import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

const RUN = process.env.RUN_LIVE_HARNESS === '1';
const MATCH_COUNT = 50;
const SEED_START = 1000;

interface HarnessMatchResult {
  seed: number;
  ticks: number;
  transitions: number;
  attempts: number;
  rolls: number;
  wins: number;
  failures: number;
  fouls: number;
  dirtyTackles: number;
  pendingSet: number;
  pendingExpired: number;
  cleanRec: number;
  looseRec: number;
  totalRec: number;
  durationMs: number;
}

function resetPlayers(
  data: ReturnType<typeof generateGameData>,
): void {
  for (const player of Object.values(data.players)) {
    player.condition = 100;
    player.fatigue = 0;
    player.injuryWeeks = 0;
    player.suspensionWeeks = 0;
    player.sentOff = false;
    player.injured = false;
    player.redCard = false;
  }
}

function runHarnessMatch(
  data: ReturnType<typeof generateGameData>,
  seed: number,
): HarnessMatchResult {
  const clubs = Object.values(data.clubs);
  const home = clubs[0];
  const away = clubs[1];

  resetPlayers(data);

  let transitions = 0;
  let previousStartedAt: number | null = null;

  // onTick sadece tick sonunda çalıştığı için aynı tick içinde
  // set edilip temizlenen pending durumunu göremez.
  // Bu nedenle pendingSet doğrudan dirty tackle sayısından türetilir.
  let pendingExpired = 0;
  let previousPendingClub: string | null = null;

  const t0 = performance.now();

  const match = simulateMatchLive(home, away, data.players, {
    seed,
    onTick: (state) => {
      if (
        state.transition.counterPressClubId !== null &&
        state.transition.startedAt !== previousStartedAt
      ) {
        transitions += 1;
        previousStartedAt = state.transition.startedAt;
      }

      const pendingClub =
        state.transition.pendingLooseBallRecoveryClubId;

      // Bu yalnızca en az bir tick yaşayan pending'leri yakalar.
      // Aynı tick içinde set -> resolve/expire olan pending onTick'te
      // görünmez; bu yüzden sonuç "gözlemlenen expiry" olarak yorumlanır.
      if (
        previousPendingClub !== null &&
        pendingClub === null &&
        state.ball.ownerId === null
      ) {
        pendingExpired += 1;
      }

      previousPendingClub = pendingClub;
    },
  });

  const t1 = performance.now();

  const stats = match.stats;
  const dirtyTackles =
    stats.counterPressTackleWins -
    stats.counterPressCleanRecoveries;

  return {
    seed,
    ticks: stats.ticks,
    transitions,
    attempts: stats.counterPressAttempts,
    rolls: stats.counterPressRollsPassed,
    wins: stats.counterPressTackleWins,
    failures: stats.counterPressTackleFailures,
    fouls: stats.counterPressTackleFouls,
    dirtyTackles,
    // Her dirty tackle applyTackleWon() içinde pending recovery context
    // kurar. Production lifecycle'ını değiştirmeden bunu en güvenilir
    // şekilde wins - cleanRecoveries üzerinden ölçüyoruz.
    pendingSet: dirtyTackles,
    pendingExpired,
    cleanRec: stats.counterPressCleanRecoveries,
    looseRec: stats.counterPressLooseBallRecoveries,
    totalRec: stats.counterPressRecoveries,
    durationMs: t1 - t0,
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function populationStdDev(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(
    mean(values.map((value) => (value - m) ** 2)),
  );
}

function sumField(
  results: HarnessMatchResult[],
  field: keyof HarnessMatchResult,
): number {
  return results.reduce(
    (sum, result) => sum + (result[field] as number),
    0,
  );
}

function minField(
  results: HarnessMatchResult[],
  field: keyof HarnessMatchResult,
): number {
  return Math.min(
    ...results.map((result) => result[field] as number),
  );
}

function maxField(
  results: HarnessMatchResult[],
  field: keyof HarnessMatchResult,
): number {
  return Math.max(
    ...results.map((result) => result[field] as number),
  );
}

describe.skipIf(!RUN)('Live transition statistical harness', () => {
  it(
    MATCH_COUNT + ' tam maçta transition istatistikleri',
    () => {
      // Diagnostic harness ile aynı fixture yaklaşımı:
      // tek kez generateGameData(), her maç öncesi oyuncular resetlenir.
      // Böylece 50 maç arasındaki ana kontrollü değişken seed olur.
      const data = generateGameData();
      const results: HarnessMatchResult[] = [];

      for (
        let seed = SEED_START;
        seed < SEED_START + MATCH_COUNT;
        seed += 1
      ) {
        results.push(runHarnessMatch(data, seed));
      }

      const durationValues = results.map((r) => r.durationMs);
      const transitionValues = results.map((r) => r.transitions);
      const attemptValues = results.map((r) => r.attempts);
      const rollValues = results.map((r) => r.rolls);
      const winValues = results.map((r) => r.wins);
      const dirtyValues = results.map((r) => r.dirtyTackles);
      const pendingSetValues = results.map((r) => r.pendingSet);
      const pendingExpiredValues = results.map((r) => r.pendingExpired);
      const looseRecValues = results.map((r) => r.looseRec);

      console.log('');
      console.log(
        '=== LIVE TRANSITION HARNESS — ' + MATCH_COUNT + ' TAM MAÇ ===',
      );
      console.log('');
      console.log(
        'Toplam süre:       ' +
          (sumField(results, 'durationMs') / 1000).toFixed(1) +
          ' sn',
      );
      console.log(
        'Maç başı süre:     ' +
          (mean(durationValues) / 1000).toFixed(2) +
          ' sn ± ' +
          (populationStdDev(durationValues) / 1000).toFixed(2),
      );
      console.log(
        'Maç başı tick:     ' +
          mean(results.map((r) => r.ticks)).toFixed(0),
      );

      console.log('');
      console.log('--- TOPLAM ---');
      console.log(
        'transitionStarts:   ' + sumField(results, 'transitions'),
      );
      console.log('attempts:           ' + sumField(results, 'attempts'));
      console.log('rolls:              ' + sumField(results, 'rolls'));
      console.log('wins:               ' + sumField(results, 'wins'));
      console.log('failures:           ' + sumField(results, 'failures'));
      console.log('fouls:              ' + sumField(results, 'fouls'));
      console.log(
        'dirtyTackles:       ' + sumField(results, 'dirtyTackles'),
      );
      console.log(
        'pendingSet:         ' + sumField(results, 'pendingSet'),
      );
      console.log(
        'pendingExpired*:    ' + sumField(results, 'pendingExpired'),
      );
      console.log('cleanRec:           ' + sumField(results, 'cleanRec'));
      console.log('looseRec:           ' + sumField(results, 'looseRec'));
      console.log('totalRec:           ' + sumField(results, 'totalRec'));

      console.log('');
      console.log('--- MAÇ BAŞINA ORTALAMA ± STD ---');
      console.log(
        'transitions:        ' +
          mean(transitionValues).toFixed(2) +
          ' ± ' +
          populationStdDev(transitionValues).toFixed(2),
      );
      console.log(
        'attempts:           ' +
          mean(attemptValues).toFixed(2) +
          ' ± ' +
          populationStdDev(attemptValues).toFixed(2),
      );
      console.log(
        'rolls:              ' +
          mean(rollValues).toFixed(2) +
          ' ± ' +
          populationStdDev(rollValues).toFixed(2),
      );
      console.log(
        'wins:               ' +
          mean(winValues).toFixed(2) +
          ' ± ' +
          populationStdDev(winValues).toFixed(2),
      );
      console.log(
        'dirtyTackles:       ' +
          mean(dirtyValues).toFixed(2) +
          ' ± ' +
          populationStdDev(dirtyValues).toFixed(2),
      );
      console.log(
        'pendingSet:         ' +
          mean(pendingSetValues).toFixed(2) +
          ' ± ' +
          populationStdDev(pendingSetValues).toFixed(2),
      );
      console.log(
        'pendingExpired*:    ' +
          mean(pendingExpiredValues).toFixed(2) +
          ' ± ' +
          populationStdDev(pendingExpiredValues).toFixed(2),
      );
      console.log(
        'cleanRec:           ' +
          mean(results.map((r) => r.cleanRec)).toFixed(2) +
          ' ± ' +
          populationStdDev(results.map((r) => r.cleanRec)).toFixed(2),
      );
      console.log(
        'looseRec:           ' +
          mean(looseRecValues).toFixed(2) +
          ' ± ' +
          populationStdDev(looseRecValues).toFixed(2),
      );
      console.log(
        'totalRec:           ' +
          mean(results.map((r) => r.totalRec)).toFixed(2) +
          ' ± ' +
          populationStdDev(results.map((r) => r.totalRec)).toFixed(2),
      );

      console.log('');
      console.log('--- MIN / MAX ---');
      console.log(
        'wins:               ' +
          minField(results, 'wins') +
          ' / ' +
          maxField(results, 'wins'),
      );
      console.log(
        'dirtyTackles:       ' +
          minField(results, 'dirtyTackles') +
          ' / ' +
          maxField(results, 'dirtyTackles'),
      );
      console.log(
        'pendingSet:         ' +
          minField(results, 'pendingSet') +
          ' / ' +
          maxField(results, 'pendingSet'),
      );
      console.log(
        'pendingExpired*:    ' +
          minField(results, 'pendingExpired') +
          ' / ' +
          maxField(results, 'pendingExpired'),
      );
      console.log(
        'looseRec:           ' +
          minField(results, 'looseRec') +
          ' / ' +
          maxField(results, 'looseRec'),
      );

      console.log('');
      console.log(
        '* pendingExpired onTick ile gözlemlenen expiry sayısıdır; aynı tick içinde set edilip temizlenen pending durumları görünmez.',
      );
      console.log('');

      console.table(results);

      // İstatistiksel harness outcome threshold koymaz.
      // Yalnızca production lifecycle sözleşmesini kontrol eder.
      expect(results).toHaveLength(MATCH_COUNT);
      expect(results.every((result) => result.ticks > 0)).toBe(true);
      expect(results.every((result) => result.dirtyTackles >= 0)).toBe(true);
      expect(
        results.every(
          (result) => result.pendingSet === result.dirtyTackles,
        ),
      ).toBe(true);
      expect(
        results.every(
          (result) =>
            result.cleanRec + result.looseRec === result.totalRec,
        ),
      ).toBe(true);
      expect(
        results.every(
          (result) => result.looseRec <= result.dirtyTackles,
        ),
      ).toBe(true);
      expect(
        results.every(
          (result) => result.cleanRec <= result.wins,
        ),
      ).toBe(true);
      expect(
        results.every(
          (result) => result.wins <= result.rolls,
        ),
      ).toBe(true);
      expect(
        results.every(
          (result) => result.rolls <= result.attempts,
        ),
      ).toBe(true);
    },
    60 * 60 * 1000,
  );
});
