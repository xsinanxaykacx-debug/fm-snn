// src/engine/match/xGDecomposition.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import { eff } from './teamAnalysis';
import type { Player, AttackSequence } from '../types';

/**
 * xG BİLEŞEN AYRIŞTIRMA — GERÇEK MAÇ MOTORU
 *
 * Amaç: ACTION_SUCCESS_DIVISOR = 180 ile gerçek maçlarda
 * xG/şut farkının hangi bileşenden geldiğini bulmak.
 *
 * Bileşenler:
 *   distanceFactor, finishingFactor, composureFactor, techniqueFactor,
 *   pressureFactor, angleFactor, positionMultiplier, bigChanceBonus
 *
 * Her maçta üretilen her şut için bu bileşenleri hesaplıyoruz.
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

interface XGSample {
  // Girdi
  quality: number;
  distance: number;
  angle: number;
  pressure: number;

  // Ara çarpanlar
  distanceFactor: number;
  finishingFactor: number;
  composureFactor: number;
  techniqueFactor: number;
  pressureFactor: number;
  angleFactor: number;
  positionMultiplier: number;
  bigChanceBonus: number;

  // xG hesabı
  baseXG: number;          // 0.20 * distanceFactor
  xGAfterFinishing: number;
  xGAfterComposure: number;
  xGAfterTechnique: number;
  xGAfterPressure: number;
  xGAfterAngle: number;
  xGAfterPosition: number;
  xGAfterBigChance: number;
  finalXG: number;

  // Sonuç
  isGoal: boolean;
}

/**
 * chance.ts'deki formülü birebir kopyalar.
 * Bu, motor koduna dokunmadan teşhis yapmamızı sağlar.
 */
function decomposeShot(
  sequence: AttackSequence,
  shooter: Player
): XGSample {
  const quality = Math.max(0, Math.min(100, sequence.chanceQuality));
  let distance = 25 - (quality / 100) * 19;

  if (sequence.finalZone === 'centerAttack') {
    distance = Math.max(6, distance - 3);
  } else if (sequence.finalZone === 'leftAttack' || sequence.finalZone === 'rightAttack') {
    distance = Math.max(8, distance);
  }
  distance = Math.max(5, Math.min(30, distance + (Math.random() - 0.5) * 4));

  let angle: number;
  if (sequence.finalZone === 'centerAttack') {
    angle = 45 + (quality / 100) * 60;
  } else {
    angle = 25 + (quality / 100) * 50;
  }
  angle = Math.max(15, Math.min(120, angle + (Math.random() - 0.5) * 15));

  const pressure = Math.max(10, Math.min(95, sequence.finalPressure));

  const finishing = eff(shooter, 'finishing');
  const composure = eff(shooter, 'composure');
  const technique = eff(shooter, 'technique');

  let distanceFactor: number;
  if (distance <= 6) distanceFactor = 2.0;
  else if (distance <= 12) distanceFactor = 1.3;
  else if (distance <= 18) distanceFactor = 0.75;
  else if (distance <= 25) distanceFactor = 0.35;
  else distanceFactor = 0.15;

  const baseXG = 0.20 * distanceFactor;

  const finishingFactor = 0.85 + (finishing / 100) * 0.30;
  const composureFactor = 0.90 + (composure / 100) * 0.20;
  const techniqueFactor = 0.95 + (technique / 100) * 0.10;
  const pressureFactor = 1 - (pressure / 100) * 0.5;

  let xg = baseXG;
  const xGAfterFinishing = xg * finishingFactor;
  xg = xGAfterFinishing;
  const xGAfterComposure = xg * composureFactor;
  xg = xGAfterComposure;
  const xGAfterTechnique = xg * techniqueFactor;
  xg = xGAfterTechnique;
  const xGAfterPressure = xg * pressureFactor;
  xg = xGAfterPressure;

  let angleFactor: number;
  if (angle > 90) angleFactor = 0.7;
  else if (angle > 70) angleFactor = 0.9;
  else if (angle > 50) angleFactor = 1.0;
  else angleFactor = 1.15;

  const xGAfterAngle = xg * angleFactor;
  xg = xGAfterAngle;

  let positionMultiplier = 1.0;
  if (sequence.finalZone === 'leftAttack' || sequence.finalZone === 'rightAttack') {
    positionMultiplier = 1.15;
  } else if (sequence.totalActions >= 4) {
    positionMultiplier = 1.2;
  } else if (distance > 20) {
    positionMultiplier = 0.7;
  }

  const xGAfterPosition = xg * positionMultiplier;
  xg = xGAfterPosition;

  let bigChanceBonus = 1.0;
  if (distance <= 10 && pressure < 50 && angle > 60) {
    bigChanceBonus = 1.4;
    xg *= 1.4;
  }

  const finalXG = Math.max(0.01, Math.min(0.95, xg));

  return {
    quality,
    distance,
    angle,
    pressure,
    distanceFactor,
    finishingFactor,
    composureFactor,
    techniqueFactor,
    pressureFactor,
    angleFactor,
    positionMultiplier,
    bigChanceBonus,
    baseXG,
    xGAfterFinishing,
    xGAfterComposure,
    xGAfterTechnique,
    xGAfterPressure,
    xGAfterAngle,
    xGAfterPosition,
    xGAfterBigChance: xg,
    finalXG,
    isGoal: false,
  };
}

