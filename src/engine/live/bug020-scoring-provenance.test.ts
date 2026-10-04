import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('BUG-020 scoring provenance diagnostic', () => {
  it('prints shot/goal provenance for one deterministic match', () => {
    const { clubs, players } = generateGameData(20261004);
    const list = Object.values(clubs);
    const match = simulateMatchLive(list[0], list[1], players, { week: 20, seed: 100000 });

    const shots = match.events.filter(e => e.type === 'shot');
    const goals = match.events.filter(e => e.type === 'goal');
    const goalsWithShotOutcome = shots.filter(e => e.shotOutcome === 'goal').length;
    const saveShots = shots.filter(e => e.shotOutcome === 'save').length;
    const missShots = shots.filter(e => e.shotOutcome === 'miss').length;

    console.log(JSON.stringify({
      score: [match.homeScore, match.awayScore],
      eventCounts: match.events.reduce<Record<string, number>>((a, e) => {
        a[e.type] = (a[e.type] ?? 0) + 1;
        return a;
      }, {}),
      shots: shots.length,
      goals: goals.length,
      shotGoals: goalsWithShotOutcome,
      saveShots,
      missShots,
      firstGoals: goals.slice(0, 40),
      lastEvents: match.events.slice(-30),
    }, null, 2));
  }, 120000);
});

