// src/engine/match/xGConsistency.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import { eff } from './teamAnalysis';
import type { Player, AttackSequence } from '../types';

/**
 * xG TUTARLILIK TESTİ
 *
 * Üç xG hesabını karşılaştır:
 *   A) Decomposition (test içinde yeniden kurulan)
 *   B) matchEngine.stats.xG (gerçek motor)
 *   C) matchEngine.stats.shots (gerçek motor)
 *
 * Amaç: A ≈ B mi? Fark nereden geliyor?
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

interface ConsistencyStats {
  label: string;
  matches: number;

  // Gerçek motor
  realShots: number;
  realXG: number;
  realXGPerShot: number;

  // Decomposition
  decompShots: number;      // kaç sequence decompose edildi
  decompXG: number;
  decompXGPerShot: number;

  // Filtrelenmiş decomposition (chanceQuality > 15)
  filteredShots: number;
  filteredXG: number;
  filteredXGPerShot: number;

  // Farklar
  xGDiff: number;
  xGPerShotDiff: number;
}

/**
 * chance.ts'deki formülü birebir kopyalar.
 */
function calculateXGFromSequence(
  sequence: AttackSequence,
  shooter: Player
): number {
  const quality = Math.max(0, Math.min(100, sequence.chanceQuality));
  let distance = 25 - (quality / 100) * 19;

  if (sequence.finalZone === 'centerAttack') {
    distance = Math.max(6, distance - 3);
  } else if (sequence.finalZone === 'leftAttack' || sequence.finalZone === 'rightAttack') {
    distance = Math.max(8, distance);
  }
  distance = Math.max(5, Math.min(30, distance + (Math.random() - 0.5) * 4));

  let angle: number;
  if (sequence.finalZone === 'centerAttack') {
    angle = 45 + (quality / 100) * 60;
  } else {
    angle = 25 + (quality / 100) * 50;
  }
  angle = Math.max(15, Math.min(120, angle + (Math.random() - 0.5) * 15));

  const pressure = Math.max(10, Math.min(95, sequence.finalPressure));

  const finishing = eff(shooter, 'finishing');
  const composure = eff(shooter, 'composure');
  const technique = eff(shooter, 'technique');

  let distanceFactor: number;
  if (distance <= 6) distanceFactor = 2.0;
  else if (distance <= 12) distanceFactor = 1.3;
  else if (distance <= 18) distanceFactor = 0.75;
  else if (distance <= 25) distanceFactor = 0.35;
  else distanceFactor = 0.15;

  let xg = 0.20 * distanceFactor;

  xg *= 0.85 + (finishing / 100) * 0.30;
  xg *= 0.90 + (composure / 100) * 0.20;
  xg *= 0.95 + (technique / 100) * 0.10;
  xg *= 1 - (pressure / 100) * 0.5;

  if (angle > 90) xg *= 0.7;
  else if (angle > 70) xg *= 0.9;
  else if (angle > 50) xg *= 1.0;
  else xg *= 1.15;

  let positionMultiplier = 1.0;
  if (sequence.finalZone === 'leftAttack' || sequence.finalZone === 'rightAttack') {
    positionMultiplier = 1.15;
  } else if (sequence.totalActions >= 4) {
    positionMultiplier = 1.2;
  } else if (distance > 20) {
    positionMultiplier = 0.7;
  }
  xg *= positionMultiplier;

  if (distance <= 10 && pressure < 50 && angle > 60) {
    xg *= 1.4;
  }

  return Math.max(0.01, Math.min(0.95, xg));
}

