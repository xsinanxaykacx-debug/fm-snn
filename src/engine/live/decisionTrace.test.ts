import { describe, it } from 'vitest';
import { simulateMatchLive } from './liveMatch';
import { generateGameData } from '../data/generateData';
import type {
  LiveMatchState,
  DecisionDebug,
} from '../types';

const RUN = process.env.RUN_LIVE_DIAGNOSTIC === '1';
const SEED = 1008;
const TRACE_START = 44360;
const TRACE_END = 45930;

interface DecisionSnapshot {
  timestamp: number | null;
  intent: string | null;
  reason: string | null;
  selected: string | null;
  candidateCount: number;
  passOptions: number;
  teammates: number;
  pressure: number | null;
  ballZone: string | null;
  selfZone: string | null;
  holdScore: number | null;
  passScores: number[];
  dribbleScore: number | null;
}

interface OwnershipRow {
  tick: number;
  prev: string | null;
  next: string | null;
  prevClub: string | null;
  nextClub: string | null;
  phase: 'acquire' | 'release';
  decision: DecisionSnapshot;
  eventTypes: string[];
  ballMoving: boolean;
  vx: number;
  vy: number;
  lastTouchId: string | null;
  lastTouchClubId: string | null;
  rng: number;
}

function snapshotDecision(debug: DecisionDebug | undefined): DecisionSnapshot {
  if (!debug) {
    return {
      timestamp: null,
      intent: null,
      reason: null,
      selected: null,
      candidateCount: 0,
      passOptions: 0,
      teammates: 0,
      pressure: null,
      ballZone: null,
      selfZone: null,
      holdScore: null,
      passScores: [],
      dribbleScore: null,
    };
  }

  const candidates = debug.candidates ?? [];
  const perception = debug.perception;

  return {
    timestamp: debug.timestamp,
    intent: debug.decision?.intent ?? null,
    reason: debug.decision?.reason ?? null,
    selected: debug.selected?.type ?? null,
    candidateCount: candidates.length,
    passOptions: perception.passOptions.length,
    teammates: perception.teammates.length,
    pressure: perception.pressure,
    ballZone: perception.zone.ball,
    selfZone: perception.zone.self,
    holdScore:
      candidates.find(candidate => candidate.type === 'hold')?.score ?? null,
    passScores: candidates
      .filter(candidate =>
        candidate.type === 'pass' ||
        candidate.type === 'through_ball'
      )
      .map(candidate => Number(candidate.score.toFixed(4))),
    dribbleScore:
      candidates.find(candidate => candidate.type === 'dribble')?.score ?? null,
  };
}

function shortId(id: string | null): string {
  if (id === null) return 'null';
  return id.slice(-8);
}

