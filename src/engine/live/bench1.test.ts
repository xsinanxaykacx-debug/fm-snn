import { describe, it, beforeEach, afterEach } from 'vitest';
import { simulateMatchLive } from './liveMatch';
import { generateGameData } from '../data/generateData';
import {
  installDeterministicRandom,
  DEFAULT_FIXTURE_SEED,
} from './diagnostics/deterministicFixture';

const SEED = 1000;
const MATCH_TICKS = 54_000;

describe('single match bench', () => {
  let handle: ReturnType<typeof installDeterministicRandom> | null = null;

  beforeEach(() => {
    handle = installDeterministicRandom(DEFAULT_FIXTURE_SEED);
  });

  afterEach(() => {
    if (handle) {
      handle.restore();
      handle = null;
    }
  });

  it(`seed=${SEED}`, () => {
    const data = generateGameData();
    const clubs = Object.values(data.clubs);
    const home = structuredClone(clubs[0]);
    const away = structuredClone(clubs[1]);
    const players = structuredClone(data.players);

    const t0 = Date.now();
    const result = simulateMatchLive(home, away, players, {
      seed: SEED,
      maxTicks: MATCH_TICKS,
    });
    const elapsedMs = Date.now() - t0;

    const s = result.stats;
    const passes = s.passes.home + s.passes.away;
    const passesCompleted =
      s.passesCompleted.home + s.passesCompleted.away;

    console.log('=== BENCH ===');
    console.log('fixtureSeed:', DEFAULT_FIXTURE_SEED);
    console.log('matchSeed:', SEED);
    console.log('elapsedSec:', (elapsedMs / 1000).toFixed(2));
    console.log('ticks:', s.ticks);
    console.log('score:', result.homeScore + '-' + result.awayScore);
    console.log('goals:', result.homeScore + result.awayScore);
    console.log('shots:', s.shots.home + s.shots.away);
    console.log('passes:', passes);
    console.log('passesCompleted:', passesCompleted);
    console.log(
      'passCompletionRate:',
      passes > 0
        ? ((passesCompleted / passes) * 100).toFixed(2) + '%'
        : 'n/a'
    );
  }, 30 * 60 * 1000);
});