function runScenario(
  label: string,
  homeQuality: number,
  awayQuality: number,
  spread: number,
  matchCount: number
): ConsistencyStats {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  let realShots = 0;
  let realXG = 0;

  let decompShots = 0;
  let decompXG = 0;

  let filteredShots = 0;
  let filteredXG = 0;

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

    // Gerçek motor
    const matchShots = match.stats.shots.home + match.stats.shots.away;
    const matchXG = match.stats.xG.home + match.stats.xG.away;
    realShots += matchShots;
    realXG += matchXG;

    // Decomposition — tüm sequence'lar
    for (const seq of match.sequences) {
      const allPlayers = [...homePlayers, ...awayPlayers];
      const shooter = allPlayers[Math.floor(Math.random() * allPlayers.length)];
      const xg = calculateXGFromSequence(seq, shooter);
      decompShots++;
      decompXG += xg;
    }

    // Filtrelenmiş decomposition — sadece chanceQuality > 15 VE şut olasılığı geçenler
    for (const seq of match.sequences) {
      if (seq.chanceQuality <= 15) continue;

      const shotProbability = Math.max(0.05, Math.min(0.90, seq.chanceQuality / 82));
      if (Math.random() > shotProbability) continue;

      const allPlayers = [...homePlayers, ...awayPlayers];
      const shooter = allPlayers[Math.floor(Math.random() * allPlayers.length)];
      const xg = calculateXGFromSequence(seq, shooter);
      filteredShots++;
      filteredXG += xg;
    }
  }

  const safeDiv = (a: number, b: number) => b === 0 ? 0 : a / b;

  return {
    label,
    matches: matchCount,
    realShots,
    realXG,
    realXGPerShot: safeDiv(realXG, realShots),
    decompShots,
    decompXG,
    decompXGPerShot: safeDiv(decompXG, decompShots),
    filteredShots,
    filteredXG,
    filteredXGPerShot: safeDiv(filteredXG, filteredShots),
    xGDiff: safeDiv(realXG, matchCount) - safeDiv(decompXG, matchCount),
    xGPerShotDiff: safeDiv(realXG, realShots) - safeDiv(decompXG, decompShots),
  };
}

