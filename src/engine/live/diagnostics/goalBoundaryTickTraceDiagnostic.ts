import type { LiveMatchState, Vec3, MatchEvent } from '../../types';
import type { BoundaryOutcome, DetectEventInput } from '../events';

interface TickSnapshotV5 {
  tick: number;
  ballPosition: Vec3;
  ballVelocity: Vec3;
  ballOwnerId: string | null;
  ballLastTouchId: string | null;
  ballLastTouchClubId: string | null;
  ballIsMoving: boolean;
  setPieceType: string | null;
  setPieceStatus: string | null;
  setPieceTakerId: string | null;
  ownerPosition: { x: number; y: number; clubId: string } | null;
  lastTouchPosition: { x: number; y: number; clubId: string } | null;
  eventsLength: number;
  newEvents: MatchEvent[];
}

export interface GoalTickTrace {
  goalIndex: number;
  boundaryTick: number | null;
  prevBallPos: Vec3;
  nextBallPos: Vec3;
  lastTouchIdAtBoundary: string | null;
  lastTouchClubIdAtBoundary: string | null;
  scorerSide: string;
  ownGoal: boolean;
  window: TickSnapshotV5[];
}

export interface GoalTickTraceReport {
  goals: GoalTickTrace[];
  N: number;
}

function distance2D(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export class GoalBoundaryTickTraceDiagnostic {
  private snapshots = new Map<number, TickSnapshotV5>();
  private tickLog: Array<{ tick: number; boundaryCallCountAtTickEnd: number }> = [];
  private lastEventsLength = 0;
  private readonly windowSize: number;

  constructor(windowSize: number = 20) {
    this.windowSize = windowSize;
  }

  onTick(state: LiveMatchState, boundaryCallCount: number): void {
    const ownerPosition = state.ball.ownerId
      ? state.players[state.ball.ownerId]
        ? {
            x: state.players[state.ball.ownerId].position.x,
            y: state.players[state.ball.ownerId].position.y,
            clubId: state.players[state.ball.ownerId].clubId,
          }
        : null
      : null;

    const lastTouchPosition = state.ball.lastTouchId
      ? state.players[state.ball.lastTouchId]
        ? {
            x: state.players[state.ball.lastTouchId].position.x,
            y: state.players[state.ball.lastTouchId].position.y,
            clubId: state.players[state.ball.lastTouchId].clubId,
          }
        : null
      : null;

    const newEvents: MatchEvent[] = [];
    if (state.events.length > this.lastEventsLength) {
      for (let i = this.lastEventsLength; i < state.events.length; i++) {
        newEvents.push(state.events[i]);
      }
    }
    this.lastEventsLength = state.events.length;

    this.snapshots.set(state.tick, {
      tick: state.tick,
      ballPosition: {
        x: state.ball.position.x,
        y: state.ball.position.y,
        z: state.ball.position.z,
      },
      ballVelocity: {
        x: state.ball.velocity.x,
        y: state.ball.velocity.y,
        z: state.ball.velocity.z,
      },
      ballOwnerId: state.ball.ownerId,
      ballLastTouchId: state.ball.lastTouchId,
      ballLastTouchClubId: state.ball.lastTouchClubId,
      ballIsMoving: state.ball.isMoving,
      setPieceType: state.setPiece?.type ?? null,
      setPieceStatus: state.setPiece?.status ?? null,
      setPieceTakerId: state.setPiece?.takerId ?? null,
      ownerPosition,
      lastTouchPosition,
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

      const window: TickSnapshotV5[] = [];
      for (
        let t = boundaryTick - this.windowSize;
        t <= boundaryTick + this.windowSize;
        t++
      ) {
        const snapshot = this.snapshots.get(t);
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
        window,
      });
    }

    console.log('=== GOAL BOUNDARY TICK TRACE V5 ===');
    console.log(`window size: ±${this.windowSize} ticks`);

    for (const goal of goals) {
      console.log('');
      console.log(
        `──── GOAL #${goal.goalIndex} boundaryTick=${goal.boundaryTick} ownGoal=${goal.ownGoal} scorerSide=${goal.scorerSide}`,
      );
      console.log(
        `  boundary input: prev=(${goal.prevBallPos.x.toFixed(2)},${goal.prevBallPos.y.toFixed(2)},${goal.prevBallPos.z.toFixed(2)}) ` +
        `next=(${goal.nextBallPos.x.toFixed(2)},${goal.nextBallPos.y.toFixed(2)},${goal.nextBallPos.z.toFixed(2)}) ` +
        `lastTouch=${goal.lastTouchIdAtBoundary ?? 'N/A'}(${goal.lastTouchClubIdAtBoundary ?? '?'})`,
      );

      let prev: TickSnapshotV5 | null = null;

      for (const snapshot of goal.window) {
        const changes: string[] = [];
        const isBoundary = snapshot.tick === goal.boundaryTick;

        if (prev) {
          if (prev.ballOwnerId !== snapshot.ballOwnerId) {
            changes.push(`owner:${prev.ballOwnerId ?? 'null'}→${snapshot.ballOwnerId ?? 'null'}`);
          }
          if (prev.ballLastTouchId !== snapshot.ballLastTouchId) {
            changes.push(`lastTouch:${prev.ballLastTouchId ?? 'null'}→${snapshot.ballLastTouchId ?? 'null'}`);
          }

          const posChanged =
            Math.abs(prev.ballPosition.x - snapshot.ballPosition.x) > 0.05 ||
            Math.abs(prev.ballPosition.y - snapshot.ballPosition.y) > 0.05 ||
            Math.abs(prev.ballPosition.z - snapshot.ballPosition.z) > 0.05;
          if (posChanged) {
            changes.push(
              `pos:(${prev.ballPosition.x.toFixed(2)},${prev.ballPosition.y.toFixed(2)})→(${snapshot.ballPosition.x.toFixed(2)},${snapshot.ballPosition.y.toFixed(2)})`,
            );
          }

          const prevSpeed = Math.hypot(prev.ballVelocity.x, prev.ballVelocity.y, prev.ballVelocity.z);
          const currentSpeed = Math.hypot(snapshot.ballVelocity.x, snapshot.ballVelocity.y, snapshot.ballVelocity.z);
          if (Math.abs(prevSpeed - currentSpeed) > 0.1) {
            changes.push(`speed:${prevSpeed.toFixed(2)}→${currentSpeed.toFixed(2)}`);
          }

          if (prev.ballIsMoving !== snapshot.ballIsMoving) {
            changes.push(`moving:${prev.ballIsMoving}→${snapshot.ballIsMoving}`);
          }

          if (prev.setPieceType !== snapshot.setPieceType) {
            changes.push(`setPiece:${prev.setPieceType ?? 'null'}→${snapshot.setPieceType ?? 'null'}`);
          }
          if (prev.setPieceStatus !== snapshot.setPieceStatus) {
            changes.push(`spStatus:${prev.setPieceStatus ?? 'null'}→${snapshot.setPieceStatus ?? 'null'}`);
          }
          if (prev.setPieceTakerId !== snapshot.setPieceTakerId) {
            changes.push(`spTaker:${prev.setPieceTakerId ?? 'null'}→${snapshot.setPieceTakerId ?? 'null'}`);
          }

          const ownerChanged =
            prev.ownerPosition?.x !== snapshot.ownerPosition?.x ||
            prev.ownerPosition?.y !== snapshot.ownerPosition?.y;
          if (ownerChanged && snapshot.ownerPosition) {
            changes.push(
              `ownerPos:(${prev.ownerPosition?.x.toFixed(2) ?? 'null'},${prev.ownerPosition?.y.toFixed(2) ?? 'null'})→(${snapshot.ownerPosition.x.toFixed(2)},${snapshot.ownerPosition.y.toFixed(2)})`,
            );
          }

          const lastTouchChanged =
            prev.lastTouchPosition?.x !== snapshot.lastTouchPosition?.x ||
            prev.lastTouchPosition?.y !== snapshot.lastTouchPosition?.y;
          if (lastTouchChanged && snapshot.lastTouchPosition) {
            changes.push(
              `ltPos:(${prev.lastTouchPosition?.x.toFixed(2) ?? 'null'},${prev.lastTouchPosition?.y.toFixed(2) ?? 'null'})→(${snapshot.lastTouchPosition.x.toFixed(2)},${snapshot.lastTouchPosition.y.toFixed(2)})`,
            );
          }
        }

        const newEventsStr = snapshot.newEvents.length > 0
          ? snapshot.newEvents.map(event => {
              const id = event.playerId ?? 'N/A';
              const club = event.clubId ?? '?';
              return `${event.type}(${id}/${club})`;
            }).join(',')
          : '';

        const marker = isBoundary ? ' ← BOUNDARY' : '';

        if (changes.length > 0 || snapshot.newEvents.length > 0 || isBoundary) {
          const owner = snapshot.ownerPosition
            ? `(${snapshot.ownerPosition.x.toFixed(2)},${snapshot.ownerPosition.y.toFixed(2)})`
            : 'N/A';
          const ownerDist = snapshot.ownerPosition
            ? distance2D(snapshot.ownerPosition, snapshot.ballPosition).toFixed(2)
            : 'N/A';
          const lastTouch = snapshot.lastTouchPosition
            ? `(${snapshot.lastTouchPosition.x.toFixed(2)},${snapshot.lastTouchPosition.y.toFixed(2)})`
            : 'N/A';
          const lastTouchDist = snapshot.lastTouchPosition
            ? distance2D(snapshot.lastTouchPosition, snapshot.ballPosition).toFixed(2)
            : 'N/A';

          console.log(
            `  tick=${snapshot.tick}` +
            ` pos=(${snapshot.ballPosition.x.toFixed(2)},${snapshot.ballPosition.y.toFixed(2)},${snapshot.ballPosition.z.toFixed(2)})` +
            ` v=(${snapshot.ballVelocity.x.toFixed(2)},${snapshot.ballVelocity.y.toFixed(2)},${snapshot.ballVelocity.z.toFixed(2)})` +
            ` owner=${snapshot.ballOwnerId ?? 'null'} ownerPos=${owner} ownerDist=${ownerDist}` +
            ` lt=${snapshot.ballLastTouchId ?? 'null'} ltPos=${lastTouch} ltDist=${lastTouchDist}` +
            ` moving=${snapshot.ballIsMoving}` +
            ` sp=${snapshot.setPieceType ?? '-'}/${snapshot.setPieceStatus ?? '-'}` +
            (newEventsStr ? ` events=[${newEventsStr}]` : '') +
            (changes.length > 0 ? ` Δ[${changes.join(' | ')}]` : '') +
            marker,
          );
        }

        prev = snapshot;
      }
    }

    return { goals, N: this.windowSize };
  }
}
