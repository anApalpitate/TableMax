import type { RoomSession } from '../session/useRoomSession';
export function InviteFriends({ session }: { session: RoomSession }) {
  const { addresses, address, setAddress, port } = session;
  return (
    <section className="invite-friends">
      {' '}
      <h2>邀请朋友</h2>
      <label htmlFor="address">电脑地址</label>
      <select
        id="address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      >
        {addresses.map((a) => (
          <option key={a}>{a}</option>
        ))}
      </select>
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
        <p>
          手机和电脑连接同一局域网；选择手机能访问的网卡地址，在系统浏览器打开。请检查私人网络防火墙、访客网络和设备隔离；地址改变后重新扫码。
        </p>
      </details>
    </section>
  );
}
