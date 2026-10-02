// src/engine/live/diagnostics/cTransitionDiagnosticV4.ts
//
// DIAGNOSTIC ONLY — v4.
//
// MUTATION TRACE birincil sınıflandırma kanıtıdır.
// Geometri yalnızca yardımcı rapor bilgisidir.
// Production dosyalarına dokunmaz.
// RNG delta hiçbir kategori kararında kullanılmaz.

import type { LiveMatchState, SetPieceState } from '../../types';

import {
  DEFAULT_MAX_TICKS,
  type TickSnapshot,
  type TickLocalEvent,
  type CTickRecord,
  type CClass,
  type Confidence,
  takeSnapshot,
  sliceEvents,
} from './cTransitionDiagnostic';

import type {
  ControlBallTrace,
  ControlBallCaller,
} from './controlBallTrace';

export { DEFAULT_MAX_TICKS };

export type {
  CClass,
  Confidence,
  TickSnapshot,
  TickLocalEvent,
  CTickRecord,
  ControlBallTrace,
  ControlBallCaller,
};

export type C5SubClass =
  | 'LIKELY_LOOSE_BALL'
  | 'UNCHANGED'
  | 'CHANGED'
  | 'LOST';

export interface CTickRecordV4 extends CTickRecord {
  controlBall: ControlBallTrace | null;
  tMinus1SetPieceType: SetPieceState['type'] | null;
  next: TickSnapshot | null;
  nextOwnerId: string | null;
  c5Sub: C5SubClass | null;
  decisionEvidence: string;
}

export interface CReportV4 {
  totalC: number;
  dist: Record<CClass, number>;
  conf: Record<Confidence, number>;
  sub: Record<C5SubClass, number>;
  callerDist: Record<ControlBallCaller, number>;
  updateSetPieceStatusByType: Record<string, number>;
  rngTotal: number;
  records: readonly CTickRecordV4[];
}

function computeSubClass(
  record: CTickRecordV4,
  nextOwnerId: string | null,
): C5SubClass {
  if (nextOwnerId === null) return 'LOST';
  if (nextOwnerId !== record.at.ownerId) return 'CHANGED';

  const previousOwner = record.before.players.find(
    player => player.id === record.at.ownerId,
  );
  const currentOwner = record.at.players.find(
    player => player.id === record.at.ownerId,
  );

  if (!previousOwner || !currentOwner) return 'UNCHANGED';

  const movement = Math.hypot(
    currentOwner.x - previousOwner.x,
    currentOwner.y - previousOwner.y,
  );
  const distance = Math.hypot(
    record.before.ballX - previousOwner.x,
    record.before.ballY - previousOwner.y,
  );

  return distance + movement <= 0.6
    ? 'LIKELY_LOOSE_BALL'
    : 'UNCHANGED';
}

function makeBaseRecord(
  before: TickSnapshot,
  at: TickSnapshot,
  events: TickLocalEvent[],
  mutation: ControlBallTrace | null,
): Omit<CTickRecordV4, 'classification' | 'confidence' | 'decisionEvidence'> {
  return {
    tick: at.tick,
    before,
    at,
    events,
    rngDelta: at.rngCounter - before.rngCounter,
    evidence: [],
    controlBall: mutation,
    tMinus1SetPieceType: before.setPieceType,
    next: null,
    nextOwnerId: null,
    c5Sub: null,
  };
}

