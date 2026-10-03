import { describe, expect, it, vi } from 'vitest';
import { SavedSoundPlayer, type AudioPort } from './sound-player';

function setup() {
  const played: string[] = [];
  const audio: AudioPort = {
    src: '',
    volume: 0,
    onended: null,
    onerror: null,
    play: vi.fn(async () => {
      played.push(audio.src);
    }),
    pause: vi.fn(),
    load: vi.fn(),
  };
  const blocked = vi.fn();
  return {
    audio,
    played,
    blocked,
    player: new SavedSoundPlayer(audio, blocked),
  };
}
describe('bounded saved sound playback', () => {
  it('reuses one player and limits a fast burst to six waiting cues', () => {
    const { audio, player, played } = setup();
    player.enqueue(['first']);
    player.enqueue(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    for (let i = 0; i < 8; i++) audio.onended?.(new Event('ended'));
    expect(played).toEqual(['first', 'c', 'd', 'e', 'f', 'g', 'h']);
  });
  it('stops and drops pending sounds immediately on losing ownership', () => {
    const { audio, player, played } = setup();
    player.enqueue(['one', 'two']);
    player.stop();
    audio.onended?.(new Event('ended'));
    expect(audio.pause).toHaveBeenCalled();
    expect(played).toEqual(['one']);
    player.enqueue(['new-owner-event']);
    expect(played).toEqual(['one', 'new-owner-event']);
  });
  it('drops a blocked queue instead of replaying old events after unlocking', async () => {
    const { audio, player, blocked, played } = setup();
    vi.mocked(audio.play).mockRejectedValueOnce(new Error('autoplay blocked'));
    player.enqueue(['old-event', 'old-followup']);
    await Promise.resolve();
    expect(blocked).toHaveBeenCalledOnce();
    await player.unlock('silent-unlock');
    player.enqueue(['fresh']);
    expect(played).toEqual(['silent-unlock', 'fresh']);
  });
  it('releases the source and ignores a stale rejected play when disposed', async () => {
    const { audio, player, blocked } = setup();
    let reject!: (error: Error) => void;
    vi.mocked(audio.play).mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    player.enqueue(['one']);
    player.dispose();
    reject(new Error('interrupted'));
    await Promise.resolve();
    expect(blocked).not.toHaveBeenCalled();
    expect(audio.src).toBe('');
    expect(audio.onended).toBeNull();
    expect(audio.load).toHaveBeenCalledOnce();
  });
});
