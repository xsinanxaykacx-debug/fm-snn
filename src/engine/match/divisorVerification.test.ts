// src/engine/match/divisorVerification.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import { setActionSuccessDivisor } from './attackSequence';
import type { Player } from '../types';

/**
 * DIVISOR 180 DOĞRULAMA TESTİ
 *
 * Amaç: 180 değerini yüksek örneklemle (2000 maç × 3 senaryo)
 * doğrulamak. Önceki test 500 maçtı, rastgelelik payı yüksekti.
 *
 * Beklenen:
 *   • Pas isabet farkı: +7–9
 *   • HIGH-LOW xG: ~3.0
 *   • HIGH-HIGH: ~33/33/33
 *   • LOW-LOW baseline: xG ~2.4, gol ~2.4
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

interface ScenarioStats {
  label: string;
  matches: number;
  sequences: number;
  avgActionsPerSequence: number;
  shotsPerMatch: number;
  onTargetPerMatch: number;
  xGPerMatch: number;
  goalsPerMatch: number;
  xGPerShot: number;
  avgPassSuccessRate: number;
  avgChanceQuality: number;
  homeWinRate: number;
  drawRate: number;
  awayWinRate: number;
  homePossession: number;
}

function runScenario(
  label: string,
  homeQuality: number,
  awayQuality: number,
  spread: number,
  matchCount: number
): ScenarioStats {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  let sequences = 0;
  let totalActions = 0;
  let shots = 0;
  let onTarget = 0;
  let xG = 0;
  let goals = 0;
  let wins = 0, draws = 0, losses = 0;
  let passAttempts = 0, passSuccesses = 0;
  let cqSum = 0, cqCount = 0;
  let possessionHome = 0;

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

    for (const p of homePlayers) setAttributeLevel(p, homeQuality, spread);
    for (const p of awayPlayers) setAttributeLevel(p, awayQuality, spread);

    const match = simulateMatch(home, away, data.players, 1);

    sequences += match.sequences.length;
    shots += match.stats.shots.home + match.stats.shots.away;
    onTarget += match.stats.onTarget.home + match.stats.onTarget.away;
    xG += match.stats.xG.home + match.stats.xG.away;
    goals += match.homeScore + match.awayScore;

    if (match.homeScore > match.awayScore) wins++;
    else if (match.homeScore === match.awayScore) draws++;
    else losses++;

    passAttempts += match.stats.passes.home + match.stats.passes.away;
    passSuccesses += match.stats.passesCompleted.home + match.stats.passesCompleted.away;

    const totalPoss = match.stats.possession.home + match.stats.possession.away;
    if (totalPoss > 0) {
      possessionHome += (match.stats.possession.home / totalPoss) * 100;
    }

    for (const seq of match.sequences) {
      totalActions += seq.actions.length;
      cqSum += seq.chanceQuality;
      cqCount++;
    }
  }

  const safeDiv = (a: number, b: number) => b === 0 ? 0 : a / b;

  return {
    label,
    matches: matchCount,
    sequences,
    avgActionsPerSequence: safeDiv(totalActions, sequences),
    shotsPerMatch: safeDiv(shots, matchCount),
    onTargetPerMatch: safeDiv(onTarget, matchCount),
    xGPerMatch: safeDiv(xG, matchCount),
    goalsPerMatch: safeDiv(goals, matchCount),
    xGPerShot: safeDiv(xG, shots),
    avgPassSuccessRate: safeDiv(passSuccesses, passAttempts),
    avgChanceQuality: safeDiv(cqSum, cqCount),
    homeWinRate: safeDiv(wins, matchCount),
    drawRate: safeDiv(draws, matchCount),
    awayWinRate: safeDiv(losses, matchCount),
    homePossession: safeDiv(possessionHome, matchCount),
  };
}

describe('Divisor 180 Doğrulama', () => {
  it('180 değerini 2000 maç × 3 senaryo ile doğrula', () => {
    console.log('\n⏳ Divisor 180 doğrulanıyor (2000 maç × 3 senaryo)...\n');

    const N = 2000;
    setActionSuccessDivisor(180);

    const lowLow = runScenario('Düşük-Düşük (10 vs 10)', 10, 10, 4, N);
    const highLow = runScenario('Yüksek-Düşük (18 vs 10)', 18, 10, 4, N);
    const highHigh = runScenario('Yüksek-Yüksek (18 vs 18)', 18, 18, 4, N);

    // Varsayılana geri dön
    setActionSuccessDivisor(150);

    const lines: string[] = [];
    const f2 = (v: number) => v.toFixed(2);
    const f1 = (v: number) => v.toFixed(1);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';

    const row = (label: string, a: string, b: string, c: string, diff = '') => {
      lines.push(
        `║  ${label.padEnd(24)}${a.padStart(11)}${b.padStart(13)}${c.padStart(14)}${diff.padStart(11)}   ║`
      );
    };

    const pctDiff = (a: number, b: number) => {
      if (a === 0) return 'N/A';
      const d = ((b / a) - 1) * 100;
      return (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
    };

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║     DIVISOR 180 DOĞRULAMA — 2000 MAÇ × 3 SENARYO                             ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  METRİK                  DÜŞÜK-DÜŞÜK  YÜKSEK-DÜŞÜK  YÜKSEK-YÜKSEK   Y/D     ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    // ── Sequence / aksiyon ──
    lines.push('║  ── SEQUENCE / AKSİYON ──                                                    ║');
    row('Sequence / maç',
      f1(lowLow.sequences / lowLow.matches),
      f1(highLow.sequences / highLow.matches),
      f1(highHigh.sequences / highHigh.matches),
      pctDiff(lowLow.sequences / lowLow.matches, highLow.sequences / highLow.matches));
    row('Aksiyon / sequence',
      f2(lowLow.avgActionsPerSequence),
      f2(highLow.avgActionsPerSequence),
      f2(highHigh.avgActionsPerSequence),
      pctDiff(lowLow.avgActionsPerSequence, highLow.avgActionsPerSequence));
    row('Pas isabet %',
      pct(lowLow.avgPassSuccessRate),
      pct(highLow.avgPassSuccessRate),
      pct(highHigh.avgPassSuccessRate),
      '+' + ((highLow.avgPassSuccessRate - lowLow.avgPassSuccessRate) * 100).toFixed(1));

    // ── Şut / xG ──
    lines.push('║  ── ŞUT / xG ──                                                              ║');
    row('Şut / maç',
      f1(lowLow.shotsPerMatch),
      f1(highLow.shotsPerMatch),
      f1(highHigh.shotsPerMatch),
      pctDiff(lowLow.shotsPerMatch, highLow.shotsPerMatch));
    row('İsabetli şut / maç',
      f1(lowLow.onTargetPerMatch),
      f1(highLow.onTargetPerMatch),
      f1(highHigh.onTargetPerMatch),
      pctDiff(lowLow.onTargetPerMatch, highLow.onTargetPerMatch));
    row('xG / maç',
      f2(lowLow.xGPerMatch),
      f2(highLow.xGPerMatch),
      f2(highHigh.xGPerMatch),
      pctDiff(lowLow.xGPerMatch, highLow.xGPerMatch));
    row('xG / şut',
      f2(lowLow.xGPerShot * 100) + '%',
      f2(highLow.xGPerShot * 100) + '%',
      f2(highHigh.xGPerShot * 100) + '%',
      pctDiff(lowLow.xGPerShot, highLow.xGPerShot));

    // ── Gol / sonuç ──
    lines.push('║  ── GOL / SONUÇ ──                                                           ║');
    row('Gol / maç',
      f2(lowLow.goalsPerMatch),
      f2(highLow.goalsPerMatch),
      f2(highHigh.goalsPerMatch),
      pctDiff(lowLow.goalsPerMatch, highLow.goalsPerMatch));
    row('Gol / xG',
      f2(lowLow.goalsPerMatch / Math.max(0.01, lowLow.xGPerMatch)),
      f2(highLow.goalsPerMatch / Math.max(0.01, highLow.xGPerMatch)),
      f2(highHigh.goalsPerMatch / Math.max(0.01, highHigh.xGPerMatch)),
      '');
    row('Ev possession %',
      f1(lowLow.homePossession) + '%',
      f1(highLow.homePossession) + '%',
      f1(highHigh.homePossession) + '%',
      pctDiff(lowLow.homePossession, highLow.homePossession));
    row('Ev kazanma %',
      pct(lowLow.homeWinRate),
      pct(highLow.homeWinRate),
      pct(highHigh.homeWinRate),
      pctDiff(lowLow.homeWinRate, highLow.homeWinRate));
    row('Beraberlik %',
      pct(lowLow.drawRate),
      pct(highLow.drawRate),
      pct(highHigh.drawRate),
      pctDiff(lowLow.drawRate, highLow.drawRate));
    row('Ev kaybetme %',
      pct(lowLow.awayWinRate),
      pct(highLow.awayWinRate),
      pct(highHigh.awayWinRate),
      pctDiff(lowLow.awayWinRate, highLow.awayWinRate));

    // ── Bağlam ──
    lines.push('║  ── BAĞLAM ──                                                                ║');
    row('Ort. chanceQuality',
      f1(lowLow.avgChanceQuality),
      f1(highLow.avgChanceQuality),
      f1(highHigh.avgChanceQuality),
      pctDiff(lowLow.avgChanceQuality, highLow.avgChanceQuality));

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ═══ HEDEF KONTROLÜ ═══
    lines.push('');
    lines.push('🎯 HEDEF KONTROLÜ');
    lines.push('');

    const passDiff = (highLow.avgPassSuccessRate - lowLow.avgPassSuccessRate) * 100;

    const checks: [string, boolean, string][] = [
      [
        'Pas isabet farkı +7–9 puan',
        passDiff >= 7 && passDiff <= 9,
        `+${passDiff.toFixed(1)}`
      ],
      [
        'HIGH-LOW xG ~2.8–3.0',
        highLow.xGPerMatch >= 2.8 && highLow.xGPerMatch <= 3.05,
        f2(highLow.xGPerMatch)
      ],
      [
        'HIGH-LOW gol ~2.8–3.0',
        highLow.goalsPerMatch >= 2.8 && highLow.goalsPerMatch <= 3.05,
        f2(highLow.goalsPerMatch)
      ],
      [
        'HIGH-HIGH dengesi (~33/33/33)',
        Math.abs(highHigh.homeWinRate - 0.33) < 0.06 &&
        Math.abs(highHigh.drawRate - 0.33) < 0.06 &&
        Math.abs(highHigh.awayWinRate - 0.33) < 0.06,
        `${pct(highHigh.homeWinRate)}/${pct(highHigh.drawRate)}/${pct(highHigh.awayWinRate)}`
      ],
      [
        'LOW-LOW xG ~2.4–2.5',
        lowLow.xGPerMatch >= 2.3 && lowLow.xGPerMatch <= 2.55,
        f2(lowLow.xGPerMatch)
      ],
      [
        'LOW-LOW gol ~2.3–2.5',
        lowLow.goalsPerMatch >= 2.2 && lowLow.goalsPerMatch <= 2.55,
        f2(lowLow.goalsPerMatch)
      ],
      [
        'LOW-LOW ev kazanma ~%33',
        Math.abs(lowLow.homeWinRate - 0.33) < 0.05,
        pct(lowLow.homeWinRate)
      ],
    ];

    for (const [label, pass, value] of checks) {
      lines.push(`  ${pass ? '✅' : '❌'} ${label.padEnd(35)} → ${value}`);
    }

    lines.push('');
    const allPass = checks.every(c => c[1]);
    if (allPass) {
      lines.push('🎉 TÜM HEDEFLER TUTTU. Divisor 180 güvenle sabitlenebilir.');
    } else {
      const failed = checks.filter(c => !c[1]).length;
      lines.push(`⚠️  ${failed} hedef tutmadı. Divisor 180'i sabitlemeden önce değerlendir.`);
    }
    lines.push('');

    console.log(lines.join('\n'));
  }, 400000);
});