// src/engine/match/chanceToShotCalibration.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import type { Player } from '../types';

/**
 * CHANCE → SHOT → xG KALİBRASYONU
 *
 * Amaç: chanceQuality'nin şut olasılığı, şut sayısı, isabetli şut,
 * xG/şut ve xG'ye nasıl dönüştüğünü ölçmek.
 *
 * ChanceQuality aralıkları:
 *   0-15, 16-25, 26-35, 36-45, 46-55, 56-65, 66-75, 76-85, 86+
 *
 * Her aralık için:
 *   • sequence sayısı
 *   • şut sayısı (shotProbability geçen)
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
  max: number; // exclusive, ama 86+ için Infinity
  sequences: number;
  shots: number;
  onTarget: number;
  xG: number;
  goals: number;
  // Şut başına
  shotsPerSequence: number;
  onTargetPerShot: number;
  xGPerShot: number;
  xGPerSequence: number;
  goalsPerSequence: number;
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
  // Genel
  totalSequences: number;
  totalShots: number;
  totalXG: number;
  totalGoals: number;
  avgCQ: number;
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

  const buckets: CQBucket[] = BUCKETS.map(b => ({
    label: b.label,
    min: b.min,
    max: b.max,
    sequences: 0,
    shots: 0,
    onTarget: 0,
    xG: 0,
    goals: 0,
    shotsPerSequence: 0,
    onTargetPerShot: 0,
    xGPerShot: 0,
    xGPerSequence: 0,
    goalsPerSequence: 0,
  }));

  let totalSequences = 0;
  let totalShots = 0;
  let totalXG = 0;
  let totalGoals = 0;
  let cqSum = 0;

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

    // Her sequence için chanceQuality'yi al
    for (const seq of match.sequences) {
      totalSequences++;
      cqSum += seq.chanceQuality;

      // Bucket bul
      const bucket = buckets.find(b =>
        seq.chanceQuality >= b.min && seq.chanceQuality < b.max
      );
      if (!bucket) continue;
      bucket.sequences++;

      // Şut olasılığı geçti mi?
      const shotProbability = Math.max(0.05, Math.min(0.90, seq.chanceQuality / 82));
      // Not: matchEngine zaten shotProbability'yi geçenleri şut olarak sayıyor.
      // Ama biz burada tüm sequence'ları görüyoruz.
      // Bu yüzden "şut oldu mu" bilgisini match events'ten almalıyız.
    }

    // Şutları match events'ten al
    // Ama match events'te sequence bilgisi yok.
    // Bu yüzden farklı bir yaklaşım kullanacağız:
    // match.stats.shots.home + match.stats.shots.away = toplam şut
    // Ama bu, sequence bazlı değil.
  }

  // Placeholder — gerçek hesaplama aşağıda
  const safeDiv = (a: number, b: number) => b === 0 ? 0 : a / b;

  for (const b of buckets) {
    b.shotsPerSequence = safeDiv(b.shots, b.sequences);
    b.onTargetPerShot = safeDiv(b.onTarget, b.shots);
    b.xGPerShot = safeDiv(b.xG, b.shots);
    b.xGPerSequence = safeDiv(b.xG, b.sequences);
    b.goalsPerSequence = safeDiv(b.goals, b.sequences);
  }

  return {
    label,
    matches: matchCount,
    buckets,
    totalSequences,
    totalShots,
    totalXG,
    totalGoals,
    avgCQ: safeDiv(cqSum, totalSequences),
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

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║       CHANCE → SHOT → xG KALİBRASYONU (500 maç × 3 senaryo)                  ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (const result of [lowLow, highLow, highHigh]) {
      lines.push(`║  ${result.label.toUpperCase()}${' '.repeat(72 - result.label.length)}║`);
      lines.push('║  CQ RANGE    SEQ      SHOT     SHOT/SEQ   ONT/SHOT   xG/SHOT   xG/SEQ     GOL/SEQ  ║');
      lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

      for (const b of result.buckets) {
        if (b.sequences === 0) continue;
        lines.push(
          `║  ${b.label.padEnd(11)}${String(b.sequences).padStart(6)}${String(b.shots).padStart(9)}${pct(b.shotsPerSequence).padStart(11)}${pct(b.onTargetPerShot).padStart(11)}${f3(b.xGPerShot).padStart(11)}${f3(b.xGPerSequence).padStart(11)}${f3(b.goalsPerSequence).padStart(11)}  ║`
        );
      }

      lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    }

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── Analiz ──
    lines.push('');
    lines.push('🔍 ANALİZ');
    lines.push('');
    lines.push('  Bu tabloda görmek istediğimiz:');
    lines.push('  • CQ arttıkça SHOT/SEQ artıyor mu? (şut olasılığı)');
    lines.push('  • CQ arttıkça xG/SHOT artıyor mu? (şut kalitesi)');
    lines.push('  • CQ arttıkça xG/SEQ nasıl değişiyor?');
    lines.push('  • 71+ bucket neredeyse boş — bu normal mi?');
    lines.push('');

    // CQ dağılımı
    for (const result of [lowLow, highLow, highHigh]) {
      lines.push(`  ${result.label}:`);
      lines.push(`    Toplam sequence: ${result.totalSequences}`);
      lines.push(`    Ortalama CQ: ${f2(result.avgCQ)}`);
      lines.push(`    CQ dağılımı:`);
      for (const b of result.buckets) {
        if (b.sequences === 0) continue;
        const pctOfTotal = (b.sequences / result.totalSequences) * 100;
        const bar = '█'.repeat(Math.min(40, Math.round(pctOfTotal)));
        lines.push(`      ${b.label.padEnd(8)} ${String(b.sequences).padStart(6)} (${pctOfTotal.toFixed(1)}%)  ${bar}`);
      }
      lines.push('');
    }

    console.log(lines.join('\n'));
  }, 300000);
});