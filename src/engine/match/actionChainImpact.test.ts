// src/engine/match/actionChainImpact.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import { eff } from './teamAnalysis';
import type { Player } from '../types';

/**
 * AKSİYON/SEQUENCE ZİNCİRİ TEŞHİSİ
 *
 * Amaç: Kalite farkının maç sonucuna neden hâlâ çok güçlü yansıdığını
 * izole etmek. Özellikle aksiyon/sequence uzunluğunun kaliteye
 * duyarlılığını ölçmek.
 *
 * Zincir:
 *   player quality
 *     ↓
 *   aksiyon başarı oranı (resolveSequenceAction)
 *     ↓
 *   aksiyon/sequence uzunluğu
 *     ↓
 *   pas/dribble/run sayısı
 *     ↓
 *   Attack zone'a ulaşma
 *     ↓
 *   chanceQuality
 *     ↓
 *   şut/xG/gol
 *     ↓
 *   maç sonucu
 *
 * Test: her halkayı ayrı ayrı ölç, kalite farkına duyarlılığını göster.
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
  name: string;
  matches: number;

  // Sequence / aksiyon
  totalSequences: number;
  totalActions: number;
  avgActionsPerSequence: number;

  // Aksiyon dağılımı (sequence başına)
  passPerSeq: number;
  dribblePerSeq: number;
  crossPerSeq: number;
  runPerSeq: number;
  throughBallPerSeq: number;
  carryPerSeq: number;

  // Aksiyon başarı oranı (her tip için)
  passSuccessRate: number;
  dribbleSuccessRate: number;
  crossSuccessRate: number;

  // Sequence sonu
  attackZoneRate: number;      // sequence'ların kaçı Attack zone'da bitiyor
  avgChanceQuality: number;
  avgFinalPressure: number;
  avgSpaceCreated: number;

  // Şut / xG / gol
  shotsPerMatch: number;
  onTargetPerMatch: number;
  xGPerMatch: number;
  goalsPerMatch: number;
  xGPerShot: number;

  // Sonuç
  homeWinRate: number;
  drawRate: number;
  awayWinRate: number;
  avgPossessionHome: number;
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

  // Sayaçlar
  let totalSequences = 0;
  let totalActions = 0;
  let passCount = 0, passSuccess = 0;
  let dribbleCount = 0, dribbleSuccess = 0;
  let crossCount = 0, crossSuccess = 0;
  let runCount = 0, throughBallCount = 0, carryCount = 0;
  let attackZoneSequences = 0;
  let cqSum = 0, cqCount = 0;
  let pressureSum = 0, spaceSum = 0;

  let shots = 0, onTarget = 0, xG = 0, goals = 0;
  let wins = 0, draws = 0, losses = 0;
  let possessionHome = 0;

  for (let i = 0; i < matchCount; i++) {
    // Sıfırla ve attribute ayarla
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

    shots += match.stats.shots.home + match.stats.shots.away;
    onTarget += match.stats.onTarget.home + match.stats.onTarget.away;
    xG += match.stats.xG.home + match.stats.xG.away;
    goals += match.homeScore + match.awayScore;

    if (match.homeScore > match.awayScore) wins++;
    else if (match.homeScore === match.awayScore) draws++;
    else losses++;

    const totalPoss = match.stats.possession.home + match.stats.possession.away;
    if (totalPoss > 0) possessionHome += (match.stats.possession.home / totalPoss) * 100;

    for (const seq of match.sequences) {
      totalSequences++;
      totalActions += seq.actions.length;

      for (const a of seq.actions) {
        if (a.action === 'pass') { passCount++; if (a.success) passSuccess++; }
        else if (a.action === 'dribble') { dribbleCount++; if (a.success) dribbleSuccess++; }
        else if (a.action === 'cross') { crossCount++; if (a.success) crossSuccess++; }
        else if (a.action === 'run') { runCount++; }
        else if (a.action === 'throughBall') { throughBallCount++; }
        else if (a.action === 'carry') { carryCount++; }
      }

      if (seq.finalZone.includes('Attack')) attackZoneSequences++;
      cqSum += seq.chanceQuality;
      cqCount++;
      pressureSum += seq.finalPressure;
      spaceSum += seq.spaceCreated;
    }
  }

  const safeDiv = (a: number, b: number) => b === 0 ? 0 : a / b;

  return {
    name,
    matches: matchCount,
    totalSequences,
    totalActions,
    avgActionsPerSequence: safeDiv(totalActions, totalSequences),
    passPerSeq: safeDiv(passCount, totalSequences),
    dribblePerSeq: safeDiv(dribbleCount, totalSequences),
    crossPerSeq: safeDiv(crossCount, totalSequences),
    runPerSeq: safeDiv(runCount, totalSequences),
    throughBallPerSeq: safeDiv(throughBallCount, totalSequences),
    carryPerSeq: safeDiv(carryCount, totalSequences),
    passSuccessRate: safeDiv(passSuccess, passCount),
    dribbleSuccessRate: safeDiv(dribbleSuccess, dribbleCount),
    crossSuccessRate: safeDiv(crossSuccess, crossCount),
    attackZoneRate: safeDiv(attackZoneSequences, totalSequences),
    avgChanceQuality: safeDiv(cqSum, cqCount),
    avgFinalPressure: safeDiv(pressureSum, cqCount),
    avgSpaceCreated: safeDiv(spaceSum, cqCount),
    shotsPerMatch: safeDiv(shots, matchCount),
    onTargetPerMatch: safeDiv(onTarget, matchCount),
    xGPerMatch: safeDiv(xG, matchCount),
    goalsPerMatch: safeDiv(goals, matchCount),
    xGPerShot: safeDiv(xG, shots),
    homeWinRate: safeDiv(wins, matchCount),
    drawRate: safeDiv(draws, matchCount),
    awayWinRate: safeDiv(losses, matchCount),
    avgPossessionHome: safeDiv(possessionHome, matchCount),
  };
}

describe('Aksiyon/Sequence Zinciri Teşhisi', () => {
  it('kalite farkının sequence uzunluğuna ve maç sonucuna etkisini izole et', () => {
    console.log('\n⏳ Aksiyon/sequence zinciri ölçülüyor (3 senaryo × 1000 maç)...\n');

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
        `║  ${label.padEnd(26)}${a.padStart(10)}${b.padStart(12)}${c.padStart(14)}${diff.padStart(12)}   ║`
      );
    };

    const diffStr = (a: number, b: number) => {
      if (a === 0) return 'N/A';
      const d = ((b / a) - 1) * 100;
      return (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
    };

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║       AKSİYON/SEQUENCE ZİNCİRİ — KALİTE FARKI İZOLASYONU (1000 maç × 3)      ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  METRİK                    DÜŞÜK-DÜŞÜK  YÜKSEK-DÜŞÜK  YÜKSEK-YÜKSEK   Y/D     ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    // ── Halka 1: Sequence ──
    lines.push('║  ── HALKA 1: SEQUENCE ──                                                     ║');
    row('Sequence / maç',
      f1(lowLow.totalSequences / lowLow.matches),
      f1(highLow.totalSequences / highLow.matches),
      f1(highHigh.totalSequences / highHigh.matches),
      diffStr(lowLow.totalSequences / lowLow.matches, highLow.totalSequences / highLow.matches));

    // ── Halka 2: Aksiyon ──
    lines.push('║  ── HALKA 2: AKSİYON ──                                                      ║');
    row('Aksiyon / sequence',
      f2(lowLow.avgActionsPerSequence),
      f2(highLow.avgActionsPerSequence),
      f2(highHigh.avgActionsPerSequence),
      diffStr(lowLow.avgActionsPerSequence, highLow.avgActionsPerSequence));

    // ── Halka 3: Aksiyon dağılımı (sequence başına) ──
    lines.push('║  ── HALKA 3: AKSİYON DAĞILIMI (sequence başına) ──                            ║');
    row('Pas / sequence',
      f2(lowLow.passPerSeq), f2(highLow.passPerSeq), f2(highHigh.passPerSeq),
      diffStr(lowLow.passPerSeq, highLow.passPerSeq));
    row('Dribble / sequence',
      f2(lowLow.dribblePerSeq), f2(highLow.dribblePerSeq), f2(highHigh.dribblePerSeq),
      diffStr(lowLow.dribblePerSeq, highLow.dribblePerSeq));
    row('Cross / sequence',
      f2(lowLow.crossPerSeq), f2(highLow.crossPerSeq), f2(highHigh.crossPerSeq),
      diffStr(lowLow.crossPerSeq, highLow.crossPerSeq));
    row('Run / sequence',
      f2(lowLow.runPerSeq), f2(highLow.runPerSeq), f2(highHigh.runPerSeq),
      diffStr(lowLow.runPerSeq, highLow.runPerSeq));

    // ── Halka 4: Aksiyon başarı ──
    lines.push('║  ── HALKA 4: AKSİYON BAŞARI ──                                                ║');
    row('Pas isabet %',
      pct(lowLow.passSuccessRate), pct(highLow.passSuccessRate), pct(highHigh.passSuccessRate),
      diffStr(lowLow.passSuccessRate, highLow.passSuccessRate));
    row('Dribble isabet %',
      pct(lowLow.dribbleSuccessRate), pct(highLow.dribbleSuccessRate), pct(highHigh.dribbleSuccessRate),
      diffStr(lowLow.dribbleSuccessRate, highLow.dribbleSuccessRate));
    row('Cross isabet %',
      pct(lowLow.crossSuccessRate), pct(highLow.crossSuccessRate), pct(highHigh.crossSuccessRate),
      diffStr(lowLow.crossSuccessRate, highLow.crossSuccessRate));

    // ── Halka 5: Sequence sonu ──
    lines.push('║  ── HALKA 5: SEQUENCE SONU ──                                                 ║');
    row('Attack zone oranı',
      pct(lowLow.attackZoneRate), pct(highLow.attackZoneRate), pct(highHigh.attackZoneRate),
      diffStr(lowLow.attackZoneRate, highLow.attackZoneRate));
    row('Ort. chanceQuality',
      f1(lowLow.avgChanceQuality), f1(highLow.avgChanceQuality), f1(highHigh.avgChanceQuality),
      diffStr(lowLow.avgChanceQuality, highLow.avgChanceQuality));
    row('Ort. finalPressure',
      f1(lowLow.avgFinalPressure), f1(highLow.avgFinalPressure), f1(highHigh.avgFinalPressure),
      diffStr(lowLow.avgFinalPressure, highLow.avgFinalPressure));

    // ── Halka 6: Şut/xG ──
    lines.push('║  ── HALKA 6: ŞUT / xG ──                                                      ║');
    row('Şut / maç',
      f1(lowLow.shotsPerMatch), f1(highLow.shotsPerMatch), f1(highHigh.shotsPerMatch),
      diffStr(lowLow.shotsPerMatch, highLow.shotsPerMatch));
    row('İsabetli şut / maç',
      f1(lowLow.onTargetPerMatch), f1(highLow.onTargetPerMatch), f1(highHigh.onTargetPerMatch),
      diffStr(lowLow.onTargetPerMatch, highLow.onTargetPerMatch));
    row('xG / maç',
      f2(lowLow.xGPerMatch), f2(highLow.xGPerMatch), f2(highHigh.xGPerMatch),
      diffStr(lowLow.xGPerMatch, highLow.xGPerMatch));
    row('xG / şut',
      f2(lowLow.xGPerShot * 100) + '%',
      f2(highLow.xGPerShot * 100) + '%',
      f2(highHigh.xGPerShot * 100) + '%',
      diffStr(lowLow.xGPerShot, highLow.xGPerShot));

    // ── Halka 7: Sonuç ──
    lines.push('║  ── HALKA 7: SONUÇ ──                                                         ║');
    row('Gol / maç',
      f2(lowLow.goalsPerMatch), f2(highLow.goalsPerMatch), f2(highHigh.goalsPerMatch),
      diffStr(lowLow.goalsPerMatch, highLow.goalsPerMatch));
    row('Ev possession %',
      f1(lowLow.avgPossessionHome) + '%', f1(highLow.avgPossessionHome) + '%', f1(highHigh.avgPossessionHome) + '%',
      diffStr(lowLow.avgPossessionHome, highLow.avgPossessionHome));
    row('Ev kazanma %',
      pct(lowLow.homeWinRate), pct(highLow.homeWinRate), pct(highHigh.homeWinRate),
      diffStr(lowLow.homeWinRate, highLow.homeWinRate));
    row('Beraberlik %',
      pct(lowLow.drawRate), pct(highLow.drawRate), pct(highHigh.drawRate),
      diffStr(lowLow.drawRate, highLow.drawRate));
    row('Ev kaybetme %',
      pct(lowLow.awayWinRate), pct(highLow.awayWinRate), pct(highHigh.awayWinRate),
      diffStr(lowLow.awayWinRate, highLow.awayWinRate));

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── Zincir Büyüme Analizi ──
    lines.push('');
    lines.push('🔍 ZİNCİR BÜYÜME ANALİZİ (Yüksek-Düşük / Düşük-Düşük)');
    lines.push('');

    const stages: [string, number, number][] = [
      ['Aksiyon/sequence', lowLow.avgActionsPerSequence, highLow.avgActionsPerSequence],
      ['Pas isabet %', lowLow.passSuccessRate, highLow.passSuccessRate],
      ['Pas / sequence', lowLow.passPerSeq, highLow.passPerSeq],
      ['Attack zone oranı', lowLow.attackZoneRate, highLow.attackZoneRate],
      ['ChanceQuality', lowLow.avgChanceQuality, highLow.avgChanceQuality],
      ['Şut / maç', lowLow.shotsPerMatch, highLow.shotsPerMatch],
      ['xG / şut', lowLow.xGPerShot, highLow.xGPerShot],
      ['xG / maç', lowLow.xGPerMatch, highLow.xGPerMatch],
      ['Gol / maç', lowLow.goalsPerMatch, highLow.goalsPerMatch],
      ['Ev kazanma %', lowLow.homeWinRate, highLow.homeWinRate],
    ];

    const growth = stages.map(([name, a, b]) => ({
      name,
      pct: (b / a - 1) * 100,
    }));

    growth.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

    for (const g of growth) {
      const bar = '█'.repeat(Math.min(50, Math.round(Math.abs(g.pct))));
      const sign = g.pct >= 0 ? '+' : '';
      lines.push(`  ${g.name.padEnd(22)}${(sign + g.pct.toFixed(1) + '%').padStart(10)}   ${bar}`);
    }

    lines.push('');
    lines.push('📌 YORUM İÇİN İPUÇLARI');
    lines.push('');
    lines.push('  • Aksiyon/sequence farkı büyükse → pas isabeti sequence uzunluğunu şişiriyor');
    lines.push('  • Attack zone oranı farkı büyükse → iyi takım daha sık hücum bölgesine ulaşıyor');
    lines.push('  • ChanceQuality farkı küçükse → asıl büyüme başka yerde');
    lines.push('  • Ev kazanma % farkı çok büyükse → zincir birikimli çalışıyor');
    lines.push('');

    console.log(lines.join('\n'));
  }, 180000);
});