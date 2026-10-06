import { describe, expect, it } from 'vitest';
import {
  poseSequences,
  poseFrameCount,
  samplePose,
  keyProgress,
} from './timeline';

describe('authored layered pose timelines', () => {
  it('covers the approved fourteen sequences and sixty-three distinct articulated states', () => {
    expect(Object.keys(poseSequences)).toHaveLength(14);
    expect(poseFrameCount).toBe(63);
    expect(
      Object.values(poseSequences).filter((entry) => entry.fullscreen),
    ).toHaveLength(9);
    for (const entry of Object.values(poseSequences)) {
      expect(entry.poses.length).toBe(entry.poseNames.length);
      expect(new Set(entry.poseNames).size).toBe(entry.poses.length);
      expect(
        new Set(entry.poses.map((joints) => JSON.stringify(joints))).size,
      ).toBe(entry.poses.length);
      for (let index = 1; index < entry.poses.length; index++) {
        const prior = entry.poses[index - 1]!;
        const next = entry.poses[index]!;
        // Body position alone cannot qualify as a new authored key pose.
        expect(
          Object.keys(next).filter(
            (key) =>
              key !== 'lift' &&
              next[key as keyof typeof next] !==
                prior[key as keyof typeof prior],
          ).length,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });
  it('preserves the approved durations and separate local timelines', () => {
    expect(poseSequences['team-rocket']!.durationMs).toBe(1800);
    expect(poseSequences.zapdos!.durationMs).toBe(1500);
    expect(poseSequences.greninja!.poseNames).toHaveLength(6);
    expect(poseSequences.ditto!.poseNames.at(-1)).toBe('round-return');
    expect(poseSequences.charizard!.fullscreen).toBe(false);
  });
  it('lands exactly on every authored key pose without frame-skipping by rounding', () => {
    for (const entry of Object.values(poseSequences)) {
      entry.poses.forEach((joints, index) => {
        const sample = samplePose(
          entry.creatureId,
          keyProgress(index, entry.poses.length),
        )!;
        expect(sample.index).toBe(index);
        expect(sample.poseName).toBe(entry.poseNames[index]);
        expect(sample.joints).toEqual(joints);
      });
    }
  });
  it('smoothly interpolates joints and bounds invalid clock progress', () => {
    const start = samplePose('mewtwo', 0)!;
    const middle = samplePose('mewtwo', keyProgress(1, 5) / 2)!;
    const second = samplePose('mewtwo', keyProgress(1, 5))!;
    expect(middle.joints.leftArm).toBe(
      (start.joints.leftArm + second.joints.leftArm) / 2,
    );
    expect(samplePose('mewtwo', -1)!.joints).toEqual(start.joints);
    expect(samplePose('mewtwo', 2)!.index).toBe(4);
    expect(samplePose('mewtwo', 0.85)!.index).toBe(4);
    expect(samplePose('mewtwo', 0.99)!.joints).toEqual(
      samplePose('mewtwo', 0.85)!.joints,
    );
    expect(samplePose('mewtwo', Number.NaN)!.joints).toEqual(start.joints);
    expect(samplePose('unknown', 0.5)).toBeNull();
  });
});
