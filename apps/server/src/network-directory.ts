import { networkInterfaces } from 'node:os';

export class NetworkDirectory {
  constructor(private interfaces = networkInterfaces) {}
  read() {
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
