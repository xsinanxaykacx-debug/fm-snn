// src/engine/live/finalValidation100.test.ts
//
// Final validation screening V1 — 10 maç diagnostic
//
// Sözleşme:
//   - 10 maç / seed 1000–1009
//   - normal maç süresi: 90:00 / 108.000 tick
//   - kabul eşiği YOK; ilk dağılım gözlemlenir
//   - production koduna dokunmaz
//
// Kullanım:
//   git pull --ff-only
//   $env:RUN_FINAL_VALIDATION="1"
//   npx vitest run src/engine/live/finalValidation100.test.ts

import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import type { Club, LiveMatchStats, Player } from '../types';
import { simulateMatchLive } from './liveMatch';

// ═══════════════════════════════════════════════
// KONFİGÜRASYON
// ═══════════════════════════════════════════════

const SEED_START = 1000;
const SEED_END = 1009;
const MATCH_TICKS = 108_000;
const MATCH_SECONDS = 5_400;

const RUN =
  typeof process !== 'undefined' &&
  process.env.RUN_FINAL_VALIDATION === '1';

// ═══════════════════════════════════════════════
// BASELINE
// ═══════════════════════════════════════════════
//
// generateGameData() kendi içinde Math.random kullanır.
// Bu validation'da yalnızca BİR KEZ baseline üretiriz.
// Her maç ve determinism koşusu aynı baseline'ın deep clone'u
// üzerinde çalışır. Böylece generateGameData randomness'i,
// seeded live-engine determinism testine karışmaz.

type Baseline = {
  clubs: Record<string, Club>;
  players: Record<string, Player>;
};

function cloneData<T>(value: T): T {
  return structuredClone(value);
}

function createBaseline(): Baseline {
  return generateGameData();
}

function getFixture(data: Baseline): {
  home: Club;
  away: Club;
} {
  const clubs = Object.values(data.clubs);

  if (clubs.length < 2) {
    throw new Error(
      'Final validation için en az iki kulüp gerekli.',
    );
  }

  return {
    home: clubs[0],
    away: clubs[1],
  };
}

// ═══════════════════════════════════════════════
// EVENT FINGERPRINT
// ═══════════════════════════════════════════════
//
// V2 sözleşmesindeki "state.events sequence" karşılaştırması.
// Sadece minute/type/clubId değil; event sırasını ve mevcut
// anlamlı alanları da dahil ediyoruz.

function eventFingerprint(
  events: Array<{
    minute: number;
    type: string;
    clubId?: string;
    playerId?: string;
    team?: string;
    description: string;
    xG?: number;
    weeks?: number;
  }>,
): string {
  return events
    .map(event =>
      JSON.stringify([
        event.minute,
        event.type,
        event.clubId ?? '',
        event.playerId ?? '',
        event.team ?? '',
        event.description,
        event.xG ?? null,
        event.weeks ?? null,
      ]),
    )
    .join(';');
}

// ═══════════════════════════════════════════════
// MATCH RECORD
// ═══════════════════════════════════════════════

interface MatchRecord {
  seed: number;
  score: {
    home: number;
    away: number;
  };
  stats: LiveMatchStats;
  eventFingerprint: string;

  // Set-piece event/taker observability audit.
  setPieceEventCounts: {
    kickoff: number;
    corner: number;
    throwIn: number;
    goalKick: number;
    freeKick: number;
    penalty: number;
  };
  setPieceEventsWithoutPlayerId: number;
  setPieceEventsWithPlayerId: number;
}

