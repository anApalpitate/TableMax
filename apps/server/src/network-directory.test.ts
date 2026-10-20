import { it, expect, vi } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { NetworkDirectory } from './network-directory';
import type { NetworkInterfaceInfo } from 'node:os';
import { NetworkSchema } from '@tablemax/protocol';

const entry = (address: string, internal = false): NetworkInterfaceInfo => ({
  address,
  internal,
  family: 'IPv4',
  netmask: '255.255.255.0',
  mac: '00:00:00:00:00:00',
  cidr: null,
});

it.each([undefined, '0.0.0.0'])(
  'rereads changed adapters, prefers LAN and retains VPN/link-local choices when listening on %s',
  (host) => {
    let adapters = {
      'vEthernet (WSL)': [entry('172.20.0.1')],
      'Wi-Fi': [entry('192.168.1.5')],
      Loopback: [entry('127.0.0.1', true)],
      Ethernet: [entry('169.254.2.1')],
    };
    const directory = new NetworkDirectory(() => adapters, host);
    expect(directory.read().addresses).toEqual([
      '192.168.1.5',
      '172.20.0.1',
      '169.254.2.1',
    ]);
    expect(directory.read().adapters.map((a) => a.kind)).toEqual([
      'lan',
      'virtual',
      'link-local',
    ]);
    adapters = { ...adapters, 'Wi-Fi': [entry('192.168.2.7')] };
    expect(directory.read().addresses[0]).toBe('192.168.2.7');
    expect(directory.read().addresses).not.toContain('192.168.1.5');
  },
);

it.each(['127.0.0.1', '127.0.0.42'])(
  'advertises only the actual loopback listener %s without enumerating unrelated adapters',
  (host) => {
    const interfaces = vi.fn(() => ({
      'Wi-Fi': [entry('192.168.1.5')],
      Loopback: [entry('127.0.0.1', true)],
    }));
    const directory = new NetworkDirectory(interfaces, host);
    const network = directory.read();
    expect(network).toEqual({
      addresses: [host],
      adapters: [{ address: host, name: '本机', kind: 'loopback' }],
    });
    expect(interfaces).not.toHaveBeenCalled();
    expect(NetworkSchema.parse({ ...network, port: 38473 }).adapters).toEqual(
      network.adapters,
    );
  },
);

it('advertises a reachable address for a real loopback-only HTTP listener', async () => {
  const server = createServer((_request, response) => {
    response.end('loopback entry reached');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const listener = server.address() as AddressInfo;
    const directory = new NetworkDirectory(
      () => ({ 'Wi-Fi': [entry('192.168.1.5')] }),
      listener.address,
    );
    const network = directory.read();
    expect(network.addresses).toEqual([listener.address]);
    const response = await fetch(
      `http://${network.addresses[0]}:${listener.port}`,
    );
    expect(response.ok).toBe(true);
    expect(await response.text()).toBe('loopback entry reached');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
