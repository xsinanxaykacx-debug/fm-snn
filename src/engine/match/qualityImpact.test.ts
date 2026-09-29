// src/engine/match/qualityImpact.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import { eff } from './teamAnalysis';
import type { Player } from '../types';

/**
 * KATMAN 1 — OYUNCU KALİTESİ ETKİSİ (GENİŞLETİLMİŞ TEŞHİS)
 *
 * Amaç: Kalite farkının motordaki hangi halkadan geçtiğini ve
 * nerede büyüdüğünü görmek.
 *
 * Zincir:
 *   attribute kalitesi
 *     ↓
 *   aksiyon başarı oranı
 *     ↓
 *   possession
 *     ↓
 *   sequence uzunluğu
 *     ↓
 *   chanceQuality
 *     ↓
 *   şut olasılığı
 *     ↓
 *   xG
 *     ↓
 *   isabetli şut
 *     ↓
 *   gol
 *
 * Her halkayı ayrı ölçüyoruz.
 */

function clampAttr(v: number): number {
  return Math.max(1, Math.min(20, Math.round(v)));
}

function setAttributeLevel(player: Player, target: number, spread: number): void {
  const attrs = player.attributes as unknown as Record<string, number>;
  for (const key in attrs) {
    if (
      key === 'goalkeeper' ||
      key === 'reflexes' ||
      key === 'gkPositioning' ||
      key === 'handling' ||
      key === 'oneOnOne' ||
      key === 'aerialReach'
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

interface ScenarioResult {
  name: string;
  matches: number;

  // Zincirin her halkası
  avgPassingAttr: number;
  avgFinishingAttr: number;
  avgDefendingAttr: number;

  // Sequence istatistikleri
  sequences: number;
  totalActions: number;
  avgSequenceLength: number;

  // Sequence içi metrikler
  avgChanceQuality: number;
  avgFinalPressure: number;
  avgSpaceCreated: number;

  // Pas / aksiyon istatistikleri
  totalPasses: number;
  totalPassesCompleted: number;
  passSuccessRate: number;

  // Şut istatistikleri
  shots: number;
  shotsOnTarget: number;
  goals: number;
  xG: number;

  // Possession
  totalPossession: number;

  // Maç sonucu
  wins: number;
  draws: number;
  losses: number;
}

function runScenario(
  name: string,
  homeQuality: number,
  awayQuality: number,
  spread: number,
  matchCount: number
): ScenarioResult {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  const result: ScenarioResult = {
    name,
    matches: 0,
    avgPassingAttr: 0,
    avgFinishingAttr: 0,
    avgDefendingAttr: 0,
    sequences: 0,
    totalActions: 0,
    avgSequenceLength: 0,
    avgChanceQuality: 0,
    avgFinalPressure: 0,
    avgSpaceCreated: 0,
    totalPasses: 0,
    totalPassesCompleted: 0,
    passSuccessRate: 0,
    shots: 0,
    shotsOnTarget: 0,
    goals: 0,
    xG: 0,
    totalPossession: 0,
    wins: 0,
    draws: 0,
    losses: 0,
  };

  let cqSum = 0;
  let cqCount = 0;
  let pressureSum = 0;
  let spaceSum = 0;
  let seqLengthSum = 0;

  for (let i = 0; i < matchCount; i++) {
    // Her maçtan önce sıfırla ve attribute'ları ayarla
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

    // İlk maçta attribute ortalamalarını örnekle
    if (i === 0) {
      let passSum = 0, finSum = 0, defSum = 0, n = 0;
      for (const p of [...homePlayers, ...awayPlayers]) {
        passSum += eff(p, 'passing');
        finSum += eff(p, 'finishing');
        defSum += eff(p, 'marking');
        n++;
      }
      result.avgPassingAttr = passSum / n;
      result.avgFinishingAttr = finSum / n;
      result.avgDefendingAttr = defSum / n;
    }

    const match = simulateMatch(home, away, data.players, 1);
    result.matches++;

    result.goals += match.homeScore + match.awayScore;
    result.xG += match.stats.xG.home + match.stats.xG.away;
    result.shots += match.stats.shots.home + match.stats.shots.away;
    result.shotsOnTarget += match.stats.onTarget.home + match.stats.onTarget.away;
    result.totalPasses += match.stats.passes.home + match.stats.passes.away;
    result.totalPassesCompleted += match.stats.passesCompleted.home + match.stats.passesCompleted.away;

    const totalPoss = match.stats.possession.home + match.stats.possession.away;
    if (totalPoss > 0) {
      result.totalPossession += (match.stats.possession.home / totalPoss) * 100;
    }

    for (const seq of match.sequences) {
      result.sequences++;
      result.totalActions += seq.actions.length;
      seqLengthSum += seq.actions.length;
      cqSum += seq.chanceQuality;
      cqCount++;
      pressureSum += seq.finalPressure;
      spaceSum += seq.spaceCreated;
    }

    if (match.homeScore > match.awayScore) result.wins++;
    else if (match.homeScore === match.awayScore) result.draws++;
    else result.losses++;
  }

  result.avgSequenceLength = seqLengthSum / Math.max(1, result.sequences);
  result.avgChanceQuality = cqSum / Math.max(1, cqCount);
  result.avgFinalPressure = pressureSum / Math.max(1, cqCount);
  result.avgSpaceCreated = spaceSum / Math.max(1, cqCount);
  result.passSuccessRate = result.totalPassesCompleted / Math.max(1, result.totalPasses);

  return result;
}

describe('Katman 1 — Oyuncu Kalitesi Etkisi (Teşhis)', () => {
  it('kalite zincirinin her halkasını ölç', () => {
    console.log('\n⏳ Kalite zinciri ölçülüyor (3 senaryo × 1000 maç)...\n');

    const N = 1000;

    const lowLow = runScenario('Düşük-Düşük (10 vs 10)', 10, 10, 4, N);
    const highLow = runScenario('Yüksek-Düşük (18 vs 10)', 18, 10, 4, N);
    const highHigh = runScenario('Yüksek-Yüksek (18 vs 18)', 18, 18, 4, N);

    const lines: string[] = [];

    const fmt = (v: number, d = 2) => v.toFixed(d);

    const row = (
      label: string,
      a: string,
      b: string,
      c: string
    ) => {
      lines.push(
        `║  ${label.padEnd(26)}${a.padStart(12)}${b.padStart(14)}${c.padStart(14)}   ║`
      );
    };

    // ═══ ZİNCİR: ATTRIBUTE ═══
    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════╗');
    lines.push('║        KATMAN 1 — KALİTE ZİNCİRİ TEŞHİSİ (1000 maç × 3 senaryo)          ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  HALK A: ATTRIBUTE (eff ölçeği 20-95)                                    ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  METRİK                    DÜŞÜK-DÜŞÜK   YÜKSEK-DÜŞÜK   YÜKSEK-YÜKSEK   ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════╣');

    row('Ort. passing (eff)',
      fmt(lowLow.avgPassingAttr, 1),
      fmt(highLow.avgPassingAttr, 1),
      fmt(highHigh.avgPassingAttr, 1));
    row('Ort. finishing (eff)',
      fmt(lowLow.avgFinishingAttr, 1),
      fmt(highLow.avgFinishingAttr, 1),
      fmt(highHigh.avgFinishingAttr, 1));
    row('Ort. marking (eff)',
      fmt(lowLow.avgDefendingAttr, 1),
      fmt(highLow.avgDefendingAttr, 1),
      fmt(highHigh.avgDefendingAttr, 1));

    // ═══ ZİNCİR: AKSİYON ═══
    lines.push('╠══════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  HALKA B: AKSİYON VE SEQUENCE                                            ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════╣');

    row('Sequence / maç',
      fmt(lowLow.sequences / lowLow.matches, 1),
      fmt(highLow.sequences / highLow.matches, 1),
      fmt(highHigh.sequences / highHigh.matches, 1));
    row('Aksiyon / sequence',
      fmt(lowLow.avgSequenceLength),
      fmt(highLow.avgSequenceLength),
      fmt(highHigh.avgSequenceLength));
    row('Pas / maç',
      fmt(lowLow.totalPasses / lowLow.matches, 1),
      fmt(highLow.totalPasses / highLow.matches, 1),
      fmt(highHigh.totalPasses / highHigh.matches, 1));
    row('Pas isabet %',
      fmt(lowLow.passSuccessRate * 100, 1) + '%',
      fmt(highLow.passSuccessRate * 100, 1) + '%',
      fmt(highHigh.passSuccessRate * 100, 1) + '%');

    // ═══ ZİNCİR: SEQUENCE KALİTESİ ═══
    lines.push('╠══════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  HALKA C: SEQUENCE KALİTESİ                                              ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════╣');

    row('Ort. chanceQuality',
      fmt(lowLow.avgChanceQuality, 1),
      fmt(highLow.avgChanceQuality, 1),
      fmt(highHigh.avgChanceQuality, 1));
    row('Ort. finalPressure',
      fmt(lowLow.avgFinalPressure, 1),
      fmt(highLow.avgFinalPressure, 1),
      fmt(highHigh.avgFinalPressure, 1));
    row('Ort. spaceCreated',
      fmt(lowLow.avgSpaceCreated, 1),
      fmt(highLow.avgSpaceCreated, 1),
      fmt(highHigh.avgSpaceCreated, 1));

    // ═══ ZİNCİR: ŞUT ═══
    lines.push('╠══════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  HALKA D: ŞUT VE xG                                                      ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════╣');

    row('Şut / maç',
      fmt(lowLow.shots / lowLow.matches, 1),
      fmt(highLow.shots / highLow.matches, 1),
      fmt(highHigh.shots / highHigh.matches, 1));
    row('İsabetli şut / maç',
      fmt(lowLow.shotsOnTarget / lowLow.matches, 1),
      fmt(highLow.shotsOnTarget / highLow.matches, 1),
      fmt(highHigh.shotsOnTarget / highHigh.matches, 1));
    row('İsabetli şut %',
      fmt(lowLow.shotsOnTarget / lowLow.shots * 100, 1) + '%',
      fmt(highLow.shotsOnTarget / highLow.shots * 100, 1) + '%',
      fmt(highHigh.shotsOnTarget / highHigh.shots * 100, 1) + '%');
    row('xG / maç',
      fmt(lowLow.xG / lowLow.matches, 2),
      fmt(highLow.xG / highLow.matches, 2),
      fmt(highHigh.xG / highHigh.matches, 2));
    row('Şut başına xG',
      fmt(lowLow.xG / Math.max(1, lowLow.shots), 3),
      fmt(highLow.xG / Math.max(1, highLow.shots), 3),
      fmt(highHigh.xG / Math.max(1, highHigh.shots), 3));

    // ═══ ZİNCİR: GOL ═══
    lines.push('╠══════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  HALKA E: GOL VE SONUÇ                                                   ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════╣');

    row('Gol / maç',
      fmt(lowLow.goals / lowLow.matches, 2),
      fmt(highLow.goals / highLow.matches, 2),
      fmt(highHigh.goals / highHigh.matches, 2));
    row('Gol / xG',
      fmt(lowLow.goals / Math.max(1, lowLow.xG), 2),
      fmt(highLow.goals / Math.max(1, highLow.xG), 2),
      fmt(highHigh.goals / Math.max(1, highHigh.xG), 2));
    row('Ev possession %',
      fmt(lowLow.totalPossession / lowLow.matches, 1) + '%',
      fmt(highLow.totalPossession / highLow.matches, 1) + '%',
      fmt(highHigh.totalPossession / highHigh.matches, 1) + '%');
    row('Ev kazanma %',
      fmt(lowLow.wins / lowLow.matches * 100, 1) + '%',
      fmt(highLow.wins / highLow.matches * 100, 1) + '%',
      fmt(highHigh.wins / highHigh.matches * 100, 1) + '%');
    row('Beraberlik %',
      fmt(lowLow.draws / lowLow.matches * 100, 1) + '%',
      fmt(highLow.draws / highLow.matches * 100, 1) + '%',
      fmt(highHigh.draws / highHigh.matches * 100, 1) + '%');
    row('Ev kaybetme %',
      fmt(lowLow.losses / lowLow.matches * 100, 1) + '%',
      fmt(highLow.losses / highLow.matches * 100, 1) + '%',
      fmt(highHigh.losses / highHigh.matches * 100, 1) + '%');

    lines.push('╚══════════════════════════════════════════════════════════════════════════╝');

    // ═══ ZİNCİR ANALİZİ ═══
    lines.push('');
    lines.push('🔍 ZİNCİR BÜYÜME ANALİZİ (Yüksek-Düşük / Düşük-Düşük oranı)');
    lines.push('');

    const ratio = (a: number, b: number) =>
      b === 0 ? 'N/A' : ((a / b - 1) * 100).toFixed(1) + '%';

    const r = (label: string, v: string) => {
      lines.push(`  ${label.padEnd(30)}${v}`);
    };

    r('Pas isabet oranı farkı:',
      ratio(highLow.passSuccessRate, lowLow.passSuccessRate));
    r('Aksiyon/sequence farkı:',
      ratio(highLow.avgSequenceLength, lowLow.avgSequenceLength));
    r('ChanceQuality farkı:',
      ratio(highLow.avgChanceQuality, lowLow.avgChanceQuality));
    r('Şut/maç farkı:',
      ratio(highLow.shots / highLow.matches, lowLow.shots / lowLow.matches));
    r('Şut başına xG farkı:',
      ratio(highLow.xG / highLow.shots, lowLow.xG / lowLow.shots));
    r('xG/maç farkı:',
      ratio(highLow.xG / highLow.matches, lowLow.xG / lowLow.matches));
    r('Gol/maç farkı:',
      ratio(highLow.goals / highLow.matches, lowLow.goals / lowLow.matches));
    r('Ev kazanma % farkı:',
      ratio(highLow.wins / highLow.matches, lowLow.wins / lowLow.matches));

    lines.push('');
    lines.push('📌 YORUM İÇİN İPUÇLARI');
    lines.push('');
    lines.push('  • Pas isabet farkı büyükse → aksiyon başarısı kaliteye çok duyarlı');
    lines.push('  • ChanceQuality farkı büyükse → sequence kalitesi kaliteye çok duyarlı');
    lines.push('  • Şut başına xG farkı büyükse → finishing kaliteye çok duyarlı');
    lines.push('  • Şut/maç farkı büyükse → şut olasılığı kaliteye çok duyarlı');
    lines.push('  • Gol/xG farkı büyükse → kaleci/gol dönüşümü kaliteye çok duyarlı');
    lines.push('');

    console.log(lines.join('\n'));
  }, 180000); // 3 dakika timeout
});