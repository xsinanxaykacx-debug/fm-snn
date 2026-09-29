// src/engine/match/xGFactorBreakdown.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { eff } from './teamAnalysis';
import type { Player, AttackSequence } from '../types';

/**
 * xG FAKTÖR TEŞHİSİ
 *
 * Amaç: calculateChanceFromSequence() içindeki her çarpanın
 * kalite farkına ne kadar duyarlı olduğunu ayrı ayrı ölçmek.
 *
 * Motor koduna dokunmuyoruz. Sadece chance.ts'deki formülü
 * burada yeniden uygulayıp her çarpanı raporluyoruz.
 *
 * Senaryolar: 10/20 vs 10/20, 18/20 vs 10/20, 18/20 vs 18/20
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

interface FactorSample {
  // Girdi koşulları
  quality: number;          // chanceQuality
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

  // Son xG
  xG: number;
}

/**
 * chance.ts'deki formülü birebir kopyalar ve tüm ara çarpanları döndürür.
 * Motor koduna dokunmadan teşhis yapmamızı sağlar.
 */
function simulateChanceCalculation(
  quality: number,
  zone: string,
  pressure: number,
  shooterFinishing: number,
  shooterComposure: number,
  shooterTechnique: number,
  totalActions: number
): FactorSample {
  // ── Mesafe ──
  let distance = 25 - (quality / 100) * 19;
  if (zone === 'centerAttack') {
    distance = Math.max(6, distance - 3);
  } else if (zone === 'leftAttack' || zone === 'rightAttack') {
    distance = Math.max(8, distance);
  }
  distance = Math.max(5, Math.min(30, distance + (Math.random() - 0.5) * 4));

  // ── Açı ──
  let angle: number;
  if (zone === 'centerAttack') {
    angle = 45 + (quality / 100) * 60;
  } else {
    angle = 25 + (quality / 100) * 50;
  }
  angle = Math.max(15, Math.min(120, angle + (Math.random() - 0.5) * 15));

  // ── Mesafe faktörü ──
  let distanceFactor: number;
  if (distance <= 6) distanceFactor = 2.0;
  else if (distance <= 12) distanceFactor = 1.3;
  else if (distance <= 18) distanceFactor = 0.75;
  else if (distance <= 25) distanceFactor = 0.35;
  else distanceFactor = 0.15;

  // ── xG hesabı (chance.ts ile aynı) ──
  let xg = 0.20 * distanceFactor;

  const finishingFactor = 0.7 + (shooterFinishing / 100) * 0.6;
  const composureFactor = 0.8 + (shooterComposure / 100) * 0.4;
  const techniqueFactor = 0.9 + (shooterTechnique / 100) * 0.2;
  const pressureFactor = 1 - (pressure / 100) * 0.5;

  xg *= finishingFactor;
  xg *= composureFactor;
  xg *= techniqueFactor;
  xg *= pressureFactor;

  // ── Açı faktörü ──
  let angleFactor: number;
  if (angle > 90) angleFactor = 0.7;
  else if (angle > 70) angleFactor = 0.9;
  else if (angle > 50) angleFactor = 1.0;
  else angleFactor = 1.15;

  xg *= angleFactor;

  // ── Pozisyon çarpanı ──
  let positionMultiplier = 1.0;
  if (zone === 'leftAttack' || zone === 'rightAttack') {
    positionMultiplier = 1.15;
  } else if (totalActions >= 4) {
    positionMultiplier = 1.2;
  } else if (distance > 20) {
    positionMultiplier = 0.7;
  }
  xg *= positionMultiplier;

  // ── Big chance bonusu ──
  let bigChanceBonus = 1.0;
  if (distance <= 10 && pressure < 50 && angle > 60) {
    bigChanceBonus = 1.4;
    xg *= 1.4;
  }

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
    xG: Math.max(0.01, Math.min(0.95, xg)),
  };
}

interface ScenarioFactors {
  name: string;
  samples: number;
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
  avgXG: number;
  // Bileşik çarpan (distanceFactor hariç tüm xG çarpanları)
  avgCompositeFactor: number;
  // xG / distanceFactor
  avgXGPerDistanceFactor: number;
}

