// src/engine/match/successFormula.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import { eff } from './teamAnalysis';
import type { Player, AttackSequenceAction } from '../types';

/**
 * SUCCESS FORMULA — BAŞARI FORMÜLÜNÜN TAM PARÇALARI
 *
 * Amaç: HIGH-LOW'da teorik başarı %60.7 iken gerçek başarı
 * neden %67.5? Aradaki +6.8 puan nereden geliyor?
 *
 * Ve: 8.7 puanlık power farkı neden 19.1 puanlık gerçek
 * başarı farkına dönüşüyor?
 *
 * Ölçülen her aksiyon için:
 *   • attackerPower, defenderPower
 *   • baseProbability (0.52 + diff/180)
 *   • zoneBonus (Attack +0.05, Defense -0.10)
 *   • tempoEffect (fast -0.03, slow +0.03)
 *   • finalProbability
 *   • actualSuccess
 *   • zone, pressure, actionType
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

function calculateDefenderPower(defender: Player | null, pressing: string): number {
  if (!defender) return 40;

  const marking = eff(defender, 'marking');
  const tackling = eff(defender, 'tackling');
  const positioning = eff(defender, 'defensivePositioning');
  const anticipation = eff(defender, 'anticipation');

  let power = marking * 0.3 + tackling * 0.3 + positioning * 0.2 + anticipation * 0.2;

  if (pressing === 'high') power += 5;
  else if (pressing === 'low') power -= 5;

  return power;
}

interface ActionSample {
  actionType: string;
  zone: string;
  pressure: number;
  attackerPower: number;
  defenderPower: number;
  baseProbability: number;
  zoneBonus: number;
  tempoEffect: number;
  finalProbability: number;
  actualSuccess: boolean;
}

const ACTION_TYPES = ['pass', 'dribble', 'cross', 'run', 'throughBall', 'recycle'] as const;
type ActionType = typeof ACTION_TYPES[number];

interface ScenarioStats {
  label: string;
  matches: number;
  samples: ActionSample[];

  // Genel
  avgAttackerPower: number;
  avgDefenderPower: number;
  avgDiff: number;
  avgBaseProb: number;
  avgZoneBonus: number;
  avgTempoEffect: number;
  avgFinalProb: number;
  actualSuccessRate: number;

  // Zone dağılımı
  attackZoneRate: number;
  defenseZoneRate: number;
  midfieldZoneRate: number;

  // Pressure dağılımı
  avgPressure: number;

  // Aksiyon tipi dağılımı
  byAction: Record<ActionType, { count: number; successRate: number; avgPressure: number; attackZoneRate: number }>;
}

function runScenario(
  label: string,
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

  const samples: ActionSample[] = [];

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

      for (const action of seq.actions) {
        if (action.action === 'carry') continue;
        if (!ACTION_TYPES.includes(action.action as ActionType)) continue;

        const actionType = action.action as ActionType;

        // Ortalama attacker/defender power (rastgele oyuncu)
        const attacker = attackXI[Math.floor(Math.random() * attackXI.length)];
        const defender = defendXI[Math.floor(Math.random() * defendXI.length)];

        const attackerPower = calculateAttackerPower(attacker, actionType);
        const pressing = 'medium';
        const defenderPower = calculateDefenderPower(defender, pressing);

        const baseProbability = 0.52 + (attackerPower - defenderPower) / 180;

        // Zone bonus
        let zoneBonus = 0;
        if (action.fromZone.includes('Attack')) zoneBonus += 0.05;
        if (action.fromZone.includes('Defense')) zoneBonus -= 0.10;

        // Tempo efekti
        let tempoEffect = 0;
        // (tempo'yu bilmiyoruz, ortalama 0 varsayıyoruz)

        let finalProbability = baseProbability + zoneBonus + tempoEffect;
        finalProbability = Math.max(0.20, Math.min(0.90, finalProbability));

        samples.push({
          actionType,
          zone: action.fromZone,
          pressure: action.defensePressure,
          attackerPower,
          defenderPower,
          baseProbability,
          zoneBonus,
          tempoEffect,
          finalProbability,
          actualSuccess: action.success,
        });
      }
    }
  }

  const n = samples.length;
  const avg = (key: keyof ActionSample) =>
    samples.reduce((s, x) => s + (x[key] as number), 0) / Math.max(1, n);

  // Zone dağılımı
  const attackZoneCount = samples.filter(s => s.zone.includes('Attack')).length;
  const defenseZoneCount = samples.filter(s => s.zone.includes('Defense')).length;
  const midfieldZoneCount = samples.filter(s => s.zone.includes('Midfield')).length;

  // Aksiyon tipi bazlı
  const byAction: Record<ActionType, any> = {} as any;
  for (const t of ACTION_TYPES) {
    const actionSamples = samples.filter(s => s.actionType === t);
    const an = actionSamples.length;
    byAction[t] = {
      count: an,
      successRate: an > 0 ? actionSamples.filter(x => x.actualSuccess).length / an : 0,
      avgPressure: an > 0 ? actionSamples.reduce((s, x) => s + x.pressure, 0) / an : 0,
      attackZoneRate: an > 0 ? actionSamples.filter(x => x.zone.includes('Attack')).length / an : 0,
    };
  }

  return {
    label, matches: matchCount, samples,
    avgAttackerPower: avg('attackerPower'),
    avgDefenderPower: avg('defenderPower'),
    avgDiff: samples.reduce((s, x) => s + x.attackerPower - x.defenderPower, 0) / Math.max(1, n),
    avgBaseProb: avg('baseProbability'),
    avgZoneBonus: avg('zoneBonus'),
    avgTempoEffect: avg('tempoEffect'),
    avgFinalProb: avg('finalProbability'),
    actualSuccessRate: samples.filter(x => x.actualSuccess).length / Math.max(1, n),
    attackZoneRate: attackZoneCount / Math.max(1, n),
    defenseZoneRate: defenseZoneCount / Math.max(1, n),
    midfieldZoneRate: midfieldZoneCount / Math.max(1, n),
    avgPressure: avg('pressure'),
    byAction,
  };
}

describe('Success Formula — Başarı Formülünün Tam Parçaları', () => {
  it('feedback loop var mı?', () => {
    console.log('\n⏳ Success formula (3 senaryo × 500 maç)...\n');

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
        `║  ${label.padEnd(26)}${a.padStart(11)}${b.padStart(13)}${c.padStart(14)}   ║`
      );
    };

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║      SUCCESS FORMULA — BAŞARI FORMÜLÜNÜN PARÇALARI (500 maç × 3 senaryo)     ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  METRİK                    DÜŞÜK-DÜŞÜK  YÜKSEK-DÜŞÜK  YÜKSEK-YÜKSEK        ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    // ── Power ──
    lines.push('║  ── POWER ──                                                                ║');
    row('attackerPower',
      f2(lowLow.avgAttackerPower), f2(highLow.avgAttackerPower), f2(highHigh.avgAttackerPower));
    row('defenderPower',
      f2(lowLow.avgDefenderPower), f2(highLow.avgDefenderPower), f2(highHigh.avgDefenderPower));
    row('Power farkı',
      f2(lowLow.avgDiff), f2(highLow.avgDiff), f2(highHigh.avgDiff));

    // ── Formül ──
    lines.push('║  ── FORMÜL PARÇALARI ──                                                     ║');
    row('baseProbability',
      pct(lowLow.avgBaseProb), pct(highLow.avgBaseProb), pct(highHigh.avgBaseProb));
    row('zoneBonus',
      pct(lowLow.avgZoneBonus), pct(highLow.avgZoneBonus), pct(highHigh.avgZoneBonus));
    row('tempoEffect',
      pct(lowLow.avgTempoEffect), pct(highLow.avgTempoEffect), pct(highHigh.avgTempoEffect));
    row('finalProbability',
      pct(lowLow.avgFinalProb), pct(highLow.avgFinalProb), pct(highHigh.avgFinalProb));
    row('GERÇEK başarı',
      pct(lowLow.actualSuccessRate), pct(highLow.actualSuccessRate), pct(highHigh.actualSuccessRate));
    row('Fark (gerçek - teorik)',
      pct(lowLow.actualSuccessRate - lowLow.avgFinalProb),
      pct(highLow.actualSuccessRate - highLow.avgFinalProb),
      pct(highHigh.actualSuccessRate - highHigh.avgFinalProb));

    // ── Zone dağılımı ──
    lines.push('║  ── ZONE DAĞILIMI ──                                                        ║');
    row('Attack zone %',
      pct(lowLow.attackZoneRate), pct(highLow.attackZoneRate), pct(highHigh.attackZoneRate));
    row('Midfield zone %',
      pct(lowLow.midfieldZoneRate), pct(highLow.midfieldZoneRate), pct(highHigh.midfieldZoneRate));
    row('Defense zone %',
      pct(lowLow.defenseZoneRate), pct(highLow.defenseZoneRate), pct(highHigh.defenseZoneRate));
    row('Ort. pressure',
      f1(lowLow.avgPressure), f1(highLow.avgPressure), f1(highHigh.avgPressure));

    // ── Aksiyon tipi ──
    lines.push('║  ── AKSİYON TİPİ BAŞARI ──                                                  ║');
    for (const t of ACTION_TYPES) {
      const la = lowLow.byAction[t];
      const ha = highLow.byAction[t];
      const hh = highHigh.byAction[t];
      row(`  ${t} başarı`,
        pct(la.successRate), pct(ha.successRate), pct(hh.successRate));
    }

    lines.push('║  ── AKSİYON TİPİ ZONE ──                                                    ║');
    for (const t of ACTION_TYPES) {
      const la = lowLow.byAction[t];
      const ha = highLow.byAction[t];
      const hh = highHigh.byAction[t];
      row(`  ${t} attack zone`,
        pct(la.attackZoneRate), pct(ha.attackZoneRate), pct(hh.attackZoneRate));
    }

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── Feedback loop analizi ──
    lines.push('');
    lines.push('🔍 FEEDBACK LOOP ANALİZİ');
    lines.push('');

    lines.push('  FORMÜL PARÇALARI (HIGH-LOW):');
    lines.push(`    baseProbability:     ${pct(highLow.avgBaseProb)}`);
    lines.push(`    zoneBonus:           ${pct(highLow.avgZoneBonus)}`);
    lines.push(`    tempoEffect:         ${pct(highLow.avgTempoEffect)}`);
    lines.push(`    finalProbability:    ${pct(highLow.avgFinalProb)}`);
    lines.push(`    GERÇEK başarı:       ${pct(highLow.actualSuccessRate)}`);
    lines.push(`    Fark:                ${((highLow.actualSuccessRate - highLow.avgFinalProb) * 100).toFixed(2)} puan`);
    lines.push('');

    // Zone etkisi
    lines.push('  ZONE BONUS ETKİSİ:');
    lines.push(`    LOW-LOW attack zone:   ${pct(lowLow.attackZoneRate)} → zoneBonus ${pct(lowLow.avgZoneBonus)}`);
    lines.push(`    HIGH-LOW attack zone:  ${pct(highLow.attackZoneRate)} → zoneBonus ${pct(highLow.avgZoneBonus)}`);
    lines.push(`    HIGH-HIGH attack zone: ${pct(highHigh.attackZoneRate)} → zoneBonus ${pct(highHigh.avgZoneBonus)}`);
    lines.push('');

    // Feedback loop kontrolü
    const llBase = lowLow.avgBaseProb;
    const hlBase = highLow.avgBaseProb;
    const llFinal = lowLow.avgFinalProb;
    const hlFinal = highLow.avgFinalProb;
    const llZone = lowLow.avgZoneBonus;
    const hlZone = highLow.avgZoneBonus;

    lines.push('  KRİTİK KARŞILAŞTIRMA:');
    lines.push(`    LOW-LOW  baseProb: ${pct(llBase)} → finalProb: ${pct(llFinal)}`);
    lines.push(`    HIGH-LOW baseProb: ${pct(hlBase)} → finalProb: ${pct(hlFinal)}`);
    lines.push('');

    const llGain = (llFinal - llBase) * 100;
    const hlGain = (hlFinal - hlBase) * 100;
    lines.push(`    LOW-LOW  zone bonus etkisi: +${llGain.toFixed(2)} puan`);
    lines.push(`    HIGH-LOW zone bonus etkisi: +${hlGain.toFixed(2)} puan`);
    lines.push('');

    if (hlGain > llGain * 1.5) {
      lines.push(`    🔴 FEEDBACK LOOP BULUNDU:`);
      lines.push(`       Yüksek kaliteli takım daha çok Attack zone'a giriyor`);
      lines.push(`       → daha çok zone bonus alıyor`);
      lines.push(`       → daha çok başarılı aksiyon`);
      lines.push(`       → daha uzun sequence`);
      lines.push(`       → daha çok Attack zone...`);
    } else if (hlGain > llGain * 1.2) {
      lines.push(`    🟡 KISMİ FEEDBACK LOOP:`);
      lines.push(`       Yüksek kaliteli takım biraz daha fazla zone bonus alıyor.`);
    } else {
      lines.push(`    ✅ Feedback loop YOK.`);
      lines.push(`       Zone bonus her iki takım için benzer.`);
    }
    lines.push('');

    // Gerçek vs teorik fark
    lines.push('  GERÇEK vs TEORİK FARK:');
    const llDiff = (lowLow.actualSuccessRate - lowLow.avgFinalProb) * 100;
    const hlDiff = (highLow.actualSuccessRate - highLow.avgFinalProb) * 100;
    const hhDiff = (highHigh.actualSuccessRate - highHigh.avgFinalProb) * 100;
    lines.push(`    LOW-LOW:  +${llDiff.toFixed(2)} puan`);
    lines.push(`    HIGH-LOW: +${hlDiff.toFixed(2)} puan`);
    lines.push(`    HIGH-HIGH:+${hhDiff.toFixed(2)} puan`);
    lines.push('');

    if (Math.abs(hlDiff - llDiff) > 2) {
      lines.push(`    🟡 Fark senaryolar arasında değişiyor.`);
      lines.push(`       Bu, başka bir mekanizmanın kalite farkına duyarlı olduğunu gösterir.`);
    } else {
      lines.push(`    ✅ Fark tüm senaryolarda benzer.`);
      lines.push(`       Bu, sabit bir ofset olduğunu gösterir (muhtemelen zone bonus).`);
    }
    lines.push('');

    console.log(lines.join('\n'));
  }, 300000);
});