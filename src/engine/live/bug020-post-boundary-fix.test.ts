import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('BUG-020 post-boundary-fix calibration trace', () => {
  it('prints live scoring volume and xG', () => {
    const { clubs, players } = generateGameData(20261004);
    const clubList = Object.values(clubs);

    for (let i = 0; i < 4; i += 1) {
      const home = clubList[(i * 2) % clubList.length];
      const away = clubList[(i * 2 + 1) % clubList.length];
      const match = simulateMatchLive(home, away, players, {
        week: 20,
        seed: 100000 + i,
      });

      console.log('[BUG-020-POST-BOUNDARY-FIX]', JSON.stringify({
        match: i + 1,
        score: [match.homeScore, match.awayScore],
        shots: match.stats.shots,
        xG: match.stats.xG,
        passes: match.stats.passes,
        dribbles: match.stats.dribbles,
        fouls: match.stats.fouls,
        goals: match.events.filter(e => e.type === 'goal').map(e => ({
          minute: e.minute,
          description: e.description,
          previousEventType: match.events[Math.max(0, match.events.indexOf(e) - 1)]?.type ?? null,
        })),
      }));
    }
  }, 180000);
});
