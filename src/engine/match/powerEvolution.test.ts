// src/engine/match/powerEvolution.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import { eff } from './teamAnalysis';
import type { Player, AttackSequenceAction } from '../types';

/**
 * POWER EVOLUTION — SEQUENCE BOYUNCA POWER FARKI
 *
 * Amaç: Sequence ilerledikçe attackerPower - defenderPower farkı
 * nasıl değişiyor?
 *
 * İhtimal A: Fark sabit → sorun sequence termination'da
 * İhtimal B: Fark büyüyor → feedback loop power üretiminde
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

function calculateAttackerPower(attacker: Player, action: string): number {
  if (action === 'pass') {
    return eff(attacker, 'passing') * 0.4 + eff(attacker, 'vision') * 0.3 + eff(attacker, 'decisions') * 0.3;
  }
  if (action === 'dribble') {
    return eff(attacker, 'dribbling') * 0.4 + eff(attacker, 'agility') * 0.3 + eff(attacker, 'technique') * 0.3;
  }
  if (action === 'cross') {
    return eff(attacker, 'crossing') * 0.5 + eff(attacker, 'technique') * 0.3 + eff(attacker, 'vision') * 0.2;
  }
  if (action === 'throughBall') {
    return eff(attacker, 'passing') * 0.4 + eff(attacker, 'vision') * 0.4 + eff(attacker, 'technique') * 0.2;
  }
  if (action === 'run') {
    return eff(attacker, 'offTheBall') * 0.4 + eff(attacker, 'pace') * 0.3 + eff(attacker, 'anticipation') * 0.3;
  }
  if (action === 'recycle') {
    return eff(attacker, 'passing') * 0.5 + eff(attacker, 'composure') * 0.5;
  }
  return 50;
}

function calculateDefenderPower(defender: Player | null): number {
  if (!defender) return 40;

  const marking = eff(defender, 'marking');
  const tackling = eff(defender, 'tackling');
  const positioning = eff(defender, 'defensivePositioning');
  const anticipation = eff(defender, 'anticipation');

  return marking * 0.3 + tackling * 0.3 + positioning * 0.2 + anticipation * 0.2;
}

interface EvolutionStats {
  label: string;
  matches: number;

  // Aksiyon sırasına göre
  byIndex: {
    index: number;
    count: number;
    avgAttackerPower: number;
    avgDefenderPower: number;
    avgDiff: number;
  }[];

  // Başlangıç vs son
  startDiff: number;
  endDiff: number;
  diffEvolution: number; // end - start
}

function runScenario(
  label: string,
  homeQuality: number,
  awayQuality: number,
  spread: number,
  matchCount: number
): EvolutionStats {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  const MAX_INDEX = 9;
  const byIndex: {
    count: number;
    sumAttacker: number;
    sumDefender: number;
  }[] = [];
  for (let i = 0; i < MAX_INDEX; i++) {
    byIndex.push({ count: 0, sumAttacker: 0, sumDefender: 0 });
  }

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
      const attackXI = isHome ? homePlayers : awayPlayers;
      const defendXI = isHome ? awayPlayers : homePlayers;

      for (let idx = 0; idx < seq.actions.length && idx < MAX_INDEX; idx++) {
        const a = seq.actions[idx];
        if (a.action === 'carry') continue;

        // Rastgele hücumcu ve savunmacı (gerçekte hangisi bilinmiyor)
        const attacker = attackXI[Math.floor(Math.random() * attackXI.length)];
        const defender = defendXI[Math.floor(Math.random() * defendXI.length)];

        const attackerPower = calculateAttackerPower(attacker, a.action);
        const defenderPower = calculateDefenderPower(defender);

        byIndex[idx].count++;
        byIndex[idx].sumAttacker += attackerPower;
        byIndex[idx].sumDefender += defenderPower;
      }
    }
  }

  const safeDiv = (a: number, b: number) => b === 0 ? 0 : a / b;

  const resultByIndex = byIndex.map((b, i) => ({
    index: i + 1,
    count: b.count,
    avgAttackerPower: safeDiv(b.sumAttacker, b.count),
    avgDefenderPower: safeDiv(b.sumDefender, b.count),
    avgDiff: safeDiv(b.sumAttacker - b.sumDefender, b.count),
  }));

  const startDiff = resultByIndex[0]?.avgDiff ?? 0;
  const endDiff = resultByIndex[MAX_INDEX - 1]?.avgDiff ?? 0;

  return {
    label, matches: matchCount, byIndex: resultByIndex,
    startDiff, endDiff,
    diffEvolution: endDiff - startDiff,
  };
}

describe('Power Evolution — Sequence Boyunca Power Farkı', () => {
  it('power farkı sequence ilerledikçe büyüyor mu?', () => {
    console.log('\n⏳ Power evolution (3 senaryo × 1000 maç)...\n');

    const N = 1000;

    const lowLow = runScenario('Düşük-Düşük', 10, 10, 4, N);
    const highLow = runScenario('Yüksek-Düşük', 18, 10, 4, N);
    const highHigh = runScenario('Yüksek-Yüksek', 18, 18, 4, N);

    const lines: string[] = [];
    const f2 = (v: number) => v.toFixed(2);
    const f1 = (v: number) => v.toFixed(1);

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║      POWER EVOLUTION — SEQUENCE BOYUNCA POWER FARKI (1000 maç × 3)          ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  AKSİYON #   DÜŞÜK-DÜŞÜK        YÜKSEK-DÜŞÜK        YÜKSEK-YÜKSEK           ║');
    lines.push('║              (atk/def/fark)      (atk/def/fark)      (atk/def/fark)         ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (let i = 0; i < 9; i++) {
      const la = lowLow.byIndex[i];
      const ha = highLow.byIndex[i];
      const hh = highHigh.byIndex[i];

      const laStr = `${f1(la.avgAttackerPower)}/${f1(la.avgDefenderPower)}/${la.avgDiff >= 0 ? '+' : ''}${f1(la.avgDiff)}`;
      const haStr = `${f1(ha.avgAttackerPower)}/${f1(ha.avgDefenderPower)}/${ha.avgDiff >= 0 ? '+' : ''}${f1(ha.avgDiff)}`;
      const hhStr = `${f1(hh.avgAttackerPower)}/${f1(hh.avgDefenderPower)}/${hh.avgDiff >= 0 ? '+' : ''}${f1(hh.avgDiff)}`;

      lines.push(
        `║  #${String(i + 1).padEnd(10)}${laStr.padStart(22)}${haStr.padStart(22)}${hhStr.padStart(22)}       ║`
      );
    }

    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  ── POWER FARKI EVRİMİ ──                                                    ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    const row = (label: string, a: string, b: string, c: string) => {
      lines.push(
        `║  ${label.padEnd(26)}${a.padStart(12)}${b.padStart(14)}${c.padStart(14)}   ║`
      );
    };

    row('Başlangıç farkı (#1)',
      f2(lowLow.startDiff), f2(highLow.startDiff), f2(highHigh.startDiff));
    row('Bitiş farkı (#9)',
      f2(lowLow.endDiff), f2(highLow.endDiff), f2(highHigh.endDiff));
    row('Evrim (bitiş - başlangıç)',
      f2(lowLow.diffEvolution), f2(highLow.diffEvolution), f2(highHigh.diffEvolution));

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── Analiz ──
    lines.push('');
    lines.push('🔍 POWER EVOLUTION ANALİZİ');
    lines.push('');

    lines.push('  HIGH-LOW power farkı evrimi:');
    for (let i = 0; i < 9; i++) {
      const ha = highLow.byIndex[i];
      const sign = ha.avgDiff >= 0 ? '+' : '';
      const bar = '█'.repeat(Math.min(40, Math.max(0, Math.round(ha.avgDiff))));
      lines.push(`    #${i + 1}: ${sign}${f2(ha.avgDiff).padStart(6)}  ${bar}`);
    }
    lines.push('');

    // İhtimal kontrolü
    const evolution = highLow.diffEvolution;
    const start = highLow.startDiff;
    const end = highLow.endDiff;

    if (Math.abs(evolution) < 2) {
      lines.push(`  ✅ İHTİMAL A: Power farkı SABİT.`);
      lines.push(`     Başlangıç: ${f2(start)}, Bitiş: ${f2(end)}, Evrim: ${f2(evolution)}`);
      lines.push(`     → Sorun power evolution değil.`);
      lines.push(`     → Sorun sequence termination / recovery / possession'da.`);
    } else if (evolution > 2) {
      lines.push(`  🔴 İHTİMAL B: Power farkı BÜYÜYOR (feedback loop).`);
      lines.push(`     Başlangıç: ${f2(start)}, Bitiş: ${f2(end)}, Evrim: +${f2(evolution)}`);
      lines.push(`     → Yüksek takım sequence ilerledikçe daha da güçleniyor.`);
      lines.push(`     → Sorun power üretiminde.`);
    } else {
      lines.push(`  🟡 Power farkı KÜÇÜLÜYOR.`);
      lines.push(`     Başlangıç: ${f2(start)}, Bitiş: ${f2(end)}, Evrim: ${f2(evolution)}`);
    }
    lines.push('');

    // LOW-LOW kontrolü
    lines.push(`  LOW-LOW evrimi: ${f2(lowLow.diffEvolution)} (beklenen: ~0)`);
    lines.push(`  HIGH-HIGH evrimi: ${f2(highHigh.diffEvolution)} (beklenen: ~0)`);
    lines.push('');

    console.log(lines.join('\n'));
  }, 300000);
});