// src/engine/live/diagnostics/cTransitionDiagnosticV4.ts
//
// DIAGNOSTIC ONLY — v4.
// Production dosyalarına dokunmaz.
//
// Birincil kanıt: controlBall mutation caller.
// Geometri yalnızca yardımcı rapor bilgisidir.
//
// Karar:
//   resolveLooseBallControl -> C1 / high
//   updateSetPieceStatus -> T-1 setPieceType'a göre:
//      kickoff -> C4 / high
//      corner | throw_in | goal_kick -> C2 / high
//      free_kick -> C3 / high
//      null/unknown -> C5 / unknown
//   Base diagnostic'in tackle/foul lifecycle kanıtı -> C3
//   kickoff lifecycle kanıtı -> C4
//   başka mutation kanıtı yok -> C5 / unknown
//
// C5 lifecycle alt sınıfı korunur fakat artık sınıflandırma kararında
// kullanılmaz. CHANGED/LOST kayıtları mutation caller'a göre C1/C2/C3/C4
// olarak kalır; T+1 owner bilgisi raporda tutulur.

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

export { DEFAULT_MAX_TICKS };

export type {
  CClass,
  Confidence,
  CTickRecord,
  C5SubClassification,
  ControlBallCaller,
  ControlBallTrace,
};

export interface CTickRecordV4 extends CTickRecord {
  controlBall: ControlBallTrace | null;
  finalClassification: CClass;
  finalConfidence: Confidence;
  mutationEvidence: string | null;
  setPieceSourceType: string | null;
}

export interface CReportV4 extends Omit<CReport, 'records'> {
  callerDist: Record<ControlBallCaller | 'NONE', number>;
  callerByFinalClass: Record<CClass, Record<ControlBallCaller | 'NONE', number>>;
  setPieceMutationTypes: Record<string, number>;
  records: readonly CTickRecordV4[];
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

function makeClassCallerZero(): Record<CClass, Record<ControlBallCaller | 'NONE', number>> {
  return {
    C1_loose_ball_resolver: makeCallerZero(),
    C2_boundary_set_piece: makeCallerZero(),
    C3_direct_action_resolution: makeCallerZero(),
    C4_kickoff: makeCallerZero(),
    C5_unexplained: makeCallerZero(),
  };
}

function classifyMutation(
  record: CTickRecord,
  controlBall: ControlBallTrace | null,
): {
  classification: CClass;
  confidence: Confidence;
  evidence: string | null;
  setPieceSourceType: string | null;
} {
  const caller = controlBall?.caller ?? null;

  if (caller === 'resolveLooseBallControl') {
    return {
      classification: 'C1_loose_ball_resolver',
      confidence: 'high',
      evidence: 'mutation trace: resolveLooseBallControl',
      setPieceSourceType: null,
    };
  }

  if (caller === 'updateSetPieceStatus') {
    const sourceType = record.before.setPieceType;

    if (sourceType === 'kickoff') {
      return {
        classification: 'C4_kickoff',
        confidence: 'high',
        evidence: 'mutation trace: updateSetPieceStatus; T-1 setPieceType=kickoff',
        setPieceSourceType: sourceType,
      };
    }

    if (
      sourceType === 'corner' ||
      sourceType === 'throw_in' ||
      sourceType === 'goal_kick'
    ) {
      return {
        classification: 'C2_boundary_set_piece',
        confidence: 'high',
        evidence:
          'mutation trace: updateSetPieceStatus; T-1 setPieceType=' +
          sourceType,
        setPieceSourceType: sourceType,
      };
    }

    if (sourceType === 'free_kick') {
      return {
        classification: 'C3_direct_action_resolution',
        confidence: 'high',
        evidence:
          'mutation trace: updateSetPieceStatus; T-1 setPieceType=free_kick',
        setPieceSourceType: sourceType,
      };
    }

    return {
      classification: 'C5_unexplained',
      confidence: 'unknown',
      evidence:
        'mutation trace: updateSetPieceStatus; T-1 setPieceType=' +
        (sourceType ?? 'null'),
      setPieceSourceType: sourceType,
    };
  }

  // Base diagnostic'in tackle/foul/interception/kickoff lifecycle kanıtı
  // mutation caller bulunmasa bile korunur.
  return {
    classification: record.classification,
    confidence: record.confidence,
    evidence: null,
    setPieceSourceType: null,
  };
}

export class CTransitionDiagnosticV4 {
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
    const calls = this.trace.getSince(this.lastSeenTraceSequence);
    this.lastSeenTraceSequence = this.trace.getLastSequence();

    if (calls.length > 0) {
      this.tickCalls.set(state.tick, calls);
    }

    this.base.onTick(state);
  }

  getRecords(): readonly CTickRecordV4[] {
    return this.buildRecords();
  }

