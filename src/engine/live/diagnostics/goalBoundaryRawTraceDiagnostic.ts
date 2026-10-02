// src/engine/live/diagnostics/goalBoundaryRawTraceDiagnostic.ts
//
// Goal Boundary Raw Trace V6
// ==========================
//
// Tek bir goal (configurable) için boundaryTick ± pencere
// arasındaki HER tick'in ham snapshot'ını kaydeder.
//
// Filtre YOK. Değişim tespiti YOK. Her tick basılır.
//
// KONTRAT:
//   - Production'a DOKUNMAZ.
//   - detectBoundaryOutcome spy'ının input/result'ını birebir raporlar.
//   - Map<tick, snapshot> kullanılır.

import type { LiveMatchState, MatchEvent } from '../../types';
import type { BoundaryOutcome, DetectEventInput } from '../events';

interface PlayerPos {
  x: number;
  y: number;
  clubId: string;
}

interface TickSnapshotV6 {
  tick: number;
  ballX: number;
  ballY: number;
  ballZ: number;
  ballVx: number;
  ballVy: number;
  ballVz: number;
  ballIsMoving: boolean;
  ownerId: string | null;
  ownerPos: PlayerPos | null;
  ownerDistToBall: number | null;
  lastTouchId: string | null;
  lastTouchPos: PlayerPos | null;
  lastTouchDistToBall: number | null;
  setPieceType: string | null;
  setPieceStatus: string | null;
  setPieceTakerId: string | null;
  eventsLength: number;
  newEvents: MatchEvent[];
}

export interface RawTraceReport {
  targetGoalIndex: number;
  boundaryTick: number | null;
  lookback: number;
  lookahead: number;
  boundaryInput: DetectEventInput | null;
  boundaryResult: BoundaryOutcome | null;
  window: TickSnapshotV6[];
}

export class GoalBoundaryRawTraceDiagnostic {
  private snapshots = new Map<number, TickSnapshotV6>();
  private tickLog: Array<{ tick: number; boundaryCallCountAtTickEnd: number }> = [];
  private lastEventsLength = 0;

  constructor(
    private readonly targetGoalIndex: number,
    private readonly lookback: number,
    private readonly lookahead: number
  ) {}

  onTick(state: LiveMatchState, boundaryCallCount: number): void {
    const newEvents: MatchEvent[] = [];
    if (state.events.length > this.lastEventsLength) {
      for (let i = this.lastEventsLength; i < state.events.length; i++) {
        newEvents.push(state.events[i]);
      }
    }
    this.lastEventsLength = state.events.length;

    const ownerId = state.ball.ownerId;
    let ownerPos: PlayerPos | null = null;
    let ownerDistToBall: number | null = null;
    if (ownerId !== null) {
      const owner = state.players[ownerId];
      if (owner) {
        ownerPos = {
          x: owner.position.x,
          y: owner.position.y,
          clubId: owner.clubId,
        };
        ownerDistToBall = Math.hypot(
          owner.position.x - state.ball.position.x,
          owner.position.y - state.ball.position.y
        );
      }
    }

    const lastTouchId = state.ball.lastTouchId;
    let lastTouchPos: PlayerPos | null = null;
    let lastTouchDistToBall: number | null = null;
    if (lastTouchId !== null) {
      const lt = state.players[lastTouchId];
      if (lt) {
        lastTouchPos = {
          x: lt.position.x,
          y: lt.position.y,
          clubId: lt.clubId,
        };
        lastTouchDistToBall = Math.hypot(
          lt.position.x - state.ball.position.x,
          lt.position.y - state.ball.position.y
        );
      }
    }

    this.snapshots.set(state.tick, {
      tick: state.tick,
      ballX: state.ball.position.x,
      ballY: state.ball.position.y,
      ballZ: state.ball.position.z,
      ballVx: state.ball.velocity.x,
      ballVy: state.ball.velocity.y,
      ballVz: state.ball.velocity.z,
      ballIsMoving: state.ball.isMoving,
      ownerId,
      ownerPos,
      ownerDistToBall,
      lastTouchId,
      lastTouchPos,
      lastTouchDistToBall,
      setPieceType: state.setPiece?.type ?? null,
      setPieceStatus: state.setPiece?.status ?? null,
      setPieceTakerId: state.setPiece?.takerId ?? null,
      eventsLength: state.events.length,
      newEvents,
    });

    this.tickLog.push({
      tick: state.tick,
      boundaryCallCountAtTickEnd: boundaryCallCount,
    });
  }

  private tickForBoundaryCall(callIndex: number): number | null {
    for (const rec of this.tickLog) {
      if (rec.boundaryCallCountAtTickEnd > callIndex) return rec.tick;
    }
    return null;
  }

