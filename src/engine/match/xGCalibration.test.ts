// src/engine/match/xGCalibration.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { eff } from './teamAnalysis';
import type { Player } from '../types';

/**
 * xG KALİBRASYON TESTİ
 *
 * Amaç: finishing / composure / technique çarpanlarının farklı
 * versiyonlarını deneyip, hedefe en yakın olanı bulmak.
 *
 * Hedef: 10/20 → 18/20 şutör farkı %15–25 arası olsun.
 * Şu an: +39.9% (çok yüksek)
 *
 * Motor koduna DOKUNMUYORUZ. Sadece bu testte alternatif formülleri
 * deniyoruz. En iyi çıkanı sonra chance.ts'e taşıyacağız.
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

interface ShooterSample {
  finishing: number;
  composure: number;
  technique: number;
}

/**
 * Bir formül versiyonu. xG'yi hesaplar (chance.ts'deki diğer çarpanlar sabit).
 */
interface XGFormula {
  name: string;
  finishingFactor: (finishing: number) => number;
  composureFactor: (composure: number) => number;
  techniqueFactor: (technique: number) => number;
}

/**
 * xG'yi hesapla — chance.ts'deki diğer tüm çarpanlar sabit tutulur.
 * distanceFactor = 0.75, pressureFactor = 0.70, angleFactor = 1.0,
 * positionMultiplier = 1.15, bigChanceBonus = 1.0
 */
function calculateXG(
  formula: XGFormula,
  sample: ShooterSample,
  baseXG = 0.20 * 0.75
): number {
  let xg = baseXG;
  xg *= formula.finishingFactor(sample.finishing);
  xg *= formula.composureFactor(sample.composure);
  xg *= formula.techniqueFactor(sample.technique);
  xg *= 1 - (60 / 100) * 0.5; // pressureFactor sabit (60 pressure)
  xg *= 1.0; // angleFactor sabit
  xg *= 1.15; // positionMultiplier sabit
  return Math.max(0.01, Math.min(0.95, xg));
}

interface FormulaResult {
  formulaName: string;
  lowXG: number;        // 10/20 şutör ortalama xG
  highXG: number;       // 18/20 şutör ortalama xG
  diffPct: number;      // xG farkı yüzdesi
  ratio: number;        // highXG / lowXG
}

function evaluateFormula(
  formula: XGFormula,
  lowSamples: ShooterSample[],
  highSamples: ShooterSample[]
): FormulaResult {
  const avgXG = (samples: ShooterSample[]) => {
    const sum = samples.reduce((s, sample) => s + calculateXG(formula, sample), 0);
    return sum / samples.length;
  };

  const lowXG = avgXG(lowSamples);
  const highXG = avgXG(highSamples);

  return {
    formulaName: formula.name,
    lowXG,
    highXG,
    diffPct: (highXG / lowXG - 1) * 100,
    ratio: highXG / lowXG,
  };
}