describe.skipIf(!RUN)('Decision trace — ownership cycle', () => {
  it('traces decision/perception state around the ownership cycle without changing production', () => {
    const data = generateGameData();
    const clubs = Object.values(data.clubs);

    for (const player of Object.values(data.players)) {
      player.condition = 100;
      player.fatigue = 0;
      player.injuryWeeks = 0;
      player.suspensionWeeks = 0;
      player.sentOff = false;
      player.injured = false;
      player.redCard = false;
    }

    const rows: OwnershipRow[] = [];
    let previousOwner: string | null = null;
    let previousEventCount = 0;

    simulateMatchLive(clubs[0], clubs[1], data.players, {
      seed: SEED,
      onTick: (state: LiveMatchState) => {
        if (
          state.tick >= TRACE_START &&
          state.tick <= TRACE_END &&
          state.ball.ownerId !== previousOwner
        ) {
          const nextOwner = state.ball.ownerId;
          const inspectedId =
            nextOwner !== null ? nextOwner : previousOwner;

          const inspectedDebug =
            inspectedId !== null
              ? state.decisions[inspectedId]
              : undefined;

          const eventTypes = state.events
            .slice(previousEventCount)
            .map(event => event.type);

          const player =
            inspectedId !== null
              ? state.players[inspectedId]
              : undefined;

          rows.push({
            tick: state.tick,
            prev: previousOwner,
            next: nextOwner,
            prevClub:
              previousOwner !== null
                ? state.players[previousOwner]?.clubId ?? null
                : null,
            nextClub:
              nextOwner !== null
                ? state.players[nextOwner]?.clubId ?? null
                : null,
            phase: nextOwner !== null ? 'acquire' : 'release',
            decision: snapshotDecision(inspectedDebug),
            eventTypes,
            ballMoving: state.ball.isMoving,
            vx: state.ball.velocity.x,
            vy: state.ball.velocity.y,
            lastTouchId: state.ball.lastTouchId,
            lastTouchClubId: state.ball.lastTouchClubId,
            rng: state.rng.counter,
          });
        }

        previousOwner = state.ball.ownerId;
        previousEventCount = state.events.length;
      },
    });

    const acquisitions = rows.filter(row => row.phase === 'acquire');
    const releases = rows.filter(row => row.phase === 'release');

    const acquisitionPassZero = acquisitions.filter(
      row => row.decision.passOptions === 0
    ).length;

    const acquisitionPassPositive = acquisitions.filter(
      row => row.decision.passOptions > 0
    ).length;

    const acquisitionSelectedHold = acquisitions.filter(
      row => row.decision.selected === 'hold'
    ).length;

    const acquisitionSelectedAction = acquisitions.filter(
      row =>
        row.decision.selected !== null &&
        row.decision.selected !== 'hold'
    ).length;

    const releasePrevHold = releases.filter(
      row => row.decision.selected === 'hold' ||
        row.decision.intent === 'hold'
    ).length;

    const releasePrevDribble = releases.filter(
      row => row.decision.selected === 'dribble' ||
        row.decision.intent === 'dribble'
    ).length;

    const releasePrevPass = releases.filter(
      row =>
        row.decision.selected === 'pass' ||
        row.decision.selected === 'through_ball' ||
        row.decision.intent === 'pass'
    ).length;

    const releaseWithActionEvent = releases.filter(
      row => row.eventTypes.length > 0
    ).length;

    console.log('\n=====================================================');
    console.log('DECISION TRACE — OWNERSHIP CYCLE');
    console.log('=====================================================\n');

    console.log('seed:', SEED);
    console.log('window:', TRACE_START, '-', TRACE_END);
    console.log('ownership changes:', rows.length);
    console.log('acquisitions:', acquisitions.length);
    console.log('releases:', releases.length);

    console.log('\n--- ACQUISITION DECISION SUMMARY ---');
    console.log('passOptions = 0:', acquisitionPassZero);
    console.log('passOptions > 0:', acquisitionPassPositive);
    console.log('selected = hold:', acquisitionSelectedHold);
    console.log('selected != hold:', acquisitionSelectedAction);

    console.log('\n--- RELEASE DECISION SUMMARY ---');
    console.log('previous selected/intent = hold:', releasePrevHold);
    console.log('previous selected/intent = dribble:', releasePrevDribble);
    console.log('previous selected/intent = pass:', releasePrevPass);
    console.log('release with new event:', releaseWithActionEvent);

    console.log('\n--- ACQUISITIONS ---');
    console.table(
      acquisitions.map(row => ({
        tick: row.tick,
        player: shortId(row.next),
        decisionTick: row.decision.timestamp,
        intent: row.decision.intent,
        reason: row.decision.reason,
        selected: row.decision.selected,
        candidates: row.decision.candidateCount,
        passOptions: row.decision.passOptions,
        teammates: row.decision.teammates,
        pressure: row.decision.pressure,
        holdScore: row.decision.holdScore,
        passScores: row.decision.passScores.join(','),
        dribbleScore: row.decision.dribbleScore,
        lastTouch: shortId(row.lastTouchId),
        moving: row.ballMoving,
        rng: row.rng,
      }))
    );

    console.log('\n--- RELEASES ---');
    console.table(
      releases.map(row => ({
        tick: row.tick,
        player: shortId(row.prev),
        decisionTick: row.decision.timestamp,
        intent: row.decision.intent,
        reason: row.decision.reason,
        selected: row.decision.selected,
        candidates: row.decision.candidateCount,
        passOptions: row.decision.passOptions,
        teammates: row.decision.teammates,
        pressure: row.decision.pressure,
        holdScore: row.decision.holdScore,
        passScores: row.decision.passScores.join(','),
        dribbleScore: row.decision.dribbleScore,
        events: row.eventTypes.join(','),
        lastTouch: shortId(row.lastTouchId),
        moving: row.ballMoving,
        vx: Number(row.vx.toFixed(2)),
        vy: Number(row.vy.toFixed(2)),
        rng: row.rng,
      }))
    );

    console.log('\n--- ÖZET ---');
    console.log(JSON.stringify({
      seed: SEED,
      window: [TRACE_START, TRACE_END],
      ownershipChanges: rows.length,
      acquisitions: {
        total: acquisitions.length,
        passOptionsZero: acquisitionPassZero,
        passOptionsPositive: acquisitionPassPositive,
        selectedHold: acquisitionSelectedHold,
        selectedNonHold: acquisitionSelectedAction,
      },
      releases: {
        total: releases.length,
        previousHold: releasePrevHold,
        previousDribble: releasePrevDribble,
        previousPass: releasePrevPass,
        withActionEvent: releaseWithActionEvent,
      },
    }, null, 2));
  }, 60 * 60 * 1000);
});
