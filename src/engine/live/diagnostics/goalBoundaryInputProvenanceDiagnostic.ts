import type { LiveMatchState, Vec3 } from '../../types';
import type { BoundaryOutcome, DetectEventInput } from '../events';

interface TickSnapshotV4 {
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
  playerPositions: Map<string, { x: number; y: number; clubId: string }>;
  eventsLength: number;
}

export interface GoalInputProvenance {
  goalIndex: number;
  boundaryTick: number | null;
  prevBallPos: Vec3;
  nextBallPos: Vec3;
  lastTouchIdAtBoundary: string | null;
  lastTouchClubIdAtBoundary: string | null;
  scorerSide: string;
  ownGoal: boolean;
  crossingPoint: Vec3;
  prevTick: TickSnapshotV4 | null;
  currentTick: TickSnapshotV4 | null;
  moveDist: number;
  moveVelocity: number;
  isStationary: boolean;
  ownerAtTMinus1: {
    id: string | null;
    clubId: string | null;
    position: { x: number; y: number } | null;
    distanceToNextBallPos: number | null;
  };
  lastTouchAtTMinus1: {
    id: string | null;
    clubId: string | null;
    position: { x: number; y: number } | null;
    distanceToNextBallPos: number | null;
  };
  setPieceAtTMinus1: {
    type: string | null;
    status: string | null;
    takerId: string | null;
  };
}

export interface GoalInputProvenanceReport {
  goals: GoalInputProvenance[];
  summary: {
    totalGoals: number;
    ownGoals: number;
    stationaryGoals: number;
    movingGoals: number;
    lastTouchIsOwner: number;
    lastTouchIsNotOwner: number;
    setPieceActive: number;
    ownerNearNextBallPos: number;
    lastTouchNearNextBallPos: number;
  };
}

export class GoalBoundaryInputProvenanceDiagnostic {
  private snapshots: TickSnapshotV4[] = [];
  private tickLog: Array<{
    tick: number;
    boundaryCallCountAtTickEnd: number;
  }> = [];

  onTick(state: LiveMatchState, boundaryCallCount: number): void {
    const playerPositions = new Map<
      string,
      { x: number; y: number; clubId: string }
    >();

    for (const id of Object.keys(state.players).sort()) {
      const player = state.players[id];
      playerPositions.set(id, {
        x: player.position.x,
        y: player.position.y,
        clubId: player.clubId,
      });
    }

    this.snapshots.push({
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
      playerPositions,
      eventsLength: state.events.length,
    });

    this.tickLog.push({
      tick: state.tick,
      boundaryCallCountAtTickEnd: boundaryCallCount,
    });
  }

  private tickForBoundaryCall(callIndex: number): number | null {
    for (const rec of this.tickLog) {
      if (rec.boundaryCallCountAtTickEnd > callIndex) {
        return rec.tick;
      }
    }
    return null;
  }

  private snapshotForTick(tick: number): TickSnapshotV4 | null {
    for (const snapshot of this.snapshots) {
      if (snapshot.tick === tick) {
        return snapshot;
      }
    }
    return null;
  }

