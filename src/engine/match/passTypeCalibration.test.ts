// src/engine/match/passTypeCalibration.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import type { Player, ActionDebugInfo } from '../types';

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

const ACTION_TYPES = ['pass', 'throughBall', 'recycle', 'cross', 'dribble', 'run'] as const;
type ActionType = typeof ACTION_TYPES[number];

interface ActionStats {
  count: number;
  success: number;
  successRate: number;
  avgAttackerPower: number;
  avgDefenderPower: number;
  avgDiff: number;
  avgProbability: number;
}

interface PassTypeResult {
  label: string;
  matches: number;
  byAction: Record<ActionType, ActionStats>;
  totalPasses: number;
  totalPassesCompleted: number;
  passAccuracy: number;
  shotsPerMatch: number;
  xGPerMatch: number;
  goalsPerMatch: number;
  homeWinRate: number;
}

function runScenario(
  label: string,
  homeQuality: number,
  awayQuality: number,
  spread: number,
  matchCount: number
): PassTypeResult {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  const byAction: Record<ActionType, ActionStats> = {} as any;
  for (const t of ACTION_TYPES) {
    byAction[t] = {
      count: 0, success: 0, successRate: 0,
      avgAttackerPower: 0, avgDefenderPower: 0, avgDiff: 0, avgProbability: 0,
    };
  }

  let totalPasses = 0;
  let totalPassesCompleted = 0;
  let totalShots = 0;
  let totalXG = 0;
  let totalGoals = 0;
  let homeWins = 0;

  // 🆕 Callback her aksiyon için çağrılır
  const debugCallback = (info: ActionDebugInfo) => {
    const actionType = info.action as ActionType;
    if (!ACTION_TYPES.includes(actionType)) return;

    const b = byAction[actionType];
    b.count++;
    if (info.success) b.success++;
    b.avgAttackerPower += info.attackerPower;
    b.avgDefenderPower += info.defenderPower;
    b.avgDiff += info.diff;
    b.avgProbability += info.probability;
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

    // 🆕 Callback'i simulateMatch'a 6. parametre olarak geçir
    const match = simulateMatch(home, away, data.players, 1, undefined, debugCallback);

    totalShots += match.stats.shots.home + match.stats.shots.away;
    totalXG += match.stats.xG.home + match.stats.xG.away;
    totalGoals += match.homeScore + match.awayScore;
    if (match.homeScore > match.awayScore) homeWins++;

    totalPasses += match.stats.passes.home + match.stats.passes.away;
    totalPassesCompleted += match.stats.passesCompleted.home + match.stats.passesCompleted.away;
  }

  for (const t of ACTION_TYPES) {
    const b = byAction[t];
    if (b.count > 0) {
      b.successRate = b.success / b.count;
      b.avgAttackerPower /= b.count;
      b.avgDefenderPower /= b.count;
      b.avgDiff /= b.count;
      b.avgProbability /= b.count;
    }
  }

  return {
    label, matches: matchCount, byAction,
    totalPasses, totalPassesCompleted,
    passAccuracy: totalPasses > 0 ? totalPassesCompleted / totalPasses : 0,
    shotsPerMatch: totalShots / matchCount,
    xGPerMatch: totalXG / matchCount,
    goalsPerMatch: totalGoals / matchCount,
    homeWinRate: homeWins / matchCount,
  };
}

describe('Pass Type Calibration', () => {
  it('her aksiyon türünün başarı oranını ayrı ayrı ölç', () => {
    console.log('\n⏳ Pass type calibration (3 senaryo × 1000 maç)...\n');

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
    lines.push('║     PASS TYPE CALIBRATION — AKSİYON TÜRÜ BAŞARI ORANLARI                     ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  AKSİYON      DÜŞÜK-DÜŞÜK    YÜKSEK-DÜŞÜK    YÜKSEK-YÜKSEK                  ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    const row = (label: string, a: string, b: string, c: string) => {
      lines.push(`║  ${label.padEnd(14)}${a.padStart(14)}${b.padStart(16)}${c.padStart(16)}        ║`);
    };

    for (const t of ACTION_TYPES) {
      const la = lowLow.byAction[t];
      const ha = highLow.byAction[t];
      const hh = highHigh.byAction[t];
      row(
        t,
        `${pct(la.successRate)} (${la.count})`,
        `${pct(ha.successRate)} (${ha.count})`,
        `${pct(hh.successRate)} (${hh.count})`
      );
    }

    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  ── GENEL PAS İSABETİ ──                                                     ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    row('Pas isabet %',
      pct(lowLow.passAccuracy), pct(highLow.passAccuracy), pct(highHigh.passAccuracy));

    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  ── MAÇ METRİKLERİ ──                                                        ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    row('Şut/maç', f1(lowLow.shotsPerMatch), f1(highLow.shotsPerMatch), f1(highHigh.shotsPerMatch));
    row('xG/maç', f2(lowLow.xGPerMatch), f2(highLow.xGPerMatch), f2(highHigh.xGPerMatch));
    row('Gol/maç', f2(lowLow.goalsPerMatch), f2(highLow.goalsPerMatch), f2(highHigh.goalsPerMatch));
    row('Ev kazanma %', pct(lowLow.homeWinRate), pct(highLow.homeWinRate), pct(highHigh.homeWinRate));

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── Detaylı analiz ──
    lines.push('');
    lines.push('🔍 DETAYLI ANALİZ');
    lines.push('');

    for (const result of [lowLow, highLow, highHigh]) {
      lines.push(`  ${result.label}:`);
      lines.push('  AKSİYON      COUNT   BAŞARI   ATT_PWR   DEF_PWR   FARK    PROB');
      lines.push('  ────────────────────────────────────────────────────────────────────');
      for (const t of ACTION_TYPES) {
        const b = result.byAction[t];
        if (b.count === 0) continue;
        lines.push(`  ${t.padEnd(12)}${String(b.count).padStart(7)}   ${pct(b.successRate).padStart(6)}   ${f1(b.avgAttackerPower).padStart(8)}  ${f1(b.avgDefenderPower).padStart(8)}  ${(b.avgDiff >= 0 ? '+' : '')}${f1(b.avgDiff).padStart(5)}   ${pct(b.avgProbability).padStart(6)}`);
      }
      lines.push('');
    }

    // ── Aksiyon türü farkı var mı? ──
    lines.push('  🎯 AKSİYON TÜRÜ FARKI');
    lines.push('');
    lines.push('  DÜŞÜK-DÜŞÜK:');
    for (const t of ACTION_TYPES) {
      const b = lowLow.byAction[t];
      if (b.count === 0) continue;
      const bar = '█'.repeat(Math.round(b.successRate * 50));
      lines.push(`    ${t.padEnd(12)}${pct(b.successRate).padStart(6)}  ${bar}`);
    }
    lines.push('');
    lines.push('  YÜKSEK-DÜŞÜK:');
    for (const t of ACTION_TYPES) {
      const b = highLow.byAction[t];
      if (b.count === 0) continue;
      const bar = '█'.repeat(Math.round(b.successRate * 50));
      lines.push(`    ${t.padEnd(12)}${pct(b.successRate).padStart(6)}  ${bar}`);
    }
    lines.push('');

    console.log(lines.join('\n'));
  }, 400000);
});