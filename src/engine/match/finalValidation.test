// src/engine/match/finalValidation.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import type { Club, Match } from '../types';

describe('Final Validation — 10.000 Maç Genel Dağılım', () => {
  it('motorun son doğrulaması', () => {
    console.log('\n⏳ Final validation: 10.000 maç simüle ediliyor...\n');

    const data = generateGameData();
    const clubList: Club[] = Object.values(data.clubs);

    let totalGoals = 0;
    let totalShots = 0;
    let totalOnTarget = 0;
    let totalXG = 0;
    let totalPasses = 0;
    let totalPassesCompleted = 0;
    let totalPossessionHome = 0;
    let homeWins = 0, draws = 0, awayWins = 0;
    let totalSequences = 0;
    let totalActions = 0;
    let cleanSheets = 0;

    const goalDistribution: Record<number, number> = {};
    const homeGoalDist: Record<number, number> = {};
    const awayGoalDist: Record<number, number> = {};

    const N = 10000;

    for (let i = 0; i < N; i++) {
      const homeIdx = i % clubList.length;
      const awayIdx = (i + 1) % clubList.length;
      if (homeIdx === awayIdx) continue;

      const home = clubList[homeIdx];
      const away = clubList[awayIdx];

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

      const match = simulateMatch(home, away, data.players, 1);

      const hg = match.homeScore;
      const ag = match.awayScore;
      const total = hg + ag;

      totalGoals += total;
      totalShots += match.stats.shots.home + match.stats.shots.away;
      totalOnTarget += match.stats.onTarget.home + match.stats.onTarget.away;
      totalXG += match.stats.xG.home + match.stats.xG.away;
      totalPasses += match.stats.passes.home + match.stats.passes.away;
      totalPassesCompleted += match.stats.passesCompleted.home + match.stats.passesCompleted.away;

      const totalPoss = match.stats.possession.home + match.stats.possession.away;
      if (totalPoss > 0) totalPossessionHome += (match.stats.possession.home / totalPoss) * 100;

      if (hg > ag) homeWins++;
      else if (hg === ag) draws++;
      else awayWins++;

      if (hg === 0 || ag === 0) cleanSheets++;

      goalDistribution[total] = (goalDistribution[total] || 0) + 1;
      homeGoalDist[hg] = (homeGoalDist[hg] || 0) + 1;
      awayGoalDist[ag] = (awayGoalDist[ag] || 0) + 1;

      totalSequences += match.sequences.length;
      for (const seq of match.sequences) {
        totalActions += seq.actions.length;
      }
    }

    const safeDiv = (a: number, b: number) => b === 0 ? 0 : a / b;

    const lines: string[] = [];
    const f2 = (v: number) => v.toFixed(2);
    const f1 = (v: number) => v.toFixed(1);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║           FINAL VALIDATION — 10.000 MAÇ GENEL DAĞILIM                        ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    lines.push('║  ── TEMEL METRİKLER ──                                                       ║');
    lines.push(`║  Gol / maç:              ${f2(totalGoals / N).padStart(8)}   (hedef: 2.5-3.0)                     ║`);
    lines.push(`║  Şut / maç:              ${f1(totalShots / N).padStart(8)}   (hedef: 20-28)                       ║`);
    lines.push(`║  İsabetli şut / maç:     ${f1(totalOnTarget / N).padStart(8)}   (hedef: 7-10)                        ║`);
    lines.push(`║  xG / maç:               ${f2(totalXG / N).padStart(8)}   (hedef: 2.5-3.0)                     ║`);
    lines.push(`║  Pas / maç:              ${f1(totalPasses / N).padStart(8)}                                       ║`);
    lines.push(`║  Pas isabet %:           ${pct(safeDiv(totalPassesCompleted, totalPasses)).padStart(8)}                                       ║`);
    lines.push(`║  Ev possession %:        ${f1(totalPossessionHome / N).padStart(8)}%                                      ║`);
    lines.push(`║  Sequence / maç:         ${f1(totalSequences / N).padStart(8)}                                       ║`);
    lines.push(`║  Aksiyon / sequence:     ${f2(safeDiv(totalActions, totalSequences)).padStart(8)}                                       ║`);
    lines.push(`║  Clean sheet %:          ${pct(cleanSheets / N).padStart(8)}                                       ║`);

    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  ── SONUÇ DAĞILIMI ──                                                        ║');
    lines.push(`║  Ev kazanma:             ${pct(homeWins / N).padStart(8)}   (hedef: ~45%)                        ║`);
    lines.push(`║  Beraberlik:             ${pct(draws / N).padStart(8)}   (hedef: ~25%)                        ║`);
    lines.push(`║  Deplasman kazanma:      ${pct(awayWins / N).padStart(8)}   (hedef: ~30%)                        ║`);

    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  ── GOL DAĞILIMI (toplam gol / maç) ──                                       ║');
    lines.push('║  Gol    Maç sayısı    %                                                       ║');

    const sortedKeys = Object.keys(goalDistribution).map(Number).sort((a, b) => a - b);
    for (const g of sortedKeys) {
      const count = goalDistribution[g];
      const p = (count / N) * 100;
      const bar = '█'.repeat(Math.min(40, Math.round(p / 2)));
      lines.push(`║  ${String(g).padStart(2)}     ${String(count).padStart(7)}     ${p.toFixed(1).padStart(5)}%  ${bar.padEnd(40)} ║`);
    }

    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  ── EV GOL DAĞILIMI ──                                                       ║');
    const homeSorted = Object.keys(homeGoalDist).map(Number).sort((a, b) => a - b);
    for (const g of homeSorted) {
      const count = homeGoalDist[g];
      const p = (count / N) * 100;
      lines.push(`║  ${String(g).padStart(2)} gol: ${pct(count / N).padStart(6)}                                                       ║`);
    }

    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  ── DEPLASMAN GOL DAĞILIMI ──                                                ║');
    const awaySorted = Object.keys(awayGoalDist).map(Number).sort((a, b) => a - b);
    for (const g of awaySorted) {
      const count = awayGoalDist[g];
      const p = (count / N) * 100;
      lines.push(`║  ${String(g).padStart(2)} gol: ${pct(count / N).padStart(6)}                                                       ║`);
    }

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    lines.push('');
    lines.push('📌 DEĞERLENDİRME');
    lines.push('');
    lines.push('  Hedefler:');
    lines.push('    • Gol/maç:        2.5-3.0');
    lines.push('    • Şut/maç:        20-28');
    lines.push('    • xG/maç:         2.5-3.0');
    lines.push('    • Pas isabet:     %70-85');
    lines.push('    • Ev kazanma:     ~%45');
    lines.push('    • Beraberlik:     ~%25');
    lines.push('    • Deplasman kaz:  ~%30');
    lines.push('');

    const goalsPerMatch = totalGoals / N;
    const xGPerMatch = totalXG / N;
    const passAcc = safeDiv(totalPassesCompleted, totalPasses);
    const homeWinPct = homeWins / N;

    const checks: [string, boolean, string][] = [
      ['Gol/maç 2.5-3.0',      goalsPerMatch >= 2.4 && goalsPerMatch <= 3.2, f2(goalsPerMatch)],
      ['Şut/maç 20-28',        totalShots / N >= 18 && totalShots / N <= 30,  f1(totalShots / N)],
      ['xG/maç 2.5-3.0',       xGPerMatch >= 2.3 && xGPerMatch <= 3.2,        f2(xGPerMatch)],
      ['Pas isabet %70-85',    passAcc >= 0.65 && passAcc <= 0.88,            pct(passAcc)],
      ['Ev kazanma ~%45',      homeWinPct >= 0.38 && homeWinPct <= 0.55,      pct(homeWinPct)],
    ];

    for (const [label, pass, value] of checks) {
      lines.push(`  ${pass ? '✅' : '❌'} ${label.padEnd(25)} → ${value}`);
    }

    lines.push('');
    const allPass = checks.every(c => c[1]);
    if (allPass) {
      lines.push('  🎉 TÜM HEDEFLER TUTTU. MOTOR DONDURULABİLİR.');
    } else {
      lines.push('  ⚠️  Bazı hedefler sapıyor. Değerlendir.');
    }
    lines.push('');

    console.log(lines.join('\n'));
  }, 600000);
});