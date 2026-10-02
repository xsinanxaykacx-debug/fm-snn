// src/engine/live/matchDeterminismDiagnostic.test.ts
//
// Diagnostic-only: aynı production kodunda seed 1008'in
// A / B / C koşullarında deterministik olup olmadığını kanıtlar.
//
// A: seed 1008 tek başına.
// B: aynı Player/Club dataset'i üzerinde 1000..1007, ardından 1008.
// C: seed 1008 tekrar tek başına.
//
// Production koduna dokunmaz. B senaryosunda V4'teki match-reset davranışı
// uygulanır; böylece inter-match fark ile oyuncu kondisyon/fatigue birikimi
// ayrıştırılabilir.
//
// Kullanım:
//   $env:RUN_LIVE_DIAGNOSTIC="1"
//   npx vitest run src/engine/live/matchDeterminismDiagnostic.test.ts

import { describe, expect, it } from 'vitest';
import { simulateMatchLive } from './liveMatch';
import { generateGameData } from '../data/generateData';
import type {
  Club,
  LiveMatchState,
  Player,
  TackleOutcome,
} from '../types';

const RUN = process.env.RUN_LIVE_DIAGNOSTIC === '1';
const TARGET_SEED = 1008;
const WARMUP_SEEDS = [1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007];

type BallSnapshot = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};

type PendingSnapshot = {
  playerId: string | null;
  clubId: string | null;
};

type TickSnapshot = {
  tick: number;
  time: number;
  rngCounter: number;
  ownerId: string | null;
  ball: BallSnapshot;
  pending: PendingSnapshot;
};

type PossessionEvent = {
  tick: number;
  ownerId: string | null;
};

type TackleEvent = {
  tick: number;
  runner: string;
  owner: string;
  distance: number | null;
  outcome: TackleOutcome['type'];
};

type LooseBallEvent = {
  tick: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};

type InterceptionEvent = {
  tick: number;
};

type PendingStartEvent = {
  tick: number;
  playerId: string;
  clubId: string;
};

type RunTrace = {
  label: string;
  seed: number;
  ticks: TickSnapshot[];
  firstPossessionChange: PossessionEvent | null;
  firstTackle: TackleEvent | null;
  firstLooseBall: LooseBallEvent | null;
  firstInterception: InterceptionEvent | null;
  firstPendingStart: PendingStartEvent | null;
  finalRngCounter: number;
  finalStats: {
    homeGoals: number;
    awayGoals: number;
    homePossession: number;
    awayPossession: number;
    tackleCount: number;
    tackleWins: number;
    tackleFouls: number;
    tackleFailures: number;
  };
  totalTicks: number;
  matchDuration: number;
};

function resetPlayersForNextMatch(players: Record<string, Player>): void {
  for (const player of Object.values(players)) {
    player.condition = 100;
    player.fatigue = 0;
    player.injuryWeeks = 0;
    player.suspensionWeeks = 0;
    player.sentOff = false;
    player.injured = false;
    player.redCard = false;
  }
}

function cloneData<T>(value: T): T {
  return structuredClone(value);
}

function getFixture(data: {
  clubs: Record<string, Club>;
  players: Record<string, Player>;
}): { home: Club; away: Club } {
  const clubs = Object.values(data.clubs);
  if (clubs.length < 2) {
    throw new Error('Determinism diagnostic için en az iki kulüp gerekli.');
  }

  return {
    home: clubs[0],
    away: clubs[1],
  };
}

function snapshotTick(state: LiveMatchState): TickSnapshot {
  return {
    tick: state.tick,
    time: state.time,
    rngCounter: state.rng.counter,
    ownerId: state.ball.ownerId,
    ball: {
      x: state.ball.position.x,
      y: state.ball.position.y,
      z: state.ball.position.z,
      vx: state.ball.velocity.x,
      vy: state.ball.velocity.y,
      vz: state.ball.velocity.z,
    },
    pending: {
      playerId: state.transition.pendingLooseBallRecoveryPlayerId,
      clubId: state.transition.pendingLooseBallRecoveryClubId,
    },
  };
}

function distanceXY(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  return Math.hypot(ax - bx, ay - by);
}