  finalize(
    boundaryCalls: readonly {
      input: DetectEventInput;
      result: BoundaryOutcome;
    }[],
  ): GoalInputProvenanceReport {
    const goals: GoalInputProvenance[] = [];
    let goalIndex = 0;

    for (let i = 0; i < boundaryCalls.length; i++) {
      const { input, result } = boundaryCalls[i];

      if (result.type !== 'goal') continue;

      goalIndex++;

      const boundaryTick = this.tickForBoundaryCall(i);
      const prevTick =
        boundaryTick !== null ? boundaryTick - 1 : null;
      const prevSnapshot =
        prevTick !== null ? this.snapshotForTick(prevTick) : null;
      const currentSnapshot =
        boundaryTick !== null
          ? this.snapshotForTick(boundaryTick)
          : null;

      const dx = input.nextBallPos.x - input.prevBallPos.x;
      const dy = input.nextBallPos.y - input.prevBallPos.y;
      const dz = input.nextBallPos.z - input.prevBallPos.z;
      const moveDist = Math.hypot(dx, dy, dz);

      const ownerId = prevSnapshot?.ballOwnerId ?? null;
      const ownerPos = ownerId
        ? prevSnapshot?.playerPositions.get(ownerId) ?? null
        : null;

      const ownerDistToNext = ownerPos
        ? Math.hypot(
            ownerPos.x - input.nextBallPos.x,
            ownerPos.y - input.nextBallPos.y,
          )
        : null;

      const lastTouchId = prevSnapshot?.ballLastTouchId ?? null;
      const lastTouchPos = lastTouchId
        ? prevSnapshot?.playerPositions.get(lastTouchId) ?? null
        : null;

      const lastTouchDistToNext = lastTouchPos
        ? Math.hypot(
            lastTouchPos.x - input.nextBallPos.x,
            lastTouchPos.y - input.nextBallPos.y,
          )
        : null;

      goals.push({
        goalIndex,
        boundaryTick,
        prevBallPos: input.prevBallPos,
        nextBallPos: input.nextBallPos,
        lastTouchIdAtBoundary: input.lastTouchId,
        lastTouchClubIdAtBoundary: input.lastTouchClubId,
        scorerSide: result.scorerSide,
        ownGoal: result.ownGoal,
        crossingPoint: {
          x: result.point.x,
          y: result.point.y,
          z: input.nextBallPos.z,
        },
        prevTick: prevSnapshot,
        currentTick: currentSnapshot,
        moveDist,
        moveVelocity: moveDist,
        isStationary: moveDist < 0.3,
        ownerAtTMinus1: {
          id: ownerId,
          clubId: ownerPos?.clubId ?? null,
          position: ownerPos
            ? { x: ownerPos.x, y: ownerPos.y }
            : null,
          distanceToNextBallPos: ownerDistToNext,
        },
        lastTouchAtTMinus1: {
          id: lastTouchId,
          clubId: lastTouchPos?.clubId ?? null,
          position: lastTouchPos
            ? { x: lastTouchPos.x, y: lastTouchPos.y }
            : null,
          distanceToNextBallPos: lastTouchDistToNext,
        },
        setPieceAtTMinus1: {
          type: prevSnapshot?.setPieceType ?? null,
          status: prevSnapshot?.setPieceStatus ?? null,
          takerId: prevSnapshot?.setPieceTakerId ?? null,
        },
      });
    }

    const ownGoals = goals.filter(goal => goal.ownGoal).length;
    const stationaryGoals = goals.filter(goal => goal.isStationary).length;

    let lastTouchIsOwner = 0;
    let lastTouchIsNotOwner = 0;

    for (const goal of goals) {
      if (
        goal.ownerAtTMinus1.id !== null &&
        goal.ownerAtTMinus1.id === goal.lastTouchAtTMinus1.id
      ) {
        lastTouchIsOwner++;
      } else {
        lastTouchIsNotOwner++;
      }
    }

    const setPieceActive = goals.filter(
      goal => goal.setPieceAtTMinus1.type !== null,
    ).length;

    const ownerNearNextBallPos = goals.filter(
      goal =>
        goal.ownerAtTMinus1.distanceToNextBallPos !== null &&
        goal.ownerAtTMinus1.distanceToNextBallPos < 1,
    ).length;

    const lastTouchNearNextBallPos = goals.filter(
      goal =>
        goal.lastTouchAtTMinus1.distanceToNextBallPos !== null &&
        goal.lastTouchAtTMinus1.distanceToNextBallPos < 1,
    ).length;

    const report: GoalInputProvenanceReport = {
      goals,
      summary: {
        totalGoals: goals.length,
        ownGoals,
        stationaryGoals,
        movingGoals: goals.length - stationaryGoals,
        lastTouchIsOwner,
        lastTouchIsNotOwner,
        setPieceActive,
        ownerNearNextBallPos,
        lastTouchNearNextBallPos,
      },
    };

    console.log('=== GOAL BOUNDARY INPUT PROVENANCE V4 ===');

    for (const goal of goals) {
      const ownerPosition =
        goal.ownerAtTMinus1.position === null
          ? 'N/A'
          : `(${goal.ownerAtTMinus1.position.x.toFixed(2)},${goal.ownerAtTMinus1.position.y.toFixed(2)})`;

      const lastTouchPosition =
        goal.lastTouchAtTMinus1.position === null
          ? 'N/A'
          : `(${goal.lastTouchAtTMinus1.position.x.toFixed(2)},${goal.lastTouchAtTMinus1.position.y.toFixed(2)})`;

      console.log(
        `GOAL #${goal.goalIndex}` +
          ` tick=${goal.boundaryTick ?? 'N/A'}` +
          ` ownGoal=${goal.ownGoal}` +
          ` moveDist=${goal.moveDist.toFixed(3)}` +
          ` stationary=${goal.isStationary}` +
          ` owner=${goal.ownerAtTMinus1.id ?? 'N/A'}(${goal.ownerAtTMinus1.clubId ?? '?'})` +
          ` ownerPos=${ownerPosition}` +
          ` ownerDist=${goal.ownerAtTMinus1.distanceToNextBallPos?.toFixed(2) ?? 'N/A'}` +
          ` lastTouch=${goal.lastTouchAtTMinus1.id ?? 'N/A'}(${goal.lastTouchAtTMinus1.clubId ?? '?'})` +
          ` lastTouchPos=${lastTouchPosition}` +
          ` ltDist=${goal.lastTouchAtTMinus1.distanceToNextBallPos?.toFixed(2) ?? 'N/A'}` +
          ` setPiece=${goal.setPieceAtTMinus1.type ?? 'none'}/${goal.setPieceAtTMinus1.status ?? '-'}` +
          ` setPieceTaker=${goal.setPieceAtTMinus1.takerId ?? 'N/A'}`,
      );
    }

    console.log('=== V4 SUMMARY ===');
    console.table({
      totalGoals: report.summary.totalGoals,
      ownGoals: report.summary.ownGoals,
      stationaryGoals: report.summary.stationaryGoals,
      movingGoals: report.summary.movingGoals,
      lastTouchIsOwner: report.summary.lastTouchIsOwner,
      lastTouchIsNotOwner: report.summary.lastTouchIsNotOwner,
      setPieceActive: report.summary.setPieceActive,
      ownerNearNextBallPos: report.summary.ownerNearNextBallPos,
      lastTouchNearNextBallPos: report.summary.lastTouchNearNextBallPos,
    });

    return report;
  }
}