function runMatch(
  baseline: Baseline,
  seed: number,
): MatchRecord {
  // Home/away dahil tüm fixture verisi aynı baseline'dan clone edilir.
  // Production state'i maçlar arasında taşınmaz.
  const data = cloneData(baseline);
  const { home, away } = getFixture(data);

  const result = simulateMatchLive(
    home,
    away,
    data.players,
    {
      seed,
      maxTicks: MATCH_TICKS,
    },
  );

  const setPieceTypes = new Set([
    'kickoff',
    'corner',
    'throw_in',
    'goal_kick',
    'free_kick',
    'penalty',
  ]);

  const setPieceEventCounts = {
    kickoff: 0,
    corner: 0,
    throwIn: 0,
    goalKick: 0,
    freeKick: 0,
    penalty: 0,
  };

  let setPieceEventsWithoutPlayerId = 0;
  let setPieceEventsWithPlayerId = 0;

  for (const event of result.events) {
    if (!setPieceTypes.has(event.type)) continue;

    if (event.type === 'kickoff') setPieceEventCounts.kickoff++;
    else if (event.type === 'corner') setPieceEventCounts.corner++;
    else if (event.type === 'throw_in') setPieceEventCounts.throwIn++;
    else if (event.type === 'goal_kick') setPieceEventCounts.goalKick++;
    else if (event.type === 'free_kick') setPieceEventCounts.freeKick++;
    else if (event.type === 'penalty') setPieceEventCounts.penalty++;

    if (event.playerId) {
      setPieceEventsWithPlayerId++;
    } else {
      setPieceEventsWithoutPlayerId++;
    }
  }

  return {
    seed,
    score: {
      home: result.homeScore,
      away: result.awayScore,
    },
    stats: result.stats as LiveMatchStats,
    eventFingerprint: eventFingerprint(result.events),
    setPieceEventCounts,
    setPieceEventsWithoutPlayerId,
    setPieceEventsWithPlayerId,
  };
}

// ═══════════════════════════════════════════════
// AGGREGATE
// ═══════════════════════════════════════════════

interface Aggregate {
  matches: number;

  goalsHome: number;
  goalsAway: number;

  xGHome: number;
  xGAway: number;

  shotsHome: number;
  shotsAway: number;

  onTargetHome: number;
  onTargetAway: number;

  passesHome: number;
  passesAway: number;

  passesCompletedHome: number;
  passesCompletedAway: number;

  possessionHomeSum: number;

  foulsHome: number;
  foulsAway: number;

  cornersHome: number;
  cornersAway: number;

  throwInsHome: number;
  throwInsAway: number;

  goalKicksHome: number;
  goalKicksAway: number;

  yellowHome: number;
  yellowAway: number;

  redHome: number;
  redAway: number;

  cpAttempts: number;
  cpRollsPassed: number;
  cpTackleWins: number;
  cpTackleFailures: number;
  cpTackleFouls: number;
  cpRecoveries: number;
  cpClean: number;
  cpLoose: number;

  cpWinChanceSum: number;
  cpWinChanceMin: number;
  cpWinChanceMax: number;
  cpRelativeSpeedSum: number;
  cpDistanceSum: number;

  setPieceKickoffs: number;
  setPieceCorners: number;
  setPieceThrowIns: number;
  setPieceGoalKicks: number;
  setPieceFreeKicks: number;
  setPiecePenalties: number;
  setPieceEventsWithoutPlayerId: number;
  setPieceEventsWithPlayerId: number;

  totalEventsSum: number;
  totalTicksSum: number;
  simulationSecondsSum: number;
}

function emptyAggregate(): Aggregate {
  return {
    matches: 0,

    goalsHome: 0,
    goalsAway: 0,

    xGHome: 0,
    xGAway: 0,

    shotsHome: 0,
    shotsAway: 0,

    onTargetHome: 0,
    onTargetAway: 0,

    passesHome: 0,
    passesAway: 0,

    passesCompletedHome: 0,
    passesCompletedAway: 0,

    possessionHomeSum: 0,

    foulsHome: 0,
    foulsAway: 0,

    cornersHome: 0,
    cornersAway: 0,

    throwInsHome: 0,
    throwInsAway: 0,

    goalKicksHome: 0,
    goalKicksAway: 0,

    yellowHome: 0,
    yellowAway: 0,

    redHome: 0,
    redAway: 0,

    cpAttempts: 0,
    cpRollsPassed: 0,
    cpTackleWins: 0,
    cpTackleFailures: 0,
    cpTackleFouls: 0,
    cpRecoveries: 0,
    cpClean: 0,
    cpLoose: 0,

    cpWinChanceSum: 0,
    cpWinChanceMin: Number.POSITIVE_INFINITY,
    cpWinChanceMax: Number.NEGATIVE_INFINITY,
    cpRelativeSpeedSum: 0,
    cpDistanceSum: 0,

    setPieceKickoffs: 0,
    setPieceCorners: 0,
    setPieceThrowIns: 0,
    setPieceGoalKicks: 0,
    setPieceFreeKicks: 0,
    setPiecePenalties: 0,
    setPieceEventsWithoutPlayerId: 0,
    setPieceEventsWithPlayerId: 0,

    totalEventsSum: 0,
    totalTicksSum: 0,
    simulationSecondsSum: 0,
  };
}

