// src/engine/match/xgQualityCalibration.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import type { Player, AttackSequence } from '../types';

/**
 * XG QUALITY CALIBRATION
 *
 * Amaç: Kalite farkı arttıkça CQ ve xG zincirinin nasıl değiştiğini
 * izole etmek. Özellikle:
 *
 *   oyuncu kalitesi
 *      ↓
 *   aksiyon başarı ihtimali
 *      ↓
 *   sequence uzunluğu
 *      ↓
 *   pressure / space
 *      ↓
 *   chanceQuality
 *      ↓
 *   şut ihtimali
 *      ↓
 *   xG
 *
 * Her aşamada kalite farkı ne kadar büyüyor?
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

interface XGQualityStats {
  homeQ: number;
  awayQ: number;
  matches: number;

  // Sequence / aksiyon
  homeSequences: number;
  awaySequences: number;
  homeActions: number;
  awayActions: number;
  homeActionsPerSeq: number;
  awayActionsPerSeq: number;

  // CQ / pressure / space
  homeAvgCQ: number;
  awayAvgCQ: number;
  homeAvgPressure: number;
  awayAvgPressure: number;
  homeAvgSpace: number;
  awayAvgSpace: number;

  // Şut
  homeShots: number;
  awayShots: number;
  homeShotsPerMatch: number;
  awayShotsPerMatch: number;
  homeOnTarget: number;
  awayOnTarget: number;

  // xG
  homeXG: number;
  awayXG: number;
  homeXGPerMatch: number;
  awayXGPerMatch: number;
  homeXGPerShot: number;
  awayXGPerShot: number;

  // Gol
  homeGoals: number;
  awayGoals: number;
  homeGoalsPerMatch: number;
  awayGoalsPerMatch: number;

  // Sonuç
  homeWins: number;
  draws: number;
  awayWins: number;
  homeWinRate: number;
}

function runXGQuality(
  homeQ: number,
  awayQ: number,
  matchCount: number
): XGQualityStats {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  let homeSequences = 0, awaySequences = 0;
  let homeActions = 0, awayActions = 0;
  let homeCQSum = 0, awayCQSum = 0;
  let homePressureSum = 0, awayPressureSum = 0;
  let homeSpaceSum = 0, awaySpaceSum = 0;
  let homeShots = 0, awayShots = 0;
  let homeOnTarget = 0, awayOnTarget = 0;
  let homeXG = 0, awayXG = 0;
  let homeGoals = 0, awayGoals = 0;
  let homeWins = 0, draws = 0, awayWins = 0;

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
    for (const p of homePlayers) setAttributeLevel(p, homeQ, 3);
    for (const p of awayPlayers) setAttributeLevel(p, awayQ, 3);

    const match = simulateMatch(home, away, data.players, 1);

    // Maç istatistikleri
    homeShots += match.stats.shots.home;
    awayShots += match.stats.shots.away;
    homeOnTarget += match.stats.onTarget.home;
    awayOnTarget += match.stats.onTarget.away;
    homeXG += match.stats.xG.home;
    awayXG += match.stats.xG.away;
    homeGoals += match.homeScore;
    awayGoals += match.awayScore;

    if (match.homeScore > match.awayScore) homeWins++;
    else if (match.homeScore === match.awayScore) draws++;
    else awayWins++;

    // Sequence bazlı
    for (const seq of match.sequences) {
      const isHome = seq.attackingClubId === home.id;
      if (isHome) {
        homeSequences++;
        homeActions += seq.actions.length;
        homeCQSum += seq.chanceQuality;
        homePressureSum += seq.finalPressure;
        homeSpaceSum += seq.spaceCreated;
      } else {
        awaySequences++;
        awayActions += seq.actions.length;
        awayCQSum += seq.chanceQuality;
        awayPressureSum += seq.finalPressure;
        awaySpaceSum += seq.spaceCreated;
      }
    }
  }

  const safeDiv = (a: number, b: number) => b === 0 ? 0 : a / b;

  return {
    homeQ, awayQ, matches: matchCount,
    homeSequences, awaySequences,
    homeActions, awayActions,
    homeActionsPerSeq: safeDiv(homeActions, homeSequences),
    awayActionsPerSeq: safeDiv(awayActions, awaySequences),
    homeAvgCQ: safeDiv(homeCQSum, homeSequences),
    awayAvgCQ: safeDiv(awayCQSum, awaySequences),
    homeAvgPressure: safeDiv(homePressureSum, homeSequences),
    awayAvgPressure: safeDiv(awayPressureSum, awaySequences),
    homeAvgSpace: safeDiv(homeSpaceSum, homeSequences),
    awayAvgSpace: safeDiv(awaySpaceSum, awaySequences),
    homeShots, awayShots,
    homeShotsPerMatch: safeDiv(homeShots, matchCount),
    awayShotsPerMatch: safeDiv(awayShots, matchCount),
    homeOnTarget, awayOnTarget,
    homeXG, awayXG,
    homeXGPerMatch: safeDiv(homeXG, matchCount),
    awayXGPerMatch: safeDiv(awayXG, matchCount),
    homeXGPerShot: safeDiv(homeXG, homeShots),
    awayXGPerShot: safeDiv(awayXG, awayShots),
    homeGoals, awayGoals,
    homeGoalsPerMatch: safeDiv(homeGoals, matchCount),
    awayGoalsPerMatch: safeDiv(awayGoals, matchCount),
    homeWins, draws, awayWins,
    homeWinRate: safeDiv(homeWins, matchCount),
  };
}

describe('xG Quality Calibration', () => {
  it('kalite farkı xG zincirinde nerede büyüyor?', () => {
    console.log('\n⏳ xG quality calibration (6 seviye × 1000 maç)...\n');

    const N = 1000;

    const scenarios = [
      { home: 10, away: 10 },
      { home: 12, away: 10 },
      { home: 14, away: 10 },
      { home: 16, away: 10 },
      { home: 18, away: 10 },
      { home: 20, away: 10 },
    ];

    const results = scenarios.map(s => runXGQuality(s.home, s.away, N));

    const lines: string[] = [];
    const f2 = (v: number) => v.toFixed(2);
    const f1 = (v: number) => v.toFixed(1);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║     XG QUALITY CALIBRATION — KALİTE FARKI ZİNCİRİ (1000 maç)                 ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    // ── CQ EV vs DEP ──
    lines.push('║  ── CHANCE QUALITY ──                                                        ║');
    lines.push('║  GÜÇ        CQ_EV   CQ_DEP   FARK    PRES_EV  PRES_DEP  SPACE_EV  SPACE_DEP  ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (const r of results) {
      lines.push(
        `║  ${String(r.homeQ).padStart(2)} vs ${String(r.awayQ).padStart(2)}   ${f1(r.homeAvgCQ).padStart(6)}  ${f1(r.awayAvgCQ).padStart(6)}  ${f1(r.homeAvgCQ - r.awayAvgCQ).padStart(5)}   ${f1(r.homeAvgPressure).padStart(6)}   ${f1(r.awayAvgPressure).padStart(6)}   ${f1(r.homeAvgSpace).padStart(6)}   ${f1(r.awayAvgSpace).padStart(6)}  ║`
      );
    }

    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  ── SEQUENCE / AKSİYON ──                                                    ║');
    lines.push('║  GÜÇ        SEQ_EV  SEQ_DEP  ACT/SEQ_EV  ACT/SEQ_DEP                       ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (const r of results) {
      lines.push(
        `║  ${String(r.homeQ).padStart(2)} vs ${String(r.awayQ).padStart(2)}   ${String(r.homeSequences).padStart(6)}  ${String(r.awaySequences).padStart(6)}   ${f2(r.homeActionsPerSeq).padStart(8)}      ${f2(r.awayActionsPerSeq).padStart(8)}          ║`
      );
    }

    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  ── ŞUT ──                                                                   ║');
    lines.push('║  GÜÇ        ŞUT_EV  ŞUT_DEP  ONT_EV  ONT_DEP  xG_EV  xG_DEP  xG/ŞUT_EV  xG/ŞUT_DEP ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (const r of results) {
      lines.push(
        `║  ${String(r.homeQ).padStart(2)} vs ${String(r.awayQ).padStart(2)}   ${f1(r.homeShotsPerMatch).padStart(6)}  ${f1(r.awayShotsPerMatch).padStart(6)}   ${f1(r.homeOnTarget / r.matches).padStart(5)}   ${f1(r.awayOnTarget / r.matches).padStart(5)}   ${f2(r.homeXGPerMatch).padStart(5)}  ${f2(r.awayXGPerMatch).padStart(5)}   ${f2(r.homeXGPerShot).padStart(6)}     ${f2(r.awayXGPerShot).padStart(6)}  ║`
      );
    }

    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  ── GOL / SONUÇ ──                                                            ║');
    lines.push('║  GÜÇ        GOL_EV  GOL_DEP  EV KAZ  BER   DEP KAZ                          ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (const r of results) {
      lines.push(
        `║  ${String(r.homeQ).padStart(2)} vs ${String(r.awayQ).padStart(2)}   ${f2(r.homeGoalsPerMatch).padStart(6)}  ${f2(r.awayGoalsPerMatch).padStart(6)}   ${pct(r.homeWinRate).padStart(5)}  ${pct(r.draws / r.matches).padStart(5)}  ${pct(r.awayWins / r.matches).padStart(6)}          ║`
      );
    }

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── Zincir büyüme analizi ──
    lines.push('');
    lines.push('🔍 ZİNCİR BÜYÜME ANALİZİ (12 vs 10 → 20 vs 10)');
    lines.push('');

    const base = results[0]; // 10 vs 10
    for (let i = 1; i < results.length; i++) {
      const r = results[i];
      const homeQ = r.homeQ;

      // Ev tarafı
      const cqGrowth = (r.homeAvgCQ / base.homeAvgCQ - 1) * 100;
      const seqGrowth = (r.homeSequences / base.homeSequences - 1) * 100;
      const actGrowth = (r.homeActionsPerSeq / base.homeActionsPerSeq - 1) * 100;
      const shotGrowth = (r.homeShotsPerMatch / base.homeShotsPerMatch - 1) * 100;
      const xgPerShotGrowth = (r.homeXGPerShot / base.homeXGPerShot - 1) * 100;
      const xgGrowth = (r.homeXGPerMatch / base.homeXGPerMatch - 1) * 100;
      const goalGrowth = (r.homeGoalsPerMatch / base.homeGoalsPerMatch - 1) * 100;

      // Dep tarafı (düşüş)
      const awayCQ = (r.awayAvgCQ / base.awayAvgCQ - 1) * 100;
      const awayShot = (r.awayShotsPerMatch / base.awayShotsPerMatch - 1) * 100;
      const awayXG = (r.awayXGPerMatch / base.awayXGPerMatch - 1) * 100;

      lines.push(`  ${homeQ} vs 10:`);
      lines.push(`    EV tarafı:`);
      lines.push(`      CQ:        ${cqGrowth >= 0 ? '+' : ''}${f1(cqGrowth)}%`);
      lines.push(`      Sequence:  ${seqGrowth >= 0 ? '+' : ''}${f1(seqGrowth)}%`);
      lines.push(`      Aksiyon/s: ${actGrowth >= 0 ? '+' : ''}${f1(actGrowth)}%`);
      lines.push(`      Şut:       ${shotGrowth >= 0 ? '+' : ''}${f1(shotGrowth)}%`);
      lines.push(`      xG/şut:    ${xgPerShotGrowth >= 0 ? '+' : ''}${f1(xgPerShotGrowth)}%`);
      lines.push(`      xG:        ${xgGrowth >= 0 ? '+' : ''}${f1(xgGrowth)}%`);
      lines.push(`      Gol:       ${goalGrowth >= 0 ? '+' : ''}${f1(goalGrowth)}%`);
      lines.push(`    DEP tarafı:`);
      lines.push(`      CQ:        ${f1(awayCQ)}%`);
      lines.push(`      Şut:       ${f1(awayShot)}%`);
      lines.push(`      xG:        ${f1(awayXG)}%`);
      lines.push('');
    }

    lines.push('');
    lines.push('  📌 ZİNCİRDE EN ÇOK BÜYÜYEN HALKA:');
    lines.push('');

    // Her seviye için en büyük büyüme
    for (let i = 1; i < results.length; i++) {
      const r = results[i];
      const stages = [
        { name: 'CQ', value: (r.homeAvgCQ / base.homeAvgCQ - 1) * 100 },
        { name: 'Sequence', value: (r.homeSequences / base.homeSequences - 1) * 100 },
        { name: 'Aksiyon/seq', value: (r.homeActionsPerSeq / base.homeActionsPerSeq - 1) * 100 },
        { name: 'Şut', value: (r.homeShotsPerMatch / base.homeShotsPerMatch - 1) * 100 },
        { name: 'xG/şut', value: (r.homeXGPerShot / base.homeXGPerShot - 1) * 100 },
        { name: 'xG', value: (r.homeXGPerMatch / base.homeXGPerMatch - 1) * 100 },
        { name: 'Gol', value: (r.homeGoalsPerMatch / base.homeGoalsPerMatch - 1) * 100 },
      ];
      stages.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
      const top = stages[0];
      lines.push(`    ${r.homeQ} vs 10: en büyük büyüme → ${top.name} (${top.value >= 0 ? '+' : ''}${f1(top.value)}%)`);
    }

    lines.push('');

    console.log(lines.join('\n'));
  }, 600000);
});