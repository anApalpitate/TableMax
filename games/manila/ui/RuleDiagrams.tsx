import type { CSSProperties, ReactNode } from 'react';
import type { CargoId } from '../rules/view';
import { cargoNames } from './labels';
import { manilaAsset, Die, Worker } from './pieces';
import './rule-diagrams.css';

function Cargo({ cargo }: { cargo: CargoId }) {
  return (
    <img
      className="mn-diagram-cargo"
      src={manilaAsset(`cargo-${cargo}-v2.webp`)}
      alt={cargoNames[cargo]}
    />
  );
}
function Boat({
  cargo,
  position,
  workers = 0,
}: {
  cargo: CargoId;
  position?: number;
  workers?: number;
}) {
  return (
    <div className="mn-diagram-boat">
      <img src={manilaAsset('boat-v1.webp')} alt="载货木船" />
      <Cargo cargo={cargo} />
      {workers > 0 && (
        <div className="mn-diagram-crew">
          {Array.from({ length: workers }, (_, index) => (
            <Worker
              key={index}
              number={index + 1}
              color={index ? '#6b5291' : '#315a7f'}
              label={`示例伙伴${index + 1}`}
            />
          ))}
        </div>
      )}
      {position !== undefined && (
        <b className="mn-diagram-position">{position} 格</b>
      )}
    </div>
  );
}
function Site({
  kind,
  label,
}: {
  kind: 'insurance' | 'port' | 'shipyard' | 'pirate' | 'pilot';
  label: string;
}) {
  return (
    <div className="mn-diagram-site">
      <img src={manilaAsset(`site-${kind}-v2.webp`)} alt="" />
      <strong>{label}</strong>
    </div>
  );
}
export function VoyageDiagram() {
  const placement = (number: number, die: number) => (
    <div className="mn-diagram-pair">
      <Worker number={number} color="#315a7f" label="派遣伙伴" />
      <Die value={die} label="航行骰" />
    </div>
  );
  const steps: [ReactNode, string, string][] = [
    [
      <img src={manilaAsset('site-port-v2.webp')} alt="港务长码头" />,
      '竞拍港务长',
      '成交后付款',
    ],
    [<Boat cargo="nutmeg" />, '购股后装船', '三货起点合计9'],
    [placement(1, 1), '派遣 → 第1掷', '3人先派两轮'],
    [placement(2, 4), '派遣 → 第2掷', '13格海盗可登船'],
    [
      <img src={manilaAsset('site-pilot-v2.webp')} alt="领航员" />,
      '最后派遣 → 领航',
      '先小领航，再大领航',
    ],
    [
      <div className="mn-diagram-pair">
        <Die value={6} label="最后航行骰" />
        <img src={manilaAsset('site-insurance-v2.webp')} alt="结算保险赔付" />
      </div>,
      '第3掷 → 结算',
      '海盗、港坞、保险、行情',
    ],
  ];
  return (
    <figure className="mn-diagram" aria-label="完整航次顺序图">
      <ol className="mn-diagram-flow">
        {steps.map(([icon, title, detail], index) => (
          <li key={title}>
            <div className="mn-diagram-step" aria-hidden="true">
              {icon}
            </div>
            <div>
              <strong>
                {index + 1}. {title}
              </strong>
              <span>{detail}</span>
            </div>
          </li>
        ))}
      </ol>
      <figcaption>
        4–5人每次掷骰前派遣一轮；3人仅第1掷前派遣两轮。登船发生在第2掷后，领航发生在最后派遣后。
      </figcaption>
    </figure>
  );
}
export function SetupDiagram() {
  return (
    <figure className="mn-diagram" aria-label="三船起点合计九的示例">
      <div className="mn-diagram-three">
        {(['nutmeg', 'silk', 'jade'] as const).map((cargo, index) => (
          <div key={cargo}>
            <Boat cargo={cargo} position={[3, 2, 4][index]!} />
            <strong>{cargoNames[cargo]}</strong>
          </div>
        ))}
      </div>
      <div className="mn-diagram-equation">
        <b>3</b>
        <span>＋</span>
        <b>2</b>
        <span>＋</span>
        <b>4</b>
        <span>＝</span>
        <b>9</b>
      </div>
      <figcaption>
        每船起点0–5；选择三种不同货物。这里的起点不是骰子结果。
      </figcaption>
    </figure>
  );
}
export function CrewDiagram() {
  return (
    <figure className="mn-diagram" aria-label="船员均分及港坞岗位示例">
      <div className="mn-diagram-split">
        <div>
          <Boat cargo="nutmeg" workers={2} />
          <div className="mn-diagram-equation">
            24 ÷ 2 ＝ 每伙伴 <b>12 ₱</b>
          </div>
          <p>同船两个伙伴，均分肉豆蔻24比索分红池。</p>
        </div>
        <div>
          <div className="mn-diagram-sites">
            <Site kind="port" label="成功靠港" />
            <Site kind="shipyard" label="进入修船坞" />
          </div>
          <div className="mn-diagram-thresholds">
            {['A', 'B', 'C'].map((letter, index) => (
              <div key={letter}>
                <b>{letter}</b>
                <span>{index + 1}船起</span>
                <strong>{[6, 8, 15][index]} ₱</strong>
                <span>入驻 {[4, 3, 2][index]} ₱</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption>
        港口／修船坞按各自抵达船数触发A、B、C。船员与岸上岗位是不同投资。
      </figcaption>
    </figure>
  );
}
export function InsuranceDiagram() {
  return (
    <figure className="mn-diagram" aria-label="保险立即收入及修船赔付图">
      <div className="mn-diagram-insurance">
        <Site kind="insurance" label="保险行" />
        <div>
          <strong className="mn-diagram-gain">免费入驻即得 ＋10 ₱</strong>
          <div className="mn-diagram-payment">
            {[6, 8, 15].map((amount, index) => (
              <div key={amount}>
                <img src={manilaAsset('site-shipyard-v2.webp')} alt="" />
                <span>第{index + 1}船</span>
                <strong>−{amount} ₱</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption>
        赔付累计，三船共6＋8＋15＝29。无人的坞位也要赔；本人占有的坞位免向自己赔付。先收其他收益，再付款。
      </figcaption>
    </figure>
  );
}
export function PirateDiagram() {
  return (
    <figure className="mn-diagram" aria-label="第二与第三掷停在十三格的区别">
      <div className="mn-diagram-split">
        <div>
          <Die value={2} label="第二次航行" />
          <strong>第2掷恰停13格</strong>
          <Boat cargo="silk" position={13} />
          <div className="mn-diagram-arrow">海盗 → 空船位</div>
          <p>船长先选，再由第二海盗选择；可以留在海盗船等待。</p>
        </div>
        <div>
          <Die value={3} label="第三次航行" />
          <strong>第3掷恰停13格</strong>
          <div className="mn-diagram-sites">
            <Site kind="pirate" label="海盗取代原船员" />
            <Cargo cargo="silk" />
          </div>
          <div className="mn-diagram-arrow">掠夺分红 → 港口／修船坞</div>
          <p>海盗均分整船分红，由船长决定送船去向；没有海盗则直接靠港。</p>
        </div>
      </div>
      <figcaption>
        13格仍在海上；超过13直接靠港。不要把第二掷登船与第三掷掠夺混为一次行动。
      </figcaption>
    </figure>
  );
}
export function PilotDiagram() {
  return (
    <figure className="mn-diagram" aria-label="领航额度与十三格示例">
      <div className="mn-diagram-insurance">
        <Site kind="pilot" label="领航员" />
        <div>
          <div className="mn-diagram-pilot">
            {[-2, -1, 0, 1, 2].map((delta) => (
              <span
                key={delta}
                style={{ '--pilot-active': delta ? 0 : 1 } as CSSProperties}
              >
                {delta > 0 ? '+' : ''}
                {delta}
              </span>
            ))}
          </div>
          <p>
            <strong>小领航：</strong>一船±1；<strong>大领航：</strong>
            一船±2或两船各±1。
          </p>
          <div className="mn-diagram-arrow">
            12 → 13：仍在海上 ｜ 13 → 14：靠港
          </div>
        </div>
      </div>
      <figcaption>
        可少用或放弃额度，不能退至0之前。领航到13不触发海盗；小领航先于大领航。
      </figcaption>
    </figure>
  );
}
export function LoanDiagram() {
  return (
    <figure className="mn-diagram" aria-label="抵押和赎回资金流向">
      <div className="mn-diagram-credit">
        <div>
          <span className="mn-diagram-share">▣</span>
          <strong>本人选一张股份</strong>
        </div>
        <span className="mn-diagram-arrow">抵押 →</span>
        <div>
          <b className="mn-diagram-gain">＋12 ₱</b>
          <span>货物身份不公开</span>
        </div>
        <span className="mn-diagram-arrow">赎回 →</span>
        <div>
          <b>支付15 ₱</b>
          <span>该股份公开</span>
        </div>
      </div>
      <figcaption>
        未赎回仍计股份市值，终局每张再扣15。需要付款时由本人选择抵押品，不自动替选。
      </figcaption>
    </figure>
  );
}
