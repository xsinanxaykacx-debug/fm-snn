import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';
import { createMatchSeed } from './rng';

describe('BUG-021 live engine determinism', () => {
  it('produces the same score and event stream for the same seed', () => {
    const first = generateGameData(20261004);
    const second = generateGameData(20261004);

    const home1 = first.clubs.club_1;
    const away1 = first.clubs.club_14;
    const home2 = second.clubs.club_1;
    const away2 = second.clubs.club_14;

    expect(home1).toBeDefined();
    expect(away1).toBeDefined();
    expect(home2).toBeDefined();
    expect(away2).toBeDefined();

    const match1 = simulateMatchLive(home1, away1, first.players, {
      seed: 424242,
      week: 6,
    });
    const match2 = simulateMatchLive(home2, away2, second.players, {
      seed: 424242,
      week: 6,
    });

    expect(match2.homeScore).toBe(match1.homeScore);
    expect(match2.awayScore).toBe(match1.awayScore);
    expect(match2.events).toEqual(match1.events);
  }, 120_000);
});

describe('BUG-021 deterministic production seed', () => {
  it('derives the same seed from the same fixture identity', () => {
    const seedA = createMatchSeed('fixture_week6_club1_club14', 6);
    const seedB = createMatchSeed('fixture_week6_club1_club14', 6);

    expect(seedB).toBe(seedA);
  });
});


describe('BUG-032 live progress diagnostics', () => {
  it('emits tick phase progress and reaches full time', () => {
    const data = generateGameData(20261004);
    const home = data.clubs.club_1;
    const away = data.clubs.club_14;
    expect(home).toBeDefined();
    expect(away).toBeDefined();

    const phases: string[] = [];
    const match = simulateMatchLive(home, away, data.players, {
      seed: 32032,
      week: 6,
      onTickPhase: (state, phase) => {
        if (state.tick <= 2 || phase === 'after-phase') {
          phases.push(state.tick + ':' + phase);
        }
      },
    });

    expect(match.played).toBe(true);
    expect(match.stats.simulationSeconds).toBeGreaterThanOrEqual(90 * 60);
    expect(phases).toContain('1:tick-start');
    expect(phases).toContain('1:after-phase');
  }, 120_000);
});


describe('BUG-032 second-half movement regression', () => {
  it('continues changing player positions after 45 minutes', () => {
    const data = generateGameData(20261004);
    const home = data.clubs.club_1;
    const away = data.clubs.club_14;
    expect(home).toBeDefined();
    expect(away).toBeDefined();

    const snapshots: Array<{ time: number; positions: Record<string, { x: number; y: number }> }> = [];
    let cumulativeMovement = 0;
    let previousPositions: Record<string, { x: number; y: number }> | null = null;

    const match = simulateMatchLive(home, away, data.players, {
      seed: 32032,
      week: 6,
      onTick: state => {
        if (state.time < 45 * 60 + 30 || state.time > 89 * 60 + 30) return;

        const positions = Object.fromEntries(
          Object.entries(state.players).map(([id, p]) => [id, { x: p.position.x, y: p.position.y }])
        );

        if (previousPositions) {
          cumulativeMovement += Object.keys(positions).reduce((sum, id) => {
            const a = previousPositions![id];
            const b = positions[id];
            return sum + Math.hypot(b.x - a.x, b.y - a.y);
          }, 0);
        }

        previousPositions = positions;

        if (snapshots.length === 0 || state.time >= 89 * 60 + 30) {
          snapshots.push({ time: state.time, positions });
        }
      },
    });

    expect(match.played).toBe(true);
    expect(snapshots.length).toBeGreaterThanOrEqual(2);
    expect(snapshots[snapshots.length - 1].time).toBeGreaterThanOrEqual(89 * 60 + 30);
    expect(cumulativeMovement).toBeGreaterThan(0);
  }, 120_000);
});
