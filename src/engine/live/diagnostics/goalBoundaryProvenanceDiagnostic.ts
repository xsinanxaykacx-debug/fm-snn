import type { LiveMatchState, MatchEvent, Vec3 } from '../../types';
import type { BoundaryOutcome, DetectEventInput } from '../events';

export interface BoundaryCallRecord {
  callIndex: number;
  tick: number | null;
  input: DetectEventInput;
  result: BoundaryOutcome;
}

export interface GoalBoundaryProvenance {
  goalIndex: number;
  boundaryTick: number | null;
  prevBallPos: Vec3;
  nextBallPos: Vec3;
  crossingPointApprox: { x: number; y: number; z: number };
  crossingZ: number | null;
  lastTouchId: string | null;
  lastTouchClubId: string | null;
  scorerSide: string;
  ownGoal: boolean;
  lastTouchActionsInWindow: Array<{
    type: string;
    tick: number | null;
    playerId: string | null;
    clubId: string | null;
  }>;
}

export interface GoalBoundaryProvenanceReport {
  goals: GoalBoundaryProvenance[];
  summary: {
    totalGoals: number;
    ownGoals: number;
    goalsWithWindowAction: number;
    windowActionTypes: Record<string, number>;
  };
}

function approxCrossingPoint(
  prev: Vec3,
  next: Vec3,
  goalLineX: number,
): { x: number; y: number; z: number } {
  const dx = next.x - prev.x;
  if (Math.abs(dx) < 1e-9) {
    return { x: prev.x, y: prev.y, z: prev.z };
  }

  const t = (goalLineX - prev.x) / dx;
  const tc = Math.max(0, Math.min(1, t));

  return {
    x: prev.x + (next.x - prev.x) * tc,
    y: prev.y + (next.y - prev.y) * tc,
    z: prev.z + (next.z - prev.z) * tc,
  };
}

export class GoalBoundaryProvenanceDiagnostic {
  private tickLog: Array<{
    tick: number;
    boundaryCallCountAtTickEnd: number;
  }> = [];

  private eventTickLog: Array<{
    tick: number;
    eventsLength: number;
  }> = [];

  private allEvents: MatchEvent[] = [];

  onTick(state: LiveMatchState, boundaryCallCount: number): void {
    this.tickLog.push({
      tick: state.tick,
      boundaryCallCountAtTickEnd: boundaryCallCount,
    });

    this.eventTickLog.push({
      tick: state.tick,
      eventsLength: state.events.length,
    });

    this.allEvents = state.events;
  }

  private tickForBoundaryCall(callIndex: number): number | null {
    for (const rec of this.tickLog) {
      if (rec.boundaryCallCountAtTickEnd > callIndex) {
        return rec.tick;
      }
    }
    return null;
  }

  private tickForEventIndex(index: number): number | null {
    for (const rec of this.eventTickLog) {
      if (rec.eventsLength > index) {
        return rec.tick;
      }
    }
    return null;
  }

  private actionsInWindow(
    fromTick: number,
    toTick: number,
    playerId: string | null,
  ): Array<{
    type: string;
    tick: number | null;
    playerId: string | null;
    clubId: string | null;
  }> {
    if (playerId === null) return [];

    const out: Array<{
      type: string;
      tick: number | null;
      playerId: string | null;
      clubId: string | null;
    }> = [];

    for (let i = 0; i < this.allEvents.length; i++) {
      const event = this.allEvents[i];

      if (event.playerId !== playerId) continue;

      const tick = this.tickForEventIndex(i);
      if (tick === null || tick < fromTick || tick > toTick) continue;

      if (
        event.type !== 'shot' &&
        event.type !== 'pass' &&
        event.type !== 'cross' &&
        event.type !== 'dribble'
      ) {
        continue;
      }

      out.push({
        type: event.type,
        tick,
        playerId: event.playerId ?? null,
        clubId: event.clubId ?? null,
      });
    }

    return out;
  }

