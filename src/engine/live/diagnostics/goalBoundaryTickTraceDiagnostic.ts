// src/engine/live/diagnostics/goalBoundaryTickTraceDiagnostic.ts
//
// Goal Boundary Tick Trace V5
// ===========================
//
// Goal boundary etrafındaki ±WINDOW tick'leri izler.
// Yalnızca DEĞİŞİM olan tick'leri raporlar.
//
// Kontrat:
//   - Production koduna dokunmaz.
//   - detectBoundaryOutcome spy aynen kullanılır.
//   - onTick snapshot aynen kullanılır.
//   - Map<tick, snapshot> kullanılır.
//   - owner + owner.position + ownerDist
//   - lastTouch + lastTouch.position + lastTouchDist
//   - event / owner Δ / lastTouch Δ / pos-velocity Δ ayrıştırılır.
//   - Bu V5 raporunda yalnızca stationary goal'ler gösterilir.

import type { LiveMatchState, MatchEvent } from '../../types';
import type { BoundaryOutcome, DetectEventInput } from '../events';

interface PlayerPos {
  x: number;
  y: number;
  clubId: string;
}

interface TickSnapshotV5 {
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

export interface GoalTickTrace {
  goalIndex: number;
  boundaryTick: number | null;
  prevBallPos: { x: number; y: number; z: number };
  nextBallPos: { x: number; y: number; z: number };
  lastTouchIdAtBoundary: string | null;
  lastTouchClubIdAtBoundary: string | null;
  scorerSide: string;
  ownGoal: boolean;
  stationary: boolean;
  window: TickSnapshotV5[];
}

export interface GoalTickTraceReport {
  goals: GoalTickTrace[];
  N: number;
  stationaryGoals: number;
}

export class GoalBoundaryTickTraceDiagnostic {
  private snapshots = new Map<number, TickSnapshotV5>();
  private tickLog: Array<{ tick: number; boundaryCallCountAtTickEnd: number }> = [];
  private lastEventsLength = 0;
  private readonly windowSize: number;

  constructor(windowSize = 20) {
    this.windowSize = windowSize;
  }

  onTick(state: LiveMatchState, boundaryCallCount: number): void {
    const newEvents: MatchEvent[] = [];

    if (state.events.length > this.lastEventsLength) {
      for (let i = this.lastEventsLength; i < state.events.length; i++) {
        newEvents.push(state.events[i]);
      }
    }

    this.lastEventsLength = state.events.length;

    const ownerId = state.ball.ownerId;
    const owner = ownerId ? state.players[ownerId] : undefined;
    const ownerPos = owner
      ? { x: owner.position.x, y: owner.position.y, clubId: owner.clubId }
      : null;
    const ownerDistToBall = owner
      ? Math.hypot(
          owner.position.x - state.ball.position.x,
          owner.position.y - state.ball.position.y,
        )
      : null;

    const lastTouchId = state.ball.lastTouchId;
    const lastTouch = lastTouchId ? state.players[lastTouchId] : undefined;
    const lastTouchPos = lastTouch
      ? {
          x: lastTouch.position.x,
          y: lastTouch.position.y,
          clubId: lastTouch.clubId,
        }
      : null;
    const lastTouchDistToBall = lastTouch
      ? Math.hypot(
          lastTouch.position.x - state.ball.position.x,
          lastTouch.position.y - state.ball.position.y,
        )
      : null;

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
    for (const record of this.tickLog) {
      if (record.boundaryCallCountAtTickEnd > callIndex) {
        return record.tick;
      }
    }
    return null;
  }

