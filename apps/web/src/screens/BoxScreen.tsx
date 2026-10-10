import { moduleFor } from '../catalog';
import { useState } from 'react';
import {
  AVATAR_PRESETS,
  type AvatarId,
  type BotDifficulty,
} from '@tablemax/protocol';
import { gameCover } from '../assets/game-covers';
import { avatarFor } from '../assets/avatars';
import appIcon from '../../../../assets/platform/app-icon-180.png';
import { ScreenLink } from '../components/ScreenLink';
import { RoomManagement } from '../components/RoomManagement';
import { InviteFriends } from '../components/InviteFriends';
import { BoxFeedback } from '../components/BoxFeedback';
import { Notifications } from '../components/notifications/Notifications';
import { RoomTable } from '../components/RoomTable';
import { OverlayPanel } from '../components/OverlayPanel';
import { SeatSettings } from '../components/SeatSettings';
import { GameLibrary } from '../components/GameLibrary';
import { PlayModeControl } from '../components/PlayModeControl';
import { PlayModeBadge } from '../components/PlayModeBadge';
import { DisplaySettings } from '../components/DisplaySettings';
import { AvatarPicker } from '../components/AvatarPicker';
import { AvatarUpload } from '../components/AvatarUpload';
import { GameIntroduction } from '../components/GameIntroduction';
import { CountdownSettings } from '../components/CountdownSettings';
import { BeginnerGuidanceSetting } from '../components/BeginnerGuidanceSetting';
import { LobbyReadiness } from '../components/LobbyReadiness';
import { BotInformation } from '../components/BotInformation';
import { PokemonVersion } from '../components/PokemonVersion';
import type { RoomSession } from '../session/useRoomSession';
import { useDeviceTransfer } from '../session/useDeviceTransfer';
import { DeviceTransfer } from '../components/DeviceTransfer';
import { RepositoryLink } from '../components/RepositoryLink';
import { feedbackText } from '../content/feedback';
import { navigate } from '../navigation';
import './box-refinements.css';

const difficultyNames: Record<BotDifficulty, string> = {
  default: '默认',
  doubao: '豆包',
  juewu: '绝悟',
};
type BoxPanel =
  | 'intro'
  | 'seats'
  | 'management'
  | 'library'
  | 'bot-info'
  | 'avatars'
  | 'transfer'
  | null;

export function BoxScreen({ session }: { session: RoomSession }) {
  return (
    <Notifications>
      <BoxScreenContent session={session} />
    </Notifications>
  );
}