function accumulate(
  agg: Aggregate,
  rec: MatchRecord,
): void {
  const s = rec.stats;

  agg.matches++;

  agg.goalsHome += rec.score.home;
  agg.goalsAway += rec.score.away;

  agg.xGHome += s.xG.home;
  agg.xGAway += s.xG.away;

  agg.shotsHome += s.shots.home;
  agg.shotsAway += s.shots.away;

  agg.onTargetHome += s.onTarget.home;
  agg.onTargetAway += s.onTarget.away;

  agg.passesHome += s.passes.home;
  agg.passesAway += s.passes.away;

  agg.passesCompletedHome += s.passesCompleted.home;
  agg.passesCompletedAway += s.passesCompleted.away;

  agg.possessionHomeSum += s.possession.home;

  agg.foulsHome += s.fouls.home;
  agg.foulsAway += s.fouls.away;

  agg.cornersHome += s.corners.home;
  agg.cornersAway += s.corners.away;

  agg.throwInsHome += s.throwIns.home;
  agg.throwInsAway += s.throwIns.away;

  agg.goalKicksHome += s.goalKicks.home;
  agg.goalKicksAway += s.goalKicks.away;

  agg.yellowHome += s.yellowCards.home;
  agg.yellowAway += s.yellowCards.away;

  agg.redHome += s.redCards.home;
  agg.redAway += s.redCards.away;

  agg.cpAttempts += s.counterPressAttempts;
  agg.cpRollsPassed += s.counterPressRollsPassed;
  agg.cpTackleWins += s.counterPressTackleWins;
  agg.cpTackleFailures += s.counterPressTackleFailures;
  agg.cpTackleFouls += s.counterPressTackleFouls;
  agg.cpRecoveries += s.counterPressRecoveries;
  agg.cpClean += s.counterPressCleanRecoveries;
  agg.cpLoose += s.counterPressLooseBallRecoveries;

  agg.cpWinChanceSum += s.counterPressTackleWinChanceSum;

  if (
    s.counterPressTackleWinChanceMin <
    agg.cpWinChanceMin
  ) {
    agg.cpWinChanceMin =
      s.counterPressTackleWinChanceMin;
  }

  if (
    s.counterPressTackleWinChanceMax >
    agg.cpWinChanceMax
  ) {
    agg.cpWinChanceMax =
      s.counterPressTackleWinChanceMax;
  }

  agg.cpRelativeSpeedSum +=
    s.counterPressTackleRelativeSpeedSum;
  agg.cpDistanceSum +=
    s.counterPressTackleDistanceSum;

  agg.setPieceKickoffs += rec.setPieceEventCounts.kickoff;
  agg.setPieceCorners += rec.setPieceEventCounts.corner;
  agg.setPieceThrowIns += rec.setPieceEventCounts.throwIn;
  agg.setPieceGoalKicks += rec.setPieceEventCounts.goalKick;
  agg.setPieceFreeKicks += rec.setPieceEventCounts.freeKick;
  agg.setPiecePenalties += rec.setPieceEventCounts.penalty;
  agg.setPieceEventsWithoutPlayerId +=
    rec.setPieceEventsWithoutPlayerId;
  agg.setPieceEventsWithPlayerId +=
    rec.setPieceEventsWithPlayerId;

  agg.totalEventsSum += rec.eventFingerprint === ''
    ? 0
    : rec.eventFingerprint.split(';').length;

  agg.totalTicksSum += s.ticks;
  agg.simulationSecondsSum += s.simulationSeconds;
}

// ═══════════════════════════════════════════════
// RAPOR
// ═══════════════════════════════════════════════

