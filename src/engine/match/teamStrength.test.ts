// src/engine/match/teamStrength.test.ts

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

interface StrengthResult {
  homeQ: number;
  awayQ: number;
  matches: number;
  homePossession: number;
  homeShots: number;
  awayShots: number;
  homeXG: number;
  awayXG: number;
  homeGoals: number;
  awayGoals: number;
  homeWins: number;
  draws: number;
  awayWins: number;
}

function runStrength(
  homeQ: number,
  awayQ: number,
  matchCount: number
): StrengthResult {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  let homePoss = 0, homeShots = 0, awayShots = 0;
  let homeXG = 0, awayXG = 0, homeGoals = 0, awayGoals = 0;
  let homeWins = 0, draws = 0, awayWins = 0;

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
    for (const p of homePlayers) setAttributeLevel(p, homeQ, 3);
    for (const p of awayPlayers) setAttributeLevel(p, awayQ, 3);

    const match = simulateMatch(home, away, data.players, 1);

    homePoss += match.stats.possession.home;
    homeShots += match.stats.shots.home;
    awayShots += match.stats.shots.away;
    homeXG += match.stats.xG.home;
    awayXG += match.stats.xG.away;
    homeGoals += match.homeScore;
    awayGoals += match.awayScore;

    if (match.homeScore > match.awayScore) homeWins++;
    else if (match.homeScore === match.awayScore) draws++;
    else awayWins++;
  }

  return {
    homeQ, awayQ, matches: matchCount,
    homePossession: homePoss / matchCount,
    homeShots: homeShots / matchCount,
    awayShots: awayShots / matchCount,
    homeXG: homeXG / matchCount,
    awayXG: awayXG / matchCount,
    homeGoals: homeGoals / matchCount,
    awayGoals: awayGoals / matchCount,
    homeWins: homeWins / matchCount,
    draws: draws / matchCount,
    awayWins: awayWins / matchCount,
  };
}

describe('Team Strength — Takım Gücü Ölçeği', () => {
  it('takım gücü arttıkça motor nasıl davranıyor?', () => {
    console.log('\n⏳ Takım gücü testi (6 seviye × 300 maç)...\n');

    const N = 300;

    const scenarios = [
      { home: 10, away: 10 },
      { home: 12, away: 10 },
      { home: 14, away: 10 },
      { home: 16, away: 10 },
      { home: 18, away: 10 },
      { home: 20, away: 10 },
    ];

    const lines: string[] = [];
    const f1 = (v: number) => v.toFixed(1);
    const f2 = (v: number) => v.toFixed(2);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║          TAKIM GÜCÜ TESTİ (Ev gücü artıyor, Deplasman sabit 10)              ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  EV vs DEP    POSS%   EV ŞUT  DEP ŞUT  EV xG   DEP xG   EV GOL  DEP GOL  EV KAZ  ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (const s of scenarios) {
      const r = runStrength(s.home, s.away, N);
      lines.push(
        `║  ${String(s.home).padStart(2)} vs ${String(s.away).padStart(2)}    ${f1(r.homePossession).padStart(5)}%   ${f1(r.homeShots).padStart(6)}   ${f1(r.awayShots).padStart(7)}   ${f2(r.homeXG).padStart(6)}   ${f2(r.awayXG).padStart(6)}   ${f2(r.homeGoals).padStart(7)}   ${f2(r.awayGoals).padStart(7)}   ${pct(r.homeWins).padStart(6)}  ║`
      );
    }

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    lines.push('');
    lines.push('📌 YORUM');
    lines.push('');
    lines.push('  Beklenen:');
    lines.push('    • Ev gücü arttıkça POSS%, ŞUT, xG, GOL, KAZANMA artmalı');
    lines.push('    • Deplasman metrikleri sabit kalmalı (o hep 10/20)');
    lines.push('    • Artış doğrusal olmalı (ani sıçrama yok)');
    lines.push('');

    console.log(lines.join('\n'));
  }, 300000);
});