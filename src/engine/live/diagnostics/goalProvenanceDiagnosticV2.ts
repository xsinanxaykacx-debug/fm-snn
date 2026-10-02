// src/engine/live/diagnostics/goalProvenanceDiagnosticV2.ts
//
// Goal provenance diagnostic — V2
// ================================
//
// V1'den farkı: "tarihsel previousAction" yerine "aynı tick'te
// üretilen event'ler" mantığını kullanır. Bunun için onTick
// sırasında state.events.length kaydedilir ve her event index'inin
// hangi tick'te göründüğü çıkarılır.
//
// KONTRAT:
//   - Production'a DOKUNMAZ.
//   - MatchEvent içinde tick ve ownGoal YOK; bunları türetmiyoruz.
//   - BoundaryOutcome onTick kanalından erişilemez;
//     raporda "unavailable_from_onTick" olarak işaretlenir.
//   - RNG kullanılmaz.

import type {
  LiveMatchState,
  MatchEvent,
  MatchStats,
} from '../../types';

interface EventTickRecord {
  tick: number;
  eventsLength: number;
}

interface BallSnapshotAtGoal {
  tick: number;
  lastTouchId: string | null;
  lastTouchClubId: string | null;
  ballX: number;
  ballY: number;
  ballZ: number;
  ballVx: number;
  ballVy: number;
  ballVz: number;
  isMoving: boolean;
}

export type PreviousActionType =
  | 'shot'
  | 'pass'
  | 'cross'
  | 'dribble'
  | 'unknown';

export interface GoalProvenanceV2 {
  goalIndex: number;
  goalTick: number | null;
  goalEventIndex: number;
  minute: number;

  scorerId: string | null;
  scorerClubId: string | null;

  sameTickEvents: MatchEvent[];
  previousEvent: MatchEvent | null;
  previousEventTick: number | null;

  lastShotEvent: MatchEvent | null;
  lastShotTick: number | null;
  lastShotPlayerId: string | null;
  ticksSinceLastShot: number | null;

  ballAtGoal: BallSnapshotAtGoal | null;

  boundaryOutcome: 'unavailable_from_onTick';
}

export interface GoalProvenanceV2Report {
  goals: GoalProvenanceV2[];
  summary: {
    totalGoals: number;
    sameTickHasShot: number;
    sameTickHasPass: number;
    sameTickHasCross: number;
    sameTickHasDribble: number;
    sameTickHasOnlyGoal: number;
    lastShotWithin1Tick: number;
    lastShotWithin5Ticks: number;
    lastShotFar: number;
    noShotBefore: number;
  };
  accounting: {
    totalGoals: number;
    shots: number;
    onTarget: number;
    xG: number;
  };
}

export class GoalProvenanceDiagnosticV2 {
  private eventTicks: EventTickRecord[] = [];
  private ballByTick: Map<number, BallSnapshotAtGoal> = new Map();

  onTick(state: LiveMatchState): void {
    const tick = state.tick;

    this.eventTicks.push({
      tick,
      eventsLength: state.events.length,
    });

    this.ballByTick.set(tick, {
      tick,
      lastTouchId: state.ball.lastTouchId,
      lastTouchClubId: state.ball.lastTouchClubId,
      ballX: state.ball.position.x,
      ballY: state.ball.position.y,
      ballZ: state.ball.position.z,
      ballVx: state.ball.velocity.x,
      ballVy: state.ball.velocity.y,
      ballVz: state.ball.velocity.z,
      isMoving: state.ball.isMoving,
    });
  }

  private tickForEventIndex(index: number): number | null {
    for (const rec of this.eventTicks) {
      if (rec.eventsLength > index) return rec.tick;
    }
    return null;
  }

  private tickWhenEventAppeared(index: number): number | null {
    return this.tickForEventIndex(index);
  }

  finalize(
    events: readonly MatchEvent[],
    stats: MatchStats
  ): GoalProvenanceV2Report {
    const goals: GoalProvenanceV2[] = [];

    let goalIndex = 0;

    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.type !== 'goal') continue;

      goalIndex++;

      const goalTick = this.tickWhenEventAppeared(i);
      const scorerId = e.playerId ?? null;
      const scorerClubId = e.clubId ?? null;

      const sameTickEvents: MatchEvent[] = [];
      if (goalTick !== null) {
        for (let j = 0; j < events.length; j++) {
          const jTick = this.tickWhenEventAppeared(j);
          if (jTick === goalTick) {
            sameTickEvents.push(events[j]);
          }
        }
      }

      const previousEvent = i > 0 ? events[i - 1] : null;
      const previousEventTick =
        i > 0 ? this.tickWhenEventAppeared(i - 1) : null;

      let lastShotEvent: MatchEvent | null = null;
      let lastShotIndex = -1;
      for (let j = i - 1; j >= 0; j--) {
        if (events[j].type === 'shot') {
          lastShotEvent = events[j];
          lastShotIndex = j;
          break;
        }
      }