function safeRate(
  numerator: number,
  denominator: number,
): number {
  return denominator > 0
    ? (numerator / denominator) * 100
    : 0;
}

function report(agg: Aggregate): void {
  const m = agg.matches;

  console.log('');
  console.log('=== FINAL VALIDATION SCREENING V1 — 10 MAÇ ===');
  console.table({
    matches: m,
    'goals/match':
      (agg.goalsHome + agg.goalsAway) / m,
    'xG/match':
      (agg.xGHome + agg.xGAway) / m,
    'shots/match':
      (agg.shotsHome + agg.shotsAway) / m,
    'onTarget/match':
      (agg.onTargetHome + agg.onTargetAway) / m,
    'passes/match':
      (agg.passesHome + agg.passesAway) / m,
    'passCompletion%':
      safeRate(
        agg.passesCompletedHome +
          agg.passesCompletedAway,
        agg.passesHome + agg.passesAway,
      ),
    'possessionHome%':
      agg.possessionHomeSum / m,
    'fouls/match':
      (agg.foulsHome + agg.foulsAway) / m,
    'corners/match':
      (agg.cornersHome + agg.cornersAway) / m,
    'throwIns/match':
      (agg.throwInsHome + agg.throwInsAway) / m,
    'goalKicks/match':
      (agg.goalKicksHome + agg.goalKicksAway) / m,
    'events/match':
      agg.totalEventsSum / m,
  });

  console.log('');
  console.log('=== COUNTER-PRESS (aggregate) ===');
  console.table({
    attempts: agg.cpAttempts,
    rollPassed: agg.cpRollsPassed,
    'rollPassRate%':
      safeRate(
        agg.cpRollsPassed,
        agg.cpAttempts,
      ),
    tackleWins: agg.cpTackleWins,
    tackleFailures: agg.cpTackleFailures,
    tackleFouls: agg.cpTackleFouls,
    recoveries: agg.cpRecoveries,
    cleanRecoveries: agg.cpClean,
    looseBallRecoveries: agg.cpLoose,
    'winRate%':
      safeRate(
        agg.cpTackleWins,
        agg.cpRollsPassed,
      ),
    'recoveryRate%':
      safeRate(
        agg.cpRecoveries,
        agg.cpTackleWins,
      ),
    'cleanRecoveryRate%':
      safeRate(
        agg.cpClean,
        agg.cpRecoveries,
      ),
    'winChanceAvg':
      agg.cpTackleWins +
      agg.cpTackleFailures +
      agg.cpTackleFouls > 0
        ? agg.cpWinChanceSum /
          (
            agg.cpTackleWins +
            agg.cpTackleFailures +
            agg.cpTackleFouls
          )
        : 0,
    'winChanceMin':
      Number.isFinite(agg.cpWinChanceMin)
        ? agg.cpWinChanceMin
        : null,
    'winChanceMax':
      Number.isFinite(agg.cpWinChanceMax)
        ? agg.cpWinChanceMax
        : null,
    'relativeSpeedAvg':
      agg.cpTackleWins +
      agg.cpTackleFailures +
      agg.cpTackleFouls > 0
        ? agg.cpRelativeSpeedSum /
          (
            agg.cpTackleWins +
            agg.cpTackleFailures +
            agg.cpTackleFouls
          )
        : 0,
    'distanceAvg':
      agg.cpTackleWins +
      agg.cpTackleFailures +
      agg.cpTackleFouls > 0
        ? agg.cpDistanceSum /
          (
            agg.cpTackleWins +
            agg.cpTackleFailures +
            agg.cpTackleFouls
          )
        : 0,
  });

  console.log('');
  console.log('=== SET-PIECE / EVENT AUDIT ===');
  console.table({
    kickoffEvents: agg.setPieceKickoffs,
    cornerEvents: agg.setPieceCorners,
    throwInEvents: agg.setPieceThrowIns,
    goalKickEvents: agg.setPieceGoalKicks,
    freeKickEvents: agg.setPieceFreeKicks,
    penaltyEvents: agg.setPiecePenalties,
    setPieceEventsWithPlayerId:
      agg.setPieceEventsWithPlayerId,
    setPieceEventsWithoutPlayerId:
      agg.setPieceEventsWithoutPlayerId,
  });

  console.log(
    '[CHECK] set-piece eventlerinde taker/playerId gözlemlenebilirliği:',
    agg.setPieceEventsWithPlayerId > 0
      ? 'BAZI EVENTLERDE VAR'
      : 'YOK',
  );

  console.log(
    '[CHECK] Event contract: set-piece eventleri Match.events üzerinden doğrulandı; '
      + 'SetPieceState.takerId doğrudan Match sonucunda expose edilmiyor.',
  );

  console.log('');
  console.log('=== CARDS ===');
  console.table({
    yellowHome: agg.yellowHome,
    yellowAway: agg.yellowAway,
    redHome: agg.redHome,
    redAway: agg.redAway,
  });
  console.log(
    '[NOT IMPLEMENTED] Kartlar production live akışında artırılmıyor.',
  );

  console.log('');
  console.log('=== MATCH INTEGRITY ===');
  console.table({
    totalTicksSum: agg.totalTicksSum,
    expectedTicksSum: m * MATCH_TICKS,
    'avgTicks/match':
      agg.totalTicksSum / m,
    totalSimulationSeconds:
      agg.simulationSecondsSum,
    expectedSimulationSeconds:
      m * MATCH_SECONDS,
    'avgSimulationSeconds/match':
      agg.simulationSecondsSum / m,
  });

  console.log('');
  console.log(
    '[NORMAL TACKLE] state.stats içinde genel tackle metriği yok; '
      + 'counter-press tackle metrikleri ayrı raporlanıyor.',
  );
}

