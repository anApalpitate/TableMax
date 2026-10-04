import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SavedSoundPlayer,
  type AudioPort,
  type PlaybackCue,
} from './sound-player';
import type { SoundLane } from './presentation-state';

function cue(
  source: string,
  lane: SoundLane = 'cry',
  priority: 1 | 2 | 3 = 1,
  delayMs = 0,
): PlaybackCue {
  return { source, lane, priority, delayMs, maxLateMs: 700 };
}
function setup(now?: () => number) {
  const played: Record<SoundLane, string[]> = { effect: [], cry: [] };
  const port = (lane: SoundLane): AudioPort => {
    const audio: AudioPort = {
      src: '',
      volume: 0,
      onended: null,
      onerror: null,
      play: vi.fn(async () => {
        played[lane].push(audio.src);
      }),
      pause: vi.fn(),
      load: vi.fn(),
    };
    return audio;
  };
  const audio = { effect: port('effect'), cry: port('cry') };
  const blocked = vi.fn();
  return {
    audio,
    played,
    blocked,
    player: new SavedSoundPlayer(audio, blocked, now),
  };
}

describe('two fixed saved sound slots', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('plays the coin cry at landing while its two-second BGM continues', () => {
    const { audio, player, played } = setup();
    player.enqueueEvent('coin:1', [
      cue('entrance', 'effect', 2),
      cue('meow', 'cry', 2, 1200),
    ]);
    expect(played).toEqual({ effect: ['entrance'], cry: [] });
    vi.advanceTimersByTime(1199);
    expect(played.cry).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(played.cry).toEqual(['meow']);
    expect(audio.effect.src).toBe('entrance');
    expect(audio.effect.pause).toHaveBeenCalledTimes(1);
  });
  it('plays a reduced-motion result immediately and deduplicates the entire event', () => {
    const { player, played } = setup();
    const recipe = [cue('entrance', 'effect', 2), cue('meow', 'cry', 2)];
    player.enqueueEvent('coin:1', recipe);
    player.enqueueEvent('coin:1', recipe);
    expect(played).toEqual({ effect: ['entrance'], cry: ['meow'] });
    player.enqueueEvent('coin:2', recipe);
    expect(played.cry).toEqual(['meow', 'meow']);
  });
  it('starts every fresh draw in the same cry slot without a historical queue', () => {
    const { audio, player, played } = setup();
    for (let i = 0; i < 20; i++)
      player.enqueueEvent(`draw:${i}`, [cue(`cry:${i}`)]);
    expect(played.cry).toHaveLength(20);
    expect(audio.cry.src).toBe('cry:19');
    audio.cry.onended?.(new Event('ended'));
    expect(played.cry).toHaveLength(20);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not replace an entrance with a lower-priority mechanical sound or replay it later', () => {
    const { audio, player, played } = setup();
    player.enqueueEvent('ability:1', [cue('entrance', 'effect', 2)]);
    player.enqueueEvent('replace:2', [cue('replace', 'effect')]);
    expect(played.effect).toEqual(['entrance']);
    audio.effect.onended?.(new Event('ended'));
    expect(played.effect).toEqual(['entrance']);
    player.enqueueEvent('victory:3', [cue('winner', 'effect', 3)]);
    expect(played.effect).toEqual(['entrance', 'winner']);
  });
  it('invalidates a pending coin cry when a newer saved event arrives', () => {
    const { player, played } = setup();
    player.enqueueEvent('coin:1', [
      cue('entrance', 'effect', 2),
      cue('old-meow', 'cry', 2, 1200),
    ]);
    vi.advanceTimersByTime(100);
    player.enqueueEvent('draw:2', [cue('fresh-pikachu')]);
    vi.advanceTimersByTime(2000);
    expect(played.cry).toEqual(['fresh-pikachu']);
  });
  it('drops a late event claim and a delayed callback that passed its deadline', () => {
    let now = 1000;
    const { player, played } = setup(() => now);
    player.enqueueEvent('stale:1', [cue('stale')], 0);
    expect(played.cry).toEqual([]);
    now = 0;
    player.enqueueEvent('coin:2', [cue('late-meow', 'cry', 2, 1200)]);
    now = 2001;
    vi.advanceTimersByTime(1200);
    expect(played.cry).toEqual([]);
  });
  it('stops both slots and all delayed feedback on permission or branch invalidation', () => {
    const { audio, player, played } = setup();
    player.enqueueEvent('coin:1', [
      cue('entrance', 'effect', 2),
      cue('meow', 'cry', 2, 1200),
    ]);
    player.stop();
    vi.advanceTimersByTime(2000);
    expect(audio.effect.pause).toHaveBeenCalledTimes(2);
    expect(audio.cry.pause).toHaveBeenCalledOnce();
    expect(played.cry).toEqual([]);
    player.enqueueEvent('new-owner:2', [cue('fresh')]);
    expect(played.cry).toEqual(['fresh']);
  });
  it('drops a blocked event and silently unlocks both slots without replay', async () => {
    const { audio, player, blocked, played } = setup();
    vi.mocked(audio.effect.play).mockRejectedValueOnce(
      new Error('autoplay blocked'),
    );
    player.enqueueEvent('coin:1', [
      cue('old-entrance', 'effect', 2),
      cue('old-meow', 'cry', 2, 1200),
    ]);
    await Promise.resolve();
    expect(blocked).toHaveBeenCalledOnce();
    await player.unlock('silent-unlock');
    vi.advanceTimersByTime(2000);
    player.enqueueEvent('draw:2', [cue('fresh')]);
    expect(played).toEqual({
      effect: ['silent-unlock'],
      cry: ['silent-unlock', 'fresh'],
    });
    expect(audio.cry.volume).toBe(0.45);
    expect(audio.effect.volume).toBe(0.45);
  });
  it('ignores rejection from an interrupted cry after a newer cry started', async () => {
    const { audio, player, blocked, played } = setup();
    let reject!: (error: Error) => void;
    vi.mocked(audio.cry.play).mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    player.enqueueEvent('draw:1', [cue('old')]);
    player.enqueueEvent('draw:2', [cue('fresh')]);
    reject(new Error('interrupted'));
    await Promise.resolve();
    expect(blocked).not.toHaveBeenCalled();
    expect(played.cry).toEqual(['fresh']);
  });
  it('pauses both silent-unlock slots if one is rejected', async () => {
    const { audio, player } = setup();
    vi.mocked(audio.cry.play).mockRejectedValueOnce(new Error('blocked'));
    await expect(player.unlock('silent-unlock')).rejects.toThrow('blocked');
    expect(audio.effect.pause).toHaveBeenCalledTimes(3);
    expect(audio.cry.pause).toHaveBeenCalledTimes(2);
    expect(audio.effect.volume).toBe(0.45);
    expect(audio.cry.volume).toBe(0.45);
  });
  it('releases both sources and ignores callbacks after disposal', async () => {
    const { audio, player, blocked } = setup();
    let reject!: (error: Error) => void;
    vi.mocked(audio.effect.play).mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    player.enqueueEvent('coin:1', [
      cue('entrance', 'effect', 2),
      cue('meow', 'cry', 2, 1200),
    ]);
    player.dispose();
    reject(new Error('interrupted'));
    await Promise.resolve();
    vi.advanceTimersByTime(2000);
    expect(blocked).not.toHaveBeenCalled();
    for (const port of Object.values(audio)) {
      expect(port.src).toBe('');
      expect(port.onended).toBeNull();
      expect(port.onerror).toBeNull();
      expect(port.load).toHaveBeenCalledOnce();
    }
  });
});
