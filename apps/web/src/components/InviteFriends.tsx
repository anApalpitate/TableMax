import { useId, useState } from 'react';
import type { RoomSession } from '../session/useRoomSession';
import { OverlayPanel } from './OverlayPanel';
import './invite-friends.css';
export function InviteFriends({ session }: { session: RoomSession }) {
  const [help, setHelp] = useState(false);
  const [draftUrl, setDraftUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const externalId = useId();
  const {
    addresses,
    adapters,
    address,
    port,
    setAddress,
    networkMessage,
    refreshNetwork,
    externalJoinUrl,
    saveExternalJoinUrl,
    isHost,
  } = session;
  const joinUrl =
    externalJoinUrl || (address ? `http://${address}:${port}` : '');
  const saveExternal = async (value: string | null) => {
    if (saving || !isHost) return;
    setSaving(true);
    setSaveMessage('');
    try {
      if (await saveExternalJoinUrl(value)) {
        if (value === null) setDraftUrl('');
        setSaveMessage(
          value === null ? '已切回局域网二维码。' : '二维码已更新。',
        );
      }
    } catch {
      setSaveMessage('外部入口保存失败，请重试。');
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="invite-friends">
      <h2>手机扫码入座</h2>
      {joinUrl ? (
        <>
          <img
            key={joinUrl}
            className="qr"
            width={196}
            height={196}
            src={
              externalJoinUrl
                ? '/api/foundation/qr?external=1'
                : `/api/foundation/qr?address=${encodeURIComponent(address)}`
            }
            alt="手机加入二维码"
          />
        </>
      ) : (
        <p className="invite-friends__empty" role="status">
          未发现可用地址，请打开连接帮助。
        </p>
      )}
      <button
        type="button"
        className="secondary"
        onClick={() => {
          setDraftUrl(externalJoinUrl ?? '');
          setSaveMessage('');
          setHelp(true);
        }}
      >
        连接帮助
      </button>
      {help && (
        <OverlayPanel title="连接帮助" close={() => setHelp(false)}>
          <div className="connection-help">
            <div className="connection-help__field">
              <label htmlFor="address">电脑地址</label>
              <div className="connection-help__address">
                <select
                  id="address"
                  value={address}
                  disabled={!isHost || !!externalJoinUrl || !addresses.length}
                  onChange={(e) => setAddress(e.target.value)}
                >
                  {!addresses.length && (
                    <option value="">未发现局域网地址</option>
                  )}
                  {addresses.map((a) => (
                    <option key={a} value={a}>
                      {adapters.find((adapter) => adapter.address === a)?.name}{' '}
                      · {a}
                      {adapters.find((adapter) => adapter.address === a)
                        ?.kind === 'virtual'
                        ? '（虚拟／VPN）'
                        : a.startsWith('169.254.')
                          ? '（未取得局域网地址）'
                          : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void refreshNetwork()}
                >
                  刷新连接地址
                </button>
              </div>
            </div>
            {joinUrl && (
              <div className="connection-help__current">
                <span>当前加入地址</span>
                <p className="connection-help__url">{joinUrl}</p>
              </div>
            )}
            {isHost && (
              <form
                className="connection-help__external"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveExternal(draftUrl.trim());
                }}
              >
                <label htmlFor={externalId}>外部入口网址</label>
                <input
                  id={externalId}
                  type="url"
                  name="external-entry"
                  inputMode="url"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={2048}
                  value={draftUrl}
                  disabled={saving}
                  placeholder="例如 https://example.com…"
                  aria-describedby={`${externalId}-hint`}
                  onChange={(event) => {
                    setDraftUrl(event.target.value);
                    setSaveMessage('');
                  }}
                />
                <p id={`${externalId}-hint`}>
                  支持 HTTP、HTTPS 网站根地址与端口，暂不支持路径前缀。
                </p>
                <div className="connection-help__external-actions">
                  <button type="submit" disabled={saving || !draftUrl.trim()}>
                    {saving ? '正在保存…' : '保存外部入口'}
                  </button>
                  {(externalJoinUrl || draftUrl) && (
                    <button
                      type="button"
                      className="secondary"
                      disabled={saving}
                      onClick={() => void saveExternal(null)}
                    >
                      使用局域网
                    </button>
                  )}
                </div>
              </form>
            )}
            {(networkMessage || saveMessage) && (
              <p className="connection-help__status" role="status">
                {networkMessage || saveMessage}
              </p>
            )}
            <details className="connection-help__troubleshooting">
              <summary>连接排查</summary>
              <div className="connection-help__steps">
                {externalJoinUrl ? (
                  <p>
                    在系统浏览器打开当前网址。外部映射需保持运行并转发网页、API
                    和实时连接；原设备使用相同网址可恢复座位。
                  </p>
                ) : (
                  <p>
                    玩家设备和主机连接同一局域网，在浏览器打开。优先选择 Wi-Fi
                    或以太网地址。原设备保留原浏览器页面，同地址重连会恢复座位。
                  </p>
                )}
                {externalJoinUrl ? (
                  <ol>
                    <li>
                      打不开网页：核对外部网址与映射端口，检查穿透软件是否正在运行。
                    </li>
                    <li>
                      页面已打开但状态不更新：检查映射是否转发 WebSocket 及
                      Socket.IO 请求。
                    </li>
                    <li>
                      无法入座：检查游戏人数与是否已开局；已有座位请使用原浏览器恢复。
                    </li>
                  </ol>
                ) : (
                  <ol>
                    <li>
                      打不开网页：核对地址，避开 VPN／虚拟网卡；手机不要使用访客
                      Wi-Fi。
                    </li>
                    <li>
                      仍连不上：在 Windows 防火墙中允许 TableMax
                      在私人网络通信，并检查路由器是否开启设备隔离。
                    </li>
                    <li>
                      网页已打开但无法入座：检查是否已选游戏、人数和是否已开局；已有座位请使用原浏览器恢复。
                    </li>
                  </ol>
                )}
              </div>
            </details>
          </div>
        </OverlayPanel>
      )}
    </section>
  );
}