// ═══════════════════════════════════════════════
// DETERMINISM
// ═══════════════════════════════════════════════

interface DeterminismSnapshot {
  score: {
    home: number;
    away: number;
  };

  xG: {
    home: number;
    away: number;
  };

  shots: {
    home: number;
    away: number;
  };

  onTarget: {
    home: number;
    away: number;
  };

  passes: {
    home: number;
    away: number;
  };

  possession: {
    home: number;
    away: number;
  };

  counterPress: {
    attempts: number;
    rollsPassed: number;
    tackleWins: number;
    tackleFailures: number;
    tackleFouls: number;
    recoveries: number;
    cleanRecoveries: number;
    looseBallRecoveries: number;
  };

  setPieces: {
    corners: {
      home: number;
      away: number;
    };
    throwIns: {
      home: number;
      away: number;
    };
    goalKicks: {
      home: number;
      away: number;
    };
  };

  ticks: number;
  simulationSeconds: number;
  eventFingerprint: string;
}

function snapshotForDeterminism(
  rec: MatchRecord,
): DeterminismSnapshot {
  const s = rec.stats;

  return {
    score: rec.score,

    xG: {
      home: s.xG.home,
      away: s.xG.away,
    },

    shots: {
      home: s.shots.home,
      away: s.shots.away,
    },

    onTarget: {
      home: s.onTarget.home,
      away: s.onTarget.away,
    },

    passes: {
      home: s.passes.home,
      away: s.passes.away,
    },

    possession: {
      home: s.possession.home,
      away: s.possession.away,
    },

    counterPress: {
      attempts: s.counterPressAttempts,
      rollsPassed: s.counterPressRollsPassed,
      tackleWins: s.counterPressTackleWins,
      tackleFailures:
        s.counterPressTackleFailures,
      tackleFouls:
        s.counterPressTackleFouls,
      recoveries: s.counterPressRecoveries,
      cleanRecoveries:
        s.counterPressCleanRecoveries,
      looseBallRecoveries:
        s.counterPressLooseBallRecoveries,
    },

    setPieces: {
      corners: {
        home: s.corners.home,
        away: s.corners.away,
      },
      throwIns: {
        home: s.throwIns.home,
        away: s.throwIns.away,
      },
      goalKicks: {
        home: s.goalKicks.home,
        away: s.goalKicks.away,
      },
    },

    ticks: s.ticks,
    simulationSeconds: s.simulationSeconds,
    eventFingerprint: rec.eventFingerprint,
  };
}

