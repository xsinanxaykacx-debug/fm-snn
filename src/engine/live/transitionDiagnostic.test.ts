import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

const DIAGNOSTIC_ENABLED = process.env.RUN_LIVE_DIAGNOSTIC === '1';

interface DiagnosticMatchResult {
  seed: number;
  ticks: number;
  simulationSeconds: number;
  durationMs: number;
  msPerTick: number;
  transitionStarts: number;
  attempts: number;
  rolls: number;
  wins: number;
  failures: number;
  fouls: number;
  cleanRec: number;
  looseRec: number;
  totalRec: number;
}

function resetPlayers(
  data: ReturnType<typeof generateGameData>
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

function runDiagnosticMatch(
  data: ReturnType<typeof generateGameData>,
  seed: number,
  maxTicks?: number
): DiagnosticMatchResult {
  const clubs = Object.values(data.clubs);
  const home = clubs[0];
  const away = clubs[1];

  resetPlayers(data);

  let previousStartedAt = 0;
  let transitionStarts = 0;

  const t0 = performance.now();

  const match = simulateMatchLive(home, away, data.players, {
    seed,
    ...(maxTicks === undefined ? {} : { maxTicks }),
    onTick: (state) => {
      if (state.transition.startedAt !== previousStartedAt) {
        transitionStarts += 1;
        previousStartedAt = state.transition.startedAt;
      }
    },
  });

  const t1 = performance.now();

  const durationMs = t1 - t0;
  const ticks = match.stats.ticks;

  return {
    seed,
    ticks,
    simulationSeconds: match.stats.simulationSeconds,
    durationMs,
    msPerTick: ticks > 0 ? durationMs / ticks : 0,
    transitionStarts,
    attempts: match.stats.counterPressAttempts,
    rolls: match.stats.counterPressRollsPassed,
    wins: match.stats.counterPressTackleWins,
    failures: match.stats.counterPressTackleFailures,
    fouls: match.stats.counterPressTackleFouls,
    cleanRec: match.stats.counterPressCleanRecoveries,
    looseRec: match.stats.counterPressLooseBallRecoveries,
    totalRec: match.stats.counterPressRecoveries,
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function populationStdDev(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(
    mean(values.map((value) => (value - m) ** 2))
  );
}

describe(
  'Live transition diagnostic — manuel',
  {
    skip: !DIAGNOSTIC_ENABLED,
  },
  () => {
    it(
      'tek tam maç',
      () => {
        const data = generateGameData();
        const result = runDiagnosticMatch(data, 42);

        console.log('');
        console.log('=== TEK TAM MAÇ ===');
        console.log(`ticks:                    ${result.ticks}`);
        console.log(
          `simulationSeconds:        ${result.simulationSeconds}`
        );
        console.log(
          `duration ms:              ${result.durationMs.toFixed(1)}`
        );
        console.log(
          `ms/tick:                  ${result.msPerTick.toFixed(4)}`
        );
        console.log(
          `transitionStarts:         ${result.transitionStarts}`
        );
        console.log(
          `counterPressAttempts:     ${result.attempts}`
        );
        console.log(
          `counterPressRollsPassed:  ${result.rolls}`
        );
        console.log(
          `counterPressTackleWins:   ${result.wins}`
        );
        console.log(
          `counterPressTackleFails:  ${result.failures}`
        );
        console.log(
          `counterPressTackleFouls:  ${result.fouls}`
        );
        console.log(
          `counterPressCleanRec:     ${result.cleanRec}`
        );
        console.log(
          `counterPressLooseRec:     ${result.looseRec}`
        );
        console.log(
          `counterPressRecoveries:   ${result.totalRec}`
        );
        console.log('================================');
        console.log('');

        expect(result.ticks).toBeGreaterThan(0);
        expect(result.simulationSeconds).toBeGreaterThan(0);
      },
      600_000
    );

    it(
      '10 tam maç batch',
      () => {
        const data = generateGameData();
        const results: DiagnosticMatchResult[] = [];

        const batchStart = performance.now();

        for (let seed = 1000; seed < 1010; seed += 1) {
          results.push(runDiagnosticMatch(data, seed));
        }

        const batchDurationMs = performance.now() - batchStart;

        const durations = results.map((r) => r.durationMs);
        const ticks = results.map((r) => r.ticks);
        const transitions = results.map((r) => r.transitionStarts);
        const attempts = results.map((r) => r.attempts);
        const rolls = results.map((r) => r.rolls);
        const wins = results.map((r) => r.wins);
        const totalRec = results.map((r) => r.totalRec);

        console.log('');
        console.log('=== 10 TAM MAÇ BATCH ===');
        console.log(
          `total duration ms:        ${batchDurationMs.toFixed(1)}`
        );
        console.log(
          `mean duration ms/match:   ${mean(durations).toFixed(1)} (±${populationStdDev(durations).toFixed(1)})`
        );
        console.log(
          `mean ticks/match:         ${mean(ticks).toFixed(0)} (±${populationStdDev(ticks).toFixed(0)})`
        );
        console.log(
          `mean transitions/match:   ${mean(transitions).toFixed(2)} (±${populationStdDev(transitions).toFixed(2)})`
        );
        console.log(
          `mean attempts/match:      ${mean(attempts).toFixed(2)} (±${populationStdDev(attempts).toFixed(2)})`
        );
        console.log(
          `mean rolls/match:         ${mean(rolls).toFixed(2)} (±${populationStdDev(rolls).toFixed(2)})`
        );
        console.log(
          `mean wins/match:          ${mean(wins).toFixed(2)} (±${populationStdDev(wins).toFixed(2)})`
        );
        console.log(
          `mean totalRec/match:      ${mean(totalRec).toFixed(2)} (±${populationStdDev(totalRec).toFixed(2)})`
        );
        console.log('================================');
        console.log('');

        console.table(results);

        expect(results).toHaveLength(10);
        expect(results.every((r) => r.ticks > 0)).toBe(true);
      },
      1_800_000
    );

    it(
      'maxTicks ölçekleme',
      () => {
        const data = generateGameData();
        const configs = [1_000, 5_000, 10_000, 20_000, 54_000];
        const results: Array<{
          maxTicks: number;
          actualTicks: number;
          durationMs: number;
          msPerTick: number;
        }> = [];

        for (const maxTicks of configs) {
          const result = runDiagnosticMatch(data, 42, maxTicks);

          results.push({
            maxTicks,
            actualTicks: result.ticks,
            durationMs: result.durationMs,
            msPerTick: result.msPerTick,
          });
        }

        console.log('');
        console.log('=== maxTicks ÖLÇEKLEME ===');
        console.table(results);
        console.log('============================');
        console.log('');

        expect(results).toHaveLength(configs.length);
        expect(results.every((r) => r.actualTicks > 0)).toBe(true);
      },
      1_800_000
    );
  }
);
