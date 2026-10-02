// src/engine/live/diagnostics/cTransitionDiagnostic.ts
//
// DIAGNOSTIC ONLY — production davranışına dokunmaz.
//
// C-transition: owner null -> owner.
// Sözleşme:
//   C2 boundary -> set-piece (corner / throw_in / goal_kick) : high
//   C4 kickoff                                             : high
//   C3 direct action (somut tackle/foul lifecycle)         : high
//   C1 loose-ball resolver koşulları T-1 ile uyumlu         : medium
//   C5 açıklanamayan                                        : unknown
//
// Event'lerde tick yoktur. Tick-local event'ler events.length delta ile
// elde edilir. Minute hiçbir sınıflandırmada kullanılmaz.
// RNG delta yalnızca yardımcı rapor bilgisidir.
//
// onTick tick'in sonunda çağrılır. Set-piece ready -> taker control ->
// played -> setPiece=null aynı tick içinde gerçekleşebilir. Bu nedenle
// restart C geçişinde T-1 setPiece lifecycle'ı kullanılır.

import type {
  LiveMatchState,
  SetPieceState,
  TackleOutcome,
} from '../../types';

export const C1_MAX_BALL_SPEED = 1.5;
export const C1_MAX_DISTANCE = 0.6;
export const DEFAULT_MAX_TICKS = 12_000;

export type CClass =
  | 'C1_loose_ball_resolver'
  | 'C2_boundary_set_piece'
  | 'C3_direct_action_resolution'
  | 'C4_kickoff'
  | 'C5_unexplained';

export type Confidence = 'high' | 'medium' | 'unknown';

export interface TickSnapshot {
  tick: number;
  time: number;
  ownerId: string | null;
  ballX: number;
  ballY: number;
  ballSpeed: number;
  isMoving: boolean;
  lastTouchId: string | null;
  lastTouchClubId: string | null;
  setPieceType: SetPieceState['type'] | null;
  setPieceStatus: SetPieceState['status'] | null;
  eventsLength: number;
  foulsHome: number;
  foulsAway: number;
  counterPressTackleWins: number;
  counterPressTackleFailures: number;
  counterPressTackleFouls: number;
  counterPressRecoveries: number;
  counterPressCleanRecoveries: number;
  counterPressLooseBallRecoveries: number;
  passesHome: number;
  passesAway: number;
  rngCounter: number;
  players: Array<{
    id: string;
    clubId: string;
    x: number;
    y: number;
  }>;
}

export interface TickLocalEvent {
  type: string;
  playerId?: string;
  clubId?: string;
  description: string;
  xG?: number;
  minute: number;
}

export interface CTickRecord {
  tick: number;
  classification: CClass;
  confidence: Confidence;
  evidence: string[];
  before: TickSnapshot;
  at: TickSnapshot;
  events: TickLocalEvent[];
  rngDelta: number;
}

interface SetPieceLifecycleEvidence {
  type: SetPieceState['type'];
  startTick: number;
  events: TickLocalEvent[];
  foulDelta: number;
  tackleFoulDelta: number;
  tackleWinDelta: number;
  tackleOutcomes: TackleOutcome[];
}

export interface CReport {
  totalC: number;
  dist: Record<CClass, number>;
  conf: Record<Confidence, number>;
  rngTotal: number;
  records: readonly CTickRecord[];
}

function getBallSpeed(state: LiveMatchState): number {
  return Math.hypot(
    state.ball.velocity.x,
    state.ball.velocity.y,
  );
}