interface ScenarioDecomposition {
  name: string;
  matches: number;
  shots: number;
  avgQuality: number;
  avgDistance: number;
  avgAngle: number;
  avgPressure: number;
  avgDistanceFactor: number;
  avgFinishingFactor: number;
  avgComposureFactor: number;
  avgTechniqueFactor: number;
  avgPressureFactor: number;
  avgAngleFactor: number;
  avgPositionMultiplier: number;
  avgBigChanceBonus: number;
  avgBaseXG: number;
  avgXGAfterFinishing: number;
  avgXGAfterComposure: number;
  avgXGAfterTechnique: number;
  avgXGAfterPressure: number;
  avgXGAfterAngle: number;
  avgXGAfterPosition: number;
  avgFinalXG: number;
  avgCompositeQualityFactor: number; // fin * comp * tech
}

function runScenario(
  name: string,
  homeQuality: number,
  awayQuality: number,
  spread: number,
  matchCount: number
): ScenarioDecomposition {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  const samples: XGSample[] = [];

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

    // Her sequence'ı şut olarak decompose et
    // (matchEngine'de her sequence'ın şut olup olmadığını bilmiyoruz,
    //  o yüzden tüm sequence'ları örnekliyoruz)
    for (const seq of match.sequences) {
      // Rastgele bir şutör seç (gerçekte matchEngine pickShooter kullanıyor)
      const allPlayers = [...homePlayers, ...awayPlayers];
      const shooter = allPlayers[Math.floor(Math.random() * allPlayers.length)];

      samples.push(decomposeShot(seq, shooter));
    }
  }

  const n = samples.length;
  const avg = (key: keyof XGSample) =>
    samples.reduce((s, x) => s + (x[key] as number), 0) / n;

  const avgCompositeQualityFactor = samples.reduce((s, x) =>
    s + x.finishingFactor * x.composureFactor * x.techniqueFactor, 0
  ) / n;

  return {
    name,
    matches: matchCount,
    shots: n,
    avgQuality: avg('quality'),
    avgDistance: avg('distance'),
    avgAngle: avg('angle'),
    avgPressure: avg('pressure'),
    avgDistanceFactor: avg('distanceFactor'),
    avgFinishingFactor: avg('finishingFactor'),
    avgComposureFactor: avg('composureFactor'),
    avgTechniqueFactor: avg('techniqueFactor'),
    avgPressureFactor: avg('pressureFactor'),
    avgAngleFactor: avg('angleFactor'),
    avgPositionMultiplier: avg('positionMultiplier'),
    avgBigChanceBonus: avg('bigChanceBonus'),
    avgBaseXG: avg('baseXG'),
    avgXGAfterFinishing: avg('xGAfterFinishing'),
    avgXGAfterComposure: avg('xGAfterComposure'),
    avgXGAfterTechnique: avg('xGAfterTechnique'),
    avgXGAfterPressure: avg('xGAfterPressure'),
    avgXGAfterAngle: avg('xGAfterAngle'),
    avgXGAfterPosition: avg('xGAfterPosition'),
    avgFinalXG: avg('finalXG'),
    avgCompositeQualityFactor,
  };
}

