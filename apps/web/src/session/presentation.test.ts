import { describe, expect, it, vi } from 'vitest';
import type { RoomView } from '@tablemax/protocol';
const lookup = vi.hoisted(() => vi.fn());
vi.mock('../game-clients/registry', () => ({ getGameClient: lookup }));
import { changedGameSlots, gameMotionDuration } from './presentation';

describe('saved presentation variant dispatch', () => {
  it('uses the expansion client for both changes and lifetime', () => {
    const releaseRef = 'a'.repeat(64);
    const savedChanges = vi.fn(() => ['event:37', 'seat:4']);
    lookup.mockImplementation((id, variant, release) =>
      id === 'pokemon-encounters' &&
      variant === 'expansion' &&
      release === releaseRef
        ? { savedChanges, motionDuration: () => 7300 }
        : { savedChanges: () => ['original'], motionDuration: 1200 },
    );
    const before = { gameView: { revision: 1 } } as unknown as RoomView;
    const after = {
      game: { id: 'pokemon-encounters', variantId: 'expansion', releaseRef },
      gameView: { revision: 2 },
    } as unknown as RoomView;
    expect(changedGameSlots(before, after)).toEqual(['event:37', 'seat:4']);
    expect(savedChanges).toHaveBeenCalledWith(before.gameView, after.gameView);
    expect(gameMotionDuration(after)).toBe(7300);
    expect(lookup).toHaveBeenLastCalledWith(
      'pokemon-encounters',
      'expansion',
      releaseRef,
    );
  });
  it('keeps original and game-free fallbacks', () => {
    lookup.mockImplementation(() => ({
      savedChanges: () => ['original'],
      motionDuration: 1200,
    }));
    const original = {
      game: { id: 'pokemon-encounters' },
    } as RoomView;
    expect(gameMotionDuration(original)).toBe(1200);
    expect(lookup).toHaveBeenLastCalledWith(
      'pokemon-encounters',
      undefined,
      undefined,
    );
    expect(changedGameSlots({} as RoomView, {} as RoomView)).toEqual([]);
    expect(gameMotionDuration({} as RoomView)).toBe(1200);
  });
});
