import { describe, expect, it, vi } from 'vitest';
import { ModernArtSoundPlayer, type ModernArtAudioPort } from './sound-player';

function setup() {
  const played: { source: string; volume: number }[] = [];
  const audio: ModernArtAudioPort = {
    src: '',
    volume: 0,
    onended: null,
    onerror: null,
    play: vi.fn(async () => {
      played.push({ source: audio.src, volume: audio.volume });
    }),
    pause: vi.fn(),
    load: vi.fn(),
  };
  const blocked = vi.fn();
  return {
    audio,
    played,
    blocked,
    player: new ModernArtSoundPlayer(audio, blocked),
  };
}

describe('Modern Art authorized short sound player', () => {
  it('uses one decoder and retains at most three recent waiting auction sounds', () => {
    const { player, audio, played } = setup();
    player.enqueue('first');
    for (const source of ['a', 'b', 'c', 'd', 'e']) player.enqueue(source);
    for (let index = 0; index < 6; index++) audio.onended?.(new Event('ended'));
    expect(played.map((item) => item.source)).toEqual(['first', 'c', 'd', 'e']);
    expect(played.every((item) => item.volume === 0.45)).toBe(true);
  });
  it('immediately stops and clears waiting sounds when muted or ownership is lost', () => {
    const { player, audio, played } = setup();
    player.enqueue('one');
    player.enqueue('two');
    player.stop();
    audio.onended?.(new Event('ended'));
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(played.map((item) => item.source)).toEqual(['one']);
    player.enqueue('newly-saved');
    expect(played.map((item) => item.source)).toEqual(['one', 'newly-saved']);
  });
  it('drops autoplay-blocked backlog and silently unlocks without replaying it', async () => {
    const { player, audio, played, blocked } = setup();
    vi.mocked(audio.play).mockRejectedValueOnce(new Error('Autoplay denied'));
    player.enqueue('old');
    player.enqueue('old-followup');
    await Promise.resolve();
    expect(blocked).toHaveBeenCalledOnce();
    expect(await player.unlock('gesture')).toBe(true);
    expect(played).toEqual([{ source: 'gesture', volume: 0 }]);
    player.enqueue('fresh');
    expect(played.at(-1)).toEqual({ source: 'fresh', volume: 0.45 });
  });
  it('does not accept a late unlock after permissions were removed', async () => {
    const { player, audio, played } = setup();
    let resolve!: () => void;
    vi.mocked(audio.play).mockReturnValueOnce(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const unlocked = player.unlock('gesture');
    player.enqueue('waiting');
    player.stop();
    resolve();
    expect(await unlocked).toBe(false);
    expect(audio.volume).toBe(0.45);
    expect(played).toEqual([]);
  });
  it('ignores a rejected obsolete play after the next cue has begun', async () => {
    const { player, audio, blocked, played } = setup();
    let reject!: (reason: Error) => void;
    vi.mocked(audio.play).mockReturnValueOnce(
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
    );
    player.enqueue('broken');
    player.enqueue('next');
    audio.onerror?.(new Event('error'));
    reject(new Error('Old source failed'));
    await Promise.resolve();
    expect(blocked).not.toHaveBeenCalled();
    expect(played.map((item) => item.source)).toEqual(['next']);
  });
  it('releases decoder handlers and ignores obsolete promises after disposal', async () => {
    const { player, audio, blocked, played } = setup();
    let reject!: (reason: Error) => void;
    vi.mocked(audio.play).mockReturnValueOnce(
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
    );
    player.enqueue('old');
    player.dispose();
    reject(new Error('Disposed'));
    await Promise.resolve();
    player.enqueue('ignored');
    expect(blocked).not.toHaveBeenCalled();
    expect(played).toEqual([]);
    expect(audio.src).toBe('');
    expect(audio.onended).toBeNull();
    expect(audio.onerror).toBeNull();
    expect(audio.load).toHaveBeenCalledOnce();
  });
});