function classifyC(
  before: TickSnapshot,
  at: TickSnapshot,
  events: TickLocalEvent[],
  mutation: ControlBallTrace | null,
): CTickRecordV4 {
  const base = makeBaseRecord(before, at, events, mutation);

  if (mutation?.caller === 'resolveLooseBallControl') {
    base.evidence.push(
      'mutation trace: controlBall(caller=resolveLooseBallControl, owner=' +
      mutation.ownerId +
      ', seq=' +
      mutation.seq +
      ')',
    );

    return {
      ...base,
      classification: 'C1_loose_ball_resolver',
      confidence: 'high',
      decisionEvidence: 'controlBall.caller=resolveLooseBallControl',
    };
  }

  if (mutation?.caller === 'updateSetPieceStatus') {
    const type = before.setPieceType;

    if (type === 'kickoff') {
      base.evidence.push(
        'mutation trace: updateSetPieceStatus + T-1 setPieceType=kickoff',
      );
      return {
        ...base,
        classification: 'C4_kickoff',
        confidence: 'high',
        decisionEvidence: 'updateSetPieceStatus + T-1 kickoff',
      };
    }

    if (
      type === 'corner' ||
      type === 'throw_in' ||
      type === 'goal_kick'
    ) {
      base.evidence.push(
        'mutation trace: updateSetPieceStatus + T-1 setPieceType=' +
        type,
      );
      return {
        ...base,
        classification: 'C2_boundary_set_piece',
        confidence: 'high',
        decisionEvidence: 'updateSetPieceStatus + T-1 ' + type,
      };
    }

    if (type === 'free_kick') {
      base.evidence.push(
        'mutation trace: updateSetPieceStatus + T-1 setPieceType=free_kick',
      );
      return {
        ...base,
        classification: 'C3_direct_action_resolution',
        confidence: 'high',
        decisionEvidence: 'updateSetPieceStatus + T-1 free_kick',
      };
    }

    base.evidence.push(
      'mutation trace: updateSetPieceStatus + T-1 setPieceType=' +
      (type ?? 'null'),
    );

    return {
      ...base,
      classification: 'C5_unexplained',
      confidence: 'unknown',
      decisionEvidence:
        'updateSetPieceStatus + T-1 setPieceType bilinmiyor',
    };
  }

  const foulsDelta =
    (at.foulsHome - before.foulsHome) +
    (at.foulsAway - before.foulsAway);

  const tackleWinsDelta =
    at.counterPressTackleWins -
    before.counterPressTackleWins;

  const tackleFoulsDelta =
    at.counterPressTackleFouls -
    before.counterPressTackleFouls;

  if (foulsDelta > 0 || tackleWinsDelta > 0 || tackleFoulsDelta > 0) {
    if (foulsDelta > 0) {
      base.evidence.push('fouls delta=+' + foulsDelta);
    }
    if (tackleWinsDelta > 0) {
      base.evidence.push(
        'counterPressTackleWins delta=+' + tackleWinsDelta,
      );
    }
    if (tackleFoulsDelta > 0) {
      base.evidence.push(
        'counterPressTackleFouls delta=+' + tackleFoulsDelta,
      );
    }

    return {
      ...base,
      classification: 'C3_direct_action_resolution',
      confidence: 'high',
      decisionEvidence: 'tackle/foul stat delta',
    };
  }

  const intercepted = events.find(
    event =>
      event.type === 'pass' &&
      event.description.startsWith('Pas kesildi'),
  );

  if (intercepted) {
    base.evidence.push('interception event: "Pas kesildi"');
    return {
      ...base,
      classification: 'C3_direct_action_resolution',
      confidence: 'high',
      decisionEvidence: 'interception event',
    };
  }

  const kickoff = events.find(event => event.type === 'kickoff');

  if (kickoff) {
    base.evidence.push('kickoff event');
    return {
      ...base,
      classification: 'C4_kickoff',
      confidence: 'high',
      decisionEvidence: 'kickoff event',
    };
  }

  base.evidence.push(
    'mutation trace yok; T-1 ballSpeed=' +
    before.ballSpeed.toFixed(3),
  );

  return {
    ...base,
    classification: 'C5_unexplained',
    confidence: 'unknown',
    decisionEvidence: 'hiçbir mutation/lifecycle kanıtı yok',
  };
}

export class CTransitionDiagnosticV4 {
  private initialized = false;
  private prev: TickSnapshot | null = null;
  private readonly records: CTickRecordV4[] = [];
  private pendingRecord: CTickRecordV4 | null = null;
  private readonly maxTicks: number;
  private stopped = false;
  private lastConsumedSeq = -1;
  private previousEventLength = 0;

  constructor(
    private readonly trace: {
      drainAfter(seq: number): readonly ControlBallTrace[];
      getLastSeq(): number;
      clear(): void;
    },
    maxTicks: number = DEFAULT_MAX_TICKS,
  ) {
    this.maxTicks = maxTicks;
  }

  onTick(state: LiveMatchState): void {
    if (this.stopped) return;

    const snap = takeSnapshot(state);
    const mutationsThisTick = this.trace.drainAfter(this.lastConsumedSeq);
    this.lastConsumedSeq = this.trace.getLastSeq();

    if (this.pendingRecord !== null) {
      this.pendingRecord.next = snap;
      this.pendingRecord.nextOwnerId = snap.ownerId;
      this.pendingRecord.c5Sub = computeSubClass(
        this.pendingRecord,
        snap.ownerId,
      );
      this.pendingRecord = null;
    }

    if (!this.initialized) {
      this.prev = snap;
      this.previousEventLength = snap.eventsLength;
      this.initialized = true;
      return;
    }

    const before = this.prev;
    const isC =
      before.ownerId === null &&
      snap.ownerId !== null;

    if (isC) {
      const events = sliceEvents(
        state,
        this.previousEventLength,
        snap.eventsLength,
      );

      const mutation =
        mutationsThisTick.find(
          call => call.ownerId === snap.ownerId,
        ) ?? null;

      const record = classifyC(
        before,
        snap,
        events,
        mutation,
      );

      this.records.push(record);
      this.pendingRecord = record;
    }

    this.prev = snap;
    this.previousEventLength = snap.eventsLength;

    if (snap.tick >= this.maxTicks) {
      this.stopped = true;
    }
  }