describe('xG Bileşen Ayrıştırma — Gerçek Maç', () => {
  it('xG/şut farkının hangi bileşenden geldiğini ölç', () => {
    console.log('\n⏳ xG decomposition (3 senaryo × 500 maç)...\n');

    const N = 500;

    const lowLow = runScenario('Düşük-Düşük', 10, 10, 4, N);
    const highLow = runScenario('Yüksek-Düşük', 18, 10, 4, N);
    const highHigh = runScenario('Yüksek-Yüksek', 18, 18, 4, N);

    const lines: string[] = [];
    const f4 = (v: number) => v.toFixed(4);
    const f3 = (v: number) => v.toFixed(3);
    const f1 = (v: number) => v.toFixed(1);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';
    const pctDiff = (a: number, b: number) => {
      if (a === 0) return 'N/A';
      const d = ((b / a) - 1) * 100;
      return (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
    };

    const row = (label: string, a: string, b: string, c: string, diff: string) => {
      lines.push(
        `║  ${label.padEnd(24)}${a.padStart(11)}${b.padStart(13)}${c.padStart(14)}${diff.padStart(11)}   ║`
      );
    };

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║     xG BİLEŞEN AYRIŞTIRMA — GERÇEK MAÇ MOTORU (ACTION_SUCCESS_DIVISOR=180)   ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  METRİK                  DÜŞÜK-DÜŞÜK  YÜKSEK-DÜŞÜK  YÜKSEK-YÜKSEK   Y/D     ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    // ── Girdi ──
    lines.push('║  ── GİRDİ ──                                                                 ║');
    row('chanceQuality',
      f1(lowLow.avgQuality), f1(highLow.avgQuality), f1(highHigh.avgQuality),
      pctDiff(lowLow.avgQuality, highLow.avgQuality));
    row('distance',
      f1(lowLow.avgDistance), f1(highLow.avgDistance), f1(highHigh.avgDistance),
      pctDiff(lowLow.avgDistance, highLow.avgDistance));
    row('angle',
      f1(lowLow.avgAngle), f1(highLow.avgAngle), f1(highHigh.avgAngle),
      pctDiff(lowLow.avgAngle, highLow.avgAngle));
    row('pressure',
      f1(lowLow.avgPressure), f1(highLow.avgPressure), f1(highHigh.avgPressure),
      pctDiff(lowLow.avgPressure, highLow.avgPressure));

    // ── Ara çarpanlar ──
    lines.push('║  ── ARA ÇARPANLAR ──                                                         ║');
    row('distanceFactor',
      f3(lowLow.avgDistanceFactor), f3(highLow.avgDistanceFactor), f3(highHigh.avgDistanceFactor),
      pctDiff(lowLow.avgDistanceFactor, highLow.avgDistanceFactor));
    row('finishingFactor',
      f4(lowLow.avgFinishingFactor), f4(highLow.avgFinishingFactor), f4(highHigh.avgFinishingFactor),
      pctDiff(lowLow.avgFinishingFactor, highLow.avgFinishingFactor));
    row('composureFactor',
      f4(lowLow.avgComposureFactor), f4(highLow.avgComposureFactor), f4(highHigh.avgComposureFactor),
      pctDiff(lowLow.avgComposureFactor, highLow.avgComposureFactor));
    row('techniqueFactor',
      f4(lowLow.avgTechniqueFactor), f4(highLow.avgTechniqueFactor), f4(highHigh.avgTechniqueFactor),
      pctDiff(lowLow.avgTechniqueFactor, highLow.avgTechniqueFactor));
    row('pressureFactor',
      f4(lowLow.avgPressureFactor), f4(highLow.avgPressureFactor), f4(highHigh.avgPressureFactor),
      pctDiff(lowLow.avgPressureFactor, highLow.avgPressureFactor));
    row('angleFactor',
      f4(lowLow.avgAngleFactor), f4(highLow.avgAngleFactor), f4(highHigh.avgAngleFactor),
      pctDiff(lowLow.avgAngleFactor, highLow.avgAngleFactor));
    row('positionMultiplier',
      f4(lowLow.avgPositionMultiplier), f4(highLow.avgPositionMultiplier), f4(highHigh.avgPositionMultiplier),
      pctDiff(lowLow.avgPositionMultiplier, highLow.avgPositionMultiplier));
    row('bigChanceBonus',
      f4(lowLow.avgBigChanceBonus), f4(highLow.avgBigChanceBonus), f4(highHigh.avgBigChanceBonus),
      pctDiff(lowLow.avgBigChanceBonus, highLow.avgBigChanceBonus));

    // ── Bileşik kalite çarpanı ──
    lines.push('║  ── BİLEŞİK KALİTE ──                                                        ║');
    row('fin * comp * tech',
      f4(lowLow.avgCompositeQualityFactor), f4(highLow.avgCompositeQualityFactor), f4(highHigh.avgCompositeQualityFactor),
      pctDiff(lowLow.avgCompositeQualityFactor, highLow.avgCompositeQualityFactor));

    // ── xG zinciri ──
    lines.push('║  ── xG ZİNCİRİ ──                                                            ║');
    row('baseXG (0.20*df)',
      f4(lowLow.avgBaseXG), f4(highLow.avgBaseXG), f4(highHigh.avgBaseXG),
      pctDiff(lowLow.avgBaseXG, highLow.avgBaseXG));
    row('+ finishing',
      f4(lowLow.avgXGAfterFinishing), f4(highLow.avgXGAfterFinishing), f4(highHigh.avgXGAfterFinishing),
      pctDiff(lowLow.avgXGAfterFinishing, highLow.avgXGAfterFinishing));
    row('+ composure',
      f4(lowLow.avgXGAfterComposure), f4(highLow.avgXGAfterComposure), f4(highHigh.avgXGAfterComposure),
      pctDiff(lowLow.avgXGAfterComposure, highLow.avgXGAfterComposure));
    row('+ technique',
      f4(lowLow.avgXGAfterTechnique), f4(highLow.avgXGAfterTechnique), f4(highHigh.avgXGAfterTechnique),
      pctDiff(lowLow.avgXGAfterTechnique, highLow.avgXGAfterTechnique));
    row('+ pressure',
      f4(lowLow.avgXGAfterPressure), f4(highLow.avgXGAfterPressure), f4(highHigh.avgXGAfterPressure),
      pctDiff(lowLow.avgXGAfterPressure, highLow.avgXGAfterPressure));
    row('+ angle',
      f4(lowLow.avgXGAfterAngle), f4(highLow.avgXGAfterAngle), f4(highHigh.avgXGAfterAngle),
      pctDiff(lowLow.avgXGAfterAngle, highLow.avgXGAfterAngle));
    row('+ position',
      f4(lowLow.avgXGAfterPosition), f4(highLow.avgXGAfterPosition), f4(highHigh.avgXGAfterPosition),
      pctDiff(lowLow.avgXGAfterPosition, highLow.avgXGAfterPosition));
    row('FINAL xG',
      f4(lowLow.avgFinalXG), f4(highLow.avgFinalXG), f4(highHigh.avgFinalXG),
      pctDiff(lowLow.avgFinalXG, highLow.avgFinalXG));

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── Katkı analizi ──
    lines.push('');
    lines.push('🔍 HER BİLEŞENİN xG FARKINA KATKISI (HIGH-LOW / LOW-LOW)');
    lines.push('');

    const contributions: [string, number][] = [
      ['distanceFactor', (highLow.avgDistanceFactor / lowLow.avgDistanceFactor - 1) * 100],
      ['finishingFactor', (highLow.avgFinishingFactor / lowLow.avgFinishingFactor - 1) * 100],
      ['composureFactor', (highLow.avgComposureFactor / lowLow.avgComposureFactor - 1) * 100],
      ['techniqueFactor', (highLow.avgTechniqueFactor / lowLow.avgTechniqueFactor - 1) * 100],
      ['pressureFactor', (highLow.avgPressureFactor / lowLow.avgPressureFactor - 1) * 100],
      ['angleFactor', (highLow.avgAngleFactor / lowLow.avgAngleFactor - 1) * 100],
      ['positionMultiplier', (highLow.avgPositionMultiplier / lowLow.avgPositionMultiplier - 1) * 100],
      ['bigChanceBonus', (highLow.avgBigChanceBonus / lowLow.avgBigChanceBonus - 1) * 100],
    ];

    contributions.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    for (const [name, contrib] of contributions) {
      const bar = '█'.repeat(Math.min(40, Math.round(Math.abs(contrib))));
      const sign = contrib >= 0 ? '+' : '';
      lines.push(`  ${name.padEnd(22)}${(sign + contrib.toFixed(1) + '%').padStart(10)}   ${bar}`);
    }

    lines.push('');
    const totalXGDiff = ((highLow.avgFinalXG / lowLow.avgFinalXG) - 1) * 100;
    lines.push(`  TOPLAM xG farkı:        +${totalXGDiff.toFixed(1)}%`);
    lines.push('');

    // ── Yorum ──
    lines.push('📌 YORUM');
    lines.push('');

    const qualityContrib =
      contributions.filter(c => ['finishingFactor', 'composureFactor', 'techniqueFactor'].includes(c[0]))
        .reduce((s, c) => s + c[1], 0);

    lines.push(`  Kalite çarpanları (fin+comp+tech) toplam: ${qualityContrib >= 0 ? '+' : ''}${qualityContrib.toFixed(1)}%`);
    lines.push(`  distanceFactor:   ${contributions.find(c => c[0] === 'distanceFactor')?.[1].toFixed(1)}%`);
    lines.push(`  pressureFactor:   ${contributions.find(c => c[0] === 'pressureFactor')?.[1].toFixed(1)}%`);
    lines.push(`  angleFactor:      ${contributions.find(c => c[0] === 'angleFactor')?.[1].toFixed(1)}%`);
    lines.push(`  positionMultiplier: ${contributions.find(c => c[0] === 'positionMultiplier')?.[1].toFixed(1)}%`);
    lines.push(`  bigChanceBonus:   ${contributions.find(c => c[0] === 'bigChanceBonus')?.[1].toFixed(1)}%`);
    lines.push('');

    console.log(lines.join('\n'));
  }, 300000);
});