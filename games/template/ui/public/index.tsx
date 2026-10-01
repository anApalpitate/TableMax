import type { TemplateView } from '../view';
import die from '../../assets/die.svg';
export function SeatResult({
  view,
  seatId,
}: {
  view: TemplateView | null;
  seatId: string;
}) {
  return (
    <>
      <img src={die} width="40" height="40" alt="" />
      <span className="tag">
        {view?.choices[seatId] ? `已选 +${view.choices[seatId]}` : '等待选择'}
      </span>
      {view?.results && (
        <p>
          骰子 {view.results[seatId]} · 总分{' '}
          {view.results[seatId]! + (view.choices[seatId] ?? 0)}
          {view.winners.includes(seatId) ? ' · 获胜' : ''}
        </p>
      )}
    </>
  );
}
export function GameHelp() {
  return (
    <p>
      每位玩家仅看到自己的秘密骰子，轮到时选择 +1、+2 或
      +3。全部完成后公开骰子，总分最高者获胜。这是用于开发与恢复验证的最小游戏模板。
    </p>
  );
}
