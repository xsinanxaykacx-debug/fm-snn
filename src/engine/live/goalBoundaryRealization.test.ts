import { describe, it, expect, vi, afterEach } from 'vitest';
import * as eventsModule from './events';
import { simulateMatchLive } from './liveMatch';
import { installDeterministicRandom, DEFAULT_FIXTURE_SEED, type DeterministicRandomHandle } from './diagnostics/deterministicFixture';
import { generateGameData } from '../data/generateData';
import type { MatchEvent, LiveMatchState } from '../types';

const MATCH_SEED = 1000;
const MATCH_TICKS = 54_000;
const RUN = typeof process !== 'undefined' && process.env.RUN_GOAL_BOUNDARY_REALIZATION === '1';

type Classification = 'GERÇEK GOL' | 'KURTARIŞ' | 'ANOMALİ';

interface GoalBoundaryCall {
  boundaryTick: number;
  prevBallPos: { x: number; y: number; z: number };
  nextBallPos: { x: number; y: number; z: number };
  lastTouchId: string | null;
  lastTouchClubId: string | null;
  scorerSide: string;
  ownGoal: boolean;
}

interface TickSnapshot {
  tick: number;
  scoreHome: number;
  scoreAway: number;
  events: MatchEvent[];
}

interface Realization {
  boundaryTick: number;
  prevBallPos: GoalBoundaryCall['prevBallPos'];
  nextBallPos: GoalBoundaryCall['nextBallPos'];
  lastTouchId: string | null;
  lastTouchClubId: string | null;
  scorerSide: string;
  ownGoal: boolean;
  scoreBefore: string;
  scoreAfter: string;
  scoreChanged: boolean;
  goalEventPushed: boolean;
  goalKickEventPushed: boolean;
  kickoffEventPushed: boolean;
  newEvents: string[];
  classification: Classification;
}

function scoreOf(snapshot: TickSnapshot | undefined): string {
  return snapshot ? `${snapshot.scoreHome}-${snapshot.scoreAway}` : 'N/A';
}

function classify(
  scoreChanged: boolean,
  goalEventPushed: boolean,
  goalKickEventPushed: boolean,
  kickoffEventPushed: boolean,
): Classification {
  if (scoreChanged && goalEventPushed && kickoffEventPushed) return 'GERÇEK GOL';
  if (!scoreChanged && goalKickEventPushed) return 'KURTARIŞ';
  return 'ANOMALİ';
}

