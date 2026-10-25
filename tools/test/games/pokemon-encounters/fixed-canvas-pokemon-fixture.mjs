// Internal generated-browser-fixture source, selected before imports/builds.
export function pokemonSavedFixtureCode() {
  return `const installPokemonSavedFixture=${installPokemonSavedFixture.toString()};`;
}

function installPokemonSavedFixture({
  item,
  fixture,
  session,
  client,
  render,
}) {
  const transactions = fixture.savedTransactions;
  if (!Array.isArray(transactions) || transactions.length !== 4)
    throw new Error('Expected four subscribed legal saved transactions');
  const equal = (left, right) => {
    const stable = (value) =>
      Array.isArray(value)
        ? value.map(stable)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.keys(value)
                .sort()
                .map((key) => [key, stable(value[key])]),
            )
          : value;
    return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
  };
  let current = session;
  let next = 0;
  let timer;
  let deadline = 0;
  let lastDelivery;
  const authority = (view) => ({
    instanceId: view.instanceId,
    branch: view.branch,
    revision: view.revision,
    status: view.status,
    paused: view.paused,
    self: view.self,
    capabilities: view.capabilities,
    decisionId: view.decisionId,
    selectionToken: view.selectionToken,
    game: view.game,
    gameView: view.gameView,
    actions: view.actions,
  });
  if (item.eventRole === 'host-board') {
    if (
      item.role !== 'host' ||
      item.variant !== 'expansion' ||
      item.playerFrame !== false ||
      item.fixtureInitialProjection !== 'savedTransactions[2].before.host'
    )
      throw new Error(
        'Host board proof requires its explicit initial projection',
      );
    const transaction = transactions[2];
    if (transaction.index !== 2 || transaction.uiOwned !== false)
      throw new Error(
        'Host board proof requires the real observer transaction',
      );
    for (const projections of [transaction.before, transaction.after]) {
      const host = projections.host;
      if (
        !host ||
        host.self.role !== 'host' ||
        host.self.seatId !== null ||
        host.actions.length !== 0 ||
        host.gameView.peek !== null ||
        !projections.anonymous ||
        !equal(host.gameView, projections.anonymous.gameView)
      )
        throw new Error(
          'Host board projections must remain public and seatless',
        );
    }
    const view = transaction.before.host;
    // The caller renders this same session object only after installation.
    // Choose its exact captured authority before the first React mount, never
    // mount charizard and then replace it with an inferred/synthetic sync.
    session.view = view;
    session.isHost = view.self.role === 'host';
    session.canControl = view.capabilities.control;
    session.canManageSeats = view.capabilities.manageSeats;
    session.self = view.seats.find((seat) => seat.id === view.self.seatId);
    current = session;
    next = 2;
    window.fixtureSession = session;
  }
  const state = {
    accepted: [],
    observerDeliveries: [],
    repeats: 0,
    disabled: [],
    errors: [],
    expired: true,
  };
  const publish = (patch) => {
    current = { ...current, ...patch };
    window.fixtureSession = current;
    render(current);
  };
  const requireNext = (index, uiOwned) => {
    const tx = transactions[index];
    if (
      !tx ||
      next !== index ||
      tx.uiOwned !== uiOwned ||
      !equal(authority(current.view), authority(tx.before[item.role]))
    )
      throw new Error(
        'Saved delivery is not the exact next authorized transaction',
      );
    return tx;
  };
  const deliver = (tx, disabled = false) => {
    clearTimeout(timer);
    const before = tx.before[item.role],
      view = tx.after[item.role];
    const motion = client.savedChanges?.(before.gameView, view.gameView) ?? [];
    if (!motion.length)
      throw new Error('Real client.savedChanges produced no saved motion');
    if (
      !tx.feedback ||
      tx.feedback.revision !== view.revision ||
      tx.feedback.instanceId !== view.instanceId ||
      tx.feedback.branch !== view.branch
    )
      throw new Error(
        'Subscribed feedback is not bound to the delivered authority',
      );
    lastDelivery = { tx, view, motion, feedback: tx.feedback };
    next++;
    const duration =
      typeof client.motionDuration === 'function'
        ? client.motionDuration(view.gameView)
        : (client.motionDuration ?? 1200);
    deadline = performance.now() + duration;
    state.expired = false;
    // Original transport-level receipt suppression is outside this direct host
    // harness. Disabled original delivery follows the real session boundary:
    // authoritative sync without presentation. Expansion receives the real
    // feedback/motion while disconnected to exercise its own seen/cancel gate.
    publish({
      view,
      self: view.seats.find((seat) => seat.id === view.self.seatId),
      connected: !disabled,
      feedback:
        disabled && item.variant === 'pokemon-encounters' ? null : tx.feedback,
      motion: disabled && item.variant === 'pokemon-encounters' ? [] : motion,
    });
    timer = setTimeout(() => {
      state.expired = true;
      publish({ motion: [] });
    }, duration);
    return { revision: view.revision, motion, duration, deadline };
  };
  const command = (intent) => {
    window.fixtureCommands.push(intent);
    try {
      const tx = requireNext(next, true);
      if (
        !equal(intent, tx.intent) ||
        !current.view.actions.some((action) => equal(action, intent.action))
      )
        throw new Error(
          'The canonical production UI intent is not the exact legal saved command',
        );
      state.accepted.push({ index: next, intent });
      // Publish after React finishes the actual event handler. No state or
      // feedback is inferred from this browser command; both were captured
      // from the real RoomCoordinator preparation transaction.
      queueMicrotask(() => deliver(tx));
    } catch (error) {
      state.errors.push(String(error));
      throw error;
    }
  };
  session.command = command;
  current = session;
  window.pokemonEventControl = {
    transactions,
    get status() {
      return {
        ...state,
        next,
        deadline,
        now: performance.now(),
        lastIndex: lastDelivery?.tx.index ?? null,
      };
    },
    observer(index) {
      const tx = requireNext(index, false);
      state.observerDeliveries.push(index);
      return deliver(tx);
    },
    repeat() {
      if (!lastDelivery)
        throw new Error('No delivered feedback can be repeated');
      state.repeats++;
      // Preserve actual object references and current timer/motion state.
      // This is a duplicate presentation delivery, not a fake receipt filter.
      publish({
        view: lastDelivery.view,
        feedback: current.feedback,
        motion: current.motion,
      });
      return this.status;
    },
    disabled(index) {
      const tx = requireNext(index, false);
      state.disabled.push(index);
      return deliver(tx, true);
    },
    restore() {
      publish({
        connected: true,
        feedback: current.feedback,
        motion: current.motion,
      });
      return this.status;
    },
    async expire() {
      const remaining = Math.max(0, deadline - performance.now());
      await new Promise((done) => setTimeout(done, remaining + 40));
      if (!state.expired)
        throw new Error('The real client motion timer has not expired');
      return this.status;
    },
  };
}

export function pokemonGuidanceFixtureCode() {
  return `const installPokemonGuidanceFixture=${installPokemonGuidanceFixture.toString()};`;
}

function installPokemonGuidanceFixture({ session, render, readGuidance }) {
  let current = session;
  window.fixtureRetryCalls = 0;
  window.fixtureReadGuidance = (action) => {
    if (
      !session.view.actions.some(
        (candidate) => JSON.stringify(candidate) === JSON.stringify(action),
      )
    )
      throw new Error(
        'Guidance expectation requires an actual authorized legal selection',
      );
    return readGuidance(action);
  };
  const retry = () => {
    window.fixtureRetryCalls++;
  };
  session.retry = retry;
  window.pokemonGuidanceControl = {
    publish(patch) {
      const permitted = [
        'locked',
        'busy',
        'awaitingConfirmation',
        'message',
        'messageKind',
      ];
      if (Object.keys(patch).some((key) => !permitted.includes(key)))
        throw new Error(
          'Guidance presentation cannot replace authoritative view or permissions',
        );
      current = { ...current, ...patch, retry };
      window.fixtureSession = current;
      render(current);
    },
  };
}