function collectSamples(
  name: string,
  shooterLevel: number,
  sequenceCount: number
): ScenarioFactors {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);

  // Forvet/kanat oyuncularını al (şut çekenler)
  const shooters = homePlayers.filter(p =>
    ['ST', 'GF', 'KFL', 'KFR', 'AML', 'AMR', 'AMC', 'ML', 'MR', 'MC'].includes(p.position)
  );

  for (const p of homePlayers) setAttributeLevel(p, shooterLevel, 4);

  const factors: FactorSample[] = [];

  for (let i = 0; i < sequenceCount; i++) {
    const shooter = shooters[Math.floor(Math.random() * shooters.length)];

    const finishing = eff(shooter, 'finishing');
    const composure = eff(shooter, 'composure');
    const technique = eff(shooter, 'technique');

    // Tipik bir sequence: quality ~40-45, zone karışık, pressure ~50-65
    const quality = 38 + Math.random() * 12; // 38-50
    const zones = ['centerAttack', 'leftAttack', 'rightAttack'];
    const zone = zones[Math.floor(Math.random() * zones.length)];
    const pressure = 45 + Math.random() * 30; // 45-75
    const totalActions = 3 + Math.floor(Math.random() * 4); // 3-6

    factors.push(
      simulateChanceCalculation(
        quality, zone, pressure,
        finishing, composure, technique,
        totalActions
      )
    );
  }

  const n = factors.length;
  const avg = (key: keyof FactorSample) =>
    factors.reduce((s, f) => s + (f[key] as number), 0) / n;

  // Bileşik çarpan: distanceFactor ve positionMultiplier hariç tüm xG çarpanları
  const avgCompositeFactor = factors.reduce((s, f) =>
    s + f.finishingFactor * f.composureFactor * f.techniqueFactor *
        f.pressureFactor * f.angleFactor * f.bigChanceBonus, 0
  ) / n;

  const avgXGPerDistanceFactor = factors.reduce((s, f) =>
    s + f.xG / f.distanceFactor, 0
  ) / n;

  return {
    name,
    samples: n,
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
    avgXG: avg('xG'),
    avgCompositeFactor,
    avgXGPerDistanceFactor,
  };
}

