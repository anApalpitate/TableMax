import type { RoomSession } from '../session/useRoomSession';
export function InviteFriends({ session }: { session: RoomSession }) {
  const {
    addresses,
    adapters,
    address,
    setAddress,
    port,
    networkMessage,
    refreshNetwork,
  } = session;
  return (
    <section className="invite-friends">
      {' '}
      <h2>手机扫码入座</h2>
      {address ? (
        <>
          <img
            className="qr"
            src={`/api/foundation/qr?address=${encodeURIComponent(address)}`}
            alt="手机加入二维码"
          />
          <p className="url">
            http://{address}:{port}/player
          </p>
        </>
      ) : (
        <p>未发现局域网地址，请检查网络。</p>
      )}
      <details>
        <summary>连接帮助</summary>
        <label htmlFor="address">电脑地址</label>
        <select
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        >
          {addresses.map((a) => (
            <option key={a} value={a}>
              {adapters.find((adapter) => adapter.address === a)?.name} · {a}
              {adapters.find((adapter) => adapter.address === a)?.kind ===
              'virtual'
                ? '（虚拟／VPN）'
                : a.startsWith('169.254.')
                  ? '（未取得局域网地址）'
                  : ''}
            </option>
          ))}
        </select>
        <button className="secondary" onClick={() => void refreshNetwork()}>
          刷新连接地址
        </button>
        {networkMessage && <p role="status">{networkMessage}</p>}
        <p>
          手机和电脑连接同一局域网，在系统浏览器打开。优先选择 Wi-Fi
          或以太网地址；地址变更后重新扫码，原座位可由房主换绑。
        </p>
        <ol>
          <li>
            打不开网页：核对地址，避开 VPN／虚拟网卡；手机不要使用访客 Wi-Fi。
          </li>
          <li>
            仍连不上：在 Windows 防火墙中允许 TableMax
            在私人网络通信，并检查路由器是否开启设备隔离。
          </li>
          <li>
            网页已打开但无法入座：检查人数、是否已开局及是否有旧座位；已有座位请用原浏览器或房主换绑。
          </li>
        </ol>
      </details>
    </section>
  );
}