function BoxScreenContent({ session }: { session: RoomSession }) {
  const [difficulty, setDifficulty] = useState<BotDifficulty>('default');
  const [panel, setPanel] = useState<BoxPanel>(null);
  const [draftAvatar, setDraftAvatar] = useState<AvatarId | null>(null);
  const [draftImage, setDraftImage] = useState<string | null>(null);
  const {
    role,
    view,
    self,
    isHost,
    canControl,
    canManageSeats,
    locked,
    command,
    name,
    setName,
    credential,
    busy,
    join,
    connected,
  } = session;
  const game = view?.game;
  const transfer = useDeviceTransfer(
    role === 'player' && !credential,
    (token) => {
      session.setPlayerCredential(token);
      if (view?.gameView) navigate('/player/game');
    },
  );
  const cover = gameCover(game?.id);
  const owner = view?.seats.find((seat) => seat.id === view.ownerSeatId);
  const lobby = view?.status === 'lobby';
  const chosenAvatar =
    self?.avatarId ??
    session.admissionAvatarId ??
    draftAvatar ??
    AVATAR_PRESETS.find(
      (avatar) => !view?.seats.some((seat) => seat.avatarId === avatar.id),
    )?.id ??
    null;
  const avatarAvailable = Boolean(
    draftImage ||
    session.admissionAvatarImage ||
    (chosenAvatar &&
      (chosenAvatar.startsWith('custom-') ||
        !view?.seats.some(
          (seat) => seat.avatarId === chosenAvatar && seat.id !== self?.id,
        ))),
  );
  const avatarLocked =
    locked || session.admissionPending || view?.status === 'playing';
  const everyoneReady = Boolean(
    view?.seats.length && view.seats.every((seat) => seat.ready),
  );
  const roomStatus = !view
    ? '正在同步牌桌'
    : lobby
      ? view.joinOpen
        ? '开放入座'
        : '已关闭入座'
      : view.status === 'ended'
        ? '对局已结束'
        : view.paused || view.botError
          ? '对局已暂停'
          : '对局进行中';
  return (
    <main
      className={`shell box-screen ${role}`}
      data-play-mode={view?.playMode ?? 'play'}
    >
      <header>
        <span className="brand">
          <img className="brand-mark" src={appIcon} alt="" />
          TableMax
        </span>
        <div className="header-status">
          {(isHost || moduleFor(game?.id)?.guidance) && (
            <CountdownSettings session={session}>
              {moduleFor(game?.id)?.guidance && (
                <BeginnerGuidanceSetting gameId={game!.id} />
              )}
            </CountdownSettings>
          )}
          <DisplaySettings role={role} />
          <PlayModeBadge mode={view?.playMode} />
          {session.messageKind === 'saved' && (
            <span className="box-save-status" role="status">
              {feedbackText('session.saved')}
            </span>
          )}
          <span
            className={`connection ${connected ? 'online' : ''}`}
            role="status"
          >
            {connected ? '已连接' : '正在连接'}
          </span>
        </div>
      </header>
      <section className="hero">
        {cover && game && <img src={cover} alt={`${game.name}游戏封面`} />}
        <div className="box-game-title">
          <h1>{game?.name ?? '选个游戏，朋友们上桌'}</h1>
        </div>
        {moduleFor(game?.id)?.versions && <PokemonVersion session={session} />}
        {isHost && game && (
          <button
            type="button"
            className="secondary"
            disabled={locked}
            onClick={() => setPanel('library')}
          >
            切换游戏
          </button>
        )}
        {game && (
          <button
            type="button"
            className="secondary box-info-control"
            aria-label="游戏介绍"
            title="游戏介绍"
            onClick={() => setPanel('intro')}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path d="M12 11v6" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="7" r="1" fill="currentColor" />
            </svg>
            <span>玩法</span>
          </button>
        )}
      </section>
      {!game && <GameLibrary session={session} />}
      <BoxFeedback session={session} />
      {game && canControl && (
        <div className="box-table-actions">
          <RoomManagement session={session} display="actions" />
          {canManageSeats && (
            <button
              type="button"
              className="secondary"
              disabled={locked || !view?.seats.length}
              onClick={() => setPanel('seats')}
            >
              座位设置
            </button>
          )}
          {isHost && (
            <button
              type="button"
              className="secondary"
              onClick={() => setPanel('management')}
            >
              管理设置
            </button>
          )}
        </div>
      )}
      {Boolean(view?.gameView) && view && (role !== 'player' || credential) && (
        <div className="continue-game">
          <div>
            <h2>
              {view.status === 'ended'
                ? '查看对局结果'
                : view.paused || view.botError
                  ? '对局已暂停'
                  : '对局进行中'}
            </h2>
          </div>
          <ScreenLink className="button" href={`/${role}/game`}>
            进入牌桌
          </ScreenLink>
        </div>
      )}
      <div className="grid">
        <section className="card stage">
          <div className="room-heading">
            <div className="room-heading__identity">
              <div className="room-heading__title">
                <h2>聚会牌桌</h2>
                <span
                  className="room-capacity"
                  aria-label={`已入座 ${view?.seats.length ?? 0} 人，最多 ${view?.game?.max ?? 6} 人`}
                >
                  {view?.seats.length ?? 0} / {view?.game?.max ?? 6}
                </span>
              </div>
              {owner && (
                <p className="owner-badge">
                  <span>房主</span>
                  <strong>{owner.name}</strong>
                </p>
              )}
            </div>
            <div className="room-heading__actions">
              <span className="room-status">{roomStatus}</span>
            </div>
          </div>
          <div className="box-player-dock">
            {self && game && (
              <div className="player-actions">
                <button
                  type="button"
                  className="profile-avatar secondary"
                  aria-label="更换头像"
                  disabled={avatarLocked}
                  onClick={() => setPanel('avatars')}
                >
                  <img src={avatarFor(self.avatarId)} alt="" />
                  <span>更换头像</span>
                </button>
                <div className="player-profile">
                  <strong title={self.name}>{self.name}</strong>
                  <span>
                    {view!.seats.findIndex((seat) => seat.id === self.id) + 1}{' '}
                    号位
                  </span>
                </div>
                {lobby && (
                  <button
                    disabled={locked}
                    onClick={() =>
                      command({ type: 'ready', ready: !self.ready })
                    }
                  >
                    {self.ready ? '取消准备' : '我准备好了'}
                  </button>
                )}
              </div>
            )}
            {role === 'player' && !credential && game && (
              <form
                className="join-table"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (
                    !locked &&
                    !transfer.pending &&
                    name.trim() &&
                    avatarAvailable
                  )
                    void join(
                      draftImage ? undefined : (chosenAvatar ?? undefined),
                      draftImage ?? undefined,
                    );
                }}
              >
                <h2>加入牌桌</h2>
                <div className="join-table__profile">
                  <button
                    type="button"
                    className="profile-avatar secondary"
                    aria-label="选择头像"
                    disabled={avatarLocked}
                    onClick={() => setPanel('avatars')}
                  >
                    {draftImage || session.admissionAvatarImage ? (
                      <img
                        src={`data:image/png;base64,${session.admissionAvatarImage ?? draftImage}`}
                        alt=""
                      />
                    ) : (
                      chosenAvatar && (
                        <img src={avatarFor(chosenAvatar)} alt="" />
                      )
                    )}
                    <span>选择头像</span>
                  </button>
                  <div className="join-table__fields">
                    <label htmlFor="nickname">你的昵称</label>
                    <div className="join-table__row">
                      <input
                        id="nickname"
                        name="nickname"
                        autoComplete="nickname"
                        spellCheck={false}
                        placeholder="朋友们怎么称呼你？"
                        value={name}
                        maxLength={24}
                        disabled={busy || session.admissionPending}
                        onChange={(event) => setName(event.target.value)}
                      />
                      <button
                        disabled={
                          locked ||
                          session.admissionPending ||
                          transfer.pending ||
                          !name.trim() ||
                          !avatarAvailable
                        }
                      >
                        加入
                      </button>
                    </div>
                  </div>
                </div>
                {!avatarAvailable && (
                  <p role="status" className="avatar-unavailable">
                    {feedbackText('avatar.unavailableDraft')}
                  </p>
                )}
              </form>
            )}
            {role === 'player' &&
              !credential &&
              view?.seats.some((seat) => seat.controller === 'human') && (
                <button
                  type="button"
                  className="secondary box-transfer-entry"
                  disabled={session.admissionPending || transfer.busy}
                  onClick={() => setPanel('transfer')}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect
                      x="4"
                      y="2"
                      width="10"
                      height="20"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M9 18h1m7-11 4 4-4 4m4-4h-9"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>
                    {transfer.pending ? '查看换机申请' : '换手机进入'}
                  </span>
                </button>
              )}
            {canControl && lobby && view && game && (
              <div className="host-lobby">
                <div className="lobby-toolbar">
                  {isHost && (
                    <div className="bot-invite">
                      <div>
                        <label htmlFor="bot-difficulty">人机等级</label>
                        <select
                          id="bot-difficulty"
                          value={difficulty}
                          disabled={locked}
                          onChange={(event) =>
                            setDifficulty(event.target.value as BotDifficulty)
                          }
                        >
                          {Object.entries(difficultyNames).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                        <button
                          type="button"
                          className="secondary bot-info-control"
                          aria-label="人机等级说明"
                          title="人机等级说明"
                          onClick={() => setPanel('bot-info')}
                        >
                          ⓘ
                        </button>
                      </div>
                      <button
                        className="secondary"
                        disabled={locked || view.seats.length >= game.max}
                        onClick={() => {
                          const prefix =
                            difficulty === 'default'
                              ? '人机'
                              : difficultyNames[difficulty];
                          let number = 1;
                          while (
                            view.seats.some(
                              (seat) => seat.name === `${prefix}${number}`,
                            )
                          )
                            number++;
                          command({
                            type: 'add-bot',
                            name: `${prefix}${number}`,
                            difficulty,
                          });
                        }}
                      >
                        添加人机
                      </button>
                    </div>
                  )}
                  <div className="lobby-start">
                    <LobbyReadiness seats={view.seats} minimum={game.min} />
                    <button
                      disabled={
                        locked || view.seats.length < game.min || !everyoneReady
                      }
                      onClick={() => command({ type: 'start' })}
                    >
                      开始游戏
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <RoomTable
            seats={view?.seats ?? []}
            capacity={view?.game?.max ?? 6}
            selfId={self?.id ?? null}
            lobby={lobby}
            status={roomStatus}
            everyoneReady={everyoneReady}
          />
        </section>
        {role !== 'player' && (
          <aside className="card controls">
            <InviteFriends session={session} />
            {role === 'host' && !isHost && (
              <p className="box-identity-notice" role="status">
                {feedbackText('common.hostIdentityMissing')}
              </p>
            )}
          </aside>
        )}
      </div>
      {panel === 'library' && isHost && (
        <OverlayPanel
          title="游戏库"
          className="game-library-panel"
          close={() => setPanel(null)}
        >
          <GameLibrary
            session={session}
            close={() => setPanel(null)}
            openSeats={() => setPanel('seats')}
          />
        </OverlayPanel>
      )}
      <PlayModeControl session={session} />
      {panel === 'transfer' && role === 'player' && !credential && (
        <OverlayPanel title="换手机进入" close={() => setPanel(null)}>
          <DeviceTransfer session={session} transfer={transfer} />
        </OverlayPanel>
      )}
      {panel === 'intro' && game && (
        <OverlayPanel title="游戏介绍" close={() => setPanel(null)}>
          <GameIntroduction game={game} />
        </OverlayPanel>
      )}
      {panel === 'avatars' && role === 'player' && (
        <OverlayPanel title="选择头像" close={() => setPanel(null)}>
          {session.awaitingConfirmation && (
            <button
              className="secondary"
              disabled={!connected}
              onClick={session.retry}
            >
              重试确认
            </button>
          )}
          <AvatarUpload
            disabled={avatarLocked}
            onConfirm={(image) => {
              if (self) session.uploadAvatar(image);
              else {
                setDraftImage(image);
                setPanel(null);
              }
            }}
          />
          <AvatarPicker
            seats={view?.seats ?? []}
            selfId={self?.id ?? null}
            selectedId={!self && draftImage ? null : chosenAvatar}
            disabled={avatarLocked}
            message=""
            onSelect={(avatarId) => {
              if (self) {
                if (avatarId !== self.avatarId)
                  command({ type: 'set-avatar', avatarId });
              } else {
                setDraftImage(null);
                setDraftAvatar(avatarId);
                setPanel(null);
              }
            }}
          />
        </OverlayPanel>
      )}
      {panel === 'seats' && canManageSeats && (
        <OverlayPanel title="座位设置" close={() => setPanel(null)}>
          <SeatSettings session={session} />
        </OverlayPanel>
      )}
      {panel === 'management' && isHost && (
        <OverlayPanel title="管理设置" close={() => setPanel(null)}>
          <RoomManagement session={session} display="details" />
        </OverlayPanel>
      )}
      {panel === 'bot-info' && isHost && game && (
        <OverlayPanel title="人机等级说明" close={() => setPanel(null)}>
          <BotInformation game={game} />
        </OverlayPanel>
      )}
      <RepositoryLink />
    </main>
  );
}
