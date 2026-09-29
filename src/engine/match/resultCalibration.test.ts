// src/engine/match/resultCalibration.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import type { Player } from '../types';

/**
 * RESULT CALIBRATION — KALİTE FARKI → SONUÇ ZİNCİRİ
 *
 * Amaç: Takım gücü farkı arttıkça kazanma olasılığının
 * nasıl değiştiğini ölçmek.
 *
 * Özellikle:
 *   10 vs 10  → %36 (mevcut)
 *   12 vs 10  → %57.7
 *   14 vs 10  → %71
 *   16 vs 10  → %80.3
 *   18 vs 10  → %88.3
 *   20 vs 10  → %96
 *
 * Ve bunun gol/xG dağılımıyla ilişkisini görmek.
 */

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

interface ResultStats {
  homeQ: number;
  awayQ: number;
  matches: number;
  homeXG: number;
  awayXG: number;
  homeGoals: number;
  awayGoals: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  homeBigWins: number;
  awayBigWins: number;
  // Gol farkı dağılımı
  goalDiffDist: Record<number, number>;
  // Maç başına gol dağılımı
  totalGoalDist: Record<number, number>;
}

function runResult(
  homeQ: number, awayQ: number, matchCount: number
): ResultStats {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  let homeXG = 0, awayXG = 0, homeGoals = 0, awayGoals = 0;
  let homeWins = 0, draws = 0, awayWins = 0;
  let homeBigWins = 0, awayBigWins = 0;

  const goalDiffDist: Record<number, number> = {};
  const totalGoalDist: Record<number, number> = {};

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

    homeXG += match.stats.xG.home;
    awayXG += match.stats.xG.away;
    homeGoals += match.homeScore;
    awayGoals += match.awayScore;

    const diff = match.homeScore - match.awayScore;
    if (diff > 0) homeWins++;
    else if (diff === 0) draws++;
    else awayWins++;

    if (diff >= 3) homeBigWins++;
    if (diff <= -3) awayBigWins++;

    const total = match.homeScore + match.awayScore;
    goalDiffDist[diff] = (goalDiffDist[diff] || 0) + 1;
    totalGoalDist[total] = (totalGoalDist[total] || 0) + 1;
  }

  return {
    homeQ, awayQ, matches: matchCount,
    homeXG: homeXG / matchCount,
    awayXG: awayXG / matchCount,
    homeGoals: homeGoals / matchCount,
    awayGoals: awayGoals / matchCount,
    homeWins: homeWins / matchCount,
    draws: draws / matchCount,
    awayWins: awayWins / matchCount,
    homeBigWins: homeBigWins / matchCount,
    awayBigWins: awayBigWins / matchCount,
    goalDiffDist,
    totalGoalDist,
  };
}

describe('Result Calibration — Kalite Farkı → Sonuç', () => {
  it('takım gücü farkı arttıkça sonuç nasıl değişiyor?', () => {
    console.log('\n⏳ Result calibration (6 seviye × 1000 maç)...\n');

    const N = 1000;

    const scenarios = [
      { home: 10, away: 10 },
      { home: 12, away: 10 },
      { home: 14, away: 10 },
      { home: 16, away: 10 },
      { home: 18, away: 10 },
      { home: 20, away: 10 },
    ];

    const lines: string[] = [];
    const f2 = (v: number) => v.toFixed(2);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║          RESULT CALIBRATION — KALİTE FARKI → SONUÇ (1000 maç)                ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  EV vs DEP   EV xG   DEP xG   EV GOL  DEP GOL  EV KAZ  BER   DEP KAZ  +3F    ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    const allResults: ResultStats[] = [];

    for (const s of scenarios) {
      const r = runResult(s.home, s.away, N);
      allResults.push(r);

      lines.push(
        `║  ${String(s.home).padStart(2)} vs ${String(s.away).padStart(2)}    ${f2(r.homeXG).padStart(6)}  ${f2(r.awayXG).padStart(6)}   ${f2(r.homeGoals).padStart(6)}  ${f2(r.awayGoals).padStart(6)}   ${pct(r.homeWins).padStart(6)} ${pct(r.draws).padStart(6)} ${pct(r.awayWins).padStart(7)}  ${pct(r.homeBigWins + r.awayBigWins).padStart(6)}  ║`
      );
    }

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── Kalibrasyon analizi ──
    lines.push('');
    lines.push('🔍 KALİBRASYON ANALİZİ');
    lines.push('');
    lines.push('  EV KAZANMA EĞRİSİ:');
    lines.push('');

    for (const r of allResults) {
      const expected = getExpectedWinRate(r.homeQ, r.awayQ);
      const diff = (r.homeWins - expected) * 100;
      const bar = '█'.repeat(Math.round(r.homeWins * 50));
      const sign = diff >= 0 ? '+' : '';
      lines.push(`    ${String(r.homeQ).padStart(2)} vs ${String(r.awayQ).padStart(2)}:  ${pct(r.homeWins).padStart(6)} (beklenen: ${pct(expected).padStart(6)}, fark: ${sign}${diff.toFixed(1)} puan)  ${bar}`);
    }

    lines.push('');

    // ── Gol farkı dağılımı ──
    lines.push('  GOL FARKI DAĞILIMI (18 vs 10):');
    const h18 = allResults[4];
    const sortedDiffs = Object.keys(h18.goalDiffDist).map(Number).sort((a, b) => a - b);
    for (const d of sortedDiffs) {
      const count = h18.goalDiffDist[d];
      const p = (count / N) * 100;
      const bar = '█'.repeat(Math.min(40, Math.round(p)));
      lines.push(`    ${String(d).padStart(2)} fark: ${p.toFixed(1).padStart(5)}%  ${bar}`);
    }

    lines.push('');

    // ── Toplam gol dağılımı ──
    lines.push('  TOPLAM GOL DAĞILIMI (18 vs 10):');
    const sortedGoals = Object.keys(h18.totalGoalDist).map(Number).sort((a, b) => a - b);
    for (const g of sortedGoals) {
      const count = h18.totalGoalDist[g];
      const p = (count / N) * 100;
      const bar = '█'.repeat(Math.min(40, Math.round(p)));
      lines.push(`    ${String(g).padStart(2)} gol: ${p.toFixed(1).padStart(5)}%  ${bar}`);
    }

    lines.push('');
    lines.push('  📌 YORUM');
    lines.push('');
    lines.push('  Hedefler:');
    lines.push('    • 10 vs 10 → ~%36 (mevcut)');
    lines.push('    • 12 vs 10 → ~%50');
    lines.push('    • 14 vs 10 → ~%62');
    lines.push('    • 16 vs 10 → ~%72');
    lines.push('    • 18 vs 10 → ~%80');
    lines.push('    • 20 vs 10 → ~%88');
    lines.push('');
    lines.push('  Eğer eğri çok dikse, kalite farkı çok agresif.');
    lines.push('  Eğer eğri çok düzse, kalite farkı yeterince etkili değil.');
    lines.push('');

    console.log(lines.join('\n'));
  }, 600000);
});

/**
 * Beklenen kazanma oranı (kalite farkına göre)
 * Logaritmik eğri: güçlü takım daha yavaş artmalı
 */
function getExpectedWinRate(homeQ: number, awayQ: number): number {
  const diff = homeQ - awayQ;
  if (diff === 0) return 0.36;
  // Logaritmik: 2 puan fark → +14, 4 puan → +26, 6 puan → +36, 8 puan → +44, 10 puan → +52
  const bonus = 0.14 * Math.log2(diff + 1) + 0.02 * diff;
  return Math.min(0.92, 0.36 + bonus);
}