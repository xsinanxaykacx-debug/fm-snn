// src/engine/match/defensiveBalance.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import type { Player } from '../types';

/**
 * DEFENSIVE BALANCE — TOP HAKİMİYETİ ZİNCİRİ
 *
 * Amaç: HIGH-LOW'da deplasman neden sadece 5 şut çekebiliyor?
 *
 * Ölçülen:
 *   • Aksiyon başarı/başarısızlık (ev/dep)
 *   • Turnover / recovery (ev/dep)
 *   • Sequence sayısı (ev/dep)
 *   • Sequence başına aksiyon (ev/dep)
 *   • Possession süresi (ev/dep)
 *
 * Zincir:
 *   başarılı aksiyon → sequence devam → top hakimiyeti
 *   başarısız aksiyon → turnover → rakip top kazanır
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

interface BalanceStats {
  label: string;
  matches: number;

  // Ev
  homeSequences: number;
  homeActions: number;
  homeSuccessful: number;
  homeFailed: number;
  homeSuccessRate: number;
  homeAvgSequenceLength: number;

  // Dep
  awaySequences: number;
  awayActions: number;
  awaySuccessful: number;
  awayFailed: number;
  awaySuccessRate: number;
  awayAvgSequenceLength: number;

  // Turnover / recovery
  homeTurnovers: number;
  homeRecoveries: number;
  awayTurnovers: number;
  awayRecoveries: number;

  // Possession süresi (pas sayısı proxy)
  homePasses: number;
  awayPasses: number;
}

function runScenario(
  label: string,
  homeQuality: number,
  awayQuality: number,
  spread: number,
  matchCount: number
): BalanceStats {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  const stats: BalanceStats = {
    label, matches: matchCount,
    homeSequences: 0, homeActions: 0, homeSuccessful: 0, homeFailed: 0,
    homeSuccessRate: 0, homeAvgSequenceLength: 0,
    awaySequences: 0, awayActions: 0, awaySuccessful: 0, awayFailed: 0,
    awaySuccessRate: 0, awayAvgSequenceLength: 0,
    homeTurnovers: 0, homeRecoveries: 0,
    awayTurnovers: 0, awayRecoveries: 0,
    homePasses: 0, awayPasses: 0,
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

    stats.homeTurnovers += match.stats.recoveries.away; // ev top kaybı = dep recovery
    stats.homeRecoveries += match.stats.recoveries.home;
    stats.awayTurnovers += match.stats.recoveries.home;
    stats.awayRecoveries += match.stats.recoveries.away;

    stats.homePasses += match.stats.passes.home;
    stats.awayPasses += match.stats.passes.away;

    for (const seq of match.sequences) {
      const isHome = seq.attackingClubId === home.id;
      const actionCount = seq.actions.length;

      let successful = 0;
      let failed = 0;
      for (const a of seq.actions) {
        if (a.success) successful++;
        else failed++;
      }

      if (isHome) {
        stats.homeSequences++;
        stats.homeActions += actionCount;
        stats.homeSuccessful += successful;
        stats.homeFailed += failed;
      } else {
        stats.awaySequences++;
        stats.awayActions += actionCount;
        stats.awaySuccessful += successful;
        stats.awayFailed += failed;
      }
    }
  }

  const safeDiv = (a: number, b: number) => b === 0 ? 0 : a / b;

  stats.homeSuccessRate = safeDiv(stats.homeSuccessful, stats.homeActions);
  stats.awaySuccessRate = safeDiv(stats.awaySuccessful, stats.awayActions);
  stats.homeAvgSequenceLength = safeDiv(stats.homeActions, stats.homeSequences);
  stats.awayAvgSequenceLength = safeDiv(stats.awayActions, stats.awaySequences);

  return stats;
}

describe('Defensive Balance — Top Hakimiyeti Zinciri', () => {
  it('HIGH-LOW\'da deplasman neden 5 şut çekiyor?', () => {
    console.log('\n⏳ Defensive balance (3 senaryo × 1000 maç)...\n');

    const N = 1000;

    const lowLow = runScenario('Düşük-Düşük', 10, 10, 4, N);
    const highLow = runScenario('Yüksek-Düşük', 18, 10, 4, N);
    const highHigh = runScenario('Yüksek-Yüksek', 18, 18, 4, N);

    const lines: string[] = [];
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
    lines.push('║       DEFENSIVE BALANCE — TOP HAKİMİYETİ ZİNCİRİ (1000 maç × 3 senaryo)      ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  METRİK                    DÜŞÜK-DÜŞÜK  YÜKSEK-DÜŞÜK  YÜKSEK-YÜKSEK        ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    // ── EV ──
    lines.push('║  ── EV SAHİBİ ──                                                            ║');
    row('Ev Sequence / maç',
      f1(lowLow.homeSequences / lowLow.matches),
      f1(highLow.homeSequences / highLow.matches),
      f1(highHigh.homeSequences / highHigh.matches));
    row('Ev Aksiyon / sequence',
      f2(lowLow.homeAvgSequenceLength),
      f2(highLow.homeAvgSequenceLength),
      f2(highHigh.homeAvgSequenceLength));
    row('Ev Aksiyon başarı %',
      pct(lowLow.homeSuccessRate),
      pct(highLow.homeSuccessRate),
      pct(highHigh.homeSuccessRate));
    row('Ev Turnover / maç',
      f1(lowLow.homeTurnovers / lowLow.matches),
      f1(highLow.homeTurnovers / highLow.matches),
      f1(highHigh.homeTurnovers / highHigh.matches));
    row('Ev Recovery / maç',
      f1(lowLow.homeRecoveries / lowLow.matches),
      f1(highLow.homeRecoveries / highLow.matches),
      f1(highHigh.homeRecoveries / highHigh.matches));
    row('Ev Pas / maç',
      f1(lowLow.homePasses / lowLow.matches),
      f1(highLow.homePasses / highLow.matches),
      f1(highHigh.homePasses / highHigh.matches));

    // ── DEP ──
    lines.push('║  ── DEPLASMAN ──                                                            ║');
    row('Dep Sequence / maç',
      f1(lowLow.awaySequences / lowLow.matches),
      f1(highLow.awaySequences / highLow.matches),
      f1(highHigh.awaySequences / highHigh.matches));
    row('Dep Aksiyon / sequence',
      f2(lowLow.awayAvgSequenceLength),
      f2(highLow.awayAvgSequenceLength),
      f2(highHigh.awayAvgSequenceLength));
    row('Dep Aksiyon başarı %',
      pct(lowLow.awaySuccessRate),
      pct(highLow.awaySuccessRate),
      pct(highHigh.awaySuccessRate));
    row('Dep Turnover / maç',
      f1(lowLow.awayTurnovers / lowLow.matches),
      f1(highLow.awayTurnovers / highLow.matches),
      f1(highHigh.awayTurnovers / highHigh.matches));
    row('Dep Recovery / maç',
      f1(lowLow.awayRecoveries / lowLow.matches),
      f1(highLow.awayRecoveries / highLow.matches),
      f1(highHigh.awayRecoveries / highHigh.matches));
    row('Dep Pas / maç',
      f1(lowLow.awayPasses / lowLow.matches),
      f1(highLow.awayPasses / highLow.matches),
      f1(highHigh.awayPasses / highHigh.matches));

    // ── FARK ──
    lines.push('║  ── FARK (EV - DEP) ──                                                      ║');
    row('Sequence farkı',
      f1((lowLow.homeSequences - lowLow.awaySequences) / lowLow.matches),
      f1((highLow.homeSequences - highLow.awaySequences) / highLow.matches),
      f1((highHigh.homeSequences - highHigh.awaySequences) / highHigh.matches));
    row('Aksiyon başarı farkı',
      pct(lowLow.homeSuccessRate - lowLow.awaySuccessRate),
      pct(highLow.homeSuccessRate - highLow.awaySuccessRate),
      pct(highHigh.homeSuccessRate - highHigh.awaySuccessRate));
    row('Pas farkı',
      f1((lowLow.homePasses - lowLow.awayPasses) / lowLow.matches),
      f1((highLow.homePasses - highLow.awayPasses) / highLow.matches),
      f1((highHigh.homePasses - highHigh.awayPasses) / highHigh.matches));

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── HIGH-LOW AYRIŞTIRMA ──
    lines.push('');
    lines.push('🔍 HIGH-LOW AYRIŞTIRMA (Ev: 18/20, Dep: 10/20)');
    lines.push('');

    const h = highLow;
    lines.push(`  Sequence:       Ev ${(h.homeSequences / h.matches).toFixed(1)}  vs  Dep ${(h.awaySequences / h.matches).toFixed(1)}   (fark: ${((h.homeSequences / h.awaySequences - 1) * 100).toFixed(0)}%)`);
    lines.push(`  Aksiyon/seq:    Ev ${h.homeAvgSequenceLength.toFixed(2)}  vs  Dep ${h.awayAvgSequenceLength.toFixed(2)}   (fark: ${((h.homeAvgSequenceLength / h.awayAvgSequenceLength - 1) * 100).toFixed(0)}%)`);
    lines.push(`  Başarı %:       Ev ${pct(h.homeSuccessRate)}  vs  Dep ${pct(h.awaySuccessRate)}   (fark: ${((h.homeSuccessRate / h.awaySuccessRate - 1) * 100).toFixed(0)}%)`);
    lines.push(`  Pas/maç:        Ev ${(h.homePasses / h.matches).toFixed(1)}  vs  Dep ${(h.awayPasses / h.matches).toFixed(1)}   (fark: ${((h.homePasses / h.awayPasses - 1) * 100).toFixed(0)}%)`);
    lines.push(`  Turnover/maç:   Ev ${(h.homeTurnovers / h.matches).toFixed(1)}  vs  Dep ${(h.awayTurnovers / h.matches).toFixed(1)}`);
    lines.push(`  Recovery/maç:   Ev ${(h.homeRecoveries / h.matches).toFixed(1)}  vs  Dep ${(h.awayRecoveries / h.matches).toFixed(1)}`);
    lines.push('');

    // ── ZİNCİR BÜYÜME ANALİZİ ──
    lines.push('🔍 ZİNCİR BÜYÜME (HIGH-LOW / LOW-LOW)');
    lines.push('');

    const growth: [string, number][] = [
      ['Ev Sequence', (highLow.homeSequences / lowLow.homeSequences - 1) * 100],
      ['Dep Sequence', (highLow.awaySequences / lowLow.awaySequences - 1) * 100],
      ['Ev Aksiyon/seq', (highLow.homeAvgSequenceLength / lowLow.homeAvgSequenceLength - 1) * 100],
      ['Dep Aksiyon/seq', (highLow.awayAvgSequenceLength / lowLow.awayAvgSequenceLength - 1) * 100],
      ['Ev Başarı %', (highLow.homeSuccessRate / lowLow.homeSuccessRate - 1) * 100],
      ['Dep Başarı %', (highLow.awaySuccessRate / lowLow.awaySuccessRate - 1) * 100],
      ['Ev Pas', (highLow.homePasses / lowLow.homePasses - 1) * 100],
      ['Dep Pas', (highLow.awayPasses / lowLow.awayPasses - 1) * 100],
    ];

    growth.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    for (const [name, g] of growth) {
      const bar = '█'.repeat(Math.min(40, Math.round(Math.abs(g))));
      const sign = g >= 0 ? '+' : '';
      lines.push(`  ${name.padEnd(20)}${(sign + g.toFixed(1) + '%').padStart(10)}   ${bar}`);
    }

    lines.push('');

    // ── YORUM ──
    lines.push('📌 YORUM');
    lines.push('');

    const seqDiff = highLow.homeSequences / highLow.awaySequences;
    const passDiff = highLow.homePasses / highLow.awayPasses;
    const successDiff = highLow.homeSuccessRate - highLow.awaySuccessRate;

    if (seqDiff > 2) {
      lines.push(`  🔴 Ev sequence sayısı, dep sequence sayısının ${seqDiff.toFixed(1)} katı.`);
      lines.push(`     Yüksek kaliteli takım topa çok daha fazla sahip oluyor.`);
    }

    if (passDiff > 3) {
      lines.push(`  🔴 Ev pas sayısı, dep pas sayısının ${passDiff.toFixed(1)} katı.`);
      lines.push(`     Bu, top hakimiyeti zincirinin kilitlendiğini gösteriyor.`);
    }

    if (successDiff > 0.25) {
      lines.push(`  🔴 Aksiyon başarı farkı ${pct(successDiff)}.`);
      lines.push(`     Yüksek kaliteli takım her aksiyonda çok daha başarılı.`);
    }

    lines.push('');
    lines.push('  SONUÇ:');
    if (seqDiff > 2 && successDiff > 0.25) {
      lines.push('    Top hakimiyeti zinciri kırılmış. Düşük kaliteli takım');
      lines.push('    hem daha az sequence başlatıyor hem de başlattıklarında');
      lines.push('    daha çabuk top kaybediyor.');
    } else if (seqDiff > 2) {
      lines.push('    Düşük kaliteli takım daha az sequence başlatıyor ama');
      lines.push('    başlattıklarında dengeli.');
    } else {
      lines.push('    Top hakimiyeti zinciri dengeli görünüyor.');
    }
    lines.push('');

    console.log(lines.join('\n'));
  }, 180000);
});