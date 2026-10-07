/** Only same-origin player navigation may update the outer browser address. */
export function playerFramePath(url: URL, origin: string): string | null {
  if (url.origin !== origin || !/^\/player(?:\/game)?$/.test(url.pathname))
    return null;
  return url.pathname + url.search + url.hash;
}