  getRecords(): readonly CTickRecordV4[] {
    return this.records;
  }

  report(): CReportV4 {
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

    const sub: Record<C5SubClass, number> = {
      LIKELY_LOOSE_BALL: 0,
      UNCHANGED: 0,
      CHANGED: 0,
      LOST: 0,
    };

    const callerDist: Record<ControlBallCaller, number> = {
      resolveLooseBallControl: 0,
      applyTackleWon: 0,
      updateSetPieceStatus: 0,
      handlePassAction: 0,
      kickoff: 0,
      other: 0,
      NONE: 0,
    };

    const updateSetPieceStatusByType: Record<string, number> = {};
    let rngTotal = 0;

    for (const record of this.records) {
      dist[record.classification]++;
      conf[record.confidence]++;
      rngTotal += record.rngDelta;

      if (record.c5Sub !== null) {
        sub[record.c5Sub]++;
      }

      const caller =
        record.controlBall?.caller ?? 'NONE';
      callerDist[caller]++;

      if (caller === 'updateSetPieceStatus') {
        const key =
          record.tMinus1SetPieceType ?? 'null';
        updateSetPieceStatusByType[key] =
          (updateSetPieceStatusByType[key] ?? 0) + 1;
      }
    }

    console.log('=== FINAL CLASSIFICATION (v4) ===');
    console.log('total C: ' + this.records.length);
    console.table(dist);
    console.table(conf);

    console.log(
      '=== SUBCLASS (raporlama; karar değiştirmez) ===',
    );
    console.table(sub);

    console.log('=== CALLER DISTRIBUTION (tüm C) ===');
    console.table(callerDist);

    console.log(
      '=== AGGREGATE updateSetPieceStatus × T-1 setPieceType ===',
    );
    console.table(updateSetPieceStatusByType);

    console.log(
      'sum rngDelta (yardımcı bilgi, kategori kararında KULLANILMADI): ' +
      rngTotal,
    );

    const changed = this.records.filter(
      record => record.c5Sub === 'CHANGED',
    );
    const lost = this.records.filter(
      record => record.c5Sub === 'LOST',
    );

    if (changed.length > 0) {
      console.log(
        '=== CHANGED lifecycle (' +
        changed.length +
        ') ===',
      );

      for (const record of changed) {
        console.log(
          'tick=' + record.tick +
          ' owner: ' +
          record.before.ownerId +
          ' -> ' +
          record.at.ownerId +
          ' -> ' +
          record.nextOwnerId +
          ' class=' +
          record.classification +
          ' controlBall=' +
          (record.controlBall?.caller ?? 'NONE') +
          ' events=[' +
          record.events.map(event => event.type).join(',') +
          ']',
        );
      }
    }

    if (lost.length > 0) {
      console.log(
        '=== LOST lifecycle (' +
        lost.length +
        ') ===',
      );

      for (const record of lost) {
        console.log(
          'tick=' + record.tick +
          ' owner: ' +
          record.before.ownerId +
          ' -> ' +
          record.at.ownerId +
          ' -> ' +
          record.nextOwnerId +
          ' class=' +
          record.classification +
          ' controlBall=' +
          (record.controlBall?.caller ?? 'NONE') +
          ' setPiece(T-1)=' +
          (record.tMinus1SetPieceType ?? '-') +
          ' setPiece(T+1)=' +
          (record.next?.setPieceType ?? '-'),
        );
      }
    }

    const c5 = dist.C5_unexplained;

    console.log('=== KARAR NOKTASI ===');
    console.log('C5_unexplained: ' + c5);

    if (c5 === 0) {
      console.log(
        'Tüm C geçişleri mutation/lifecycle kanıtı ile açıklandı. Production patch YOK.',
      );
    } else {
      console.log(
        'C5 > 0: kalan kayıtları T-1/T/T+1 lifecycle ile incele.',
      );
      for (
        const record of this.records
          .filter(item => item.classification === 'C5_unexplained')
          .slice(0, 30)
      ) {
        console.log(
          'tick=' + record.tick +
          ' owner: ' +
          record.before.ownerId +
          ' -> ' +
          record.at.ownerId +
          ' controlBall=' +
          (record.controlBall?.caller ?? 'NONE') +
          ' T-1 setPiece=' +
          (record.tMinus1SetPieceType ?? '-') +
          ' events=[' +
          record.events.map(event => event.type).join(',') +
          ']' +
          ' evidence=[' +
          record.evidence.join(' | ') +
          ']',
        );
      }
    }

    return {
      totalC: this.records.length,
      dist,
      conf,
      sub,
      callerDist,
      updateSetPieceStatusByType,
      rngTotal,
      records: this.records,
    };
  }
}
