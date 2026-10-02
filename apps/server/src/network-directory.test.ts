import { it, expect } from 'vitest';
import { NetworkDirectory } from './network-directory';
import type { NetworkInterfaceInfo } from 'node:os';
it('rereads changed adapters, prefers LAN and retains explicit VPN/link-local choices', () => {
  const entry = (address: string, internal = false): NetworkInterfaceInfo => ({
    address,
    internal,
    family: 'IPv4',
    netmask: '255.255.255.0',
    mac: '00:00:00:00:00:00',
    cidr: null,
  });
  let adapters = {
    'vEthernet (WSL)': [entry('172.20.0.1')],
    'Wi-Fi': [entry('192.168.1.5')],
    Loopback: [entry('127.0.0.1', true)],
    Ethernet: [entry('169.254.2.1')],
  };
  const directory = new NetworkDirectory(() => adapters);
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
});