  report(): CReportV4 {
    const baseReport = this.base.report();
    const records = this.buildRecords();

    const callerDist = makeCallerZero();
    const callerByFinalClass = makeClassCallerZero();
    const setPieceMutationTypes: Record<string, number> = {};

    for (const record of records) {
      const caller: ControlBallCaller | 'NONE' =
        record.controlBall?.caller ?? 'NONE';

      if (record.controlBall !== null) {
        callerDist[caller] += 1;
      } else {
        callerDist.NONE += 1;
      }

      callerByFinalClass[record.finalClassification][caller] += 1;

      if (record.controlBall?.caller === 'updateSetPieceStatus') {
        const key = record.setPieceSourceType ?? 'null';
        setPieceMutationTypes[key] =
          (setPieceMutationTypes[key] ?? 0) + 1;
      }
    }

    console.log('=== C-TRANSITION DIAGNOSTIC v4 ===');
    console.log('total C: ' + records.length);
    console.log('=== FINAL CLASSIFICATION ===');
    console.table(
      records.reduce<Record<CClass, number>>(
        (acc, record) => {
          acc[record.finalClassification] += 1;
          return acc;
        },
        {
          C1_loose_ball_resolver: 0,
          C2_boundary_set_piece: 0,
          C3_direct_action_resolution: 0,
          C4_kickoff: 0,
          C5_unexplained: 0,
        },
      ),
    );

    console.log('=== ORIGINAL BASE CLASSIFICATION ===');
    console.table(baseReport.dist);

    console.log('=== FINAL CONFIDENCE ===');
    console.table(
      records.reduce<Record<Confidence, number>>(
        (acc, record) => {
          acc[record.finalConfidence] += 1;
          return acc;
        },
        { high: 0, medium: 0, unknown: 0 },
      ),
    );

    console.log('=== C5 LIFECYCLE INFO (rapor; karar kanıtı değil) ===');
    console.table(baseReport.c5SubDist);

    console.log('=== CONTROL-BALL MUTATION TRACE ===');
    console.log('controlBall called: ' + records.filter(r => r.controlBall !== null).length);
    console.log('controlBall not called: ' + records.filter(r => r.controlBall === null).length);
    console.log('caller distribution:');
    console.table(callerDist);

    console.log('=== FINAL CLASS × CALLER ===');
    console.table(callerByFinalClass);

    console.log('=== updateSetPieceStatus × T-1 setPieceType ===');
    console.table(setPieceMutationTypes);

    const changed = records.filter(
      r => r.c5Lifecycle?.subClassification === 'C5_UNEXPLAINED_CHANGED',
    );
    const lost = records.filter(
      r => r.c5Lifecycle?.subClassification === 'C5_UNEXPLAINED_LOST',
    );

    console.log(
      '=== CHANGED/LOST lifecycle (C1/C2/C3/C4 kararından bağımsız yardımcı bilgi) ===',
    );
    console.log('CHANGED: ' + changed.length);
    console.log('LOST: ' + lost.length);

    for (const record of [...changed, ...lost]) {
      console.log(
        'tick=' + record.tick +
        ' final=' + record.finalClassification +
        ' caller=' + (record.controlBall?.caller ?? 'NONE') +
        ' owner: ' + record.before.ownerId +
        ' -> ' + record.at.ownerId +
        ' -> ' + (record.after?.ownerId ?? 'N/A') +
        ' T-1 setPiece=' + (record.before.setPieceType ?? '-') +
        ' evidence=' + (record.mutationEvidence ?? 'none'),
      );
    }

    console.log('=== GEOMETRY (yardımcı bilgi; karar kanıtı değil) ===');
    const geometryExamples = records
      .filter(r => r.controlBall?.caller === 'resolveLooseBallControl')
      .slice(0, 10);

    for (const record of geometryExamples) {
      console.log(
        'tick=' + record.tick +
        ' final=' + record.finalClassification +
        ' dist(T-1)=' +
        (record.c5Lifecycle?.tMinus1Distance.toFixed(3) ?? 'N/A') +
        ' dist(T)=' +
        (record.c5Lifecycle?.tDistance.toFixed(3) ?? 'N/A') +
        ' speed(T-1)=' +
        (record.before.ballSpeed.toFixed(3)),
      );
    }

    console.log('=== KARAR NOKTASI ===');
    const unresolved = records.filter(
      r => r.finalClassification === 'C5_unexplained',
    ).length;

    console.log('final C5: ' + unresolved);

    return {
      totalC: records.length,
      dist: records.reduce<Record<CClass, number>>(
        (acc, record) => {
          acc[record.finalClassification] += 1;
          return acc;
        },
        {
          C1_loose_ball_resolver: 0,
          C2_boundary_set_piece: 0,
          C3_direct_action_resolution: 0,
          C4_kickoff: 0,
          C5_unexplained: 0,
        },
      ),
      conf: records.reduce<Record<Confidence, number>>(
        (acc, record) => {
          acc[record.finalConfidence] += 1;
          return acc;
        },
        { high: 0, medium: 0, unknown: 0 },
      ),
      c5SubDist: baseReport.c5SubDist,
      rngTotal: baseReport.rngTotal,
      callerDist,
      callerByFinalClass,
      setPieceMutationTypes,
      records,
    };
  }

  private buildRecords(): readonly CTickRecordV4[] {
    return this.base.getRecords().map(record => {
      const calls = this.tickCalls.get(record.tick) ?? [];
      const controlBall =
        record.before.ownerId === null && record.at.ownerId !== null
          ? this.findMatchingControlBall(record, calls)
          : null;

      const mutation = classifyMutation(record, controlBall);

      return {
        ...record,
        controlBall,
        finalClassification: mutation.classification,
        finalConfidence: mutation.confidence,
        mutationEvidence: mutation.evidence,
        setPieceSourceType: mutation.setPieceSourceType,
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
