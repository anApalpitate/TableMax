// Player screens run in one stable same-origin phone viewport. Assertions must
// inspect that document, while viewport changes and screenshots use its parent.
export function playerUi(page) {
  return page.frameLocator('iframe[data-player-frame]');
}

export async function playerFrame(page) {
  const iframe = page.locator('iframe[data-player-frame]');
  await iframe.waitFor();
  const frame = await (await iframe.elementHandle()).contentFrame();
  if (!frame) throw new Error('Player document is not available');
  return frame;
}