describe('xG Kalibrasyon Testi', () => {
  it('farklı finishing/composure/technique formüllerini karşılaştır', () => {
    console.log('\n⏳ Formül versiyonları karşılaştırılıyor (20.000 şutör × 2 kalite)...\n');

    const data = generateGameData();
    const clubList = Object.values(data.clubs);
    const home = clubList[0];
    const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);

    const shooters = homePlayers.filter(p =>
      ['ST', 'GF', 'KFL', 'KFR', 'AML', 'AMR', 'AMC', 'ML', 'MR', 'MC'].includes(p.position)
    );

    const N = 20000;

    // ── Örneklem toplama ──
    // Aynı oyuncular üzerinden iki senaryo:
    // Düşük: 10/20 seviyesinde ayarlanmış attribute'lar
    // Yüksek: 18/20 seviyesinde ayarlanmış attribute'lar
    const lowSamples: ShooterSample[] = [];
    const highSamples: ShooterSample[] = [];

    for (let i = 0; i < N; i++) {
      const shooter = shooters[Math.floor(Math.random() * shooters.length)];

      // Düşük senaryo
      setAttributeLevel(shooter, 10, 4);
      lowSamples.push({
        finishing: eff(shooter, 'finishing'),
        composure: eff(shooter, 'composure'),
        technique: eff(shooter, 'technique'),
      });

      // Yüksek senaryo
      setAttributeLevel(shooter, 18, 4);
      highSamples.push({
        finishing: eff(shooter, 'finishing'),
        composure: eff(shooter, 'composure'),
        technique: eff(shooter, 'technique'),
      });
    }

    // ── Formül versiyonları ──

    // A) Mevcut (referans)
    const formulaA: XGFormula = {
      name: 'A) Mevcut (0.7/0.6, 0.8/0.4, 0.9/0.2)',
      finishingFactor: f => 0.7 + (f / 100) * 0.6,
      composureFactor: c => 0.8 + (c / 100) * 0.4,
      techniqueFactor: t => 0.9 + (t / 100) * 0.2,
    };

    // B) Sadece finishing yumuşatıldı
    const formulaB: XGFormula = {
      name: 'B) Sadece finishing yumuşak (0.8/0.4)',
      finishingFactor: f => 0.8 + (f / 100) * 0.4,
      composureFactor: c => 0.8 + (c / 100) * 0.4,
      techniqueFactor: t => 0.9 + (t / 100) * 0.2,
    };

    // C) Sadece composure yumuşatıldı
    const formulaC: XGFormula = {
      name: 'C) Sadece composure yumuşak (0.9/0.2)',
      finishingFactor: f => 0.7 + (f / 100) * 0.6,
      composureFactor: c => 0.9 + (c / 100) * 0.2,
      techniqueFactor: t => 0.9 + (t / 100) * 0.2,
    };

    // D) Sadece technique yumuşatıldı
    const formulaD: XGFormula = {
      name: 'D) Sadece technique yumuşak (0.95/0.1)',
      finishingFactor: f => 0.7 + (f / 100) * 0.6,
      composureFactor: c => 0.8 + (c / 100) * 0.4,
      techniqueFactor: t => 0.95 + (t / 100) * 0.1,
    };

    // E) Üçü birlikte, hafif yumuşatıldı
    const formulaE: XGFormula = {
      name: 'E) Üçü birlikte hafif (0.80/0.45, 0.87/0.30, 0.93/0.15)',
      finishingFactor: f => 0.80 + (f / 100) * 0.45,
      composureFactor: c => 0.87 + (c / 100) * 0.30,
      techniqueFactor: t => 0.93 + (t / 100) * 0.15,
    };

    // F) Üçü birlikte, orta yumuşatma (HEDEF)
    const formulaF: XGFormula = {
      name: 'F) Üçü birlikte orta (0.85/0.30, 0.90/0.20, 0.95/0.10)',
      finishingFactor: f => 0.85 + (f / 100) * 0.30,
      composureFactor: c => 0.90 + (c / 100) * 0.20,
      techniqueFactor: t => 0.95 + (t / 100) * 0.10,
    };

    // G) Üçü birlikte, agresif yumuşatma
    const formulaG: XGFormula = {
      name: 'G) Üçü birlikte agresif (0.90/0.20, 0.94/0.12, 0.97/0.06)',
      finishingFactor: f => 0.90 + (f / 100) * 0.20,
      composureFactor: c => 0.94 + (c / 100) * 0.12,
      techniqueFactor: t => 0.97 + (t / 100) * 0.06,
    };

    // H) Sadece finishing, çok agresif
    const formulaH: XGFormula = {
      name: 'H) Finishing agresif (0.85/0.30), diğer sabit',
      finishingFactor: f => 0.85 + (f / 100) * 0.30,
      composureFactor: c => 0.8 + (c / 100) * 0.4,
      techniqueFactor: t => 0.9 + (t / 100) * 0.2,
    };

    const formulas = [formulaA, formulaB, formulaC, formulaD, formulaE, formulaF, formulaG, formulaH];
    const results = formulas.map(f => evaluateFormula(f, lowSamples, highSamples));

    // ── Tablo ──
    const lines: string[] = [];
    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║           xG KALİBRASYON — FORMÜL VERSİYONLARI (20.000 örneklem)             ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  FORMÜL                                          10/20    18/20    FARK    ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (const r of results) {
      const name = r.formulaName.padEnd(44);
      const low = r.lowXG.toFixed(4).padStart(8);
      const high = r.highXG.toFixed(4).padStart(8);
      const diff = (r.diffPct >= 0 ? '+' : '') + r.diffPct.toFixed(1) + '%';
      lines.push(`║  ${name}${low}${high}${diff.padStart(9)}    ║`);
    }

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── Hedef kontrolü ──
    lines.push('');
    lines.push('🎯 HEDEF: Fark %15–25 arası olmalı');
    lines.push('');

    const inTarget = results.filter(r => r.diffPct >= 15 && r.diffPct <= 25);
    if (inTarget.length > 0) {
      lines.push('✅ Hedefe giren formüller:');
      for (const r of inTarget) {
        lines.push(`   • ${r.formulaName.split(')')[0]}) fark: +${r.diffPct.toFixed(1)}%`);
      }
    } else {
      lines.push('⚠️  Hedefe giren formül yok. En yakınlar:');
      const sorted = [...results].sort((a, b) => Math.abs(a.diffPct - 20) - Math.abs(b.diffPct - 20));
      for (const r of sorted.slice(0, 3)) {
        lines.push(`   • ${r.formulaName.split(')')[0]}) fark: +${r.diffPct.toFixed(1)}%`);
      }
    }

    lines.push('');
    lines.push('📊 DETAYLI FARKLAR');
    lines.push('');
    for (const r of results) {
      const diff = (r.diffPct >= 0 ? '+' : '') + r.diffPct.toFixed(1) + '%';
      const target = r.diffPct >= 15 && r.diffPct <= 25 ? ' ✅' : '';
      lines.push(`   ${r.formulaName.split(')')[0]}) ${r.formulaName.substring(r.formulaName.indexOf(')') + 1).trim().padEnd(45)} ${diff.padStart(8)}${target}`);
    }

    lines.push('');
    lines.push('📌 YORUM');
    lines.push('');
    lines.push('  • A (mevcut) referans noktası');
    lines.push('  • B/C/D tek tek çarpanların etkisini gösterir');
    lines.push('  • E/F/G üçünün birlikte etkisini gösterir');
    lines.push('  • H finishing tek başına ne kadar etkili olduğunu gösterir');
    lines.push('');

    console.log(lines.join('\n'));
  }, 60000);
});