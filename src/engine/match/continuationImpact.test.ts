// src/engine/match/continuationImpact.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import { eff } from './teamAnalysis';
import type { Player } from '../types';

/**
 * CONTINUATION IMPACT TESTİ
 *
 * Amaç: Başarılı bir aksiyondan sonra sequence'in devam etme
 * olasılığını ölçmek. Kalite farkı burada mı patlıyor?
 *
 * Zincir:
 *   aksiyon başarılı mı?
 *     ↓ evet
 *   sequence devam ediyor mu?
 *     ↓ evet
 *   sonraki aksiyon
 *
 * Eğer yüksek kaliteli takımın sequence'ları başarılı aksiyondan
 * sonra çok daha sık devam ediyorsa, asıl katil halka budur.
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

interface ContinuationStats {
  name: string;
  matches: number;

  // Sequence uzunluk dağılımı
  sequences: number;
  totalActions: number;

  // Aksiyon sonrası devam
  successfulActions: number;       // başarılı aksiyon sayısı
  actionsAfterSuccess: number;     // başarılı aksiyondan sonra gelen aksiyon sayısı
  continuationRate: number;        // actionsAfterSuccess / successfulActions

  // Sequence bitiş nedenleri
  endedByFailure: number;          // başarısız aksiyonla bitti
  endedByMaxActions: number;       // maxActions'a ulaştı
  endedByOther: number;            // diğer

  // Sequence uzunluk dağılımı
  seqLength1: number;
  seqLength2: number;
  seqLength3: number;
  seqLength4plus: number;

  // Kalite bağlamı
  avgPassSuccessRate: number;
  avgChanceQuality: number;
}

function runScenario(
  name: string,
  homeQuality: number,
  awayQuality: number,
  spread: number,
  matchCount: number
): ContinuationStats {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  let sequences = 0;
  let totalActions = 0;
  let successfulActions = 0;
  let actionsAfterSuccess = 0;
  let endedByFailure = 0;
  let endedByMaxActions = 0;
  let endedByOther = 0;
  let seqLength1 = 0;
  let seqLength2 = 0;
  let seqLength3 = 0;
  let seqLength4plus = 0;

  let passCount = 0;
  let passSuccess = 0;
  let cqSum = 0;
  let cqCount = 0;

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

    for (const seq of match.sequences) {
      sequences++;
      const actionCount = seq.actions.length;
      totalActions += actionCount;
      cqSum += seq.chanceQuality;
      cqCount++;

      // Sequence uzunluk dağılımı
      if (actionCount === 1) seqLength1++;
      else if (actionCount === 2) seqLength2++;
      else if (actionCount === 3) seqLength3++;
      else seqLength4plus++;

      // Aksiyon sonrası devam analizi
      for (let j = 0; j < actionCount - 1; j++) {
        const action = seq.actions[j];
        if (action.action === 'pass') {
          passCount++;
          if (action.success) passSuccess++;
        }
        if (action.success) {
          successfulActions++;
          actionsAfterSuccess++; // bu başarılı aksiyondan sonra en az bir aksiyon var
        }
      }

      // Son aksiyon başarılıysa "actionsAfterSuccess" sayılmaz
      // (çünkü sonrasında aksiyon yok)
      const lastAction = seq.actions[actionCount - 1];
      if (lastAction.action === 'pass') {
        passCount++;
        if (lastAction.success) passSuccess++;
      }
      if (!lastAction.success) {
        endedByFailure++;
      } else if (actionCount >= 8) {
        endedByMaxActions++;
      } else {
        endedByOther++;
      }
    }
  }

  const safeDiv = (a: number, b: number) => b === 0 ? 0 : a / b;

  return {
    name,
    matches: matchCount,
    sequences,
    totalActions,
    successfulActions,
    actionsAfterSuccess,
    continuationRate: safeDiv(actionsAfterSuccess, successfulActions),
    endedByFailure,
    endedByMaxActions,
    endedByOther,
    seqLength1,
    seqLength2,
    seqLength3,
    seqLength4plus,
    avgPassSuccessRate: safeDiv(passSuccess, passCount),
    avgChanceQuality: safeDiv(cqSum, cqCount),
  };
}

describe('Continuation Impact — Başarılı Aksiyon Sonrası Devam', () => {
  it('başarılı aksiyon sonrası sequence devam oranını ölç', () => {
    console.log('\n⏳ Continuation ölçülüyor (3 senaryo × 1000 maç)...\n');

    const N = 1000;

    const lowLow = runScenario('Düşük-Düşük (10 vs 10)', 10, 10, 4, N);
    const highLow = runScenario('Yüksek-Düşük (18 vs 10)', 18, 10, 4, N);
    const highHigh = runScenario('Yüksek-Yüksek (18 vs 18)', 18, 18, 4, N);

    const lines: string[] = [];
    const f2 = (v: number) => v.toFixed(2);
    const f1 = (v: number) => v.toFixed(1);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';

    const row = (label: string, a: string, b: string, c: string, diff: string) => {
      lines.push(
        `║  ${label.padEnd(28)}${a.padStart(10)}${b.padStart(13)}${c.padStart(14)}${diff.padStart(12)}   ║`
      );
    };

    const diffStr = (a: number, b: number) => {
      if (a === 0) return 'N/A';
      const d = ((b / a) - 1) * 100;
      return (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
    };

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║          CONTINUATION IMPACT — BAŞARILI AKSİYON SONRASI DEVAM                ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  METRİK                    DÜŞÜK-DÜŞÜK  YÜKSEK-DÜŞÜK  YÜKSEK-YÜKSEK   Y/D     ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    // ── Continuation ──
    lines.push('║  ── CONTINUATION ──                                                          ║');
    row('Başarılı aksiyon / maç',
      f1(lowLow.successfulActions / lowLow.matches),
      f1(highLow.successfulActions / highLow.matches),
      f1(highHigh.successfulActions / highHigh.matches),
      diffStr(lowLow.successfulActions / lowLow.matches, highLow.successfulActions / highLow.matches));
    row('Devam eden (başarı sonrası)',
      f1(lowLow.actionsAfterSuccess / lowLow.matches),
      f1(highLow.actionsAfterSuccess / highLow.matches),
      f1(highHigh.actionsAfterSuccess / highHigh.matches),
      diffStr(lowLow.actionsAfterSuccess / lowLow.matches, highLow.actionsAfterSuccess / highLow.matches));
    row('CONTINUATION RATE',
      pct(lowLow.continuationRate),
      pct(highLow.continuationRate),
      pct(highHigh.continuationRate),
      diffStr(lowLow.continuationRate, highLow.continuationRate));

    // ── Sequence uzunluk dağılımı ──
    lines.push('║  ── SEQUENCE UZUNLUK DAĞILIMI ──                                              ║');
    row('Uzunluk 1 (%)',
      pct(lowLow.seqLength1 / lowLow.sequences),
      pct(highLow.seqLength1 / highLow.sequences),
      pct(highHigh.seqLength1 / highHigh.sequences),
      diffStr(lowLow.seqLength1 / lowLow.sequences, highLow.seqLength1 / highLow.sequences));
    row('Uzunluk 2 (%)',
      pct(lowLow.seqLength2 / lowLow.sequences),
      pct(highLow.seqLength2 / highLow.sequences),
      pct(highHigh.seqLength2 / highHigh.sequences),
      diffStr(lowLow.seqLength2 / lowLow.sequences, highLow.seqLength2 / highLow.sequences));
    row('Uzunluk 3 (%)',
      pct(lowLow.seqLength3 / lowLow.sequences),
      pct(highLow.seqLength3 / highLow.sequences),
      pct(highHigh.seqLength3 / highHigh.sequences),
      diffStr(lowLow.seqLength3 / lowLow.sequences, highLow.seqLength3 / highLow.sequences));
    row('Uzunluk 4+ (%)',
      pct(lowLow.seqLength4plus / lowLow.sequences),
      pct(highLow.seqLength4plus / highLow.sequences),
      pct(highHigh.seqLength4plus / highHigh.sequences),
      diffStr(lowLow.seqLength4plus / lowLow.sequences, highLow.seqLength4plus / highHigh.sequences ? 0 : 0));

    // ── Sequence bitiş nedenleri ──
    lines.push('║  ── SEQUENCE BİTİŞ NEDENLERİ ──                                              ║');
    row('Başarısız aksiyonla bitti (%)',
      pct(lowLow.endedByFailure / lowLow.sequences),
      pct(highLow.endedByFailure / highLow.sequences),
      pct(highHigh.endedByFailure / highHigh.sequences),
      diffStr(lowLow.endedByFailure / lowLow.sequences, highLow.endedByFailure / highLow.sequences));
    row('MaxActions ile bitti (%)',
      pct(lowLow.endedByMaxActions / lowLow.sequences),
      pct(highLow.endedByMaxActions / highLow.sequences),
      pct(highHigh.endedByMaxActions / highHigh.sequences),
      diffStr(lowLow.endedByMaxActions / lowLow.sequences, highLow.endedByMaxActions / highLow.sequences));
    row('Diğer (%)',
      pct(lowLow.endedByOther / lowLow.sequences),
      pct(highLow.endedByOther / highLow.sequences),
      pct(highHigh.endedByOther / highHigh.sequences),
      diffStr(lowLow.endedByOther / lowLow.sequences, highLow.endedByOther / highLow.sequences));

    // ── Bağlam ──
    lines.push('║  ── BAĞLAM ──                                                                ║');
    row('Pas isabet %',
      pct(lowLow.avgPassSuccessRate),
      pct(highLow.avgPassSuccessRate),
      pct(highHigh.avgPassSuccessRate),
      diffStr(lowLow.avgPassSuccessRate, highLow.avgPassSuccessRate));
    row('Ort. chanceQuality',
      f1(lowLow.avgChanceQuality),
      f1(highLow.avgChanceQuality),
      f1(highHigh.avgChanceQuality),
      diffStr(lowLow.avgChanceQuality, highLow.avgChanceQuality));

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── Analiz ──
    lines.push('');
    lines.push('🔍 CONTINUATION ANALİZİ');
    lines.push('');

    const contLow = lowLow.continuationRate;
    const contHigh = highLow.continuationRate;
    const contDiff = (contHigh - contLow) * 100;

    lines.push(`  LOW-LOW  continuation rate:  ${pct(contLow)}`);
    lines.push(`  HIGH-LOW continuation rate:  ${pct(contHigh)}`);
    lines.push(`  Fark:                        ${contDiff >= 0 ? '+' : ''}${contDiff.toFixed(1)} puan`);
    lines.push('');

    if (contDiff > 8) {
      lines.push(`  🔴 KRİTİK: Continuation farkı ${contDiff.toFixed(1)} puan.`);
      lines.push(`     Yüksek kaliteli takım başarılı aksiyondan sonra çok daha sık devam ediyor.`);
      lines.push(`     Bu, kalitenin iki kez ödüllendirildiğini gösteriyor:`);
      lines.push(`       1) aksiyon başarısı (pas isabeti +18%)`);
      lines.push(`       2) devam etme olasılığı (+${contDiff.toFixed(1)} puan)`);
      lines.push(`     Çözüm: continuation rate'e bir tavan koy.`);
    } else if (contDiff > 4) {
      lines.push(`  🟡 ORTA: Continuation farkı ${contDiff.toFixed(1)} puan.`);
      lines.push(`     Kalite etkisi ölçülü, ama yine de katkı yapıyor.`);
    } else {
      lines.push(`  ✅ DÜŞÜK: Continuation farkı sadece ${contDiff.toFixed(1)} puan.`);
      lines.push(`     Bu halka kalite farkına duyarlı değil.`);
      lines.push(`     Asıl büyüme başka yerde.`);
    }

    lines.push('');

    // Sequence bitiş analizi
    lines.push('  SEQUENCE BİTİŞ DAĞILIMI:');
    lines.push(`    LOW-LOW  → başarısız: ${pct(lowLow.endedByFailure / lowLow.sequences)}, maxActions: ${pct(lowLow.endedByMaxActions / lowLow.sequences)}`);
    lines.push(`    HIGH-LOW → başarısız: ${pct(highLow.endedByFailure / highLow.sequences)}, maxActions: ${pct(highLow.endedByMaxActions / highLow.sequences)}`);
    lines.push(`    HIGH-HIGH→ başarısız: ${pct(highHigh.endedByFailure / highHigh.sequences)}, maxActions: ${pct(highHigh.endedByMaxActions / highHigh.sequences)}`);
    lines.push('');

    console.log(lines.join('\n'));
  }, 180000);
});