function runTargetMatch(
  label: string,
  data: {
    clubs: Record<string, Club>;
    players: Record<string, Player>;
  },
): RunTrace {
  const { home, away } = getFixture(data);

  const ticks: TickSnapshot[] = [];
  let previousOwnerId: string | null = null;
  let previousPendingPlayerId: string | null = null;

  let firstPossessionChange: PossessionEvent | null = null;
  let firstTackle: TackleEvent | null = null;
  let firstLooseBall: LooseBallEvent | null = null;
  let firstInterception: InterceptionEvent | null = null;
  let firstPendingStart: PendingStartEvent | null = null;

  let tackleCount = 0;
  let tackleWins = 0;
  let tackleFouls = 0;
  let tackleFailures = 0;

  const onTackleResolved = (outcome: TackleOutcome): void => {
    tackleCount++;

    if (outcome.type === 'won') tackleWins++;
    else if (outcome.type === 'foul') tackleFouls++;
    else tackleFailures++;

    if (firstTackle === null) {
      firstTackle = {
        tick: currentTick,
        runner: outcome.tacklerId,
        owner: outcome.ballCarrierId,
        distance:
          outcome.debug && typeof outcome.debug.distance === 'number'
            ? outcome.debug.distance
            : null,
        outcome: outcome.type,
      };
    }
  };

  let currentTick = 0;

  const onTick = (state: LiveMatchState): void => {
    currentTick = state.tick;

    const currentOwnerId = state.ball.ownerId;
    const currentPendingPlayerId =
      state.transition.pendingLooseBallRecoveryPlayerId;

    ticks.push(snapshotTick(state));

    if (
      firstPossessionChange === null &&
      currentOwnerId !== previousOwnerId
    ) {
      firstPossessionChange = {
        tick: state.tick,
        ownerId: currentOwnerId,
      };
    }

    const ballSpeed = Math.hypot(
      state.ball.velocity.x,
      state.ball.velocity.y,
    );

    if (
      firstLooseBall === null &&
      previousOwnerId !== null &&
      currentOwnerId === null &&
      ballSpeed > 0
    ) {
      firstLooseBall = {
        tick: state.tick,
        x: state.ball.position.x,
        y: state.ball.position.y,
        z: state.ball.position.z,
        vx: state.ball.velocity.x,
        vy: state.ball.velocity.y,
        vz: state.ball.velocity.z,
      };
    }

    // handlePassAction interception için ayrı callback yok.
    // Production'daki "Pas kesildi" event'i interception sinyalidir.
    const lastEvent = state.events[state.events.length - 1];
    if (
      firstInterception === null &&
      lastEvent?.type === 'pass' &&
      lastEvent.description.startsWith('Pas kesildi:')
    ) {
      firstInterception = { tick: state.tick };
    }

    if (
      firstPendingStart === null &&
      previousPendingPlayerId === null &&
      currentPendingPlayerId !== null
    ) {
      const pendingPlayer = state.players[currentPendingPlayerId];

      if (pendingPlayer) {
        firstPendingStart = {
          tick: state.tick,
          playerId: currentPendingPlayerId,
          clubId: pendingPlayer.clubId,
        };
      }
    }

    previousOwnerId = currentOwnerId;
    previousPendingPlayerId = currentPendingPlayerId;
  };

  const match = simulateMatchLive(home, away, data.players, {
    seed: TARGET_SEED,
    onTick,
    onTackleResolved,
  });

  return {
    label,
    seed: TARGET_SEED,
    ticks,
    firstPossessionChange,
    firstTackle,
    firstLooseBall,
    firstInterception,
    firstPendingStart,
    finalRngCounter:
      ticks.length > 0
        ? ticks[ticks.length - 1].rngCounter
        : 0,
    finalStats: {
      homeGoals: match.homeScore,
      awayGoals: match.awayScore,
      homePossession: match.stats.possession.home,
      awayPossession: match.stats.possession.away,
      tackleCount,
      tackleWins,
      tackleFouls,
      tackleFailures,
    },
    totalTicks: match.stats.ticks ?? ticks.length,
    matchDuration: match.stats.simulationSeconds ?? 0,
  };
}

