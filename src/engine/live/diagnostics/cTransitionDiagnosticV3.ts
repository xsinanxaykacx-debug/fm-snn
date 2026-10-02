// src/engine/live/diagnostics/cTransitionDiagnosticV3.ts
//
// DIAGNOSTIC ONLY — v3.
// Production davranışına dokunmaz.
//
// v2 C-transition sınıflandırmasını aynen kullanır.
// v3 yalnızca test scope'unda controlBall mutation trace'i ile
// mevcut C kayıtlarını zenginleştirir.
//
// ÖNEMLİ:
//   controlBall trace tick numarasına güvenmez.
//   onTick sonunda geldiği için her onTick'te bir önceki onTick'ten beri
//   oluşan controlBall çağrıları o tick'e bağlanır.
//   Böylece onTick/controlBall sırası için yapay +1/-1 offset kullanılmaz.

import type { LiveMatchState, TackleOutcome } from '../../types';

import {
  CTransitionDiagnostic,
  DEFAULT_MAX_TICKS,
  type CClass,
  type CReport,
  type Confidence,
  type CTickRecord,
  type C5SubClassification,
} from './cTransitionDiagnostic';

import {
  traceBuffer as defaultTraceBuffer,
  type ControlBallCaller,
  type ControlBallTrace,
  ControlBallTraceBuffer,
} from './controlBallTrace';

export type {
  CClass,
  Confidence,
  CTickRecord,
  C5SubClassification,
  ControlBallCaller,
  ControlBallTrace,
};

export interface CTickRecordV3 extends CTickRecord {
  controlBall: ControlBallTrace | null;
}

export interface CReportV3 extends Omit<CReport, 'records'> {
  callerDist: Record<ControlBallCaller | 'NONE', number>;
  callerBySub: Record<
    C5SubClassification,
    Record<ControlBallCaller | 'NONE', number>
  >;
  records: readonly CTickRecordV3[];
}

function makeCallerZero(): Record<ControlBallCaller | 'NONE', number> {
  return {
    resolveLooseBallControl: 0,
    applyTackleWon: 0,
    updateSetPieceStatus: 0,
    handlePassAction: 0,
    kickoff: 0,
    other: 0,
    NONE: 0,
  };
}

export class CTransitionDiagnosticV3 {
  private readonly base: CTransitionDiagnostic;
  private readonly trace: ControlBallTraceBuffer;
  private readonly tickCalls = new Map<number, readonly ControlBallTrace[]>();
  private lastSeenTraceSequence = -1;

  constructor(
    trace: ControlBallTraceBuffer = defaultTraceBuffer,
    maxTicks: number = DEFAULT_MAX_TICKS,
  ) {
    this.trace = trace;
    this.base = new CTransitionDiagnostic(maxTicks);
  }

  onTackleResolved(outcome: TackleOutcome): void {
    this.base.onTackleResolved(outcome);
  }

  onTick(state: LiveMatchState): void {
    // runTick içindeki bütün controlBall çağrıları onTick'ten önce gelir.
    // Bu nedenle burada yeni trace kayıtlarının tamamı current tick'e aittir.
    const calls = this.trace.getSince(this.lastSeenTraceSequence);
    this.lastSeenTraceSequence = this.trace.getLastSequence();

    if (calls.length > 0) {
      this.tickCalls.set(state.tick, calls);
    }

    this.base.onTick(state);
  }

  getRecords(): readonly CTickRecordV3[] {
    return this.buildRecords();
  }

