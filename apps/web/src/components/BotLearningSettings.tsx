import { useId } from 'react';
import { SettingHelp } from '@tablemax/web-host';
import type { RoomSession } from '../session/useRoomSession';

export function BotLearningSettings({ session }: { session: RoomSession }) {
  const captureId = useId();
  const trainingId = useId();
  const learning = session.view?.botLearning;
  if (!session.isHost || session.role !== 'host' || !learning) return null;
  const disabled = session.locked || session.awaitingConfirmation;
  return (
    <>
      <div className="display-settings-choice">
        <SettingHelp
          id={captureId}
          label="人机样本采集"
          hint="UNO 决策样本只保存在本机。关闭后停止新增采集，正常存档继续。"
        />
        <select
          aria-labelledby={captureId}
          disabled={disabled}
          value={
            learning.capture === null
              ? 'default'
              : learning.capture
                ? 'on'
                : 'off'
          }
          onChange={(event) => {
            const value = event.target.value;
            session.command({
              type: 'set-bot-learning',
              options: {
                capture: value === 'default' ? null : value === 'on',
                training: learning.training,
              },
            });
          }}
        >
          <option value="default">
            按程序默认（{learning.defaultCapture ? '开启' : '关闭'}）
          </option>
          <option value="on">开启</option>
          <option value="off">关闭</option>
        </select>
      </div>
      {learning.captureState === 'quota' && (
        <p role="status">本机采集已达容量上限</p>
      )}
      {learning.captureState === 'unavailable' && (
        <p role="status">本机采集文件暂不可用</p>
      )}
      <div className="display-settings-choice">
        <SettingHelp
          id={trainingId}
          label="空闲训练偏好"
          hint="为本机训练保留启用偏好。学习模型仍需通过独立验收才可用于新局。"
        />
        <button
          type="button"
          className="secondary"
          role="switch"
          aria-checked={learning.training}
          aria-labelledby={trainingId}
          disabled={disabled}
          onClick={() =>
            session.command({
              type: 'set-bot-learning',
              options: {
                capture: learning.capture,
                training: !learning.training,
              },
            })
          }
        >
          <span
            className={`settings-switch${learning.training ? ' settings-switch--on' : ''}`}
            aria-hidden="true"
          />
          {learning.training ? '已开启' : '已关闭'}
        </button>
      </div>
    </>
  );
}