function firstDivergence(
  a: TickSnapshot[],
  b: TickSnapshot[],
): {
  tick: number | null;
  field: string | null;
  a: unknown;
  b: unknown;
} {
  const count = Math.min(a.length, b.length);

  for (let i = 0; i < count; i++) {
    const av = a[i];
    const bv = b[i];

    const checks: Array<[string, unknown, unknown]> = [
      ['tick', av.tick, bv.tick],
      ['time', av.time, bv.time],
      ['rng.counter', av.rngCounter, bv.rngCounter],
      ['ball.ownerId', av.ownerId, bv.ownerId],
      ['ball.position.x', av.ball.x, bv.ball.x],
      ['ball.position.y', av.ball.y, bv.ball.y],
      ['ball.position.z', av.ball.z, bv.ball.z],
      ['ball.velocity.x', av.ball.vx, bv.ball.vx],
      ['ball.velocity.y', av.ball.vy, bv.ball.vy],
      ['ball.velocity.z', av.ball.vz, bv.ball.vz],
      ['pending.playerId', av.pending.playerId, bv.pending.playerId],
      ['pending.clubId', av.pending.clubId, bv.pending.clubId],
    ];

    for (const [field, left, right] of checks) {
      if (!Object.is(left, right)) {
        return {
          tick: av.tick,
          field,
          a: left,
          b: right,
        };
      }
    }
  }

  if (a.length !== b.length) {
    return {
      tick: a[count]?.tick ?? b[count]?.tick ?? null,
      field: 'trace.length',
      a: a.length,
      b: b.length,
    };
  }

  return {
    tick: null,
    field: null,
    a: null,
    b: null,
  };
}

function eventKey<T extends object>(value: T | null): string {
  return value === null ? 'null' : JSON.stringify(value);
}

function printEventComparison(
  name: string,
  a: RunTrace,
  b: RunTrace,
): void {
  console.log(
    name,
    eventKey((a as unknown as Record<string, unknown>)[name] as object | null),
    eventKey((b as unknown as Record<string, unknown>)[name] as object | null),
  );
}

function printFirstDivergenceTable(
  a: RunTrace,
  b: RunTrace,
  label: string,
): void {
  const d = firstDivergence(a.ticks, b.ticks);

  console.table([
    {
      comparison: label,
      firstDivergenceTick: d.tick,
      field: d.field,
      A: d.a,
      B: d.b,
      A_finalRng: a.finalRngCounter,
      B_finalRng: b.finalRngCounter,
      A_totalTicks: a.totalTicks,
      B_totalTicks: b.totalTicks,
    },
  ]);
}

function printTraceSummary(a: RunTrace, b: RunTrace): void {
  console.log('\n=== EVENT COMPARISON A / B / C ===');

  console.table([
    {
      event: 'first possession change',
      A: eventKey(a.firstPossessionChange),
      B: eventKey(b.firstPossessionChange),
      C: eventKey(arguments.length ? null : null),
    },
  ]);
}