function takeSnapshot(state: LiveMatchState): TickSnapshot {
  const players: TickSnapshot['players'] = [];

  for (const id of Object.keys(state.players).sort()) {
    const player = state.players[id];

    players.push({
      id: player.player.id,
      clubId: player.clubId,
      x: player.position.x,
      y: player.position.y,
    });
  }

  return {
    tick: state.tick,
    time: state.time,
    ownerId: state.ball.ownerId,
    ballX: state.ball.position.x,
    ballY: state.ball.position.y,
    ballSpeed: getBallSpeed(state),
    isMoving: state.ball.isMoving,
    lastTouchId: state.ball.lastTouchId,
    lastTouchClubId: state.ball.lastTouchClubId,
    setPieceType: state.setPiece?.type ?? null,
    setPieceStatus: state.setPiece?.status ?? null,
    eventsLength: state.events.length,
    foulsHome: state.stats.fouls.home,
    foulsAway: state.stats.fouls.away,
    counterPressTackleWins: state.stats.counterPressTackleWins,
    counterPressTackleFailures: state.stats.counterPressTackleFailures,
    counterPressTackleFouls: state.stats.counterPressTackleFouls,
    counterPressRecoveries: state.stats.counterPressRecoveries,
    counterPressCleanRecoveries: state.stats.counterPressCleanRecoveries,
    counterPressLooseBallRecoveries:
      state.stats.counterPressLooseBallRecoveries,
    passesHome: state.stats.passes.home,
    passesAway: state.stats.passes.away,
    rngCounter: state.rng.counter,
    players,
  };
}

function sliceEvents(
  state: LiveMatchState,
  fromLength: number,
  toLength: number,
): TickLocalEvent[] {
  const events: TickLocalEvent[] = [];

  for (
    let i = fromLength;
    i < toLength && i < state.events.length;
    i += 1
  ) {
    const event = state.events[i];

    events.push({
      type: event.type,
      playerId: event.playerId,
      clubId: event.clubId,
      description: event.description,
      xG: event.xG,
      minute: event.minute,
    });
  }

  return events;
}

function distance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  return Math.hypot(ax - bx, ay - by);
}

function distanceToNewOwnerAtPreviousTick(
  previous: TickSnapshot,
  newOwnerId: string,
): number {
  const player = previous.players.find(
    candidate => candidate.id === newOwnerId,
  );

  if (!player) {
    return Number.POSITIVE_INFINITY;
  }

  return distance(
    player.x,
    player.y,
    previous.ballX,
    previous.ballY,
  );
}

function sumFouls(snapshot: TickSnapshot): number {
  return snapshot.foulsHome + snapshot.foulsAway;
}

function isBoundarySetPiece(
  type: SetPieceState['type'] | null,
): type is 'corner' | 'throw_in' | 'goal_kick' {
  return (
    type === 'corner' ||
    type === 'throw_in' ||
    type === 'goal_kick'
  );
}

