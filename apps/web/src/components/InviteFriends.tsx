import { useEffect, useId, useRef, useState } from 'react';
import type { RoomSession } from '../session/useRoomSession';
import { BoxOverlayPanel } from './BoxOverlayPanel';
import './invite-friends.css';
import { useNotifications } from './notifications/context';
import { feedbackText } from '../content/feedback';
import { SettingHelp } from '@tablemax/web-host';
import {
  composeExternalEntry,
  cycleExternalEntry,
  splitExternalEntry,
  type ExternalPrefix,
} from './external-entry';
import './settings-panel.css';
export function InviteFriends({ session }: { session: RoomSession }) {
  const notifications = useNotifications();
  const [help, setHelp] = useState(false);
  const helpOpen = useRef(false);
  const [draftUrl, setDraftUrl] = useState('');
  const [prefix, setPrefix] = useState<ExternalPrefix>('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [openMessage, setOpenMessage] = useState('');
  const externalId = useId();
  const changeHelp = (open: boolean) => {
    helpOpen.current = open;
    setHelp(open);
  };
  const saveFeedback = (message: string, kind: 'success' | 'error') => {
    if (helpOpen.current || !notifications) setSaveMessage(message);
    else notifications.show(message, kind);
  };
  useEffect(() => {
    const failed = () => {
      const message = feedbackText('network.openFailed');
      if (notifications) notifications.show(message, 'error');
      else setOpenMessage(message);
    };
    window.addEventListener('tablemax:join-open-error', failed);
    return () => window.removeEventListener('tablemax:join-open-error', failed);
  }, [notifications]);
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
  const loopbackOnly =
    !externalJoinUrl &&
    adapters.some(
      (adapter) => adapter.address === address && adapter.kind === 'loopback',
    );
  const saveExternal = async (value: string | null) => {
    if (saving || !isHost) return;
    setSaving(true);
    setSaveMessage('');
    try {
      if (await saveExternalJoinUrl(value)) {
        const next = splitExternalEntry(
          value === null ? '' : new URL(value).origin,
        );
        setPrefix(next.prefix);
        setDraftUrl(next.value);
        const message =
          value === null
            ? feedbackText('network.restoredLan')
            : feedbackText('network.qrUpdated');
        saveFeedback(message, 'success');
      } else saveFeedback(feedbackText('network.externalSaveFailed'), 'error');
    } catch {
      const message = feedbackText('network.externalSaveFailed');
      saveFeedback(message, 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="invite-friends">
      <h2>扫码或使用网址</h2>
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
            alt="玩家加入二维码"
          />
          <a
            className="button invite-friends__open"
            href={joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-tablemax-join-link=""
            aria-label="使用网址，在浏览器中加入牌桌"
            onClick={(event) => {
              setOpenMessage('');
              // Native WebView2 only accepts a trusted top-document activation
              // of this current entry. Player frames cannot grant desktop access.
              if (event.isTrusted && window === window.top)
                event.currentTarget.dataset.tablemaxJoinRequest = String(
                  Date.now(),
                );
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
            </svg>
            <span>打开网址</span>
          </a>
          {loopbackOnly && (
            <p className="invite-friends__empty" role="status">
              当前网址仅限这台电脑使用，手机无法通过此地址加入。
            </p>
          )}
          {openMessage && (
            <p className="invite-friends__empty" role="status">
              {openMessage}
            </p>
          )}
        </>
      ) : (
        <p className="invite-friends__empty" role="status">
          {feedbackText('network.noAddressHelp')}
        </p>
      )}
      {!help && saveMessage && (
        <p className="invite-friends__empty" role="status">
          {saveMessage}
        </p>
      )}
      <button
        type="button"
        className="secondary"
        onClick={() => {
          const next = splitExternalEntry(externalJoinUrl ?? '');
          setPrefix(next.prefix);
          setDraftUrl(next.value);
          setSaveMessage('');
          changeHelp(true);
        }}
      >
        连接帮助
      </button>
      {help && (
        <BoxOverlayPanel
          title="连接帮助"
          className="settings-panel settings-panel--connection"
          close={() => changeHelp(false)}
        >
          <div className="connection-help">
            <div className="connection-help__methods">
              <SettingHelp
                label="连接方式"
                hint={
                  loopbackOnly
                    ? '点击二维码下方“打开网址”，或在这台电脑的浏览器输入当前加入地址。'
                    : '用手机相机扫描二维码，或在手机、电脑浏览器打开当前加入地址。'
                }
              />
              <span>{loopbackOnly ? '仅本机' : '扫码或网址'}</span>
            </div>
            {loopbackOnly && (
              <p className="connection-help__status" role="status">
                当前网址仅限这台电脑使用，手机无法通过此地址加入。
              </p>
            )}
            <div className="connection-help__field">
              <SettingHelp
                id="connection-address-label"
                label="电脑地址"
                hint="优先选择 Wi-Fi 或以太网地址，避免访客网络、VPN或未取得局域网地址的网卡；保存外部入口时暂停选择。"
              />
              <div className="connection-help__address">
                <select
                  id="address"
                  aria-labelledby="connection-address-label"
                  value={address}
                  disabled={!isHost || !!externalJoinUrl || !addresses.length}
                  onChange={(e) => setAddress(e.target.value)}
                >
                  {!addresses.length && (
                    <option value="">未发现局域网地址</option>
                  )}
                  {addresses.map((a) => {
                    const adapter = adapters.find((item) => item.address === a);
                    return (
                      <option key={a} value={a}>
                        {adapter?.name}（{a}）
                        {adapter?.kind === 'loopback'
                          ? '（仅本机）'
                          : adapter?.kind === 'virtual'
                            ? '（虚拟／VPN）'
                            : a.startsWith('169.254.')
                              ? '（未取得局域网地址）'
                              : ''}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  className="secondary"
                  aria-label="刷新连接地址"
                  title="刷新连接地址"
                  onClick={() => void refreshNetwork()}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17" />
                  </svg>
                </button>
              </div>
            </div>
            {joinUrl && (
              <div className="connection-help__current">
                <SettingHelp
                  label="当前网址"
                  hint="二维码与“打开网址”使用此已保存地址；可选中文字复制到玩家浏览器。"
                />
                <p className="connection-help__url">{joinUrl}</p>
              </div>
            )}
            {isHost && (
              <form
                className="connection-help__external"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveExternal(composeExternalEntry(prefix, draftUrl));
                }}
              >
                <SettingHelp
                  id={`${externalId}-label`}
                  label="外部入口网址"
                  hint={`${feedbackText('network.urlHint')} 前缀按钮可循环切换无前缀、http://、https://；无前缀时输入完整网址。`}
                />
                <div className="connection-help__entry">
                  <button
                    type="button"
                    className="secondary connection-help__prefix"
                    aria-label="网址前缀"
                    aria-description={`当前${prefix || '无前缀'}，点击切换下一个前缀。`}
                    disabled={saving}
                    onClick={() => {
                      const next = cycleExternalEntry(prefix, draftUrl);
                      setPrefix(next.prefix);
                      setDraftUrl(next.value);
                      setSaveMessage('');
                    }}
                  >
                    {prefix || '无前缀'}
                  </button>
                  <input
                    id={externalId}
                    type={prefix ? 'text' : 'url'}
                    pattern={prefix ? undefined : '[Hh][Tt][Tt][Pp][Ss]?://.+'}
                    title={
                      prefix
                        ? undefined
                        : '请输入带 http:// 或 https:// 的完整网址，或点击前缀按钮选择协议。'
                    }
                    name="external-entry"
                    inputMode="url"
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={2048 - prefix.length}
                    value={draftUrl}
                    disabled={saving}
                    placeholder={
                      prefix ? 'example.com:12345' : 'https://example.com:12345'
                    }
                    aria-labelledby={`${externalId}-label`}
                    onChange={(event) => {
                      const value = event.target.value;
                      const next = splitExternalEntry(value);
                      if (prefix && next.prefix) {
                        setPrefix(next.prefix);
                        setDraftUrl(next.value);
                      } else setDraftUrl(value);
                      setSaveMessage('');
                    }}
                  />
                </div>
                <div className="connection-help__external-actions">
                  <button type="submit" disabled={saving || !draftUrl.trim()}>
                    {saving ? feedbackText('common.saving') : '保存外部入口'}
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
                ) : loopbackOnly ? (
                  <p>在这台电脑的系统浏览器打开当前网址。</p>
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
                ) : loopbackOnly ? (
                  <ol>
                    <li>
                      打不开网页：核对当前网址和端口，确认 TableMax 正在运行。
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
        </BoxOverlayPanel>
      )}
    </section>
  );
}