  finalize(
    boundaryCalls: readonly {
      input: DetectEventInput;
      result: BoundaryOutcome;
    }[],
  ): GoalBoundaryProvenanceReport {
    const allBoundaryCalls: BoundaryCallRecord[] = [];

    for (let i = 0; i < boundaryCalls.length; i++) {
      const { input, result } = boundaryCalls[i];

      allBoundaryCalls.push({
        callIndex: i,
        tick: this.tickForBoundaryCall(i),
        input,
        result,
      });
    }

    const goals: GoalBoundaryProvenance[] = [];
    let goalIndex = 0;

    for (const record of allBoundaryCalls) {
      if (record.result.type !== 'goal') continue;

      goalIndex++;

      const boundaryTick = record.tick;
      const goalSide =
        record.result.scorerSide === 'HOME' ? 'AWAY' : 'HOME';
      const goalLineX =
        goalSide === 'HOME' ? 0 : record.input.pitch.length;

      const crossingPointApprox = approxCrossingPoint(
        record.input.prevBallPos,
        record.input.nextBallPos,
        goalLineX,
      );

      const crossingZ = crossingPointApprox.z;

      const lastTouchActionsInWindow =
        boundaryTick === null
          ? []
          : this.actionsInWindow(
              boundaryTick - 2,
              boundaryTick,
              record.input.lastTouchId,
            );

      goals.push({
        goalIndex,
        boundaryTick,
        prevBallPos: record.input.prevBallPos,
        nextBallPos: record.input.nextBallPos,
        crossingPointApprox,
        crossingZ,
        lastTouchId: record.input.lastTouchId,
        lastTouchClubId: record.input.lastTouchClubId,
        scorerSide: record.result.scorerSide,
        ownGoal: record.result.ownGoal,
        lastTouchActionsInWindow,
      });
    }

    const ownGoals = goals.filter(goal => goal.ownGoal).length;
    const goalsWithWindowAction = goals.filter(
      goal => goal.lastTouchActionsInWindow.length > 0,
    ).length;

    const windowActionTypes: Record<string, number> = {};

    for (const goal of goals) {
      for (const action of goal.lastTouchActionsInWindow) {
        windowActionTypes[action.type] =
          (windowActionTypes[action.type] ?? 0) + 1;
      }
    }

    const report: GoalBoundaryProvenanceReport = {
      goals,
      summary: {
        totalGoals: goals.length,
        ownGoals,
        goalsWithWindowAction,
        windowActionTypes,
      },
    };

    console.log('=== GOAL BOUNDARY PROVENANCE V3 ===');

    for (const goal of goals) {
      const prev = goal.prevBallPos;
      const next = goal.nextBallPos;
      const moveDistance = Math.hypot(
        next.x - prev.x,
        next.y - prev.y,
        next.z - prev.z,
      );

      const actions =
        goal.lastTouchActionsInWindow.length === 0
          ? 'none'
          : goal.lastTouchActionsInWindow
              .map(action => `${action.type}@${action.tick ?? '?'}`)
              .join(',');

      console.log(
        `GOAL #${goal.goalIndex}` +
          ` boundaryTick=${goal.boundaryTick ?? 'N/A'}` +
          ` scorerSide=${goal.scorerSide}` +
          ` ownGoal=${goal.ownGoal}` +
          ` prev=(${prev.x.toFixed(2)},${prev.y.toFixed(2)},${prev.z.toFixed(2)})` +
          ` next=(${next.x.toFixed(2)},${next.y.toFixed(2)},${next.z.toFixed(2)})` +
          ` crossingZ=${goal.crossingZ?.toFixed(3) ?? 'N/A'}` +
          ` moveDist=${moveDistance.toFixed(3)}` +
          ` lastTouch=${goal.lastTouchId ?? 'N/A'}` +
          ` lastTouchClub=${goal.lastTouchClubId ?? 'N/A'}` +
          ` windowActions=[${actions}]`,
      );
    }

    console.log('=== V3 SUMMARY ===');
    console.table({
      totalGoals: report.summary.totalGoals,
      ownGoals: report.summary.ownGoals,
      goalsWithWindowAction: report.summary.goalsWithWindowAction,
    });

    console.log('=== WINDOW ACTION TYPES ===');
    console.table(report.summary.windowActionTypes);

    return report;
  }
}
