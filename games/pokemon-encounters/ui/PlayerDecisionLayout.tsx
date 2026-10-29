import { Component, type ReactNode } from 'react';

/** Slots contain authorized views and callbacks; layouts never own game decisions. */
export interface PlayerDecisionLayoutProps {
  context: ReactNode;
  field: ReactNode;
  actions: ReactNode;
}

abstract class PlayerDecisionLayout extends Component<PlayerDecisionLayoutProps> {
  abstract render(): ReactNode;
}

/** Touch flow keeps sources, field and confirmation in one vertical sequence. */
export class PortraitDecisionLayout extends PlayerDecisionLayout {
  render() {
    const { context, field, actions } = this.props;
    return (
      <>
        {context}
        {field}
        {actions}
      </>
    );
  }
}

/** Desktop gives the field and the complete decision their own persistent areas. */
export class LandscapeDecisionLayout extends PlayerDecisionLayout {
  render() {
    const { context, field, actions } = this.props;
    return (
      <>
        <div className="player-field">{field}</div>
        <aside
          className="player-decision-workbench"
          aria-label="当前行动工作台"
        >
          <div className="workbench-context">{context}</div>
          <div className="workbench-actions">{actions}</div>
        </aside>
      </>
    );
  }
}
