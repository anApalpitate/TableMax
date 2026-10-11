import {
  ScreenLink,
  SessionFeedback,
  RoomManagement,
  type GameClient,
} from '@tablemax/web-host';
export const client: GameClient = {
  savedChanges: () => [],
  motionDuration: 0,
  Screen({ session }) {
    const game = session.view?.gameView as { total: number } | null;
    return (
      <main className="shell">
        <ScreenLink href={`/${session.role}`}>‹ 盒子</ScreenLink>
        <h1>独立作者示例</h1>
        <SessionFeedback session={session} />
        <p>合计：{game?.total ?? 0}</p>
        {session.view?.actions.map((action, index) => (
          <button
            key={index}
            disabled={session.locked}
            onClick={() => {
              if (session.view?.decisionId)
                session.command({
                  type: 'game',
                  decisionId: session.view.decisionId,
                  action,
                });
            }}
          >
            加 {(action as { value: number }).value}
          </button>
        ))}
        <RoomManagement session={session} />
      </main>
    );
  },
};
