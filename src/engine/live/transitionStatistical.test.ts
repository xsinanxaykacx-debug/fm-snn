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

  clean: number;
  dirty: number;

  cleanChances: number[];
  expectedCleanCount: number;
  observedCleanCount: number;

  pendingSetObserved: number;
  pendingClearedSameClub: number;
  pendingClearedOpponent: number;
  pendingClearedExpiry: number;
  pendingClearedOther: number;
  pendingSetInvisible: number;

  totalRec: number;
  cleanRec: number;
  looseRec: number;

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

  let pendingSetObserved = 0;
  let previousPendingClub: string | null = null;
  let previousPendingExpiresAt = 0;

  let pendingClearedSameClub = 0;
  let pendingClearedOpponent = 0;
  let pendingClearedExpiry = 0;
  let pendingClearedOther = 0;

  const cleanChances: number[] = [];

  const t0 = performance.now();

  const match = simulateMatchLive(home, away, data.players, {
    seed,

    onTackleResolved: (outcome) => {
      if (
        outcome.type === 'won' &&
        typeof outcome.debug?.cleanChance === 'number'
      ) {
        cleanChances.push(outcome.debug.cleanChance);
      }
    },

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
      const pendingExpiresAt =
        state.transition.expiresAt;

      if (
        pendingClub !== null &&
        previousPendingClub === null
      ) {
        pendingSetObserved += 1;
      }

      if (
        previousPendingClub !== null &&
        pendingClub === null
      ) {
        const ownerId = state.ball.ownerId;

        if (ownerId !== null) {
          const owner = state.players[ownerId];

          if (owner?.clubId === previousPendingClub) {
            pendingClearedSameClub += 1;
          } else if (owner) {
            pendingClearedOpponent += 1;
          } else {
            pendingClearedOther += 1;
          }
        } else if (state.time >= previousPendingExpiresAt) {
          pendingClearedExpiry += 1;
        } else {
          pendingClearedOther += 1;
        }
      }

      previousPendingClub = pendingClub;
      previousPendingExpiresAt = pendingExpiresAt;
    },
  });

  const t1 = performance.now();

  const stats = match.stats;

  const wins = stats.counterPressTackleWins;
  const clean = stats.counterPressCleanRecoveries;
  const dirty = wins - clean;

  const expectedCleanCount = cleanChances.reduce(
    (sum, chance) => sum + chance,
    0,
  );

  const totalObservedCleared =
    pendingClearedSameClub +
    pendingClearedOpponent +
    pendingClearedExpiry +
    pendingClearedOther;

  const pendingSetInvisible =
    dirty - pendingSetObserved;

  return {
    seed,
    ticks: stats.ticks,

    transitions,
    attempts: stats.counterPressAttempts,
    rolls: stats.counterPressRollsPassed,

    wins,
    failures: stats.counterPressTackleFailures,
    fouls: stats.counterPressTackleFouls,

    clean,
    dirty,

    cleanChances,
    expectedCleanCount,
    observedCleanCount: clean,

    pendingSetObserved,
    pendingClearedSameClub,
    pendingClearedOpponent,
    pendingClearedExpiry,
    pendingClearedOther,
    pendingSetInvisible,

    totalRec: stats.counterPressRecoveries,
    cleanRec: stats.counterPressCleanRecoveries,
    looseRec: stats.counterPressLooseBallRecoveries,

    durationMs: t1 - t0,
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

function populationStdDev(values: number[]): number {
  if (values.length === 0) return 0;

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

describe.skipIf(!RUN)(
  'Live transition statistical harness v2',
  () => {
    it(
      MATCH_COUNT +
        ' tam maçta clean/dirty ve pending lifecycle',
      () => {
        const data = generateGameData();
        const results: HarnessMatchResult[] = [];

        for (
          let seed = SEED_START;
          seed < SEED_START + MATCH_COUNT;
          seed += 1
        ) {
          results.push(runHarnessMatch(data, seed));
        }

        const totalWins = sumField(results, 'wins');
        const totalClean = sumField(results, 'clean');
        const totalDirty = sumField(results, 'dirty');

        const allCleanChances = results.flatMap(
          (result) => result.cleanChances,
        );

        const totalExpectedClean = sumField(
          results,
          'expectedCleanCount',
        );

        const observedCleanRate =
          totalWins > 0
            ? totalClean / totalWins
            : 0;

        const expectedCleanRate =
          totalWins > 0
            ? totalExpectedClean / totalWins
            : 0;

        const expectedObservedCountDelta =
          totalClean - totalExpectedClean;

        const pendingSetObserved = sumField(
          results,
          'pendingSetObserved',
        );

        const pendingClearedSameClub = sumField(
          results,
          'pendingClearedSameClub',
        );

        const pendingClearedOpponent = sumField(
          results,
          'pendingClearedOpponent',
        );

        const pendingClearedExpiry = sumField(
          results,
          'pendingClearedExpiry',
        );

        const pendingClearedOther = sumField(
          results,
          'pendingClearedOther',
        );

        const pendingSetInvisible = sumField(
          results,
          'pendingSetInvisible',
        );

        const totalCleared =
          pendingClearedSameClub +
          pendingClearedOpponent +
          pendingClearedExpiry +
          pendingClearedOther;

        console.log('');
        console.log(
          '=== LIVE HARNESS v2 — ' +
            MATCH_COUNT +
            ' TAM MAÇ ===',
        );
        console.log('');

        console.log(
          'Toplam süre:       ' +
            (
              sumField(results, 'durationMs') /
              1000
            ).toFixed(1) +
            ' sn',
        );

        console.log(
          'Maç başı süre:     ' +
            (
              mean(
                results.map(
                  (result) => result.durationMs,
                ),
              ) / 1000
            ).toFixed(2) +
            ' sn ± ' +
            (
              populationStdDev(
                results.map(
                  (result) => result.durationMs,
                ),
              ) / 1000
            ).toFixed(2),
        );

        console.log(
          'Maç başı tick:     ' +
            mean(
              results.map(
                (result) => result.ticks,
              ),
            ).toFixed(0),
        );

        console.log('');
        console.log('--- TACKLE / CLEAN-DIRTY ---');
        console.log('wins:              ' + totalWins);
        console.log('clean:             ' + totalClean);
        console.log('dirty:             ' + totalDirty);

        console.log(
          'observedCleanRate: ' +
            observedCleanRate.toFixed(4),
        );

        console.log(
          'expectedCleanRate: ' +
            expectedCleanRate.toFixed(4),
        );

        console.log(
          'meanCleanChance:   ' +
            (
              mean(allCleanChances)
            ).toFixed(4),
        );

        console.log(
          'expectedCleanCount:' +
            totalExpectedClean.toFixed(3),
        );

        console.log(
          'observedCleanCount:' +
            totalClean,
        );

        console.log(
          'observed-expected:' +
            expectedObservedCountDelta.toFixed(3),
        );

        console.log('');
        console.log('--- PENDING LIFECYCLE ---');
        console.log(
          'dirtyTackles:           ' +
            totalDirty,
        );

        console.log(
          'pendingSetObserved:     ' +
            pendingSetObserved,
        );

        console.log(
          'pendingSetInvisible*:   ' +
            pendingSetInvisible,
        );

        console.log(
          'pendingClearedSameClub: ' +
            pendingClearedSameClub,
        );

        console.log(
          'pendingClearedOpponent: ' +
            pendingClearedOpponent,
        );

        console.log(
          'pendingClearedExpiry:   ' +
            pendingClearedExpiry,
        );

        console.log(
          'pendingClearedOther:    ' +
            pendingClearedOther,
        );

        console.log(
          'totalCleared:           ' +
            totalCleared,
        );

        console.log(
          'dirty - totalCleared:   ' +
            (
              totalDirty - totalCleared
            ),
        );

        console.log('');
        console.log('--- RECOVERY ---');
        console.log(
          'cleanRec:               ' +
            sumField(results, 'cleanRec'),
        );
        console.log(
          'looseRec:               ' +
            sumField(results, 'looseRec'),
        );
        console.log(
          'totalRec:               ' +
            sumField(results, 'totalRec'),
        );

        console.log('');
        console.log(
          '* pendingSetObserved yalnızca en az bir tick yaşayan pending durumlarını gösterir.',
        );
        console.log(
          '* pendingSetInvisible = dirty - observed pending set; aynı tick içinde set edilip temizlenen pending olaylarını temsil eder.',
        );
        console.log(
          '* pendingClearedExpiry, onTick sonunda owner yokken sürenin dolduğunun görüldüğü olaydır.',
        );
        console.log('');

        console.table(results);

        expect(results).toHaveLength(MATCH_COUNT);
        expect(
          results.every(
            (result) => result.ticks > 0,
          ),
        ).toBe(true);

        expect(
          results.every(
            (result) => result.dirty >= 0,
          ),
        ).toBe(true);

        expect(
          results.every(
            (result) =>
              result.cleanChances.length ===
              result.wins,
          ),
        ).toBe(true);

        expect(
          results.every(
            (result) =>
              Number.isFinite(
                result.expectedCleanCount,
              ),
          ),
        ).toBe(true);

        expect(
          results.every(
            (result) =>
              result.cleanRec + result.looseRec ===
              result.totalRec,
          ),
        ).toBe(true);

        expect(
          results.every(
            (result) =>
              result.looseRec <= result.dirty,
          ),
        ).toBe(true);

        expect(
          results.every(
            (result) =>
              result.cleanRec <= result.wins,
          ),
        ).toBe(true);

        expect(
          results.every(
            (result) =>
              result.wins <= result.rolls,
          ),
        ).toBe(true);

        expect(
          results.every(
            (result) =>
              result.rolls <= result.attempts,
          ),
        ).toBe(true);

        expect(
          pendingSetObserved +
            pendingSetInvisible,
        ).toBe(totalDirty);

        expect(
          totalCleared,
        ).toBe(pendingSetObserved);
      },
      60 * 60 * 1000,
    );
  },
);