describe('Goal Boundary Realization Classifier V8', () => {
  let random: DeterministicRandomHandle | null = null;
  let boundarySpy: ReturnType<typeof vi.spyOn> | null = null;

  afterEach(() => {
    boundarySpy?.mockRestore();
    random?.restore();
    boundarySpy = null;
    random = null;
  });

  it('classifies every boundary goal into real goal, goalkeeper save, or anomaly', ({ skip }) => {
    if (!RUN) skip();

    random = installDeterministicRandom(DEFAULT_FIXTURE_SEED);

    const snapshots = new Map<number, TickSnapshot>();
    const goalBoundaries: GoalBoundaryCall[] = [];
    let currentTick = 0;

    const originalBoundary = eventsModule.detectBoundaryOutcome;
    boundarySpy = vi.spyOn(eventsModule, 'detectBoundaryOutcome').mockImplementation(input => {
      const result = originalBoundary(input);
      const tick = currentTick + 1;

      if (result.type === 'goal') {
        goalBoundaries.push({
          boundaryTick: tick,
          prevBallPos: { ...input.prevBallPos },
          nextBallPos: { ...input.nextBallPos },
          lastTouchId: input.lastTouchId ?? null,
          lastTouchClubId: input.lastTouchClubId ?? null,
          scorerSide: result.scorerSide,
          ownGoal: result.ownGoal,
        });
      }

      return result;
    });

    const data = generateGameData();
    const clubs = Object.values(data.clubs);
    const home = structuredClone(clubs[0]);
    const away = structuredClone(clubs[1]);
    const players = structuredClone(data.players);

    simulateMatchLive(home, away, players, {
      seed: MATCH_SEED,
      maxTicks: MATCH_TICKS,
      onTick: (state: LiveMatchState) => {
        const previous = snapshots.get(state.tick - 1);

        const eventsStart = previous?.events.length ?? 0;
        const newEvents = state.events.slice(eventsStart);

        snapshots.set(state.tick, {
          tick: state.tick,
          scoreHome: state.score.home,
          scoreAway: state.score.away,
          events: newEvents,
        });

        currentTick = state.tick;
      },
    });

    const realizations: Realization[] = goalBoundaries.map(goal => {
      const current = snapshots.get(goal.boundaryTick);
      const previous = snapshots.get(goal.boundaryTick - 1);

      const scoreChanged = !!current && !!previous &&
        (current.scoreHome !== previous.scoreHome || current.scoreAway !== previous.scoreAway);

      const newEvents = current?.events ?? [];
      const eventTypes = newEvents.map(event => event.type);
      const goalEventPushed = newEvents.some(event => event.type === 'goal');
      const goalKickEventPushed = newEvents.some(event => event.type === 'goal_kick');
      const kickoffEventPushed = newEvents.some(event => event.type === 'kickoff');

      return {
        boundaryTick: goal.boundaryTick,
        prevBallPos: goal.prevBallPos,
        nextBallPos: goal.nextBallPos,
        lastTouchId: goal.lastTouchId,
        lastTouchClubId: goal.lastTouchClubId,
        scorerSide: goal.scorerSide,
        ownGoal: goal.ownGoal,
        scoreBefore: scoreOf(previous),
        scoreAfter: scoreOf(current),
        scoreChanged,
        goalEventPushed,
        goalKickEventPushed,
        kickoffEventPushed,
        newEvents: eventTypes,
        classification: classify(scoreChanged, goalEventPushed, goalKickEventPushed, kickoffEventPushed),
      };
    });

    let realGoals = 0;
    let goalkeeperSaves = 0;
    let anomalies = 0;

    console.log('');
    console.log('=== V8 GOAL BOUNDARY REALIZATION ===');
    console.log(`seed=${MATCH_SEED} ticks=${MATCH_TICKS}`);
    console.log(`goal boundary calls=${realizations.length}`);
    console.log('');

    for (const r of realizations) {
      if (r.classification === 'GERÇEK GOL') realGoals++;
      else if (r.classification === 'KURTARIŞ') goalkeeperSaves++;
      else anomalies++;

      const marker = r.boundaryTick === 53422 ? ' <-- V6 #45' :
        r.boundaryTick === 53573 ? ' <-- V7 SAVE' : '';

      console.log(
        `tick=${r.boundaryTick} ${r.classification}${marker} ` +
        `prev=(${r.prevBallPos.x.toFixed(3)},${r.prevBallPos.y.toFixed(3)},${r.prevBallPos.z.toFixed(3)}) ` +
        `next=(${r.nextBallPos.x.toFixed(3)},${r.nextBallPos.y.toFixed(3)},${r.nextBallPos.z.toFixed(3)})`
      );
      console.log(
        `  lastTouch=${r.lastTouchId ?? 'null'} club=${r.lastTouchClubId ?? 'null'} ` +
        `scorerSide=${r.scorerSide} ownGoal=${r.ownGoal}`
      );
      console.log(
        `  score=${r.scoreBefore} -> ${r.scoreAfter} scoreChanged=${r.scoreChanged} ` +
        `goal=${r.goalEventPushed} goalKick=${r.goalKickEventPushed} kickoff=${r.kickoffEventPushed}`
      );
      console.log(`  newEvents=[${r.newEvents.join(',')}]`);
    }

    console.log('');
    console.log('=== V8 SUMMARY ===');
    console.log(`goalBoundaryCalls=${realizations.length}`);
    console.log(`realGoals=${realGoals}`);
    console.log(`goalkeeperSaves=${goalkeeperSaves}`);
    console.log(`anomalies=${anomalies}`);
    console.log(`partitionCheck=${realGoals + goalkeeperSaves + anomalies === realizations.length}`);
    console.log('');

    const v6Count = 46;
    console.log(`V6 reference goal-boundary count=${v6Count}`);
    console.log(`V6 count matches V8=${realizations.length === v6Count}`);

    const ownGoalCount = realizations.filter(r => r.ownGoal).length;
    const realOwnGoalCount = realizations.filter(r => r.ownGoal && r.classification === 'GERÇEK GOL').length;
    console.log(`ownGoal boundary classifications=${ownGoalCount}`);
    console.log(`real own goals=${realOwnGoalCount}`);

    const target53422 = realizations.filter(r => r.boundaryTick === 53422);
    const target53573 = realizations.filter(r => r.boundaryTick === 53573);

    console.log('');
    console.log('=== V8 REQUIRED TARGETS ===');
    console.log(`53422 count=${target53422.length}`);
    for (const r of target53422) {
      console.log(`53422 classification=${r.classification} score=${r.scoreBefore}->${r.scoreAfter} goal=${r.goalEventPushed} goalKick=${r.goalKickEventPushed} kickoff=${r.kickoffEventPushed}`);
    }
    console.log(`53573 count=${target53573.length}`);
    for (const r of target53573) {
      console.log(`53573 classification=${r.classification} score=${r.scoreBefore}->${r.scoreAfter} goal=${r.goalEventPushed} goalKick=${r.goalKickEventPushed} kickoff=${r.kickoffEventPushed}`);
    }

    expect(realizations.length).toBe(v6Count);
    expect(realGoals + goalkeeperSaves + anomalies).toBe(realizations.length);
    expect(target53573.length).toBe(1);
    expect(target53573[0].classification).toBe('KURTARIŞ');
  }, 10 * 60 * 1000);
});
