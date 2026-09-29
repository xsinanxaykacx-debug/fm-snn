// src/engine/match/edgeCase.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import type { Player } from '../types';

function clampAttr(v: number): number {
  return Math.max(1, Math.min(20, Math.round(v)));
}

function setAttributeLevel(player: Player, target: number, spread: number): void {
  const attrs = player.attributes as unknown as Record<string, number>;
  for (const key in attrs) {
    if (
      key === 'goalkeeper' || key === 'reflexes' || key === 'gkPositioning' ||
      key === 'handling' || key === 'oneOnOne' || key === 'aerialReach'
    ) {
      if (player.position === 'GK') {
        attrs[key] = clampAttr(target + (Math.random() - 0.5) * spread * 2);
      } else {
        attrs[key] = clampAttr(3 + Math.random() * 3);
      }
    } else {
      attrs[key] = clampAttr(target + (Math.random() - 0.5) * spread * 2);
    }
  }
}

interface EdgeResult {
  label: string;
  homeQ: number;
  awayQ: number;
  homeGoals: number;
  awayGoals: number;
  homeXG: number;
  awayXG: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  homeBigWins: number;  // +3 fark
  awayBigWins: number;
}

function runEdge(
  label: string, homeQ: number, awayQ: number, matchCount: number
): EdgeResult {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  let homeGoals = 0, awayGoals = 0;
  let homeXG = 0, awayXG = 0;
  let homeWins = 0, draws = 0, awayWins = 0;
  let homeBigWins = 0, awayBigWins = 0;

  for (let i = 0; i < matchCount; i++) {
    for (const p of Object.values(data.players)) {
      p.condition = 100;
      p.morale = 80;
      p.form = 60;
      p.injuryWeeks = 0;
      p.suspensionWeeks = 0;
      p.yellowCards = 0;
      p.sentOff = false;
      p.injured = false;
      p.redCard = false;
    }
    for (const p of homePlayers) setAttributeLevel(p, homeQ, 2);
    for (const p of awayPlayers) setAttributeLevel(p, awayQ, 2);

    const match = simulateMatch(home, away, data.players, 1);

    homeGoals += match.homeScore;
    awayGoals += match.awayScore;
    homeXG += match.stats.xG.home;
    awayXG += match.stats.xG.away;

    const diff = match.homeScore - match.awayScore;
    if (diff > 0) homeWins++;
    else if (diff === 0) draws++;
    else awayWins++;

    if (diff >= 3) homeBigWins++;
    if (diff <= -3) awayBigWins++;
  }

  return {
    label, homeQ, awayQ,
    homeGoals: homeGoals / matchCount,
    awayGoals: awayGoals / matchCount,
    homeXG: homeXG / matchCount,
    awayXG: awayXG / matchCount,
    homeWins: homeWins / matchCount,
    draws: draws / matchCount,
    awayWins: awayWins / matchCount,
    homeBigWins: homeBigWins / matchCount,
    awayBigWins: awayBigWins / matchCount,
  };
}

describe('Edge Case — Extreme Senaryolar', () => {
  it('absürt sonuç var mı?', () => {
    console.log('\n⏳ Edge case testi (4 senaryo × 500 maç)...\n');

    const N = 500;

    const scenarios = [
      { label: '20 vs 1',  home: 20, away: 1 },
      { label: '1 vs 20',  home: 1,  away: 20 },
      { label: '20 vs 20', home: 20, away: 20 },
      { label: '1 vs 1',   home: 1,  away: 1 },
    ];

    const lines: string[] = [];
    const f2 = (v: number) => v.toFixed(2);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║              EDGE CASE TESTİ (500 maç × 4 ekstrem senaryo)                   ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  SENARYO     EV GOL   DEP GOL   EV xG   DEP xG   EV KAZ   BER   DEP KAZ   +3F  ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (const s of scenarios) {
      const r = runEdge(s.label, s.home, s.away, N);
      lines.push(
        `║  ${s.label.padEnd(11)}${f2(r.homeGoals).padStart(7)}${f2(r.awayGoals).padStart(9)}${f2(r.homeXG).padStart(9)}${f2(r.awayXG).padStart(9)}${pct(r.homeWins).padStart(9)}${pct(r.draws).padStart(7)}${pct(r.awayWins).padStart(9)}${pct(r.homeBigWins + r.awayBigWins).padStart(7)}  ║`
      );
    }

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    lines.push('');
    lines.push('📌 YORUM');
    lines.push('');
    lines.push('  20 vs 1:  Güçlü ev sahibi ~%95+ kazanmalı, 5-0 gibi skorlar normal');
    lines.push('  1 vs 20:  Güçlü deplasman ~%90+ kazanmalı, absürt sürpriz olmamalı');
    lines.push('  20 vs 20: Dengeli, ~33/33/33');
    lines.push('  1 vs 1:   Dengeli ama düşük kaliteli, ~33/33/33');
    lines.push('');
    lines.push('  ⚠️  Kontrol: 1 vs 20\'de deplasman 5+ gol atıyorsa motor fazla agresif.');
    lines.push('     20 vs 1\'de ev sahibi 5+ gol atıyorsa normal (kalite farkı çok büyük).');
    lines.push('');

    console.log(lines.join('\n'));
  }, 300000);
});