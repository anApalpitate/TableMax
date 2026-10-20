import { networkInterfaces } from 'node:os';
import { isIPv4 } from 'node:net';
import type { NetworkSchema } from '@tablemax/protocol';

type NetworkSnapshot = Pick<
  ReturnType<typeof NetworkSchema.parse>,
  'adapters' | 'addresses'
>;

export class NetworkDirectory {
  constructor(
    private interfaces = networkInterfaces,
    private listenHost?: string,
  ) {}
  read(): NetworkSnapshot {
    if (
      this.listenHost &&
      isIPv4(this.listenHost) &&
      this.listenHost.startsWith('127.')
    )
      return {
        adapters: [
          { address: this.listenHost, name: '本机', kind: 'loopback' as const },
        ],
        addresses: [this.listenHost],
      };
    const adapters = Object.entries(this.interfaces()).flatMap(
      ([name, entries]) =>
        (entries ?? [])
          .filter((entry) => entry.family === 'IPv4' && !entry.internal)
          .map((entry) => ({
            address: entry.address,
            name,
            kind: entry.address.startsWith('169.254.')
              ? ('link-local' as const)
              : /virtual|vmware|vbox|hyper-v|vethernet|wsl|vpn|tailscale|zerotier|tap|tun|docker|loopback/i.test(
                    name,
                  )
                ? ('virtual' as const)
                : ('lan' as const),
          })),
    );
    const rank = { lan: 0, virtual: 1, 'link-local': 2 };
    adapters.sort(
      (a, b) =>
        rank[a.kind] - rank[b.kind] ||
        a.name.localeCompare(b.name) ||
        a.address.localeCompare(b.address),
    );
    return {
      adapters,
      addresses: [...new Set(adapters.map((a) => a.address))],
    };
  }
}
