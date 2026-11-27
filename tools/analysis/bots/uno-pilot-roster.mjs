import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const experience = ['偶尔玩', '经常玩'];
export const profiles = {
  '默认／豆包': ['默认', '豆包'],
  '豆包／绝悟': ['豆包', '绝悟'],
  '绝悟／捣蛋王': ['绝悟', '捣蛋王'],
};
const botRoles = {
  默认: 'default',
  豆包: 'doubao',
  绝悟: 'juewu',
  捣蛋王: 'mischief',
};

/** @param {string | URL} path */
export function readUnoPilotRoster(path) {
  const roster = readFileSync(path);
  const rosterSha256 = createHash('sha256').update(roster).digest('hex');
  const schedule = roster
    .toString('utf8')
    .split(/\r?\n/)
    .filter((line) => line.startsWith('| UNO-'))
    .map((line) => {
      const [id, band, comparison, first, second] = line
        .slice(1, -1)
        .split('|')
        .map((part) => part.trim());
      const plays = [first, second].map((value) => {
        const seats = value.split('、');
        const focus = seats.findIndex((role) => role.startsWith('受测'));
        const roles = seats.map((role) =>
          role === '真人' ? 'human' : botRoles[role.replace(/^受测/, '')],
        );
        assert.equal(roles.length, 4);
        assert.ok(roles.every(Boolean));
        assert.equal(roles.filter((role) => role === 'human').length, 1);
        return {
          roles,
          profile:
            focus < 0
              ? seats.find((role) => role !== '真人')
              : seats[focus].slice(2),
          humanSeat: seats.indexOf('真人') + 1,
          ...(focus < 0 ? {} : { focusSeat: focus + 1 }),
        };
      });
      assert.ok(experience.includes(band));
      assert.ok(profiles[comparison]);
      assert.deepEqual(
        plays.map(({ profile }) => profile).sort(),
        [...profiles[comparison]].sort(),
      );
      return { id, band, comparison, plays };
    });
  assert.equal(schedule.length, 24);
  const allowed = new Map(schedule.map((row) => [row.id, row]));
  assert.equal(allowed.size, schedule.length);
  return { rosterSha256, schedule, allowed };
}
