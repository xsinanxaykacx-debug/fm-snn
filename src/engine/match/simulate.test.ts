import { describe, it, expect } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './simulate';

describe('Maç Motoru Denge Testi', () => {
  it('1000 maçta ortalama 1.5-4.5 gol olmalı', () => {
    const { clubs, players } = generateGameData();
    const ids = Object.keys(clubs);
    let totalGoals = 0;
    let totalShots = 0;
    let totalCards = 0;
    let totalInjuries = 0;
    let validMatches = 0;

    for (let i = 0; i < 1000; i++) {
      const homeIdx = Math.floor(Math.random() * ids.length);
      let awayIdx = Math.floor(Math.random() * ids.length);
      while (awayIdx === homeIdx) awayIdx = Math.floor(Math.random() * ids.length);

      const home = clubs[ids[homeIdx]];
      const away = clubs[ids[awayIdx]];
      const m = simulateMatch(home, away, players, 1);

      totalGoals += m.homeScore + m.awayScore;
      totalShots += m.stats.shots.home + m.stats.shots.away;
      totalCards += m.events.filter(e => e.type === 'yellow' || e.type === 'red').length;
      totalInjuries += m.events.filter(e => e.type === 'injury').length;
      validMatches++;
    }

    const avgGoals = totalGoals / validMatches;
    const avgShots = totalShots / validMatches;
    const avgCards = totalCards / validMatches;
    const avgInjuries = totalInjuries / validMatches;

    console.log('\n📊 MAÇ MOTORU İSTATİSTİKLERİ (1000 maç)');
    console.log(`   Ortalama gol:      ${avgGoals.toFixed(2)}  (hedef: 2.5-3.0)`);
    console.log(`   Ortalama şut:      ${avgShots.toFixed(2)}  (hedef: 20-28)`);
    console.log(`   Ortalama kart:     ${avgCards.toFixed(2)}  (hedef: 3-5)`);
    console.log(`   Ortalama sakatlık: ${avgInjuries.toFixed(2)}  (hedef: 0.1-0.3)`);
    console.log('');

    expect(avgGoals).toBeGreaterThan(1.5);
    expect(avgGoals).toBeLessThan(4.5);
  });
});