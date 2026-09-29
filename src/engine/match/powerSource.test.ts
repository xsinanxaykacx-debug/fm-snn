// src/engine/match/powerSource.test.ts

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

interface IndexBucket {
  count: number;
  sumAttackerPower: number;
  sumDefenderPower: number;
  sumDiff: number;
  sumProb: number;
  success: number;
  zones: Record<string, number>;
  attackerPositions: Record<string, number>;
  defenderPositions: Record<string, number>;
  examples: ActionDebugInfo[];
}

interface SourceResult {
  label: string;
  byIndex: IndexBucket[];
}

function runScenario(
  label: string,
  homeQuality: number,
  awayQuality: number,
  spread: number,
  matchCount: number
): SourceResult {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  const MAX_INDEX = 9;
  const byIndex: IndexBucket[] = [];
  for (let i = 0; i < MAX_INDEX; i++) {
    byIndex.push({
      count: 0,
      sumAttackerPower: 0,
      sumDefenderPower: 0,
      sumDiff: 0,
      sumProb: 0,
      success: 0,
      zones: {},
      attackerPositions: {},
      defenderPositions: {},
      examples: [],
    });
  }

  const callback = (info: ActionDebugInfo) => {
    const idx = info.actionIndex;
    if (idx >= MAX_INDEX) return;

    const b = byIndex[idx];
    b.count++;
    b.sumAttackerPower += info.attackerPower;
    b.sumDefenderPower += info.defenderPower;
    b.sumDiff += info.diff;
    b.sumProb += info.probability;
    if (info.success) b.success++;

    b.zones[info.zone] = (b.zones[info.zone] || 0) + 1;
    b.attackerPositions[info.attackerPosition] =
      (b.attackerPositions[info.attackerPosition] || 0) + 1;
    if (info.defenderPosition) {
      b.defenderPositions[info.defenderPosition] =
        (b.defenderPositions[info.defenderPosition] || 0) + 1;
    }

    if (b.examples.length < 2) {
      b.examples.push(info);
    }
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

    simulateMatch(home, away, data.players, 1, undefined, callback);
  }

  return { label, byIndex };
}

describe('Power Source — Gerçek Motor Değerleri', () => {
  it('pickPlayerForZone ve pickDefender gerçek değerlerini ölç', () => {
    console.log('\n⏳ Power source (3 senaryo × 300 maç)...\n');

    const N = 300;

    const lowLow = runScenario('Düşük-Düşük', 10, 10, 4, N);
    const highLow = runScenario('Yüksek-Düşük', 18, 10, 4, N);
    const highHigh = runScenario('Yüksek-Yüksek', 18, 18, 4, N);

    const lines: string[] = [];
    const f2 = (v: number) => v.toFixed(2);
    const f1 = (v: number) => v.toFixed(1);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║       POWER SOURCE — GERÇEK MOTOR (pickPlayerForZone + pickDefender)          ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (const result of [lowLow, highLow, highHigh]) {
      lines.push(`║  ${result.label.toUpperCase()}${' '.repeat(72 - result.label.length)}║`);
      lines.push('║  AKS#  ATT_PWR  DEF_PWR  FARK    PROB    BAŞARI  ATK_POZ        DEF_POZ        ║');
      lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

      for (const b of result.byIndex) {
        if (b.count === 0) continue;

        const avgAtk = b.sumAttackerPower / b.count;
        const avgDef = b.sumDefenderPower / b.count;
        const avgDiff = b.sumDiff / b.count;
        const avgProb = b.sumProb / b.count;
        const succRate = b.success / b.count;

        const topAtk = Object.entries(b.attackerPositions)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([p, c]) => `${p}:${((c / b.count) * 100).toFixed(0)}%`)
          .join(' ');

        const topDef = Object.entries(b.defenderPositions)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([p, c]) => `${p}:${((c / b.count) * 100).toFixed(0)}%`)
          .join(' ');

        lines.push(
          `║  #${String(b.examples[0]?.actionIndex + 1 || 0).padEnd(5)}${f1(avgAtk).padStart(7)}${f1(avgDef).padStart(9)}${(avgDiff >= 0 ? '+' : '')}${f1(avgDiff).padStart(7)}${pct(avgProb).padStart(8)}${pct(succRate).padStart(8)}  ${topAtk.padEnd(13)} ${topDef.padEnd(14)} ║`
        );
      }
      lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    }

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── HIGH-LOW detay ──
    lines.push('');
    lines.push('🔍 HIGH-LOW ÖRNEKLER (ilk 4 aksiyon)');
    lines.push('');

    for (const b of highLow.byIndex.slice(0, 4)) {
      if (b.count === 0) continue;
      lines.push(`  Aksiyon #${b.examples[0]?.actionIndex + 1 || 0}:`);
      for (const ex of b.examples.slice(0, 2)) {
        lines.push(`    zone=${ex.zone}  action=${ex.action}`);
        lines.push(`    ${ex.attackerPosition} ${ex.attackerName} (pw=${f1(ex.attackerPower)})  vs  ${ex.defenderPosition} ${ex.defenderName} (pw=${f1(ex.defenderPower)})`);
        lines.push(`    diff=${f1(ex.diff)}  prob=${pct(ex.probability)}  success=${ex.success}`);
      }
      lines.push('');
    }

    console.log(lines.join('\n'));
  }, 300000);
});