      const lastShotTick =
        lastShotIndex >= 0
          ? this.tickWhenEventAppeared(lastShotIndex)
          : null;

      const ticksSinceLastShot =
        goalTick !== null && lastShotTick !== null
          ? goalTick - lastShotTick
          : null;

      const ballAtGoal =
        goalTick !== null ? this.ballByTick.get(goalTick) ?? null : null;

      goals.push({
        goalIndex,
        goalTick,
        goalEventIndex: i,
        minute: e.minute,
        scorerId,
        scorerClubId,
        sameTickEvents,
        previousEvent,
        previousEventTick,
        lastShotEvent,
        lastShotTick,
        lastShotPlayerId: lastShotEvent?.playerId ?? null,
        ticksSinceLastShot,
        ballAtGoal,
        boundaryOutcome: 'unavailable_from_onTick',
      });
    }

    let sameTickHasShot = 0;
    let sameTickHasPass = 0;
    let sameTickHasCross = 0;
    let sameTickHasDribble = 0;
    let sameTickHasOnlyGoal = 0;
    let lastShotWithin1Tick = 0;
    let lastShotWithin5Ticks = 0;
    let lastShotFar = 0;
    let noShotBefore = 0;

    for (const g of goals) {
      const types = new Set(g.sameTickEvents.map(e => e.type));
      if (types.has('shot')) sameTickHasShot++;
      if (types.has('pass')) sameTickHasPass++;
      if (types.has('cross')) sameTickHasCross++;
      if (types.has('dribble')) sameTickHasDribble++;
      if (g.sameTickEvents.length === 1 && g.sameTickEvents[0].type === 'goal') {
        sameTickHasOnlyGoal++;
      }

      if (g.ticksSinceLastShot === null) {
        noShotBefore++;
      } else if (g.ticksSinceLastShot <= 1) {
        lastShotWithin1Tick++;
      } else if (g.ticksSinceLastShot <= 5) {
        lastShotWithin5Ticks++;
      } else {
        lastShotFar++;
      }
    }

    const shots = stats.shots.home + stats.shots.away;
    const onTarget = stats.onTarget.home + stats.onTarget.away;
    const xG = stats.xG.home + stats.xG.away;

    const report: GoalProvenanceV2Report = {
      goals,
      summary: {
        totalGoals: goals.length,
        sameTickHasShot,
        sameTickHasPass,
        sameTickHasCross,
        sameTickHasDribble,
        sameTickHasOnlyGoal,
        lastShotWithin1Tick,
        lastShotWithin5Ticks,
        lastShotFar,
        noShotBefore,
      },
      accounting: {
        totalGoals: goals.length,
        shots,
        onTarget,
        xG,
      },
    };

    console.log('=== GOAL PROVENANCE V2 (per goal) ===');
    for (const g of goals) {
      console.log(
        `GOAL #${g.goalIndex}` +
        ` goalTick=${g.goalTick ?? 'N/A'}` +
        ` minute=${g.minute}` +
        ` scorer=${g.scorerId ?? 'N/A'}` +
        ` scorerClub=${g.scorerClubId ?? 'N/A'}` +
        ` sameTickEvents=[${g.sameTickEvents.map(e => e.type).join(',')}]` +
        ` prevEvent=${g.previousEvent?.type ?? 'N/A'}` +
        ` lastShot=${g.lastShotEvent ? `shot@${g.lastShotTick} (Δ${g.ticksSinceLastShot})` : 'N/A'}` +
        ` ballV=(${g.ballAtGoal?.ballVx.toFixed(2) ?? 'N/A'}, ${g.ballAtGoal?.ballVy.toFixed(2) ?? 'N/A'})` +
        ` ballMoving=${g.ballAtGoal?.isMoving ?? 'N/A'}`
      );
    }

    console.log('=== GOAL PROVENANCE V2 SUMMARY ===');
    console.table({
      totalGoals: report.summary.totalGoals,
      sameTickHasShot: report.summary.sameTickHasShot,
      sameTickHasPass: report.summary.sameTickHasPass,
      sameTickHasCross: report.summary.sameTickHasCross,
      sameTickHasDribble: report.summary.sameTickHasDribble,
      sameTickHasOnlyGoal: report.summary.sameTickHasOnlyGoal,
      lastShotWithin1Tick: report.summary.lastShotWithin1Tick,
      lastShotWithin5Ticks: report.summary.lastShotWithin5Ticks,
      lastShotFar: report.summary.lastShotFar,
      noShotBefore: report.summary.noShotBefore,
    });

    console.log('=== ACCOUNTING ===');
    console.table({
      totalGoals: report.accounting.totalGoals,
      shots: report.accounting.shots,
      onTarget: report.accounting.onTarget,
      xG: report.accounting.xG,
    });

    console.log('=== EVENT TYPE COUNTS ===');
    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.type] = (counts[e.type] ?? 0) + 1;
    }
    console.table(counts);

    return report;
  }
}
