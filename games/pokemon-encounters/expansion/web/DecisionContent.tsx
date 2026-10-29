import type { ReactNode } from 'react';
import type { RulesProfile } from '../research';
import type { PlayerDecisionProps } from './player-decision-contract';
import { ResearchPicture } from './ResearchCard';
import { phaseText } from './view-model';

/** Device-specific content, sharing authorized decisions but owning no draft or command. */
abstract class DecisionContent {
  abstract heading(props: PlayerDecisionProps): ReactNode;
  abstract sourceFace(card: ReactNode, detail: ReactNode): ReactNode;
  abstract researchPicture(id: string, profile: RulesProfile): ReactNode;
}

class PortraitDecisionContent extends DecisionContent {
  heading() {
    return null;
  }
  sourceFace(card: ReactNode) {
    // Mobile card labels are already on the card; do not mount desktop-only summaries.
    return <div className="ex-source-face">{card}</div>;
  }
  researchPicture() {
    return null;
  }
}

class LandscapeDecisionContent extends DecisionContent {
  heading({ game, session, decision }: PlayerDecisionProps) {
    const { names, self, actorAvatar } = decision;
    return (
      <header className="desktop-action-heading">
        <span>
          <span className="desktop-actor">
            <img className="desktop-actor-avatar" src={actorAvatar} alt="" />
            {names[game.actorSeat ?? self] ?? session.self?.name}
          </span>
          <span>第 {game.roundNumber} 小局</span>
        </span>
        <h2>{phaseText[game.phase]}</h2>
      </header>
    );
  }
  sourceFace(card: ReactNode, detail: ReactNode) {
    return (
      <div className="ex-source-face">
        {card}
        {detail}
      </div>
    );
  }
  researchPicture(id: string, profile: RulesProfile) {
    return <ResearchPicture id={id} profile={profile} />;
  }
}

export const portraitDecisionContent: DecisionContent =
  new PortraitDecisionContent();
export const landscapeDecisionContent: DecisionContent =
  new LandscapeDecisionContent();