  finalize(
    boundaryCalls: readonly { input: DetectEventInput; result: BoundaryOutcome }[]
  ): RawTraceReport {
    let goalIndex = 0;
    let targetCallIndex = -1;
    let targetBoundaryTick: number | null = null;
    let targetInput: DetectEventInput | null = null;
    let targetResult: BoundaryOutcome | null = null;

    for (let i = 0; i < boundaryCalls.length; i++) {
      const { input, result } = boundaryCalls[i];
      if (result.type !== 'goal') continue;
      goalIndex++;
      if (goalIndex === this.targetGoalIndex) {
        targetCallIndex = i;
        targetBoundaryTick = this.tickForBoundaryCall(i);
        targetInput = input;
        targetResult = result;
        break;
      }
    }

    if (targetBoundaryTick === null || targetInput === null || targetResult === null) {
      console.log(`=== V6 RAW TRACE: target goal #${this.targetGoalIndex} NOT FOUND ===`);
      return {
        targetGoalIndex: this.targetGoalIndex,
        boundaryTick: null,
        lookback: this.lookback,
        lookahead: this.lookahead,
        boundaryInput: null,
        boundaryResult: null,
        window: [],
      };
    }

    const from = targetBoundaryTick - this.lookback;
    const to = targetBoundaryTick + this.lookahead;
    const window: TickSnapshotV6[] = [];

    for (let t = from; t <= to; t++) {
      const s = this.snapshots.get(t);
      if (s) window.push(s);
    }

    console.log('=== V6 GOAL BOUNDARY RAW TRACE ===');
    console.log(
      `target goal #${this.targetGoalIndex} ` +
      `boundaryTick=${targetBoundaryTick} ` +
      `window=[${from}..${to}] ` +
      `(lookback=${this.lookback}, lookahead=${this.lookahead})`
    );

    console.log('');
    console.log('=== BOUNDARY INPUT (spy argümanları) ===');
    console.log(
      `  prevBallPos = (${targetInput.prevBallPos.x.toFixed(3)}, ${targetInput.prevBallPos.y.toFixed(3)}, ${targetInput.prevBallPos.z.toFixed(3)})`
    );
    console.log(
      `  nextBallPos = (${targetInput.nextBallPos.x.toFixed(3)}, ${targetInput.nextBallPos.y.toFixed(3)}, ${targetInput.nextBallPos.z.toFixed(3)})`
    );
    console.log(`  lastTouchId = ${targetInput.lastTouchId ?? 'null'}`);
    console.log(`  lastTouchClubId = ${targetInput.lastTouchClubId ?? 'null'}`);
    console.log(`  homeClubId = ${targetInput.homeClubId}`);
    console.log(`  awayClubId = ${targetInput.awayClubId}`);

    console.log('');
    console.log('=== BOUNDARY RESULT ===');
    console.log(`  type = ${targetResult.type}`);
    if (targetResult.type === 'goal') {
      console.log(`  scorerSide = ${targetResult.scorerSide}`);
      console.log(`  ownGoal = ${targetResult.ownGoal}`);
      console.log(
        `  point = (${targetResult.point.x.toFixed(3)}, ${targetResult.point.y.toFixed(3)})`
      );
    }

    console.log('');
    console.log('=== RAW TICK WINDOW ===');
    for (const s of window) {
      const isBoundary = s.tick === targetBoundaryTick;
      const ownerStr = s.ownerId
        ? `${s.ownerId}(${s.ownerPos?.clubId ?? '?'})@(${s.ownerPos?.x.toFixed(2) ?? '?'},${s.ownerPos?.y.toFixed(2) ?? '?'})d=${s.ownerDistToBall?.toFixed(2) ?? '?'}`
        : 'null';
      const ltStr = s.lastTouchId
        ? `${s.lastTouchId}(${s.lastTouchPos?.clubId ?? '?'})@(${s.lastTouchPos?.x.toFixed(2) ?? '?'},${s.lastTouchPos?.y.toFixed(2) ?? '?'})d=${s.lastTouchDistToBall?.toFixed(2) ?? '?'}`
        : 'null';
      const evStr = s.newEvents.length > 0
        ? s.newEvents
            .map(e => `${e.type}${e.playerId ? `(${e.playerId})` : ''}${e.clubId ? `[${e.clubId}]` : ''}`)
            .join(',')
        : '-';
      const spStr = s.setPieceType
        ? `${s.setPieceType}/${s.setPieceStatus ?? '-'}/${s.setPieceTakerId ?? '-'}`
        : '-';

      console.log(
        `t=${s.tick}` +
        ` pos=(${s.ballX.toFixed(3)},${s.ballY.toFixed(3)},${s.ballZ.toFixed(3)})` +
        ` v=(${s.ballVx.toFixed(3)},${s.ballVy.toFixed(3)},${s.ballVz.toFixed(3)})` +
        ` moving=${s.ballIsMoving}` +
        ` owner=${ownerStr}` +
        ` lt=${ltStr}` +
        ` sp=${spStr}` +
        ` ev=[${evStr}]` +
        (isBoundary ? '  ← BOUNDARY' : '')
      );
    }

    return {
      targetGoalIndex: this.targetGoalIndex,
      boundaryTick: targetBoundaryTick,
      lookback: this.lookback,
      lookahead: this.lookahead,
      boundaryInput: targetInput,
      boundaryResult: targetResult,
      window,
    };
  }
}
