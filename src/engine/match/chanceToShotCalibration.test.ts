// src/engine/match/chanceToShotCalibration.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch, setShotDebugCallback } from './matchEngine';
import type { Player, ShotDebugInfo } from '../types';

/**
 * CHANCE → SHOT → xG KALİBRASYONU
 *
 * Amaç: chanceQuality'nin şut olasılığı, isabetli şut, xG/şut ve xG'ye
 * nasıl dönüştüğünü ölçmek. Gerçek motor çıktısını kullanır.
 *
 * ChanceQuality aralıkları:
 *   0-15, 16-25, 26-35, 36-45, 46-55, 56-65, 66-75, 76-85, 86+
 *
 * Her aralık için:
 *   • sequence sayısı (chanceQuality bu aralıkta olan)
 *   • şut sayısı (shotTaken)
 *   • şut / sequence oranı
 *   • isabetli şut / şut
 *   • xG / şut
 *   • xG / sequence
 *   • gol / sequence
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

interface CQBucket {
  label: string;
  min: number;
  max: number; // exclusive
  sequences: number;
  shots: number;
  onTarget: number;
  xG: number;
  goals: number;
}

const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '0-15',   min: 0,  max: 16 },
  { label: '16-25',  min: 16, max: 26 },
  { label: '26-35',  min: 26, max: 36 },
  { label: '36-45',  min: 36, max: 46 },
  { label: '46-55',  min: 46, max: 56 },
  { label: '56-65',  min: 56, max: 66 },
  { label: '66-75',  min: 66, max: 76 },
  { label: '76-85',  min: 76, max: 86 },
  { label: '86+',    min: 86, max: Infinity },
];

interface ScenarioResult {
  label: string;
  matches: number;
  buckets: CQBucket[];
  totalSequences: number;
  totalShots: number;
  totalXG: number;
  totalGoals: number;
  avgCQ: number;
}

function emptyBuckets(): CQBucket[] {
  return BUCKETS.map(b => ({
    label: b.label,
    min: b.min,
    max: b.max,
    sequences: 0,
    shots: 0,
    onTarget: 0,
    xG: 0,
    goals: 0,
  }));
}

function runScenario(
  label: string,
  homeQuality: number,
  awayQuality: number,
  spread: number,
  matchCount: number
): ScenarioResult {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  const buckets = emptyBuckets();

  let totalSequences = 0;
  let totalShots = 0;
  let totalXG = 0;
  let totalGoals = 0;
  let cqSum = 0;

  // Shot debug: her şut atıldığında çağrılır
  const shotCallback = (info: ShotDebugInfo) => {
    const cq = info.sequenceChanceQuality;
    const bucket = buckets.find(b => cq >= b.min && cq < b.max);
    if (!bucket) return;

    bucket.shots++;
    bucket.xG += info.xG;
    if (info.onTarget) bucket.onTarget++;
    if (info.outcome === 'goal') bucket.goals++;

    totalShots++;
    totalXG += info.xG;
    if (info.outcome === 'goal') totalGoals++;
  };

  setShotDebugCallback(shotCallback);

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

    // Her sequence için bucket say
    for (const seq of match.sequences) {
      totalSequences++;
      cqSum += seq.chanceQuality;

      const bucket = buckets.find(b =>
        seq.chanceQuality >= b.min && seq.chanceQuality < b.max
      );
      if (bucket) bucket.sequences++;
    }
  }

  setShotDebugCallback(null);

  return {
    label,
    matches: matchCount,
    buckets,
    totalSequences,
    totalShots,
    totalXG,
    totalGoals,
    avgCQ: totalSequences > 0 ? cqSum / totalSequences : 0,
  };
}

describe('Chance → Shot → xG Kalibrasyonu', () => {
  it('chanceQuality aralıklarına göre şut/xG/gol davranışını ölç', () => {
    console.log('\n⏳ Chance → Shot → xG kalibrasyonu (3 senaryo × 500 maç)...\n');

    const N = 500;

    const lowLow = runScenario('Düşük-Düşük', 10, 10, 4, N);
    const highLow = runScenario('Yüksek-Düşük', 18, 10, 4, N);
    const highHigh = runScenario('Yüksek-Yüksek', 18, 18, 4, N);

    const lines: string[] = [];
    const f2 = (v: number) => v.toFixed(2);
    const f3 = (v: number) => v.toFixed(3);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';

    const safeDiv = (a: number, b: number) => b === 0 ? 0 : a / b;

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║       CHANCE → SHOT → xG KALİBRASYONU (500 maç × 3 senaryo)                  ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (const result of [lowLow, highLow, highHigh]) {
      lines.push(`║  ${result.label.toUpperCase()}${' '.repeat(72 - result.label.length)}║`);
      lines.push('║  CQ RANGE    SEQ      SHOT     SHOT/SEQ   ONT/SHOT   xG/SHOT   xG/SEQ    GOL/SEQ  ║');
      lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

      for (const b of result.buckets) {
        if (b.sequences === 0) continue;
        const shotPerSeq = safeDiv(b.shots, b.sequences);
        const ontPerShot = safeDiv(b.onTarget, b.shots);
        const xgPerShot = safeDiv(b.xG, b.shots);
        const xgPerSeq = safeDiv(b.xG, b.sequences);
        const goalsPerSeq = safeDiv(b.goals, b.sequences);

        lines.push(
          `║  ${b.label.padEnd(11)}${String(b.sequences).padStart(6)}${String(b.shots).padStart(9)}${pct(shotPerSeq).padStart(11)}${pct(ontPerShot).padStart(11)}${f3(xgPerShot).padStart(11)}${f3(xgPerSeq).padStart(10)}${f3(goalsPerSeq).padStart(10)}  ║`
        );
      }

      // Toplam satırı
      const totalShotPerSeq = safeDiv(result.totalShots, result.totalSequences);
      const totalXGPerShot = safeDiv(result.totalXG, result.totalShots);
      const totalXGPerSeq = safeDiv(result.totalXG, result.totalSequences);
      const totalGoalsPerSeq = safeDiv(result.totalGoals, result.totalSequences);

      lines.push(
        `║  ${'TOPLAM'.padEnd(11)}${String(result.totalSequences).padStart(6)}${String(result.totalShots).padStart(9)}${pct(totalShotPerSeq).padStart(11)}${'—'.padStart(11)}${f3(totalXGPerShot).padStart(11)}${f3(totalXGPerSeq).padStart(10)}${f3(totalGoalsPerSeq).padStart(10)}  ║`
      );

      lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    }

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── Analiz ──
    lines.push('');
    lines.push('🔍 ANALİZ');
    lines.push('');

    for (const result of [lowLow, highLow, highHigh]) {
      lines.push(`  ${result.label}:`);
      lines.push(`    Toplam sequence: ${result.totalSequences}`);
      lines.push(`    Toplam şut:      ${result.totalShots} (${pct(safeDiv(result.totalShots, result.totalSequences))} / sequence)`);
      lines.push(`    Toplam xG:       ${f2(result.totalXG)} (${f3(safeDiv(result.totalXG, result.totalShots))} / şut)`);
      lines.push(`    Toplam gol:      ${result.totalGoals} (${f3(safeDiv(result.totalGoals, result.totalSequences))} / sequence)`);
      lines.push(`    Ortalama CQ:     ${f2(result.avgCQ)}`);
      lines.push('');
      lines.push('    CQ dağılımı:');
      for (const b of result.buckets) {
        if (b.sequences === 0) continue;
        const pctOfTotal = (b.sequences / result.totalSequences) * 100;
        const bar = '█'.repeat(Math.min(40, Math.round(pctOfTotal)));
        const shotRate = b.shots > 0 ? pct(b.shots / b.sequences) : '—';
        lines.push(`      ${b.label.padEnd(8)} ${String(b.sequences).padStart(6)} (${pctOfTotal.toFixed(1)}%)  şut: ${shotRate.padStart(7)}  ${bar}`);
      }
      lines.push('');
    }

    // ── CQ → Şut oranı analizi ──
    lines.push('  CQ → ŞUT ORANI (tüm senaryolar birleşik):');
    lines.push('');
    lines.push('    CQ aralığı     ŞUT/SEQ    xG/ŞUT');
    lines.push('    ─────────────────────────────────');

    // Tüm senaryoları birleştir
    const combinedBuckets: CQBucket[] = emptyBuckets();
    for (const result of [lowLow, highLow, highHigh]) {
      for (const b of result.buckets) {
        const cb = combinedBuckets.find(c => c.label === b.label);
        if (!cb) continue;
        cb.sequences += b.sequences;
        cb.shots += b.shots;
        cb.onTarget += b.onTarget;
        cb.xG += b.xG;
        cb.goals += b.goals;
      }
    }

    for (const cb of combinedBuckets) {
      if (cb.sequences === 0) continue;
      const shotRate = safeDiv(cb.shots, cb.sequences);
      const xgPerShot = safeDiv(cb.xG, cb.shots);
      lines.push(`    ${cb.label.padEnd(13)} ${pct(shotRate).padStart(8)}   ${f3(xgPerShot).padStart(8)}`);
    }
    lines.push('');

    // ── Hipotez kontrolü ──
    lines.push('  🎯 HİPOTEZ KONTROLÜ');
    lines.push('');

    const firstFilled = combinedBuckets.find(b => b.sequences > 0);
    const lastFilled = [...combinedBuckets].reverse().find(b => b.sequences > 0);

    if (firstFilled && lastFilled && firstFilled.label !== lastFilled.label) {
      const firstShotRate = safeDiv(firstFilled.shots, firstFilled.sequences);
      const lastShotRate = safeDiv(lastFilled.shots, lastFilled.sequences);
      const firstXGPerShot = safeDiv(firstFilled.xG, firstFilled.shots);
      const lastXGPerShot = safeDiv(lastFilled.xG, lastFilled.shots);

      lines.push(`    ${firstFilled.label} → ${lastFilled.label}:`);
      lines.push(`      Şut oranı:  ${pct(firstShotRate)} → ${pct(lastShotRate)}  (fark: ${((lastShotRate - firstShotRate) * 100).toFixed(1)} puan)`);
      lines.push(`      xG/şut:     ${f3(firstXGPerShot)} → ${f3(lastXGPerShot)}  (fark: ${((lastXGPerShot / Math.max(0.001, firstXGPerShot) - 1) * 100).toFixed(1)}%)`);
      lines.push('');

      if (lastShotRate > firstShotRate * 1.5) {
        lines.push('    ✅ Şut oranı CQ ile belirgin şekilde artıyor.');
      } else {
        lines.push('    🟡 Şut oranı CQ ile yeterince artmıyor.');
      }

      if (lastXGPerShot > firstXGPerShot * 1.2) {
        lines.push('    ✅ xG/şut CQ ile belirgin şekilde artıyor.');
      } else {
        lines.push('    🟡 xG/şut CQ ile yeterince artmıyor.');
      }
    }

    lines.push('');
    lines.push('  📌 NOT: 71+ bucket neredeyse boşsa, motor yüksek kaliteli');
    lines.push('     pozisyon üretemiyor demektir. Bu, sonraki katmanın konusu.');
    lines.push('');

    console.log(lines.join('\n'));
  }, 300000);
});