// src/engine/live/diagnostics/goalProvenanceDiagnostic.ts
//
// Goal provenance diagnostic — B
// Production koduna dokunmaz.
//
// onTick: goal event ilk görüldüğü anda tick + lastTouch snapshot'ı alır.
// finalize: events + stats üzerinden provenance ve muhasebe raporu üretir.
// MatchEvent sözleşmesi değiştirilmez; ownGoal description üzerinden gözlemlenir.

import type { LiveMatchState, MatchEvent, LiveMatchStats } from '../../types';

export type PreviousActionType =
  | 'shot'
  | 'pass'
  | 'cross'
  | 'dribble'
  | 'unknown';

export type OwnGoalObservation = 'yes' | 'no' | 'unknown';

interface GoalSnapshot {
  tick: number;
  lastTouchId: string | null;
  lastTouchClubId: string | null;
}

export interface GoalProvenance {
  goalIndex: number;
  tick: number | null;
  minute: number;
  scorerId: string | null;
  scorerClubId: string | null;
  lastTouchId: string | null;
  lastTouchClubId: string | null;
  ownGoal: OwnGoalObservation;
  previousActionType: PreviousActionType;
  previousActionTick: number | null;
  previousActionPlayerId: string | null;
  previousActionClubId: string | null;
  goalEvent: MatchEvent;
}

export interface GoalProvenanceReport {
  goals: GoalProvenance[];
  summary: {
    totalGoals: number;
    shotGoals: number;
    passGoals: number;
    crossGoals: number;
    dribbleGoals: number;
    unknownGoals: number;
    ownGoals: number;
    ownGoalUnknown: number;
    nonShotGoals: number;
  };
  accounting: {
    totalGoals: number;
    shotGoals: number;
    nonShotGoals: number;
    ownGoals: number;
    ownGoalUnknown: number;
    shots: number;
    onTarget: number;
    xG: number;
  };
}

const ACTION_TYPES = new Set(['shot', 'pass', 'cross', 'dribble']);

function findPreviousAction(
  events: readonly MatchEvent[],
  goalEventIndex: number,
  playerId: string | null
): { type: PreviousActionType; event: MatchEvent | null } {
  if (playerId === null) return { type: 'unknown', event: null };

  for (let i = goalEventIndex - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.playerId !== playerId) continue;
    if (!ACTION_TYPES.has(event.type)) continue;

    return {
      type: event.type as PreviousActionType,
      event,
    };
  }

  return { type: 'unknown', event: null };
}

function observeOwnGoal(goalEvent: MatchEvent): OwnGoalObservation {
  if (goalEvent.description.startsWith('Kendi kalesine gol!')) {
    return 'yes';
  }

  if (goalEvent.description.startsWith('GOL!')) {
    return 'no';
  }

  return 'unknown';
}

export class GoalProvenanceDiagnostic {
  private snapshots: GoalSnapshot[] = [];
  private observedGoalEventCount = 0;

  onTick(state: LiveMatchState): void {
    const goals = state.events.filter(event => event.type === 'goal');

    if (goals.length <= this.observedGoalEventCount) return;

    for (let i = this.observedGoalEventCount; i < goals.length; i += 1) {
      this.snapshots.push({
        tick: state.tick,
        lastTouchId: state.ball.lastTouchId,
        lastTouchClubId: state.ball.lastTouchClubId,
      });
    }

    this.observedGoalEventCount = goals.length;
  }

  finalize(
    events: readonly MatchEvent[],
    stats: LiveMatchStats
  ): GoalProvenanceReport {
    const goals: GoalProvenance[] = [];
    let goalIndex = 0;

    for (let i = 0; i < events.length; i += 1) {
      const goalEvent = events[i];
      if (goalEvent.type !== 'goal') continue;

      const snapshot = this.snapshots[goalIndex];
      const scorerId = goalEvent.playerId ?? null;
      const scorerClubId = goalEvent.clubId ?? null;
      const lastTouchId = snapshot?.lastTouchId ?? scorerId;
      const lastTouchClubId = snapshot?.lastTouchClubId ?? null;
      const previous = findPreviousAction(events, i, lastTouchId);

      goalIndex += 1;

      goals.push({
        goalIndex,
        tick: snapshot?.tick ?? null,
        minute: goalEvent.minute,
        scorerId,
        scorerClubId,
        lastTouchId,
        lastTouchClubId,
        ownGoal: observeOwnGoal(goalEvent),
        previousActionType: previous.type,
        previousActionTick: null,
        previousActionPlayerId: previous.event?.playerId ?? null,
        previousActionClubId: previous.event?.clubId ?? null,
        goalEvent,
      });
    }

    const shotGoals = goals.filter(g => g.previousActionType === 'shot').length;
    const passGoals = goals.filter(g => g.previousActionType === 'pass').length;
    const crossGoals = goals.filter(g => g.previousActionType === 'cross').length;
    const dribbleGoals = goals.filter(g => g.previousActionType === 'dribble').length;
    const unknownGoals = goals.filter(g => g.previousActionType === 'unknown').length;
    const ownGoals = goals.filter(g => g.ownGoal === 'yes').length;
    const ownGoalUnknown = goals.filter(g => g.ownGoal === 'unknown').length;

    const report: GoalProvenanceReport = {
      goals,
      summary: {
        totalGoals: goals.length,
        shotGoals,
        passGoals,
        crossGoals,
        dribbleGoals,
        unknownGoals,
        ownGoals,
        ownGoalUnknown,
        nonShotGoals: goals.length - shotGoals,
      },
      accounting: {
        totalGoals: goals.length,
        shotGoals,
        nonShotGoals: goals.length - shotGoals,
        ownGoals,
        ownGoalUnknown,
        shots: stats.shots.home + stats.shots.away,
        onTarget: stats.onTarget.home + stats.onTarget.away,
        xG: (stats.xG?.home ?? 0) + (stats.xG?.away ?? 0),
      },
    };

    console.log('=== GOAL PROVENANCE (per goal) ===');
    for (const goal of goals) {
      console.log(
        `GOAL #${goal.goalIndex}` +
        ` tick=${goal.tick ?? 'N/A'}` +
        ` minute=${goal.minute}` +
        ` scorer=${goal.scorerId ?? 'N/A'}` +
        ` scorerClub=${goal.scorerClubId ?? 'N/A'}` +
        ` lastTouch=${goal.lastTouchId ?? 'N/A'}` +
        ` lastTouchClub=${goal.lastTouchClubId ?? 'N/A'}` +
        ` prevAction=${goal.previousActionType}` +
        ` prevActionPlayer=${goal.previousActionPlayerId ?? 'N/A'}` +
        ` prevActionClub=${goal.previousActionClubId ?? 'N/A'}` +
        ` ownGoal=${goal.ownGoal}`
      );
    }

    console.log('=== GOAL PROVENANCE SUMMARY ===');
    console.table(report.summary);

    console.log('=== ACCOUNTING ===');
    console.table(report.accounting);

    console.log('=== EVENT TYPE COUNTS ===');
    const counts: Record<string, number> = {};
    for (const event of events) {
      counts[event.type] = (counts[event.type] ?? 0) + 1;
    }
    console.table(counts);

    return report;
  }
}