function printAllComparisons(
  a: RunTrace,
  b: RunTrace,
  c: RunTrace,
): void {
  console.log('\n=== MATCH DETERMINISM DIAGNOSTIC ===\n');

  console.log('--- FIRST EVENTS ---');
  console.table([
    {
      event: 'possession change',
      A: eventKey(a.firstPossessionChange),
      B: eventKey(b.firstPossessionChange),
      C: eventKey(c.firstPossessionChange),
    },
    {
      event: 'tackle',
      A: eventKey(a.firstTackle),
      B: eventKey(b.firstTackle),
      C: eventKey(c.firstTackle),
    },
    {
      event: 'loose-ball',
      A: eventKey(a.firstLooseBall),
      B: eventKey(b.firstLooseBall),
      C: eventKey(c.firstLooseBall),
    },
    {
      event: 'interception',
      A: eventKey(a.firstInterception),
      B: eventKey(b.firstInterception),
      C: eventKey(c.firstInterception),
    },
    {
      event: 'pending start',
      A: eventKey(a.firstPendingStart),
      B: eventKey(b.firstPendingStart),
      C: eventKey(c.firstPendingStart),
    },
  ]);

  console.log('\n--- MATCH TOTALS ---');
  console.table([
    {
      run: 'A',
      finalRngCounter: a.finalRngCounter,
      totalTicks: a.totalTicks,
      duration: a.matchDuration,
      goals: a.finalStats.homeGoals + '-' + a.finalStats.awayGoals,
      possession: a.finalStats.homePossession + '-' + a.finalStats.awayPossession,
      tackles: a.finalStats.tackleCount,
      tackleWins: a.finalStats.tackleWins,
      tackleFouls: a.finalStats.tackleFouls,
      tackleFailures: a.finalStats.tackleFailures,
    },
    {
      run: 'B',
      finalRngCounter: b.finalRngCounter,
      totalTicks: b.totalTicks,
      duration: b.matchDuration,
      goals: b.finalStats.homeGoals + '-' + b.finalStats.awayGoals,
      possession: b.finalStats.homePossession + '-' + b.finalStats.awayPossession,
      tackles: b.finalStats.tackleCount,
      tackleWins: b.finalStats.tackleWins,
      tackleFouls: b.finalStats.tackleFouls,
      tackleFailures: b.finalStats.tackleFailures,
    },
    {
      run: 'C',
      finalRngCounter: c.finalRngCounter,
      totalTicks: c.totalTicks,
      duration: c.matchDuration,
      goals: c.finalStats.homeGoals + '-' + c.finalStats.awayScore,
      possession: c.finalStats.homePossession + '-' + c.finalStats.awayPossession,
      tackles: c.finalStats.tackleCount,
      tackleWins: c.finalStats.tackleWins,
      tackleFouls: c.finalStats.tackleFouls,
      tackleFailures: c.finalStats.tackleFailures,
    },
  ]);

  console.log('\n--- FIRST DIVERGENCE: A vs B ---');
  printFirstDivergenceTable(a, b, 'A vs B');

  console.log('\n--- FIRST DIVERGENCE: A vs C ---');
  printFirstDivergenceTable(a, c, 'A vs C');

  console.log('\n--- DECISION ---');
  const ab = firstDivergence(a.ticks, b.ticks);
  const ac = firstDivergence(a.ticks, c.ticks);

  console.table([
    {
      test: 'A == C',
      result: ac.tick === null ? 'PASS' : 'FAIL',
      meaning:
        ac.tick === null
          ? 'Tek maç determinizmi korunuyor.'
          : 'Aynı seed + aynı input ile tek maçta ayrışma var.',
    },
    {
      test: 'A == B',
      result: ab.tick === null ? 'PASS' : 'FAIL',
      meaning:
        ab.tick === null
          ? 'Önceki maçlar target seed 1008 sonucunu değiştirmiyor.'
          : '1000..1007 sonrasında target maç ayrışıyor.',
    },
  ]);
}

describe('Match determinism diagnostic', () => {
  it(
    'seed 1008 için A/B/C determinizmini karşılaştırır',
    () => {
      if (!RUN) {
        console.log(
          '[determinism] RUN_LIVE_DIAGNOSTIC=1 değil, tanı atlandı.',
        );
        return;
      }

      // generateGameData() Math.random() kullanıyor. Bu yüzden A/C'nin
      // dataset'lerini ayrı ayrı üretmek determinism testi olamaz.
      // Tek bir baseline üretip üç bağımsız clone üzerinden çalıştırıyoruz.
      const baseline = generateGameData();

      // A — yalnızca 1008.
      const dataA = cloneData(baseline);
      resetPlayersForNextMatch(dataA.players);
      const traceA = runTargetMatch('A', dataA);

      // B — aynı dataset üzerinde 1000..1007, sonra 1008.
      const dataB = cloneData(baseline);
      resetPlayersForNextMatch(dataB.players);

      const { home: bHome, away: bAway } = getFixture(dataB);
      for (const seed of WARMUP_SEEDS) {
        resetPlayersForNextMatch(dataB.players);
        simulateMatchLive(bHome, bAway, dataB.players, { seed });
      }

      resetPlayersForNextMatch(dataB.players);
      const traceB = runTargetMatch('B', dataB);

      // C — baseline'ın yeni clone'u; tekrar yalnızca 1008.
      const dataC = cloneData(baseline);
      resetPlayersForNextMatch(dataC.players);
      const traceC = runTargetMatch('C', dataC);

      printAllComparisons(traceA, traceB, traceC);

      expect(firstDivergence(traceA.ticks, traceC.ticks).tick).toBeNull();
    },
    60 * 60 * 1000,
  );
});