  report(): CReportV3 {
    const baseReport = this.base.report();
    const records = this.buildRecords();

    const callerDist = makeCallerZero();

    const callerBySub: Record<
      C5SubClassification,
      Record<ControlBallCaller | 'NONE', number>
    > = {
      LIKELY_LOOSE_BALL: makeCallerZero(),
      C5_UNEXPLAINED_UNCHANGED: makeCallerZero(),
      C5_UNEXPLAINED_CHANGED: makeCallerZero(),
      C5_UNEXPLAINED_LOST: makeCallerZero(),
    };

    for (const record of records) {
      if (record.classification !== 'C5_unexplained') continue;

      const caller = record.controlBall?.caller ?? 'NONE';
      callerDist[caller] += 1;

      const sub = record.c5Lifecycle?.subClassification;
      if (sub !== undefined) {
        callerBySub[sub][caller] += 1;
      }
    }

    console.log('=== C-TRANSITION DIAGNOSTIC v3 ===');
    console.log('total C: ' + records.length);
    console.table(baseReport.dist);
    console.table(baseReport.conf);

    console.log('=== C5 SUBCLASS DISTRIBUTION ===');
    console.table(baseReport.c5SubDist);

    const c5Total = baseReport.dist.C5_unexplained;
    const c5WithControlBall = records.filter(
      record =>
        record.classification === 'C5_unexplained' &&
        record.controlBall !== null,
    ).length;

    console.log('=== C5 CONTROL-BALL MUTATION TRACE ===');
    console.log('C5 total: ' + c5Total);
    console.log('controlBall called: ' + c5WithControlBall);
    console.log('controlBall not called: ' + (c5Total - c5WithControlBall));
    console.log('caller distribution (C5):');
    console.table(callerDist);

    console.log('=== C5 SUBCLASS × CALLER ===');
    console.table(callerBySub);

    const lost = records.filter(
      record =>
        record.c5Lifecycle?.subClassification ===
        'C5_UNEXPLAINED_LOST',
    );

    const changed = records.filter(
      record =>
        record.c5Lifecycle?.subClassification ===
        'C5_UNEXPLAINED_CHANGED',
    );

    if (lost.length > 0) {
      console.log('=== LOST örnekleri (' + lost.length + ') ===');
      for (const record of lost) {
        console.log(
          'tick=' + record.tick +
          ' owner: ' + record.before.ownerId +
          ' -> ' + record.at.ownerId +
          ' -> ' + (record.after?.ownerId ?? 'N/A') +
          ' controlBall=' + (record.controlBall?.caller ?? 'NONE') +
          ' controlBallOwner=' + (record.controlBall?.ownerId ?? 'N/A') +
          ' setPiece(T)=' + (record.at.setPieceType ?? '-') +
          ' setPiece(T+1)=' + (record.after?.setPieceType ?? '-') +
          ' events=[' +
          record.events.map(event => event.type).join(',') +
          ']' +
          ' evidence=[' + record.evidence.join(' | ') + ']',
        );
      }
    }

    if (changed.length > 0) {
      console.log('=== CHANGED örnekleri (' + changed.length + ') ===');
      for (const record of changed) {
        console.log(
          'tick=' + record.tick +
          ' owner: ' + record.before.ownerId +
          ' -> ' + record.at.ownerId +
          ' -> ' + (record.after?.ownerId ?? 'N/A') +
          ' controlBall=' + (record.controlBall?.caller ?? 'NONE') +
          ' controlBallOwner=' + (record.controlBall?.ownerId ?? 'N/A') +
          ' setPiece(T)=' + (record.at.setPieceType ?? '-') +
          ' setPiece(T+1)=' + (record.after?.setPieceType ?? '-') +
          ' events=[' +
          record.events.map(event => event.type).join(',') +
          ']',
        );
      }
    }

    const unchanged = records.filter(
      record =>
        record.c5Lifecycle?.subClassification ===
        'C5_UNEXPLAINED_UNCHANGED',
    );

    if (unchanged.length > 0) {
      console.log(
        '=== UNCHANGED örnekleri (ilk 10 / ' +
        unchanged.length +
        ') ===',
      );

      for (const record of unchanged.slice(0, 10)) {
        console.log(
          'tick=' + record.tick +
          ' owner: ' + record.before.ownerId +
          ' -> ' + record.at.ownerId +
          ' controlBall=' +
          (record.controlBall?.caller ?? 'NONE') +
          ' controlBallOwner=' +
          (record.controlBall?.ownerId ?? 'N/A') +
          ' dist(T)=' +
          (
            record.c5Lifecycle?.tDistance.toFixed(3) ?? 'N/A'
          ),
        );
      }
    }

    console.log('=== KARAR NOKTASI ===');

    const unchangedTotal =
      baseReport.c5SubDist.C5_UNEXPLAINED_UNCHANGED;

    const unchangedResolved =
      callerBySub.C5_UNEXPLAINED_UNCHANGED.resolveLooseBallControl;

    const unchangedOther =
      callerBySub.C5_UNEXPLAINED_UNCHANGED.other +
      callerBySub.C5_UNEXPLAINED_UNCHANGED.NONE;

    if (
      unchangedTotal > 0 &&
      unchangedResolved / unchangedTotal > 0.9
    ) {
      console.log(
        'UNCHANGED\'in %' +
        Math.round((unchangedResolved / unchangedTotal) * 100) +
        '\'i resolveLooseBallControl → C5 UNCHANGED = ' +
        'diagnostic\'in C1\'i kaçırması',
      );
    } else if (unchangedOther > 0) {
      console.log(
        'UNCHANGED içinde ' +
        unchangedOther +
        ' adet other/NONE var → incele',
      );
    } else {
      console.log(
        'UNCHANGED resolveLooseBallControl ağırlığı %90 eşiğine ulaşmadı.',
      );
    }

    return {
      ...baseReport,
      records,
      callerDist,
      callerBySub,
    };
  }

  private buildRecords(): readonly CTickRecordV3[] {
    return this.base.getRecords().map(record => {
      const calls = this.tickCalls.get(record.tick) ?? [];

      const controlBall =
        record.classification === 'C5_unexplained'
          ? this.findMatchingControlBall(record, calls)
          : null;

      return {
        ...record,
        controlBall,
      };
    });
  }

  private findMatchingControlBall(
    record: CTickRecord,
    calls: readonly ControlBallTrace[],
  ): ControlBallTrace | null {
    const ownerId = record.at.ownerId;

    if (ownerId === null) return null;

    for (let i = calls.length - 1; i >= 0; i -= 1) {
      if (calls[i].ownerId === ownerId) {
        return calls[i];
      }
    }

    return null;
  }
}