function detectDirectAction(
  previous: TickSnapshot,
  current: TickSnapshot,
  events: readonly TickLocalEvent[],
  sameTickTackles: readonly TackleOutcome[],
  activeSetPiece: SetPieceLifecycleEvidence | null,
): { strong: boolean; evidence: string[]; weak: string[] } {
  const evidence: string[] = [];
  const weak: string[] = [];
  let strong = false;

  const foulDelta =
    sumFouls(current) - sumFouls(previous);

  const tackleWinsDelta =
    current.counterPressTackleWins -
    previous.counterPressTackleWins;

  const tackleFoulsDelta =
    current.counterPressTackleFouls -
    previous.counterPressTackleFouls;

  const counterPressRecoveryDelta =
    current.counterPressRecoveries -
    previous.counterPressRecoveries;

  const counterPressLooseRecoveryDelta =
    current.counterPressLooseBallRecoveries -
    previous.counterPressLooseBallRecoveries;

  if (sameTickTackles.length > 0) {
    for (const outcome of sameTickTackles) {
      if (outcome.type === 'won') {
        evidence.push(
          'tackle callback: won' +
          (outcome.newOwnerId === null
            ? ' + newOwnerId=null'
            : ' + newOwnerId=' + outcome.newOwnerId),
        );
        strong = true;
      } else if (outcome.type === 'foul') {
        evidence.push(
          'tackle callback: foul (' + outcome.severity + ')',
        );
        strong = true;
      }
    }
  }

  if (tackleWinsDelta > 0) {
    evidence.push(
      'counterPressTackleWins delta=+' + tackleWinsDelta,
    );
    strong = true;
  }

  if (tackleFoulsDelta > 0) {
    evidence.push(
      'counterPressTackleFouls delta=+' + tackleFoulsDelta,
    );
    strong = true;
  }

  if (foulDelta > 0) {
    evidence.push('fouls delta=+' + foulDelta);
    strong = true;
  }

  if (counterPressRecoveryDelta > 0) {
    evidence.push(
      'counterPressRecoveries delta=+' +
      counterPressRecoveryDelta,
    );
    strong = true;
  }

  if (counterPressLooseRecoveryDelta > 0) {
    evidence.push(
      'counterPressLooseBallRecoveries delta=+' +
      counterPressLooseRecoveryDelta,
    );
    strong = true;
  }

  if (activeSetPiece !== null && activeSetPiece.type === 'free_kick') {
    const hasFoulLifecycle =
      activeSetPiece.foulDelta > 0 ||
      activeSetPiece.tackleFoulDelta > 0 ||
      activeSetPiece.tackleOutcomes.some(
        outcome => outcome.type === 'foul',
      ) ||
      activeSetPiece.events.some(
        event => event.type === 'foul',
      );

    if (hasFoulLifecycle) {
      evidence.push(
        'free_kick lifecycle + foul/tackle-foul kanıtı',
      );
      strong = true;
    }
  }

  const intercepted = events.find(
    event =>
      event.type === 'pass' &&
      event.description.startsWith('Pas kesildi'),
  );

  if (intercepted) {
    evidence.push(
      'interception bağlamı: "Pas kesildi" event',
    );
    // Bu tek başına C3 değildir; null -> owner transition'ı
    // aynı lifecycle içinde doğrudan açıklamaz.
  }

  for (const event of events) {
    if (
      event.type === 'pass' ||
      event.type === 'dribble' ||
      event.type === 'shot' ||
      event.type === 'cross'
    ) {
      weak.push('event: ' + event.type);
    }
  }

  const passDelta =
    (current.passesHome - previous.passesHome) +
    (current.passesAway - previous.passesAway);

  if (passDelta > 0) {
    weak.push('passes delta=+' + passDelta);
  }

  if (current.counterPressTackleFailures -
      previous.counterPressTackleFailures > 0) {
    weak.push(
      'counterPressTackleFailures delta=+' +
      (current.counterPressTackleFailures -
        previous.counterPressTackleFailures),
    );
  }

  return { strong, evidence, weak };
}

function makeRecord(
  classification: CClass,
  confidence: Confidence,
  evidence: string[],
  before: TickSnapshot,
  at: TickSnapshot,
  events: TickLocalEvent[],
): CTickRecord {
  return {
    tick: at.tick,
    classification,
    confidence,
    evidence,
    before,
    at,
    events,
    rngDelta: at.rngCounter - before.rngCounter,
  };
}

function classifyC(
  before: TickSnapshot,
  at: TickSnapshot,
  events: TickLocalEvent[],
  sameTickTackles: readonly TackleOutcome[],
  activeSetPiece: SetPieceLifecycleEvidence | null,
): CTickRecord {
  const evidence: string[] = [];

  // T-1 boundary kaynaklı set-piece varsa restart C2'dir.
  if (isBoundarySetPiece(before.setPieceType)) {
    evidence.push(
      'boundary set-piece lifecycle: ' +
      before.setPieceType,
    );
    evidence.push(
      'setPiece status(T-1)=' +
      (before.setPieceStatus ?? '-'),
    );

    return makeRecord(
      'C2_boundary_set_piece',
      'high',
      evidence,
      before,
      at,
      events,
    );
  }

  // T-1 kickoff lifecycle varsa C4.
  if (before.setPieceType === 'kickoff') {
    evidence.push('kickoff set-piece lifecycle');
    evidence.push(
      'setPiece status(T-1)=' +
      (before.setPieceStatus ?? '-'),
    );

    return makeRecord(
      'C4_kickoff',
      'high',
      evidence,
      before,
      at,
      events,
    );
  }

  // Free-kick restart yalnızca foul/tackle lifecycle kanıtı varsa C3.
  // Aksi durumda C5'e bırakılır.
  if (before.setPieceType === 'free_kick') {
    const direct = detectDirectAction(
      before,
      at,
      events,
      sameTickTackles,
      activeSetPiece,
    );

    if (direct.strong) {
      evidence.push(...direct.evidence);
      return makeRecord(
        'C3_direct_action_resolution',
        'high',
        evidence,
        before,
        at,
        events,
      );
    }
  } else {
    const direct = detectDirectAction(
      before,
      at,
      events,
      sameTickTackles,
      activeSetPiece,
    );

    if (direct.strong) {
      evidence.push(...direct.evidence);
      if (direct.weak.length > 0) {
        evidence.push(
          ...direct.weak.map(item => '(bağlam) ' + item),
        );
      }

      return makeRecord(
        'C3_direct_action_resolution',
        'high',
        evidence,
        before,
        at,
        events,
      );
    }
  }

  // Loose-ball resolver uyumluluğu.
  const newOwnerId = at.ownerId;
  const dist = distanceToNewOwnerAtPreviousTick(
    before,
    newOwnerId,
  );

  const c1 =
    before.ownerId === null &&
    before.ballSpeed <= C1_MAX_BALL_SPEED &&
    dist <= C1_MAX_DISTANCE;

  if (c1) {
    evidence.push(
      'T-1 resolver koşulları uyumlu: owner=null, ' +
      'ballSpeed=' + before.ballSpeed.toFixed(3) +
      ' <= ' + C1_MAX_BALL_SPEED +
      ', dist(newOwner)=' + dist.toFixed(3) +
      ' <= ' + C1_MAX_DISTANCE,
    );

    return makeRecord(
      'C1_loose_ball_resolver',
      'medium',
      evidence,
      before,
      at,
      events,
    );
  }

  evidence.push(
    'kanıt yok: T-1 ballSpeed=' +
    before.ballSpeed.toFixed(3) +
    ', dist(newOwner)=' +
    (dist === Number.POSITIVE_INFINITY
      ? 'N/A'
      : dist.toFixed(3)),
  );

  return makeRecord(
    'C5_unexplained',
    'unknown',
    evidence,
    before,
    at,
    events,
  );
}

