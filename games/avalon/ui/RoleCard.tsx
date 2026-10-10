import type { CSSProperties } from 'react';
import type { Role, AvalonView } from '../types';

const roleNames: Record<Role, string> = {
  merlin: '梅林',
  percival: '派西维尔',
  servant: '亚瑟的忠臣',
  morgana: '莫甘娜',
  assassin: '刺客',
  minion: '莫德雷德的爪牙',
  mordred: '莫德雷德',
  oberon: '奥伯伦',
};
const positions: Record<Role, string> = {
  merlin: '0% 0%',
  percival: '100% 0%',
  servant: '0% 50%',
  morgana: '100% 50%',
  assassin: '0% 100%',
  minion: '100% 100%',
  mordred: '100% 100%',
  oberon: '100% 100%',
};
function alignmentFor(role: Role) {
  return ['merlin', 'percival', 'servant'].includes(role) ? 'good' : 'evil';
}
export function RoleCard({
  role,
  compact = false,
}: {
  role: Role;
  compact?: boolean;
}) {
  return (
    <div
      className={`av-role-card av-role-card--${alignmentFor(role)}${compact ? ' av-role-card--compact' : ''}`}
      data-role={role}
    >
      <div
        className="av-role-portrait"
        style={{ '--role-position': positions[role] } as CSSProperties}
      />
      <div className="av-role-caption">
        <span>{alignmentFor(role) === 'good' ? '忠诚阵营' : '邪恶阵营'}</span>
        <strong>{roleNames[role]}</strong>
      </div>
    </div>
  );
}

export function PrivateKnowledge({
  self,
  names,
}: {
  self: NonNullable<AvalonView['self']>;
  names: Record<string, string>;
}) {
  const evil = self.knowledge.evilSeats;
  const candidates = self.knowledge.merlinCandidates;
  return (
    <section className="av-private-knowledge">
      <h3>仅你可见</h3>
      {self.role === 'merlin' ? (
        <p>
          你知晓邪恶势力，但要避免暴露自己。三次任务成功后，刺客仍有机会刺杀梅林。
        </p>
      ) : self.role === 'percival' ? (
        <p>
          这两人分别是梅林与莫甘娜；你无法直接分辨。保护梅林，同时观察他们的选择。
        </p>
      ) : self.alignment === 'evil' ? (
        <p>
          让三次任务失败，或连续否决五支队伍。若忠诚阵营完成三次任务，刺客可刺杀梅林逆转胜负。
        </p>
      ) : (
        <p>
          你不知道其他人的身份。通过发言、公开表决和任务结果找出可信的远征同伴。
        </p>
      )}
      {(evil.length > 0 || candidates.length > 0) && (
        <div className="av-knowledge-list">
          <strong>
            {candidates.length ? '梅林／莫甘娜候选' : '你看到的邪恶势力'}
          </strong>
          {(candidates.length ? candidates : evil).map((id) => (
            <span key={id}>{names[id] ?? '圆桌同伴'}</span>
          ))}
        </div>
      )}
      <p className="av-private-warning">
        请避开他人视线。关闭后不保留身份图像。
      </p>
    </section>
  );
}