describe('xG Tutarlılık — Decomposition vs Gerçek Motor', () => {
  it('üç xG hesabını karşılaştır', () => {
    console.log('\n⏳ xG tutarlılık (3 senaryo × 500 maç)...\n');

    const N = 500;

    const lowLow = runScenario('Düşük-Düşük', 10, 10, 4, N);
    const highLow = runScenario('Yüksek-Düşük', 18, 10, 4, N);
    const highHigh = runScenario('Yüksek-Yüksek', 18, 18, 4, N);

    const lines: string[] = [];
    const f4 = (v: number) => v.toFixed(4);
    const f2 = (v: number) => v.toFixed(2);
    const f1 = (v: number) => v.toFixed(1);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';

    const row = (label: string, a: string, b: string, c: string) => {
      lines.push(
        `║  ${label.padEnd(26)}${a.padStart(12)}${b.padStart(14)}${c.padStart(14)}   ║`
      );
    };

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║        xG TUTARLILIK — DECOMPOSITION vs GERÇEK MOTOR                          ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  METRİK                    DÜŞÜK-DÜŞÜK  YÜKSEK-DÜŞÜK  YÜKSEK-YÜKSEK        ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    // ── Gerçek motor ──
    lines.push('║  ── GERÇEK MOTOR ──                                                          ║');
    row('Şut / maç',
      f1(lowLow.realShots / lowLow.matches),
      f1(highLow.realShots / highLow.matches),
      f1(highHigh.realShots / highHigh.matches));
    row('xG / maç',
      f2(lowLow.realXG / lowLow.matches),
      f2(highLow.realXG / highLow.matches),
      f2(highHigh.realXG / highHigh.matches));
    row('xG / şut (gerçek)',
      f4(lowLow.realXGPerShot),
      f4(highLow.realXGPerShot),
      f4(highHigh.realXGPerShot));

    // ── Decomposition (tüm sequence'lar) ──
    lines.push('║  ── DECOMPOSITION (tüm sequence\'lar) ──                                      ║');
    row('Sequence / maç',
      f1(lowLow.decompShots / lowLow.matches),
      f1(highLow.decompShots / highLow.matches),
      f1(highHigh.decompShots / highHigh.matches));
    row('xG / maç (decomp)',
      f2(lowLow.decompXG / lowLow.matches),
      f2(highLow.decompXG / highLow.matches),
      f2(highHigh.decompXG / highHigh.matches));
    row('xG / şut (decomp)',
      f4(lowLow.decompXGPerShot),
      f4(highLow.decompXGPerShot),
      f4(highHigh.decompXGPerShot));

    // ── Filtrelenmiş decomposition ──
    lines.push('║  ── FİLTRELENMİŞ DECOMPOSITION (cq>15, shotProb) ──                          ║');
    row('Şut / maç (filtered)',
      f1(lowLow.filteredShots / lowLow.matches),
      f1(highLow.filteredShots / highLow.matches),
      f1(highHigh.filteredShots / highHigh.matches));
    row('xG / maç (filtered)',
      f2(lowLow.filteredXG / lowLow.matches),
      f2(highLow.filteredXG / highLow.matches),
      f2(highHigh.filteredXG / highHigh.matches));
    row('xG / şut (filtered)',
      f4(lowLow.filteredXGPerShot),
      f4(highLow.filteredXGPerShot),
      f4(highHigh.filteredXGPerShot));

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── Fark analizi ──
    lines.push('');
    lines.push('🔍 FARK ANALİZİ (Gerçek vs Decomposition)');
    lines.push('');

    const analyze = (real: number, decomp: number, realPerShot: number, decompPerShot: number, label: string) => {
      const totalDiff = (real / decomp - 1) * 100;
      const perShotDiff = (realPerShot / decompPerShot - 1) * 100;
      lines.push(`  ${label}`);
      lines.push(`    Toplam xG/maç farkı:  ${real.toFixed(2)} vs ${decomp.toFixed(2)}  → ${totalDiff >= 0 ? '+' : ''}${totalDiff.toFixed(1)}%`);
      lines.push(`    xG/şut farkı:         ${realPerShot.toFixed(4)} vs ${decompPerShot.toFixed(4)}  → ${perShotDiff >= 0 ? '+' : ''}${perShotDiff.toFixed(1)}%`);
      lines.push('');
    };

    analyze(
      lowLow.realXG / lowLow.matches,
      lowLow.decompXG / lowLow.matches,
      lowLow.realXGPerShot,
      lowLow.decompXGPerShot,
      'LOW-LOW'
    );

    analyze(
      highLow.realXG / highLow.matches,
      highLow.decompXG / highLow.matches,
      highLow.realXGPerShot,
      highLow.decompXGPerShot,
      'HIGH-LOW'
    );

    analyze(
      highHigh.realXG / highHigh.matches,
      highHigh.decompXG / highHigh.matches,
      highHigh.realXGPerShot,
      highHigh.decompXGPerShot,
      'HIGH-HIGH'
    );

    // ── Sonuç ──
    lines.push('📌 SONUÇ');
    lines.push('');

    const realHighLowXGPerShot = highLow.realXGPerShot;
    const decompHighLowXGPerShot = highLow.decompXGPerShot;
    const filteredHighLowXGPerShot = highLow.filteredXGPerShot;

    lines.push('  HIGH-LOW xG/şut:');
    lines.push(`    Gerçek motor:        ${realHighLowXGPerShot.toFixed(4)}`);
    lines.push(`    Decomposition:       ${decompHighLowXGPerShot.toFixed(4)}`);
    lines.push(`    Filtrelenmiş decomp: ${filteredHighLowXGPerShot.toFixed(4)}`);
    lines.push('');

    const realVsDecomp = Math.abs(realHighLowXGPerShot - decompHighLowXGPerShot) / realHighLowXGPerShot;
    const realVsFiltered = Math.abs(realHighLowXGPerShot - filteredHighLowXGPerShot) / realHighLowXGPerShot;

    if (realVsDecomp > 0.15) {
      lines.push(`  🔴 Decomposition gerçek motordan ${(realVsDecomp * 100).toFixed(1)}% sapıyor.`);
      lines.push(`     Sebep: pickShooter farkı veya filtre eksikliği.`);
    } else {
      lines.push(`  ✅ Decomposition gerçek motora yakın (sapma: ${(realVsDecomp * 100).toFixed(1)}%).`);
    }
    lines.push('');

    if (realVsFiltered < 0.10) {
      lines.push(`  ✅ Filtrelenmiş decomposition gerçek motora çok yakın (sapma: ${(realVsFiltered * 100).toFixed(1)}%).`);
      lines.push(`     → Gerçek motorun şut seçimi doğru modellenmiş.`);
    } else if (realVsFiltered < realVsDecomp) {
      lines.push(`  🟡 Filtrelenmiş decomposition daha iyi (sapma: ${(realVsFiltered * 100).toFixed(1)}%).`);
      lines.push(`     → Filtre kısmen çalışıyor ama hâlâ fark var.`);
    }
    lines.push('');

    console.log(lines.join('\n'));
  }, 300000);
});