export class CTransitionDiagnostic {
  private initialized = false;
  private prev: TickSnapshot | null = null;
  private readonly records: CTickRecord[] = [];
  private readonly maxTicks: number;
  private stopped = false;

  private previousEventLength = 0;

  private activeSetPiece: SetPieceLifecycleEvidence | null = null;

  // runTick içindeki onTackleResolved, onTick'ten önce çalışır.
  // Outcome'lar bir sonraki onTick'te aynı tick'in evidence'ı olarak tüketilir.
  private tackleOutcomesSinceLastTick: TackleOutcome[] = [];

  constructor(maxTicks: number = DEFAULT_MAX_TICKS) {
    this.maxTicks = maxTicks;
  }

  onTackleResolved(outcome: TackleOutcome): void {
    if (this.stopped) return;
    this.tackleOutcomesSinceLastTick.push(outcome);
  }

  onTick(state: LiveMatchState): void {
    if (this.stopped) return;

    const snap = takeSnapshot(state);

    if (!this.initialized) {
      this.prev = snap;
      this.previousEventLength = state.events.length;
      this.initialized = true;

      if (state.setPiece !== null) {
        this.activeSetPiece = {
          type: state.setPiece.type,
          startTick: state.tick,
          events: [],
          foulDelta: 0,
          tackleFoulDelta: 0,
          tackleWinDelta: 0,
          tackleOutcomes: [],
        };
      }

      this.tackleOutcomesSinceLastTick = [];
      return;
    }

    const previous = this.prev;

    const events = sliceEvents(
      state,
      this.previousEventLength,
      state.events.length,
    );

    const newSetPiece =
      previous.setPieceType === null &&
      snap.setPieceType !== null;

    if (newSetPiece) {
      this.activeSetPiece = {
        type: snap.setPieceType!,
        startTick: snap.tick,
        events: [...events],
        foulDelta:
          sumFouls(snap) - sumFouls(previous),
        tackleFoulDelta:
          snap.counterPressTackleFouls -
          previous.counterPressTackleFouls,
        tackleWinDelta:
          snap.counterPressTackleWins -
          previous.counterPressTackleWins,
        tackleOutcomes: [
          ...this.tackleOutcomesSinceLastTick,
        ],
      };
    } else if (this.activeSetPiece !== null) {
      this.activeSetPiece.events.push(...events);
      this.activeSetPiece.foulDelta +=
        sumFouls(snap) - sumFouls(previous);
      this.activeSetPiece.tackleFoulDelta +=
        snap.counterPressTackleFouls -
        previous.counterPressTackleFouls;
      this.activeSetPiece.tackleWinDelta +=
        snap.counterPressTackleWins -
        previous.counterPressTackleWins;

      if (this.tackleOutcomesSinceLastTick.length > 0) {
        this.activeSetPiece.tackleOutcomes.push(
          ...this.tackleOutcomesSinceLastTick,
        );
      }
    }

    const isC =
      previous.ownerId === null &&
      snap.ownerId !== null;

    if (isC) {
      const record = classifyC(
        previous,
        snap,
        events,
        this.tackleOutcomesSinceLastTick,
        this.activeSetPiece,
      );

      this.records.push(record);

      if (previous.setPieceType !== null) {
        this.activeSetPiece = null;
      }
    }

    this.prev = snap;
    this.previousEventLength = state.events.length;
    this.tackleOutcomesSinceLastTick = [];

    if (snap.tick >= this.maxTicks) {
      this.stopped = true;
    }
  }

