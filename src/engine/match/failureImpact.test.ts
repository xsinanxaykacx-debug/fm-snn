// src/engine/match/failureImpact.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import type { Player } from '../types';

/**
 * FAILURE IMPACT — Başarısızlığın sequence'e etkisi
 *
 * Amaç:
 *   1) Hangi aksiyon tipi kaç kez başarısız oluyor?
 *   2) Başarısızlık sequence'in kaçıncı aksiyonunda oluyor?
 *   3) Başarısızlık sequence'i gerçekten bitiriyor mu?
 *   4) HIGH-LOW'daki başarı farkı sequence uzunluğundaki farkı
 *      tam olarak açıklıyor mu?
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

const ACTION_TYPES = ['pass', 'dribble', 'cross', 'run', 'throughBall', 'recycle'] as const;
type ActionType = typeof ACTION_TYPES[number];

interface ActionStats {
  attempts: number;
  successes: number;
  failures: number;
  successRate: number;
  failureRate: number;
  // Failures that occurred as the LAST action of a sequence
  lastActionFailures: number;
  // Failures that were followed by another action (should be 0)
  midSequenceFailures: number;
  // Average action index where this action failed (1-based)
  avgFailureIndex: number;
}

interface ScenarioStats {
  name: string;
  matches: number;
  sequences: number;

  // Per-action breakdown
  actions: Record<ActionType, ActionStats>;

  // Overall
  totalActions: number;
  totalFailures: number;
  avgFailureIndex: number;
  maxActionsRate: number;

  // Context
  avgPassSuccessRate: number;
  avgChanceQuality: number;
}

function emptyActionStats(): ActionStats {
  return {
    attempts: 0,
    successes: 0,
    failures: 0,
    successRate: 0,
    failureRate: 0,
    lastActionFailures: 0,
    midSequenceFailures: 0,
    avgFailureIndex: 0,
  };
}

function runScenario(
  name: string,
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

  const actions: Record<ActionType, ActionStats> = {
    pass: emptyActionStats(),
    dribble: emptyActionStats(),
    cross: emptyActionStats(),
    run: emptyActionStats(),
    throughBall: emptyActionStats(),
    recycle: emptyActionStats(),
  };

  let sequences = 0;
  let totalActions = 0;
  let totalFailures = 0;
  let failureIndexSum = 0;
  let maxActionsReached = 0;

  // For pass success rate context
  let passAttempts = 0;
  let passSuccesses = 0;

  // For chanceQuality context
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
      totalActions += seq.actions.length;
      cqSum += seq.chanceQuality;
      cqCount++;

      if (seq.actions.length >= 8) maxActionsReached++;

      const lastIdx = seq.actions.length - 1;

      for (let j = 0; j < seq.actions.length; j++) {
        const a = seq.actions[j];
        const type = a.action as ActionType;
        if (!actions[type]) continue;

        actions[type].attempts++;
        if (a.success) {
          actions[type].successes++;
          if (type === 'pass') passSuccesses++;
        } else {
          actions[type].failures++;
          totalFailures++;
          failureIndexSum += j + 1; // 1-based index
          actions[type].avgFailureIndex += j + 1;

          if (j === lastIdx) {
            actions[type].lastActionFailures++;
          } else {
            actions[type].midSequenceFailures++;
          }
        }
        if (type === 'pass') passAttempts++;
      }
    }
  }

  // Compute rates
  for (const t of ACTION_TYPES) {
    const a = actions[t];
    a.successRate = a.attempts > 0 ? a.successes / a.attempts : 0;
    a.failureRate = a.attempts > 0 ? a.failures / a.attempts : 0;
    a.avgFailureIndex = a.failures > 0 ? a.avgFailureIndex / a.failures : 0;
  }

  return {
    name,
    matches: matchCount,
    sequences,
    actions,
    totalActions,
    totalFailures,
    avgFailureIndex: totalFailures > 0 ? failureIndexSum / totalFailures : 0,
    maxActionsRate: sequences > 0 ? maxActionsReached / sequences : 0,
    avgPassSuccessRate: passAttempts > 0 ? passSuccesses / passAttempts : 0,
    avgChanceQuality: cqCount > 0 ? cqSum / cqCount : 0,
  };
}

describe('Failure Impact — Başarısızlığın Sequence\'e Etkisi', () => {
  it('hangi aksiyon, hangi index\'te, sequence\'i bitiriyor mu?', () => {
    console.log('\n⏳ Failure impact ölçülüyor (3 senaryo × 1000 maç)...\n');

    const N = 1000;

    const lowLow = runScenario('Düşük-Düşük (10 vs 10)', 10, 10, 4, N);
    const highLow = runScenario('Yüksek-Düşük (18 vs 10)', 18, 10, 4, N);
    const highHigh = runScenario('Yüksek-Yüksek (18 vs 18)', 18, 18, 4, N);

    const lines: string[] = [];
    const f1 = (v: number) => v.toFixed(1);
    const f2 = (v: number) => v.toFixed(2);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';
    const pctDiff = (a: number, b: number) => {
      if (a === 0) return 'N/A';
      const d = ((b / a) - 1) * 100;
      return (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
    };

    const header = (title: string) => {
      lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
      lines.push(`║  ${title.padEnd(76)}║`);
      lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    };

    const row = (label: string, a: string, b: string, c: string, diff = '') => {
      lines.push(
        `║  ${label.padEnd(26)}${a.padStart(10)}${b.padStart(13)}${c.padStart(14)}${diff.padStart(12)}   ║`
      );
    };

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║           FAILURE IMPACT — BAŞARISIZLIK ANALİZİ (1000 maç × 3 senaryo)       ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  METRİK                    DÜŞÜK-DÜŞÜK  YÜKSEK-DÜŞÜK  YÜKSEK-YÜKSEK   Y/D     ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    // ── Genel ──
    header('── GENEL ──');
    row('Toplam aksiyon / maç',
      f1(lowLow.totalActions / lowLow.matches),
      f1(highLow.totalActions / highLow.matches),
      f1(highHigh.totalActions / highHigh.matches),
      pctDiff(lowLow.totalActions / lowLow.matches, highLow.totalActions / highLow.matches));
    row('Toplam başarısızlık / maç',
      f1(lowLow.totalFailures / lowLow.matches),
      f1(highLow.totalFailures / highLow.matches),
      f1(highHigh.totalFailures / highHigh.matches),
      pctDiff(lowLow.totalFailures / lowLow.matches, highLow.totalFailures / highLow.matches));
    row('Ort. failure index',
      f2(lowLow.avgFailureIndex),
      f2(highLow.avgFailureIndex),
      f2(highHigh.avgFailureIndex),
      pctDiff(lowLow.avgFailureIndex, highLow.avgFailureIndex));
    row('MaxActions oranı',
      pct(lowLow.maxActionsRate),
      pct(highLow.maxActionsRate),
      pct(highHigh.maxActionsRate),
      pctDiff(lowLow.maxActionsRate, highLow.maxActionsRate));

    // ── Aksiyon tipi bazlı ──
    header('── AKSİYON BAŞARI ORANI ──');
    for (const t of ACTION_TYPES) {
      const la = lowLow.actions[t];
      const ha = highLow.actions[t];
      const hh = highHigh.actions[t];
      row(`${t} başarı %`,
        pct(la.successRate),
        pct(ha.successRate),
        pct(hh.successRate),
        pctDiff(la.successRate, ha.successRate));
    }

    header('── AKSİYON BAŞARISIZLIK ORANI ──');
    for (const t of ACTION_TYPES) {
      const la = lowLow.actions[t];
      const ha = highLow.actions[t];
      const hh = highHigh.actions[t];
      row(`${t} başarısızlık %`,
        pct(la.failureRate),
        pct(ha.failureRate),
        pct(hh.failureRate),
        pctDiff(la.failureRate, ha.failureRate));
    }

    header('── ORTALAMA FAILURE INDEX (hangi aksiyonda başarısız oluyor) ──');
    for (const t of ACTION_TYPES) {
      const la = lowLow.actions[t];
      const ha = highLow.actions[t];
      const hh = highHigh.actions[t];
      row(`${t} ort. failure index`,
        f2(la.avgFailureIndex),
        f2(ha.avgFailureIndex),
        f2(hh.avgFailureIndex),
        pctDiff(la.avgFailureIndex, ha.avgFailureIndex));
    }

    header('── MID-SEQUENCE FAILURE (olmaması gereken) ──');
    for (const t of ACTION_TYPES) {
      const la = lowLow.actions[t];
      const ha = highLow.actions[t];
      const hh = highHigh.actions[t];
      row(`${t} mid-seq failure`,
        String(la.midSequenceFailures),
        String(ha.midSequenceFailures),
        String(hh.midSequenceFailures),
        '');
    }

    // ── Bağlam ──
    header('── BAĞLAM ──');
    row('Pas isabet %',
      pct(lowLow.avgPassSuccessRate),
      pct(highLow.avgPassSuccessRate),
      pct(highHigh.avgPassSuccessRate),
      pctDiff(lowLow.avgPassSuccessRate, highLow.avgPassSuccessRate));
    row('Ort. chanceQuality',
      f1(lowLow.avgChanceQuality),
      f1(highLow.avgChanceQuality),
      f1(highHigh.avgChanceQuality),
      pctDiff(lowLow.avgChanceQuality, highLow.avgChanceQuality));

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── Analiz ──
    lines.push('');
    lines.push('🔍 FAILURE ANALİZİ');
    lines.push('');

    // Hangi aksiyon en çok başarısız oluyor?
    lines.push('  En çok başarısız olan aksiyon tipleri (HIGH-LOW):');
    const sorted = [...ACTION_TYPES].sort((a, b) =>
      highLow.actions[b].failureRate - highLow.actions[a].failureRate
    );
    for (const t of sorted) {
      const rate = highLow.actions[t].failureRate;
      const bar = '█'.repeat(Math.min(40, Math.round(rate * 100)));
      lines.push(`    ${t.padEnd(14)}${pct(rate).padStart(8)}  ${bar}`);
    }
    lines.push('');

    // Mid-sequence failure kontrolü
    let totalMidSeq = 0;
    for (const t of ACTION_TYPES) {
      totalMidSeq += highLow.actions[t].midSequenceFailures;
    }
    if (totalMidSeq === 0) {
      lines.push('  ✅ Mid-sequence failure YOK. Her başarısızlık sequence\'i bitiriyor.');
    } else {
      lines.push(`  ⚠️  ${totalMidSeq} mid-sequence failure var! Bu beklenmeyen bir durum.`);
    }
    lines.push('');

    // Sequence uzunluğu farkını açıklıyor mu?
    const passDiff = highLow.avgPassSuccessRate - lowLow.avgPassSuccessRate;
    const seqLenLow = lowLow.totalActions / lowLow.sequences;
    const seqLenHigh = highLow.totalActions / highLow.sequences;
    const seqLenDiff = seqLenHigh - seqLenLow;

    lines.push('  MATEMATİKSEL TUTARLILIK KONTROLÜ:');
    lines.push(`    Pas isabet farkı:        +${(passDiff * 100).toFixed(1)} puan`);
    lines.push(`    Sequence uzunluk farkı:  +${seqLenDiff.toFixed(2)} aksiyon (${f2(seqLenLow)} → ${f2(seqLenHigh)})`);
    lines.push('');

    // Basit model: E[seqLen] = 1 / (1 - successRate) yaklaşımı
    // (gerçekte maxActions sınırı var, ama yaklaşık)
    const eSeqLow = 1 / Math.max(0.01, 1 - lowLow.avgPassSuccessRate);
    const eSeqHigh = 1 / Math.max(0.01, 1 - highLow.avgPassSuccessRate);
    lines.push('    Teorik model (başarı oranına göre):');
    lines.push(`      LOW:  1 / (1 - ${pct(lowLow.avgPassSuccessRate)}) = ${f2(eSeqLow)} aksiyon`);
    lines.push(`      HIGH: 1 / (1 - ${pct(highLow.avgPassSuccessRate)}) = ${f2(eSeqHigh)} aksiyon`);
    lines.push(`      Teorik fark: ${f2(eSeqHigh - eSeqLow)} aksiyon`);
    lines.push(`      Gerçek fark: ${f2(seqLenDiff)} aksiyon`);
    lines.push('');

    const explained = (eSeqHigh - eSeqLow) / Math.max(0.01, seqLenDiff) * 100;
    if (explained > 80) {
      lines.push(`    ✅ Başarı farkı, sequence uzunluk farkının ~%${explained.toFixed(0)}'ını açıklıyor.`);
      lines.push(`       Motor matematiksel olarak tutarlı.`);
      lines.push(`       Sorun: kalitenin başarı oranına etkisi fazla güçlü.`);
    } else if (explained > 50) {
      lines.push(`    🟡 Başarı farkı, sequence uzunluk farkının ~%${explained.toFixed(0)}'ını açıklıyor.`);
      lines.push(`       Kısmi ek mekanizma var.`);
    } else {
      lines.push(`    🔴 Başarı farkı, sequence uzunluk farkının sadece ~%${explained.toFixed(0)}'ını açıklıyor.`);
      lines.push(`       Başka bir mekanizma sequence'i uzatıyor.`);
    }
    lines.push('');

    console.log(lines.join('\n'));
  }, 180000);
});