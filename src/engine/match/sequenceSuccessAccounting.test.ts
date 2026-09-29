// src/engine/match/sequenceSuccessAccounting.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import type { Player } from '../types';

/**
 * SEQUENCE SUCCESS ACCOUNTING — HAM AKSİYON BAŞARI ORANI
 *
 * Amaç: Aksiyon başarı oranını sequence'den bağımsız ölçmek.
 *
 * Her aksiyon için:
 *   • denenen aksiyon
 *   • başarılı aksiyon
 *   • başarısız aksiyon
 *
 * Ham başarı = başarılı / toplam denenen
 *
 * Beklenen:
 *   LOW-LOW    ≈ %57
 *   HIGH-LOW   ≈ %66
 *   HIGH-HIGH  ≈ %57
 *
 * Eğer böyle çıkarsa → aksiyon motoru doğru.
 * Sorun maç istatistiklerinin sequence'leri ağırlıklandırması.
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

interface AccountingStats {
  label: string;
  matches: number;

  // Ham aksiyon (carry hariç)
  rawAttempts: number;
  rawSuccess: number;
  rawFail: number;
  rawSuccessRate: number;

  // Carry dahil
  totalWithCarry: number;
  totalWithCarrySuccess: number;
  totalWithCarryRate: number;

  // Sequence-weighted
  weightedSuccess: number;
  weightedTotal: number;
  weightedRate: number;

  // Unweighted (sequence başına ortalama)
  unweightedRate: number;

  // Ev/dep
  homeRawAttempts: number;
  homeRawSuccess: number;
  homeRawRate: number;
  awayRawAttempts: number;
  awayRawSuccess: number;
  awayRawRate: number;

  // Aksiyon tipi bazlı
  byAction: Record<string, { attempts: number; success: number; rate: number }>;
}

function runScenario(
  label: string,
  homeQuality: number,
  awayQuality: number,
  spread: number,
  matchCount: number
): AccountingStats {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  let rawAttempts = 0;
  let rawSuccess = 0;
  let rawFail = 0;

  let totalWithCarry = 0;
  let totalWithCarrySuccess = 0;

  let weightedSuccess = 0;
  let weightedTotal = 0;

  let unweightedSum = 0;
  let unweightedCount = 0;

  let homeRawAttempts = 0;
  let homeRawSuccess = 0;
  let awayRawAttempts = 0;
  let awayRawSuccess = 0;

  const byAction: Record<string, { attempts: number; success: number }> = {
    pass: { attempts: 0, success: 0 },
    dribble: { attempts: 0, success: 0 },
    cross: { attempts: 0, success: 0 },
    run: { attempts: 0, success: 0 },
    throughBall: { attempts: 0, success: 0 },
    recycle: { attempts: 0, success: 0 },
    carry: { attempts: 0, success: 0 },
  };

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
      const isHome = seq.attackingClubId === home.id;
      let seqSuccess = 0;
      let seqTotal = 0;

      for (const a of seq.actions) {
        // Her aksiyon
        totalWithCarry++;
        if (a.success) totalWithCarrySuccess++;

        // Carry hariç
        if (a.action !== 'carry') {
          rawAttempts++;
          seqTotal++;
          if (a.success) {
            rawSuccess++;
            seqSuccess++;
            if (isHome) homeRawSuccess++;
            else awayRawSuccess++;
          } else {
            rawFail++;
          }
          if (isHome) homeRawAttempts++;
          else awayRawAttempts++;

          // Aksiyon tipi
          if (byAction[a.action]) {
            byAction[a.action].attempts++;
            if (a.success) byAction[a.action].success++;
          }
        }

        // Weighted
        weightedTotal++;
        if (a.success) weightedSuccess++;
      }

      // Unweighted (sequence başına)
      if (seqTotal > 0) {
        unweightedSum += seqSuccess / seqTotal;
        unweightedCount++;
      }
    }
  }

  const safeDiv = (a: number, b: number) => b === 0 ? 0 : a / b;

  const byActionResult: Record<string, { attempts: number; success: number; rate: number }> = {};
  for (const k of Object.keys(byAction)) {
    byActionResult[k] = {
      attempts: byAction[k].attempts,
      success: byAction[k].success,
      rate: safeDiv(byAction[k].success, byAction[k].attempts),
    };
  }

  return {
    label,
    matches: matchCount,
    rawAttempts,
    rawSuccess,
    rawFail,
    rawSuccessRate: safeDiv(rawSuccess, rawAttempts),
    totalWithCarry,
    totalWithCarrySuccess,
    totalWithCarryRate: safeDiv(totalWithCarrySuccess, totalWithCarry),
    weightedSuccess,
    weightedTotal,
    weightedRate: safeDiv(weightedSuccess, weightedTotal),
    unweightedRate: safeDiv(unweightedSum, unweightedCount),
    homeRawAttempts,
    homeRawSuccess,
    homeRawRate: safeDiv(homeRawSuccess, homeRawAttempts),
    awayRawAttempts,
    awayRawSuccess,
    awayRawRate: safeDiv(awayRawSuccess, awayRawAttempts),
    byAction: byActionResult,
  };
}

describe('Sequence Success Accounting — Ham Aksiyon Başarı Oranı', () => {
  it('ham aksiyon başarı oranını sequence\'den bağımsız ölç', () => {
    console.log('\n⏳ Sequence success accounting (3 senaryo × 1000 maç)...\n');

    const N = 1000;

    const lowLow = runScenario('Düşük-Düşük', 10, 10, 4, N);
    const highLow = runScenario('Yüksek-Düşük', 18, 10, 4, N);
    const highHigh = runScenario('Yüksek-Yüksek', 18, 18, 4, N);

    const lines: string[] = [];
    const f1 = (v: number) => v.toFixed(1);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';
    const pctDiff = (a: number, b: number) => {
      if (a === 0) return 'N/A';
      const d = ((b / a) - 1) * 100;
      return (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
    };

    const row = (label: string, a: string, b: string, c: string, diff = '') => {
      lines.push(
        `║  ${label.padEnd(26)}${a.padStart(12)}${b.padStart(14)}${c.padStart(14)}${diff.padStart(10)}   ║`
      );
    };

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║   SEQUENCE SUCCESS ACCOUNTING — HAM AKSİYON BAŞARI (1000 maç × 3 senaryo)   ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  METRİK                    DÜŞÜK-DÜŞÜK  YÜKSEK-DÜŞÜK  YÜKSEK-YÜKSEK   Y/D     ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    // ── Ham aksiyon ──
    lines.push('║  ── HAM AKSİYON (carry hariç) ──                                             ║');
    row('Denenen aksiyon',
      String(lowLow.rawAttempts), String(highLow.rawAttempts), String(highHigh.rawAttempts));
    row('Başarılı',
      String(lowLow.rawSuccess), String(highLow.rawSuccess), String(highHigh.rawSuccess));
    row('Başarısız',
      String(lowLow.rawFail), String(highLow.rawFail), String(highHigh.rawFail));
    row('HAM BAŞARI %',
      pct(lowLow.rawSuccessRate), pct(highLow.rawSuccessRate), pct(highHigh.rawSuccessRate),
      '+' + ((highLow.rawSuccessRate - lowLow.rawSuccessRate) * 100).toFixed(1));

    // ── Farklı ölçümler ──
    lines.push('║  ── FARKLI ÖLÇÜMLER ──                                                       ║');
    row('Ham (carry hariç)',
      pct(lowLow.rawSuccessRate), pct(highLow.rawSuccessRate), pct(highHigh.rawSuccessRate));
    row('Carry dahil',
      pct(lowLow.totalWithCarryRate), pct(highLow.totalWithCarryRate), pct(highHigh.totalWithCarryRate));
    row('Weighted',
      pct(lowLow.weightedRate), pct(highLow.weightedRate), pct(highHigh.weightedRate));
    row('Unweighted (seq başına)',
      pct(lowLow.unweightedRate), pct(highLow.unweightedRate), pct(highHigh.unweightedRate));

    // ── Ev/dep ──
    lines.push('║  ── EV/DEP AYRIMI (ham) ──                                                   ║');
    row('Ev ham başarı %',
      pct(lowLow.homeRawRate), pct(highLow.homeRawRate), pct(highHigh.homeRawRate),
      '+' + ((highLow.homeRawRate - lowLow.homeRawRate) * 100).toFixed(1));
    row('Dep ham başarı %',
      pct(lowLow.awayRawRate), pct(highLow.awayRawRate), pct(highHigh.awayRawRate),
      '+' + ((highLow.awayRawRate - lowLow.awayRawRate) * 100).toFixed(1));

    // ── Aksiyon tipi ──
    lines.push('║  ── AKSİYON TİPİ BAŞARI % ──                                                 ║');
    const actionTypes = ['pass', 'dribble', 'cross', 'run', 'throughBall', 'recycle'];
    for (const t of actionTypes) {
      const la = lowLow.byAction[t];
      const ha = highLow.byAction[t];
      const hh = highHigh.byAction[t];
      row(`  ${t}`,
        pct(la.rate), pct(ha.rate), pct(hh.rate));
    }

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── Analiz ──
    lines.push('');
    lines.push('🔍 HAM BAŞARI ANALİZİ');
    lines.push('');

    lines.push(`  HAM AKSİYON BAŞARI ORANI (carry hariç):`);
    lines.push(`    LOW-LOW:    ${pct(lowLow.rawSuccessRate)}  (beklenen: ~%57)`);
    lines.push(`    HIGH-LOW:   ${pct(highLow.rawSuccessRate)}  (beklenen: ~%66)`);
    lines.push(`    HIGH-HIGH:  ${pct(highHigh.rawSuccessRate)}  (beklenen: ~%57)`);
    lines.push('');

    const llRaw = lowLow.rawSuccessRate;
    const hlRaw = highLow.rawSuccessRate;
    const hhRaw = highHigh.rawSuccessRate;

    if (Math.abs(llRaw - 0.57) < 0.03 && Math.abs(hlRaw - 0.66) < 0.03) {
      lines.push(`  ✅ Ham başarı oranı beklenen aralıkta.`);
      lines.push(`     Aksiyon motoru DOĞRU çalışıyor.`);
    } else {
      lines.push(`  🟡 Ham başarı oranı beklenenden farklı.`);
      lines.push(`     LOW-LOW: ${pct(llRaw)} (beklenen %57)`);
      lines.push(`     HIGH-LOW: ${pct(hlRaw)} (beklenen %66)`);
    }
    lines.push('');

    // Ölçüm farkları
    lines.push(`  ÖLÇÜM YÖNTEMİ FARKLARI (HIGH-LOW):`);
    lines.push(`    Ham:        ${pct(hlRaw)}`);
    lines.push(`    Carry dahil:${pct(highLow.totalWithCarryRate)}  (fark: ${((highLow.totalWithCarryRate - hlRaw) * 100).toFixed(1)} puan)`);
    lines.push(`    Weighted:   ${pct(highLow.weightedRate)}  (fark: ${((highLow.weightedRate - hlRaw) * 100).toFixed(1)} puan)`);
    lines.push(`    Unweighted: ${pct(highLow.unweightedRate)}  (fark: ${((highLow.unweightedRate - hlRaw) * 100).toFixed(1)} puan)`);
    lines.push('');

    // Ev/dep farkı
    lines.push(`  EV/DEP HAM FARKI (HIGH-LOW):`);
    lines.push(`    Ev:  ${pct(highLow.homeRawRate)}`);
    lines.push(`    Dep: ${pct(highLow.awayRawRate)}`);
    lines.push(`    Fark: ${((highLow.homeRawRate - highLow.awayRawRate) * 100).toFixed(1)} puan`);
    lines.push('');

    if (Math.abs(hlRaw - llRaw) < 0.12) {
      lines.push(`  ✅ Ham başarı farkı makul (${((hlRaw - llRaw) * 100).toFixed(1)} puan).`);
      lines.push(`     Sorun sequence continuation + possession ekonomisinde.`);
    } else {
      lines.push(`  🔴 Ham başarı farkı büyük (${((hlRaw - llRaw) * 100).toFixed(1)} puan).`);
      lines.push(`     Aksiyon başarı formülü hâlâ fazla agresif.`);
    }
    lines.push('');

    console.log(lines.join('\n'));
  }, 300000);
});