// src/engine/match/powerBalance.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import { eff } from './teamAnalysis';
import type { Player, AttackSequenceAction } from '../types';

/**
 * POWER BALANCE — ATTACKER/DEFENDER POWER AYRIŞTIRMA
 *
 * Amaç: HIGH-LOW'da %81 vs %61.9 başarı farkı nereden geliyor?
 *
 * Ölçülen (her aksiyon tipi için):
 *   • attackerPower (ev/dep)
 *   • defenderPower (ev/dep)
 *   • power farkı (ev/dep)
 *   • başarı olasılığı (teorik)
 *   • gerçek başarı %
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

// ═══════════════════════════════════════════════
// MOTOR FONKSİYONLARININ BİREBİR KOPYASI
// ═══════════════════════════════════════════════

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

function calculateDefenderPower(defender: Player | null, team: any): number {
  if (!defender) return 40;

  const marking = eff(defender, 'marking');
  const tackling = eff(defender, 'tackling');
  const positioning = eff(defender, 'defensivePositioning');
  const anticipation = eff(defender, 'anticipation');

  let power = marking * 0.3 + tackling * 0.3 + positioning * 0.2 + anticipation * 0.2;

  if (team.pressing === 'high') power += 5;
  else if (team.pressing === 'low') power -= 5;

  return power;
}

// ═══════════════════════════════════════════════
// POWER ÖRNEKLEMESİ
// ═══════════════════════════════════════════════

interface PowerSample {
  action: string;
  attackerPower: number;
  defenderPower: number;
  diff: number;
  successProb: number;   // teorik olasılık
  actualSuccess: boolean;
}

const ACTION_TYPES = ['pass', 'dribble', 'cross', 'run', 'throughBall', 'recycle'] as const;
type ActionType = typeof ACTION_TYPES[number];

interface ScenarioPowerStats {
  label: string;
  matches: number;
  byAction: Record<ActionType, {
    count: number;
    avgAttackerPower: number;
    avgDefenderPower: number;
    avgDiff: number;
    avgSuccessProb: number;
    actualSuccessRate: number;
  }>;
  // Genel
  overallAvgAttacker: number;
  overallAvgDefender: number;
  overallAvgDiff: number;
  overallAvgSuccessProb: number;
  overallActualSuccess: number;
}

function runScenario(
  label: string,
  homeQuality: number,
  awayQuality: number,
  spread: number,
  matchCount: number
): ScenarioPowerStats {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  const samples: PowerSample[] = [];

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

      // Her aksiyon için power hesapla
      for (const action of seq.actions) {
        if (action.action === 'carry') continue; // carry her zaman başarılı
        if (!ACTION_TYPES.includes(action.action as ActionType)) continue;

        // Aksiyon tipini al
        const actionType = action.action as ActionType;

        // Rastgele bir hücumcu ve savunmacı seç
        // (gerçekte hangi oyuncunun kullanıldığını bilmiyoruz, o yüzden ortalamayı alıyoruz)
        const attacker = attackXI[Math.floor(Math.random() * attackXI.length)];
        const defender = defendXI[Math.floor(Math.random() * defendXI.length)];

        const attackerPower = calculateAttackerPower(attacker, actionType);
        const defenderPower = calculateDefenderPower(defender, isHome ? match.stats : match.stats);

        const diff = attackerPower - defenderPower;
        const successProb = Math.max(0.20, Math.min(0.90, 0.52 + diff / 180));

        samples.push({
          action: actionType,
          attackerPower,
          defenderPower,
          diff,
          successProb,
          actualSuccess: action.success,
        });
      }
    }
  }

  // Aggregate
  const byAction: Record<ActionType, any> = {} as any;
  for (const t of ACTION_TYPES) {
    const actionSamples = samples.filter(s => s.action === t);
    const n = actionSamples.length;
    if (n === 0) {
      byAction[t] = {
        count: 0, avgAttackerPower: 0, avgDefenderPower: 0, avgDiff: 0,
        avgSuccessProb: 0, actualSuccessRate: 0,
      };
      continue;
    }
    byAction[t] = {
      count: n,
      avgAttackerPower: actionSamples.reduce((s, x) => s + x.attackerPower, 0) / n,
      avgDefenderPower: actionSamples.reduce((s, x) => s + x.defenderPower, 0) / n,
      avgDiff: actionSamples.reduce((s, x) => s + x.diff, 0) / n,
      avgSuccessProb: actionSamples.reduce((s, x) => s + x.successProb, 0) / n,
      actualSuccessRate: actionSamples.filter(x => x.actualSuccess).length / n,
    };
  }

  const n = samples.length;
  const overallAvgAttacker = samples.reduce((s, x) => s + x.attackerPower, 0) / n;
  const overallAvgDefender = samples.reduce((s, x) => s + x.defenderPower, 0) / n;
  const overallAvgDiff = samples.reduce((s, x) => s + x.diff, 0) / n;
  const overallAvgSuccessProb = samples.reduce((s, x) => s + x.successProb, 0) / n;
  const overallActualSuccess = samples.filter(x => x.actualSuccess).length / n;

  return {
    label, matches: matchCount, byAction,
    overallAvgAttacker,
    overallAvgDefender,
    overallAvgDiff,
    overallAvgSuccessProb,
    overallActualSuccess,
  };
}

describe('Power Balance — Attacker/Defender Power Ayrıştırma', () => {
  it('HIGH-LOW başarı farkının power kaynağını bul', () => {
    console.log('\n⏳ Power balance (3 senaryo × 500 maç)...\n');

    const N = 500;

    const lowLow = runScenario('Düşük-Düşük', 10, 10, 4, N);
    const highLow = runScenario('Yüksek-Düşük', 18, 10, 4, N);
    const highHigh = runScenario('Yüksek-Yüksek', 18, 18, 4, N);

    const lines: string[] = [];
    const f2 = (v: number) => v.toFixed(2);
    const f1 = (v: number) => v.toFixed(1);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';

    const row = (label: string, a: string, b: string, c: string) => {
      lines.push(
        `║  ${label.padEnd(24)}${a.padStart(11)}${b.padStart(13)}${c.padStart(14)}   ║`
      );
    };

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║        POWER BALANCE — ATTACKER/DEFENDER POWER (500 maç × 3 senaryo)          ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  METRİK                  DÜŞÜK-DÜŞÜK  YÜKSEK-DÜŞÜK  YÜKSEK-YÜKSEK          ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    // ── Genel ──
    lines.push('║  ── GENEL (tüm aksiyonlar) ──                                                ║');
    row('Ort. attackerPower',
      f2(lowLow.overallAvgAttacker), f2(highLow.overallAvgAttacker), f2(highHigh.overallAvgAttacker));
    row('Ort. defenderPower',
      f2(lowLow.overallAvgDefender), f2(highLow.overallAvgDefender), f2(highHigh.overallAvgDefender));
    row('Ort. power farkı',
      f2(lowLow.overallAvgDiff), f2(highLow.overallAvgDiff), f2(highHigh.overallAvgDiff));
    row('Teorik başarı olasılığı',
      pct(lowLow.overallAvgSuccessProb), pct(highLow.overallAvgSuccessProb), pct(highHigh.overallAvgSuccessProb));
    row('Gerçek başarı %',
      pct(lowLow.overallActualSuccess), pct(highLow.overallActualSuccess), pct(highHigh.overallActualSuccess));

    // ── Aksiyon tipi bazlı ──
    for (const t of ACTION_TYPES) {
      lines.push(`║  ── ${t.toUpperCase()} ──${' '.repeat(76 - t.length * 2)}║`);
      const la = lowLow.byAction[t];
      const ha = highLow.byAction[t];
      const hh = highHigh.byAction[t];
      row(`  ${t} attackerPower`,
        f2(la.avgAttackerPower), f2(ha.avgAttackerPower), f2(hh.avgAttackerPower));
      row(`  ${t} defenderPower`,
        f2(la.avgDefenderPower), f2(ha.avgDefenderPower), f2(hh.avgDefenderPower));
      row(`  ${t} fark`,
        f2(la.avgDiff), f2(ha.avgDiff), f2(hh.avgDiff));
      row(`  ${t} teorik başarı`,
        pct(la.avgSuccessProb), pct(ha.avgSuccessProb), pct(hh.avgSuccessProb));
      row(`  ${t} gerçek başarı`,
        pct(la.actualSuccessRate), pct(ha.actualSuccessRate), pct(hh.actualSuccessRate));
    }

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── Kritik analiz ──
    lines.push('');
    lines.push('🔍 HIGH-LOW BAŞARI FARKI ANALİZİ');
    lines.push('');

    const homeAvgProb = highLow.overallAvgSuccessProb;
    const homeActual = highLow.overallActualSuccess;
    const lowAvgProb = lowLow.overallAvgSuccessProb;
    const lowActual = lowLow.overallActualSuccess;

    lines.push(`  LOW-LOW:`);
    lines.push(`    Teorik başarı:  ${pct(lowAvgProb)}`);
    lines.push(`    Gerçek başarı:  ${pct(lowActual)}`);
    lines.push(`    Fark:           ${((lowActual - lowAvgProb) * 100).toFixed(1)} puan`);
    lines.push('');

    lines.push(`  HIGH-LOW:`);
    lines.push(`    Teorik başarı:  ${pct(homeAvgProb)}`);
    lines.push(`    Gerçek başarı:  ${pct(homeActual)}`);
    lines.push(`    Fark:           ${((homeActual - homeAvgProb) * 100).toFixed(1)} puan`);
    lines.push('');

    // Aksiyon tipi bazlı power farkı
    lines.push('  AKSİYON TİPİ BAZINDA POWER FARKI (HIGH-LOW):');
    lines.push('');
    for (const t of ACTION_TYPES) {
      const ha = highLow.byAction[t];
      const la = lowLow.byAction[t];
      const diffChange = ha.avgDiff - la.avgDiff;
      lines.push(`    ${t.padEnd(12)}  power farkı: ${f2(ha.avgDiff).padStart(7)}  (LOW-LOW: ${f2(la.avgDiff).padStart(7)}, değişim: ${diffChange >= 0 ? '+' : ''}${f2(diffChange)})`);
    }
    lines.push('');

    // ── Yorum ──
    lines.push('📌 YORUM');
    lines.push('');

    // En büyük power farkı hangi aksiyonda?
    const sorted = [...ACTION_TYPES].sort((a, b) =>
      Math.abs(highLow.byAction[b].avgDiff) - Math.abs(highLow.byAction[a].avgDiff)
    );

    lines.push('  HIGH-LOW\'da en büyük power farkı:');
    for (const t of sorted.slice(0, 3)) {
      const ha = highLow.byAction[t];
      lines.push(`    ${t.padEnd(12)}  fark: ${f2(ha.avgDiff).padStart(7)}  (başarı: ${pct(ha.actualSuccessRate)})`);
    }
    lines.push('');

    // Aksiyon tipi başına defenderPower
    lines.push('  Defender power (HIGH-LOW):');
    for (const t of ACTION_TYPES) {
      const ha = highLow.byAction[t];
      lines.push(`    ${t.padEnd(12)}  defenderPower: ${f2(ha.avgDefenderPower)}`);
    }
    lines.push('');

    console.log(lines.join('\n'));
  }, 300000);
});