function reportDeterminism(
  a: MatchRecord,
  b: MatchRecord,
): void {
  const sa = snapshotForDeterminism(a);
  const sb = snapshotForDeterminism(b);

  console.log('');
  console.log('=== DETERMINISM — SAME BASELINE + SAME SEED × 2 ===');

  console.table({
    seed: a.seed,
    scoreA:
      sa.score.home + '-' + sa.score.away,
    scoreB:
      sb.score.home + '-' + sb.score.away,
    xGA:
      (sa.xG.home + sa.xG.away).toFixed(6),
    xGB:
      (sb.xG.home + sb.xG.away).toFixed(6),
    shotsA:
      sa.shots.home + sa.shots.away,
    shotsB:
      sb.shots.home + sb.shots.away,
    onTargetA:
      sa.onTarget.home + sa.onTarget.away,
    onTargetB:
      sb.onTarget.home + sb.onTarget.away,
    passesA:
      sa.passes.home + sa.passes.away,
    passesB:
      sb.passes.home + sb.passes.away,
    possessionA:
      sa.possession.home + '-' + sa.possession.away,
    possessionB:
      sb.possession.home + '-' + sb.possession.away,
    cpAttemptsA:
      sa.counterPress.attempts,
    cpAttemptsB:
      sb.counterPress.attempts,
    cpRollsA:
      sa.counterPress.rollsPassed,
    cpRollsB:
      sb.counterPress.rollsPassed,
    cpWinsA:
      sa.counterPress.tackleWins,
    cpWinsB:
      sb.counterPress.tackleWins,
    cpRecoveriesA:
      sa.counterPress.recoveries,
    cpRecoveriesB:
      sb.counterPress.recoveries,
    cornersA:
      sa.setPieces.corners.home +
      sa.setPieces.corners.away,
    cornersB:
      sb.setPieces.corners.home +
      sb.setPieces.corners.away,
    throwInsA:
      sa.setPieces.throwIns.home +
      sa.setPieces.throwIns.away,
    throwInsB:
      sb.setPieces.throwIns.home +
      sb.setPieces.throwIns.away,
    goalKicksA:
      sa.setPieces.goalKicks.home +
      sa.setPieces.goalKicks.away,
    goalKicksB:
      sb.setPieces.goalKicks.home +
      sb.setPieces.goalKicks.away,
    ticksA: sa.ticks,
    ticksB: sb.ticks,
    secondsA: sa.simulationSeconds,
    secondsB: sb.simulationSeconds,
    eventFingerprintEqual:
      sa.eventFingerprint === sb.eventFingerprint,
  });

  expect(sa).toEqual(sb);
}

// ═══════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════

describe.skipIf(!RUN)('Final validation screening V1 — 10 maç', () => {
  it(
    `runs ${SEED_END - SEED_START + 1} screening matches`,
    () => {
      // Tek baseline: tüm 100 maç aynı fixture/data dağılımını kullanır.
      const baseline = createBaseline();
      const agg = emptyAggregate();

      for (
        let seed = SEED_START;
        seed <= SEED_END;
        seed++
      ) {
        const rec = runMatch(baseline, seed);
        accumulate(agg, rec);
      }

      report(agg);

      expect(agg.matches).toBe(10);

      // Bunlar futbol kalibrasyon eşiği değil;
      // motorun 90:00 / 108.000 tick sözleşmesinin integrity kontrolleridir.
      expect(agg.totalTicksSum)
        .toBe(10 * MATCH_TICKS);

      expect(agg.simulationSecondsSum)
        .toBe(10 * MATCH_SECONDS);
    },
    30 * 60 * 1000,
  );

  it(
    'determinism: same seed × 2 → identical metrics and event sequence',
    () => {
      const baseline = createBaseline();

      const a = runMatch(baseline, SEED_START);
      const b = runMatch(baseline, SEED_START);

      reportDeterminism(a, b);

      // Production acceptance threshold değildir.
      // Bu, seeded deterministic engine contract'ının doğrudan kontrolüdür.
      expect(
        snapshotForDeterminism(a),
      ).toEqual(
        snapshotForDeterminism(b),
      );
    },
    20 * 60 * 1000,
  );
});