  getRecords(): readonly CTickRecord[] {
    return this.records;
  }

  report(): CReport {
    const dist: Record<CClass, number> = {
      C1_loose_ball_resolver: 0,
      C2_boundary_set_piece: 0,
      C3_direct_action_resolution: 0,
      C4_kickoff: 0,
      C5_unexplained: 0,
    };

    const conf: Record<Confidence, number> = {
      high: 0,
      medium: 0,
      unknown: 0,
    };

    let rngTotal = 0;

    for (const record of this.records) {
      dist[record.classification] += 1;
      conf[record.confidence] += 1;
      rngTotal += record.rngDelta;
    }

    console.log('=== C-TRANSITION DIAGNOSTIC ===');
    console.log(
      'total C transitions: ' +
      this.records.length,
    );
    console.table(dist);
    console.table(conf);
    console.log(
      'sum rngDelta (yardımcı, karar dışında): ' +
      rngTotal,
    );

    const c5 = this.records.filter(
      record => record.classification === 'C5_unexplained',
    );

    if (c5.length > 0) {
      console.log(
        '--- C5 örnekleri (ilk 50 / ' +
        c5.length +
        ') ---',
      );

      for (const record of c5.slice(0, 50)) {
        console.log(
          'tick=' + record.tick,
          'evidence=[' + record.evidence.join(' | ') + ']',
          'owner: ' + record.before.ownerId +
          ' -> ' + record.at.ownerId,
          'speed(T-1)=' +
          record.before.ballSpeed.toFixed(3),
          'setPiece(T-1->T)=' +
          (record.before.setPieceType ?? '-') +
          '->' +
          (record.at.setPieceType ?? '-'),
          'events=[' +
          record.events.map(event => event.type).join(',') +
          ']',
        );
      }
    }

    const c1 = this.records.filter(
      record => record.classification === 'C1_loose_ball_resolver',
    );

    if (c1.length > 0) {
      console.log(
        '--- C1 örnekleri (ilk 10 / ' +
        c1.length +
        ') ---',
      );

      for (const record of c1.slice(0, 10)) {
        console.log(
          'tick=' + record.tick +
          ' | ' +
          record.evidence.join(' | '),
        );
      }
    }

    const c2 = this.records.filter(
      record => record.classification === 'C2_boundary_set_piece',
    );

    if (c2.length > 0) {
      console.log(
        '--- C2 örnekleri (ilk 10 / ' +
        c2.length +
        ') ---',
      );

      for (const record of c2.slice(0, 10)) {
        console.log(
          'tick=' + record.tick +
          ' | ' +
          record.evidence.join(' | '),
        );
      }
    }

    const c3 = this.records.filter(
      record => record.classification === 'C3_direct_action_resolution',
    );

    if (c3.length > 0) {
      console.log(
        '--- C3 örnekleri (ilk 10 / ' +
        c3.length +
        ') ---',
      );

      for (const record of c3.slice(0, 10)) {
        console.log(
          'tick=' + record.tick +
          ' | ' +
          record.evidence.join(' | '),
        );
      }
    }

    return {
      totalC: this.records.length,
      dist,
      conf,
      rngTotal,
      records: this.records,
    };
  }
}