describe('xG Faktör Teşhisi', () => {
  it('şut başına xG sıçramasının hangi faktörden geldiğini ölç', () => {
    console.log('\n⏳ xG faktörleri ölçülüyor (3 senaryo × 20.000 sequence)...\n');

    const N = 20000;

    const low = collectSamples('Şutör 10/20', 10, N);
    const high = collectSamples('Şutör 18/20', 18, N);

    const lines: string[] = [];
    const fmt = (v: number, d = 3) => v.toFixed(d);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════╗');
    lines.push('║        xG FAKTÖR TEŞHİSİ — Şutör Kalitesi 10/20 vs 18/20             ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════╣');
    lines.push('║  FAKTÖR                     10/20        18/20        FARK           ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════╣');

    const row = (label: string, a: number, b: number, decimals = 3) => {
      const diff = a === 0 ? 'N/A' : (((b / a) - 1) * 100).toFixed(1) + '%';
      lines.push(
        `║  ${label.padEnd(26)}${fmt(a, decimals).padStart(11)}${fmt(b, decimals).padStart(13)}${diff.padStart(12)}   ║`
      );
    };

    // ── Girdi ──
    lines.push('║  ── GİRDİ ──                                                         ║');
    row('chanceQuality (ort.)', low.avgQuality, high.avgQuality, 1);
    row('distance (ort.)', low.avgDistance, high.avgDistance, 1);
    row('angle (ort.)', low.avgAngle, high.avgAngle, 1);
    row('pressure (ort.)', low.avgPressure, high.avgPressure, 1);

    // ── Ara çarpanlar ──
    lines.push('║  ── ARA ÇARPANLAR ──                                                 ║');
    row('distanceFactor', low.avgDistanceFactor, high.avgDistanceFactor, 3);
    row('finishingFactor', low.avgFinishingFactor, high.avgFinishingFactor, 4);
    row('composureFactor', low.avgComposureFactor, high.avgComposureFactor, 4);
    row('techniqueFactor', low.avgTechniqueFactor, high.avgTechniqueFactor, 4);
    row('pressureFactor', low.avgPressureFactor, high.avgPressureFactor, 4);
    row('angleFactor', low.avgAngleFactor, high.avgAngleFactor, 4);
    row('positionMultiplier', low.avgPositionMultiplier, high.avgPositionMultiplier, 4);
    row('bigChanceBonus', low.avgBigChanceBonus, high.avgBigChanceBonus, 4);

    // ── Bileşik ──
    lines.push('║  ── BİLEŞİK ──                                                       ║');
    row('compositeFactor (fin*comp*tech*press*ang*big)',
      low.avgCompositeFactor, high.avgCompositeFactor, 4);

    // ── Sonuç ──
    lines.push('║  ── SONUÇ ──                                                         ║');
    row('xG (ort.)', low.avgXG, high.avgXG, 4);
    row('xG / distanceFactor', low.avgXGPerDistanceFactor, high.avgXGPerDistanceFactor, 4);

    lines.push('╚══════════════════════════════════════════════════════════════════════╝');

    // ═══ KATKI ANALİZİ ═══
    lines.push('');
    lines.push('🔍 HER ÇARPANIN xG FARKINA KATKISI');
    lines.push('');
    lines.push('  (Bir çarpanın xG farkına katkısı = o çarpanın yüzde değişimi)');
    lines.push('');

    const contributions: [string, number][] = [
      ['distanceFactor', (high.avgDistanceFactor / low.avgDistanceFactor - 1) * 100],
      ['finishingFactor', (high.avgFinishingFactor / low.avgFinishingFactor - 1) * 100],
      ['composureFactor', (high.avgComposureFactor / low.avgComposureFactor - 1) * 100],
      ['techniqueFactor', (high.avgTechniqueFactor / low.avgTechniqueFactor - 1) * 100],
      ['pressureFactor', (high.avgPressureFactor / low.avgPressureFactor - 1) * 100],
      ['angleFactor', (high.avgAngleFactor / low.avgAngleFactor - 1) * 100],
      ['positionMultiplier', (high.avgPositionMultiplier / low.avgPositionMultiplier - 1) * 100],
      ['bigChanceBonus', (high.avgBigChanceBonus / low.avgBigChanceBonus - 1) * 100],
    ];

    contributions.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    for (const [name, contrib] of contributions) {
      const bar = '█'.repeat(Math.min(40, Math.round(Math.abs(contrib))));
      const sign = contrib >= 0 ? '+' : '';
      lines.push(`  ${name.padEnd(22)}${(sign + contrib.toFixed(1) + '%').padStart(10)}   ${bar}`);
    }

    lines.push('');
    const totalXGDiff = ((high.avgXG / low.avgXG) - 1) * 100;
    lines.push(`  TOPLAM xG farkı:        +${totalXGDiff.toFixed(1)}%`);
    lines.push('');

    // ═══ YORUM ═══
    lines.push('📌 YORUM');
    lines.push('');

    const finishingContrib = contributions.find(c => c[0] === 'finishingFactor')?.[1] ?? 0;
    const composureContrib = contributions.find(c => c[0] === 'composureFactor')?.[1] ?? 0;
    const techniqueContrib = contributions.find(c => c[0] === 'techniqueFactor')?.[1] ?? 0;
    const totalShooterContrib = finishingContrib + composureContrib + techniqueContrib;

    lines.push(`  Şutör kalite çarpanları toplam katkı: ${totalShooterContrib >= 0 ? '+' : ''}${totalShooterContrib.toFixed(1)}%`);
    lines.push(`    → finishing:  ${finishingContrib >= 0 ? '+' : ''}${finishingContrib.toFixed(1)}%`);
    lines.push(`    → composure:  ${composureContrib >= 0 ? '+' : ''}${composureContrib.toFixed(1)}%`);
    lines.push(`    → technique:  ${techniqueContrib >= 0 ? '+' : ''}${techniqueContrib.toFixed(1)}%`);
    lines.push('');

    const pressureContrib = contributions.find(c => c[0] === 'pressureFactor')?.[1] ?? 0;
    if (Math.abs(pressureContrib) > 2) {
      lines.push(`  ⚠️  pressureFactor ${pressureContrib >= 0 ? '+' : ''}${pressureContrib.toFixed(1)}% katkı yapıyor`);
      lines.push(`      → Bu beklenmeyen bir etki (basınç her iki senaryoda da benzer olmalı)`);
    } else {
      lines.push(`  ✅ pressureFactor katkısı ${pressureContrib >= 0 ? '+' : ''}${pressureContrib.toFixed(1)}% (beklenen: ~0%)`);
    }
    lines.push('');

    if (totalShooterContrib > 20) {
      lines.push(`  🔴 Şutör kalite çarpanları xG'yi çok fazla etkiliyor (${totalShooterContrib.toFixed(1)}%)`);
      lines.push(`      → Bu, "şut başına xG +38%" sıçramasının ana sebebi`);
      lines.push(`      → Çözüm: finishing/composure/technique çarpanlarını yumuşat`);
    } else if (totalShooterContrib > 10) {
      lines.push(`  🟡 Şutör kalite çarpanları xG'yi orta düzeyde etkiliyor (${totalShooterContrib.toFixed(1)}%)`);
      lines.push(`      → Diğer faktörler de (pressure, angle) incelenmeli`);
    } else {
      lines.push(`  ✅ Şutör kalite çarpanları xG'yi az etkiliyor (${totalShooterContrib.toFixed(1)}%)`);
      lines.push(`      → Sıçramanın sebebi başka bir yerde`);
    }

    lines.push('');

    console.log(lines.join('\n'));
  }, 120000);
});