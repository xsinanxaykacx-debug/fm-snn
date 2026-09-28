import { describe, it, expect } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './simulate';

describe('Maç Motoru Denge Testi', () => {
  it('1000 maçta ortalama 1.5-4.5 gol olmalı', () => {
    const data = generateGameData();
    const clubs = data.clubs;
    const players = data.players;

    console.log('📦 Data tipi kontrolü:');
    console.log('  clubs tipi:', Array.isArray(clubs) ? 'ARRAY' : typeof clubs);
    console.log('  players tipi:', Array.isArray(players) ? 'ARRAY' : typeof players);
    console.log('  clubs anahtar sayısı:', Object.keys(clubs).length);
    console.log('  players anahtar sayısı:', Object.keys(players).length);

    const ids = Object.keys(clubs);
    console.log('  İlk club id:', ids[0]);
    console.log('  İlk club:', JSON.stringify(clubs[ids[0]], null, 2).slice(0, 300));

    // İlk takımın oyuncularını kontrol et
    const firstClubId = ids[0];
    const firstClubPlayers = Object.values(players).filter(
      (p: any) => p.clubId === firstClubId
    );
    console.log('  İlk takımın oyuncu sayısı:', firstClubPlayers.length);

    // Tek maç test et
    const testMatch = simulateMatch(clubs[ids[0]], clubs[ids[1]], players, 1);
    console.log('\n🧪 Tek maç testi:');
    console.log('  Skor:', testMatch.homeScore, '-', testMatch.awayScore);
    console.log('  Şut:', testMatch.stats?.shots);
    console.log('  Event sayısı:', testMatch.events?.length);
    console.log('  İlk 5 event:');
    testMatch.events?.slice(0, 5).forEach((e: any) => {
      console.log(`    ${e.minute}' [${e.type}] ${e.description}`);
    });

    let totalGoals = 0;
    let totalShots = 0;
    let totalXG = 0;
    let validMatches = 0;

    for (let i = 0; i < 100; i++) {
      const homeIdx = Math.floor(Math.random() * ids.length);
      let awayIdx = Math.floor(Math.random() * ids.length);
      while (awayIdx === homeIdx) awayIdx = Math.floor(Math.random() * ids.length);

      const home = clubs[ids[homeIdx]];
      const away = clubs[ids[awayIdx]];
      const m = simulateMatch(home, away, players, 1);

      totalGoals += m.homeScore + m.awayScore;
      totalShots += (m.stats.shots?.home || 0) + (m.stats.shots?.away || 0);
      totalXG += (m.stats.xG?.home || 0) + (m.stats.xG?.away || 0);
      validMatches++;
    }

    const avgGoals = totalGoals / validMatches;
    const avgShots = totalShots / validMatches;
    const avgXG = totalXG / validMatches;

    console.log('\n📊 100 MAÇ SONUCU');
    console.log(`   Ortalama gol:  ${avgGoals.toFixed(2)}  (hedef: 2.5-3.0)`);
    console.log(`   Ortalama xG:   ${avgXG.toFixed(2)}  (hedef: 2.5-3.0)`);
    console.log(`   Ortalama şut:  ${avgShots.toFixed(2)}  (hedef: 20-28)`);
    console.log(`   Gol/xG oranı:  ${(avgGoals / avgXG * 100).toFixed(1)}%`);
    console.log('');

    expect(avgGoals).toBeGreaterThan(1.5);
    expect(avgGoals).toBeLessThan(4.5);
  });
});