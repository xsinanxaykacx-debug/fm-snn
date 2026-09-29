// src/engine/match/successDistribution.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import type { Player } from '../types';

/**
 * SUCCESS DISTRIBUTION — AKSİYON SIRASINA GÖRE BAŞARI
 *
 * Amaç: Defensive Balance'taki %81.0 ev başarısı ile
 * Success Formula'daki %67.8 arasındaki farkı çözmek.
 *
 * Şüphe: Uzun sequence'lerde başarılı aksiyonlar daha fazla
 * görünüyor (survivorship bias). Bu, maç istatistiğinde
 * başarı oranını yapay olarak yükseltiyor olabilir.
 *
 * Ölçülen: Her aksiyon sırası için (1., 2., 3., ...)
 * başarı oranı.
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

interface DistributionStats {
  label: string;
  matches: number;

  // Aksiyon sırasına göre başarı
  byIndex: {
    index: number;
    count: number;
    success: number;
    successRate: number;
    // Bu index'te kaç sequence hayatta kaldı?
    survivalRate: number;  // sequence'ların kaçı bu index'e ulaştı
  }[];

  // Genel
  totalActions: number;
  totalSuccess: number;
  overallSuccessRate: number;

  // Weighted vs unweighted
  unweightedSuccessRate: number;  // her sequence'a eşit ağırlık
  weightedSuccessRate: number;    // her aksiyona eşit ağırlık (overall)

  // Ev/dep ayrımı
  homeOverallSuccessRate: number;
  awayOverallSuccessRate: number;
  homeUnweightedSuccessRate: number;
  awayUnweightedSuccessRate: number;
}

function runScenario(
  label: string,
  homeQuality: number,
  awayQuality: number,
  spread: number,
  matchCount: number
): DistributionStats {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  // index başına
  const MAX_INDEX = 10;
  const byIndex: {
    count: number;
    success: number;
    sequencesReaching: number;
  }[] = [];
  for (let i = 0; i < MAX_INDEX; i++) {
    byIndex.push({ count: 0, success: 0, sequencesReaching: 0 });
  }

  let totalActions = 0;
  let totalSuccess = 0;
  let totalSequences = 0;

  // Ev/dep ayrımı
  let homeActions = 0, homeSuccess = 0;
  let awayActions = 0, awaySuccess = 0;

  // Unweighted (sequence başına ortalama)
  let unweightedSum = 0;

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
      totalSequences++;
      const isHome = seq.attackingClubId === home.id;
      const actionCount = seq.actions.length;

      // Sequence başına başarı oranı (unweighted)
      let seqSuccess = 0;
      for (const a of seq.actions) {
        if (a.success) seqSuccess++;
      }
      unweightedSum += seqSuccess / actionCount;

      // Aksiyon sırasına göre
      for (let idx = 0; idx < actionCount && idx < MAX_INDEX; idx++) {
        const a = seq.actions[idx];
        byIndex[idx].count++;
        if (a.success) byIndex[idx].success++;
      }

      // Sequence'ın ulaştığı max index
      for (let idx = 0; idx < actionCount && idx < MAX_INDEX; idx++) {
        byIndex[idx].sequencesReaching++;
      }

      // Genel
      for (const a of seq.actions) {
        totalActions++;
        if (a.success) totalSuccess++;

        if (isHome) {
          homeActions++;
          if (a.success) homeSuccess++;
        } else {
          awayActions++;
          if (a.success) awaySuccess++;
        }
      }
    }
  }

  // Compute rates
  const safeDiv = (a: number, b: number) => b === 0 ? 0 : a / b;

  const resultByIndex = byIndex.map((b, i) => ({
    index: i + 1,
    count: b.count,
    success: b.success,
    successRate: safeDiv(b.success, b.count),
    survivalRate: safeDiv(b.sequencesReaching, totalSequences),
  }));

  return {
    label,
    matches: matchCount,
    byIndex: resultByIndex,
    totalActions,
    totalSuccess,
    overallSuccessRate: safeDiv(totalSuccess, totalActions),
    unweightedSuccessRate: safeDiv(unweightedSum, totalSequences),
    weightedSuccessRate: safeDiv(totalSuccess, totalActions),
    homeOverallSuccessRate: safeDiv(homeSuccess, homeActions),
    awayOverallSuccessRate: safeDiv(awaySuccess, awayActions),
    homeUnweightedSuccessRate: 0, // placeholder
    awayUnweightedSuccessRate: 0,
  };
}

describe('Success Distribution — Aksiyon Sırasına Göre Başarı', () => {
  it('survivorship bias var mı?', () => {
    console.log('\n⏳ Success distribution (3 senaryo × 1000 maç)...\n');

    const N = 1000;

    const lowLow = runScenario('Düşük-Düşük', 10, 10, 4, N);
    const highLow = runScenario('Yüksek-Düşük', 18, 10, 4, N);
    const highHigh = runScenario('Yüksek-Yüksek', 18, 18, 4, N);

    const lines: string[] = [];
    const f2 = (v: number) => v.toFixed(2);
    const f1 = (v: number) => v.toFixed(1);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║     SUCCESS DISTRIBUTION — AKSİYON SIRASINA GÖRE BAŞARI (1000 maç × 3)       ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  AKSİYON #    DÜŞÜK-DÜŞÜK    YÜKSEK-DÜŞÜK    YÜKSEK-YÜKSEK   (survival)     ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (let i = 0; i < 10; i++) {
      const la = lowLow.byIndex[i];
      const ha = highLow.byIndex[i];
      const hh = highHigh.byIndex[i];

      const laStr = `${pct(la.successRate)} (${pct(la.survivalRate)})`;
      const haStr = `${pct(ha.successRate)} (${pct(ha.survivalRate)})`;
      const hhStr = `${pct(hh.successRate)} (${pct(hh.survivalRate)})`;

      lines.push(
        `║  #${String(i + 1).padEnd(12)}${laStr.padStart(20)}${haStr.padStart(20)}${hhStr.padStart(20)}     ║`
      );
    }

    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  ── GENEL ──                                                                 ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    const row = (label: string, a: string, b: string, c: string) => {
      lines.push(
        `║  ${label.padEnd(26)}${a.padStart(12)}${b.padStart(14)}${c.padStart(14)}   ║`
      );
    };

    row('Weighted başarı %',
      pct(lowLow.weightedSuccessRate),
      pct(highLow.weightedSuccessRate),
      pct(highHigh.weightedSuccessRate));
    row('Unweighted başarı %',
      pct(lowLow.unweightedSuccessRate),
      pct(highLow.unweightedSuccessRate),
      pct(highHigh.unweightedSuccessRate));
    row('Toplam aksiyon / maç',
      f1(lowLow.totalActions / lowLow.matches),
      f1(highLow.totalActions / highLow.matches),
      f1(highHigh.totalActions / highHigh.matches));

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── Analiz ──
    lines.push('');
    lines.push('🔍 SURVIVORSHIP BIAS ANALİZİ');
    lines.push('');

    // Weighted vs unweighted farkı
    const llW = lowLow.weightedSuccessRate;
    const llU = lowLow.unweightedSuccessRate;
    const hlW = highLow.weightedSuccessRate;
    const hlU = highLow.unweightedSuccessRate;

    lines.push(`  LOW-LOW:`);
    lines.push(`    Weighted:   ${pct(llW)}`);
    lines.push(`    Unweighted: ${pct(llU)}`);
    lines.push(`    Fark:       ${((llW - llU) * 100).toFixed(2)} puan`);
    lines.push('');

    lines.push(`  HIGH-LOW:`);
    lines.push(`    Weighted:   ${pct(hlW)}`);
    lines.push(`    Unweighted: ${pct(hlU)}`);
    lines.push(`    Fark:       ${((hlW - hlU) * 100).toFixed(2)} puan`);
    lines.push('');

    if (Math.abs(hlW - hlU) > 0.03) {
      lines.push(`  🔴 SURVIVORSHIP BIAS VAR:`);
      lines.push(`     Weighted başarı, unweighted'dan ${((hlW - hlU) * 100).toFixed(2)} puan yüksek.`);
      lines.push(`     Uzun sequence'lerde başarılı aksiyonlar daha fazla görünüyor.`);
      lines.push(`     Bu, maç istatistiğinde başarı oranını yapay olarak yükseltiyor.`);
    } else {
      lines.push(`  ✅ Survivorship bias YOK.`);
      lines.push(`     Weighted ≈ unweighted.`);
    }
    lines.push('');

    // Aksiyon sırasına göre artış var mı?
    lines.push('  AKSİYON SIRASINA GÖRE BAŞARI (HIGH-LOW):');
    let increasing = true;
    for (let i = 0; i < 6; i++) {
      const ha = highLow.byIndex[i];
      lines.push(`    #${i + 1}: ${pct(ha.successRate)}  (${ha.count} örnek)`);
      if (i > 0 && ha.successRate < highLow.byIndex[i - 1].successRate) {
        increasing = false;
      }
    }
    lines.push('');

    if (increasing) {
      lines.push(`  🟡 Aksiyon sırasına göre başarı artıyor.`);
      lines.push(`     Bu, ilerleyen aksiyonlarda daha iyi zone/pressure olduğunu gösterir.`);
    } else {
      lines.push(`  ✅ Aksiyon sırasına göre başarı sabit.`);
      lines.push(`     Başarı, aksiyon sırasından bağımsız.`);
    }
    lines.push('');

    console.log(lines.join('\n'));
  }, 300000);
});