  finalize(
    boundaryCalls: readonly {
      input: DetectEventInput;
      result: BoundaryOutcome;
    }[],
  ): GoalTickTraceReport {
    const goals: GoalTickTrace[] = [];
    let goalIndex = 0;

    for (let i = 0; i < boundaryCalls.length; i++) {
      const { input, result } = boundaryCalls[i];

      if (result.type !== 'goal') continue;

      goalIndex++;

      const boundaryTick = this.tickForBoundaryCall(i);
      if (boundaryTick === null) continue;

      const dx = input.nextBallPos.x - input.prevBallPos.x;
      const dy = input.nextBallPos.y - input.prevBallPos.y;
      const dz = input.nextBallPos.z - input.prevBallPos.z;
      const moveDist = Math.hypot(dx, dy, dz);
      const stationary = moveDist < 0.3;

      const window: TickSnapshotV5[] = [];

      for (
        let tick = boundaryTick - this.windowSize;
        tick <= boundaryTick + this.windowSize;
        tick++
      ) {
        const snapshot = this.snapshots.get(tick);
        if (snapshot) window.push(snapshot);
      }

      goals.push({
        goalIndex,
        boundaryTick,
        prevBallPos: input.prevBallPos,
        nextBallPos: input.nextBallPos,
        lastTouchIdAtBoundary: input.lastTouchId,
        lastTouchClubIdAtBoundary: input.lastTouchClubId,
        scorerSide: result.scorerSide,
        ownGoal: result.ownGoal,
        stationary,
        window,
      });
    }

    const stationaryGoals = goals.filter(goal => goal.stationary).length;

    console.log('=== GOAL BOUNDARY TICK TRACE V5 ===');
    console.log(`window size: ±${this.windowSize} ticks`);
    console.log(`stationary goals only: ${stationaryGoals}`);

    for (const goal of goals) {
      if (!goal.stationary) continue;

      console.log('');
      console.log(
        `──── GOAL #${goal.goalIndex} ` +
        `boundaryTick=${goal.boundaryTick} ` +
        `ownGoal=${goal.ownGoal} ` +
        `scorerSide=${goal.scorerSide}`,
      );
      console.log(
        `  boundary input: ` +
        `prev=(${goal.prevBallPos.x.toFixed(2)},${goal.prevBallPos.y.toFixed(2)},${goal.prevBallPos.z.toFixed(2)}) ` +
        `next=(${goal.nextBallPos.x.toFixed(2)},${goal.nextBallPos.y.toFixed(2)},${goal.nextBallPos.z.toFixed(2)}) ` +
        `lastTouch@boundary=${goal.lastTouchIdAtBoundary ?? 'N/A'}(${goal.lastTouchClubIdAtBoundary ?? '?'})`,
      );

      let previous: TickSnapshotV5 | null = null;

      for (const snapshot of goal.window) {
        const isBoundary = snapshot.tick === goal.boundaryTick;
        const changes: string[] = [];

        if (previous) {
          if (previous.ownerId !== snapshot.ownerId) {
            changes.push(
              `A-owner:${previous.ownerId ?? 'null'}→${snapshot.ownerId ?? 'null'}`,
            );
          }

          if (previous.lastTouchId !== snapshot.lastTouchId) {
            changes.push(
              `B-lt:${previous.lastTouchId ?? 'null'}→${snapshot.lastTouchId ?? 'null'}`,
            );
          }

          if (
            Math.abs(previous.ballX - snapshot.ballX) > 0.05 ||
            Math.abs(previous.ballY - snapshot.ballY) > 0.05 ||
            Math.abs(previous.ballZ - snapshot.ballZ) > 0.05
          ) {
            changes.push(
              `C-pos:(${previous.ballX.toFixed(2)},${previous.ballY.toFixed(2)})→(${snapshot.ballX.toFixed(2)},${snapshot.ballY.toFixed(2)})`,
            );
          }

          const previousSpeed = Math.hypot(
            previous.ballVx,
            previous.ballVy,
            previous.ballVz,
          );
          const currentSpeed = Math.hypot(
            snapshot.ballVx,
            snapshot.ballVy,
            snapshot.ballVz,
          );

          if (Math.abs(previousSpeed - currentSpeed) > 0.1) {
            changes.push(
              `C-speed:${previousSpeed.toFixed(2)}→${currentSpeed.toFixed(2)}`,
            );
          }

          if (previous.ballIsMoving !== snapshot.ballIsMoving) {
            changes.push(
              `C-moving:${previous.ballIsMoving}→${snapshot.ballIsMoving}`,
            );
          }

          if (previous.setPieceType !== snapshot.setPieceType) {
            changes.push(
              `sp-type:${previous.setPieceType ?? 'null'}→${snapshot.setPieceType ?? 'null'}`,
            );
          }

          if (previous.setPieceStatus !== snapshot.setPieceStatus) {
            changes.push(
              `sp-status:${previous.setPieceStatus ?? 'null'}→${snapshot.setPieceStatus ?? 'null'}`,
            );
          }

          if (previous.setPieceTakerId !== snapshot.setPieceTakerId) {
            changes.push(
              `sp-taker:${previous.setPieceTakerId ?? 'null'}→${snapshot.setPieceTakerId ?? 'null'}`,
            );
          }
        }

        const newEventsStr = snapshot.newEvents.length > 0
          ? snapshot.newEvents
              .map(event =>
                `${event.type}${event.playerId ? `(${event.playerId}/${event.clubId ?? '?'})` : ''}`,
              )
              .join(',')
          : '';

        if (changes.length === 0 && snapshot.newEvents.length === 0 && !isBoundary) {
          previous = snapshot;
          continue;
        }

        const ownerStr = snapshot.ownerId
          ? `${snapshot.ownerId}@(${snapshot.ownerPos?.x.toFixed(2) ?? '?'},${snapshot.ownerPos?.y.toFixed(2) ?? '?'})d=${snapshot.ownerDistToBall?.toFixed(2) ?? '?'}`
          : 'null';

        const lastTouchStr = snapshot.lastTouchId
          ? `${snapshot.lastTouchId}@(${snapshot.lastTouchPos?.x.toFixed(2) ?? '?'},${snapshot.lastTouchPos?.y.toFixed(2) ?? '?'})d=${snapshot.lastTouchDistToBall?.toFixed(2) ?? '?'}`
          : 'null';

        console.log(
          `  tick=${snapshot.tick}` +
          ` pos=(${snapshot.ballX.toFixed(2)},${snapshot.ballY.toFixed(2)},${snapshot.ballZ.toFixed(2)})` +
          ` v=(${snapshot.ballVx.toFixed(2)},${snapshot.ballVy.toFixed(2)},${snapshot.ballVz.toFixed(2)})` +
          ` moving=${snapshot.ballIsMoving}` +
          ` owner=${ownerStr}` +
          ` lt=${lastTouchStr}` +
          ` sp=${snapshot.setPieceType ?? '-'}/${snapshot.setPieceStatus ?? '-'}/${snapshot.setPieceTakerId ?? '-'}` +
          (newEventsStr ? ` events=[${newEventsStr}]` : '') +
          (changes.length > 0 ? ` Δ[${changes.join(' | ')}]` : '') +
          (isBoundary ? ' ← BOUNDARY' : ''),
        );

        previous = snapshot;
      }
    }

    return {
      goals,
      N: this.windowSize,
      stationaryGoals,
    };
  }
}
