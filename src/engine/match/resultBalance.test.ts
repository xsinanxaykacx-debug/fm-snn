// src/engine/match/resultBalance.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import type { Player } from '../types';

/**
 * RESULT BALANCE — EV/DEPLASMAN AYRIŞTIRMA
 *
 * Amaç: HIGH-LOW'daki %90.3 ev kazanma neden oluşuyor?
 * Home ve away metriklerini ayrı ayrı ölç.
 *
 * Eğer away xG çok düşükse → savunma/pozisyon üretimi sorunu
 * Eğer away xG normal ama gol dönüşümü düşükse → gol çözümleme sorunu
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

interface BalanceStats {
  label: string;
  matches: number;

  // Home
  homeShots: number;
  homeOnTarget: number;
  homeXG: number;
  homeGoals: number;
  homePossession: number;
  homePasses: number;
  homePassesCompleted: number;
  homeRecoveries: number;

  // Away
  awayShots: number;
  awayOnTarget: number;
  awayXG: number;
  awayGoals: number;
  awayPossession: number;
  awayPasses: number;
  awayPassesCompleted: number;
  awayRecoveries: number;

  // Sonuç
  homeWins: number;
  draws: number;
  awayWins: number;
}

function runScenario(
  label: string,
  homeQuality: number,
  awayQuality: number,
  spread: number,
  matchCount: number
): BalanceStats {
  const data = generateGameData();
  const clubList = Object.values(data.clubs);
  const home = clubList[0];
  const away = clubList[1];

  const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
  const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

  const stats: BalanceStats = {
    label, matches: matchCount,
    homeShots: 0, homeOnTarget: 0, homeXG: 0, homeGoals: 0,
    homePossession: 0, homePasses: 0, homePassesCompleted: 0, homeRecoveries: 0,
    awayShots: 0, awayOnTarget: 0, awayXG: 0, awayGoals: 0,
    awayPossession: 0, awayPasses: 0, awayPassesCompleted: 0, awayRecoveries: 0,
    homeWins: 0, draws: 0, awayWins: 0,
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

    const match = simulateMatch(home, away, data.players, 1);

    stats.homeShots += match.stats.shots.home;
    stats.homeOnTarget += match.stats.onTarget.home;
    stats.homeXG += match.stats.xG.home;
    stats.homeGoals += match.homeScore;
    stats.homePossession += match.stats.possession.home;
    stats.homePasses += match.stats.passes.home;
    stats.homePassesCompleted += match.stats.passesCompleted.home;
    stats.homeRecoveries += match.stats.recoveries.home;

    stats.awayShots += match.stats.shots.away;
    stats.awayOnTarget += match.stats.onTarget.away;
    stats.awayXG += match.stats.xG.away;
    stats.awayGoals += match.awayScore;
    stats.awayPossession += match.stats.possession.away;
    stats.awayPasses += match.stats.passes.away;
    stats.awayPassesCompleted += match.stats.passesCompleted.away;
    stats.awayRecoveries += match.stats.recoveries.away;

    if (match.homeScore > match.awayScore) stats.homeWins++;
    else if (match.homeScore === match.awayScore) stats.draws++;
    else stats.awayWins++;
  }

  return stats;
}

describe('Result Balance — Ev/Deplasman Ayrıştırma', () => {
  it('HIGH-LOW galibiyetin nedenini ev/away ayrımıyla bul', () => {
    console.log('\n⏳ Result balance (3 senaryo × 1000 maç)...\n');

    const N = 1000;

    const lowLow = runScenario('Düşük-Düşük', 10, 10, 4, N);
    const highLow = runScenario('Yüksek-Düşük', 18, 10, 4, N);
    const highHigh = runScenario('Yüksek-Yüksek', 18, 18, 4, N);

    const lines: string[] = [];
    const f2 = (v: number) => v.toFixed(2);
    const f1 = (v: number) => v.toFixed(1);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';

    const row = (label: string, a: string, b: string, c: string) => {
      lines.push(
        `║  ${label.padEnd(26)}${a.padStart(12)}${b.padStart(14)}${c.padStart(14)}   ║`
      );
    };

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║              RESULT BALANCE — EV/DEPLASMAN AYRIŞTIRMA (1000 maç)              ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  METRİK                    DÜŞÜK-DÜŞÜK  YÜKSEK-DÜŞÜK  YÜKSEK-YÜKSEK        ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    // ── EV (HOME) ──
    lines.push('║  ── EV SAHİBİ (HOME) ──                                                      ║');
    row('Ev Şut / maç',
      f1(lowLow.homeShots / lowLow.matches),
      f1(highLow.homeShots / highLow.matches),
      f1(highHigh.homeShots / highHigh.matches));
    row('Ev İsabetli şut / maç',
      f1(lowLow.homeOnTarget / lowLow.matches),
      f1(highLow.homeOnTarget / highLow.matches),
      f1(highHigh.homeOnTarget / highHigh.matches));
    row('Ev xG / maç',
      f2(lowLow.homeXG / lowLow.matches),
      f2(highLow.homeXG / highLow.matches),
      f2(highHigh.homeXG / highHigh.matches));
    row('Ev Gol / maç',
      f2(lowLow.homeGoals / lowLow.matches),
      f2(highLow.homeGoals / highLow.matches),
      f2(highHigh.homeGoals / highHigh.matches));
    row('Ev Possession %',
      f1(lowLow.homePossession / lowLow.matches),
      f1(highLow.homePossession / highLow.matches),
      f1(highHigh.homePossession / highHigh.matches));
    row('Ev Pas / maç',
      f1(lowLow.homePasses / lowLow.matches),
      f1(highLow.homePasses / highLow.matches),
      f1(highHigh.homePasses / highHigh.matches));
    row('Ev Pas isabet %',
      pct(lowLow.homePassesCompleted / Math.max(1, lowLow.homePasses)),
      pct(highLow.homePassesCompleted / Math.max(1, highLow.homePasses)),
      pct(highHigh.homePassesCompleted / Math.max(1, highHigh.homePasses)));

    // ── DEPLASMAN (AWAY) ──
    lines.push('║  ── DEPLASMAN (AWAY) ──                                                      ║');
    row('Dep Şut / maç',
      f1(lowLow.awayShots / lowLow.matches),
      f1(highLow.awayShots / highLow.matches),
      f1(highHigh.awayShots / highHigh.matches));
    row('Dep İsabetli şut / maç',
      f1(lowLow.awayOnTarget / lowLow.matches),
      f1(highLow.awayOnTarget / highLow.matches),
      f1(highHigh.awayOnTarget / highHigh.matches));
    row('Dep xG / maç',
      f2(lowLow.awayXG / lowLow.matches),
      f2(highLow.awayXG / highLow.matches),
      f2(highHigh.awayXG / highHigh.matches));
    row('Dep Gol / maç',
      f2(lowLow.awayGoals / lowLow.matches),
      f2(highLow.awayGoals / highLow.matches),
      f2(highHigh.awayGoals / highHigh.matches));
    row('Dep Possession %',
      f1(lowLow.awayPossession / lowLow.matches),
      f1(highLow.awayPossession / highLow.matches),
      f1(highHigh.awayPossession / highHigh.matches));
    row('Dep Pas / maç',
      f1(lowLow.awayPasses / lowLow.matches),
      f1(highLow.awayPasses / highLow.matches),
      f1(highHigh.awayPasses / highHigh.matches));
    row('Dep Pas isabet %',
      pct(lowLow.awayPassesCompleted / Math.max(1, lowLow.awayPasses)),
      pct(highLow.awayPassesCompleted / Math.max(1, highLow.awayPasses)),
      pct(highHigh.awayPassesCompleted / Math.max(1, highHigh.awayPasses)));

    // ── SONUÇ ──
    lines.push('║  ── SONUÇ ──                                                                 ║');
    row('Ev kazanma %',
      pct(lowLow.homeWins / lowLow.matches),
      pct(highLow.homeWins / highLow.matches),
      pct(highHigh.homeWins / highHigh.matches));
    row('Beraberlik %',
      pct(lowLow.draws / lowLow.matches),
      pct(highLow.draws / highLow.matches),
      pct(highHigh.draws / highHigh.matches));
    row('Dep kazanma %',
      pct(lowLow.awayWins / lowLow.matches),
      pct(highLow.awayWins / highLow.matches),
      pct(highHigh.awayWins / highHigh.matches));

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── HIGH-LOW AYRIŞTIRMA ──
    lines.push('');
    lines.push('🔍 HIGH-LOW AYRIŞTIRMA');
    lines.push('');

    const homeXG = highLow.homeXG / highLow.matches;
    const awayXG = highLow.awayXG / highLow.matches;
    const homeGoals = highLow.homeGoals / highLow.matches;
    const awayGoals = highLow.awayGoals / highLow.matches;
    const homeShots = highLow.homeShots / highLow.matches;
    const awayShots = highLow.awayShots / highLow.matches;
    const homePoss = highLow.homePossession / highLow.matches;
    const awayPoss = highLow.awayPossession / highLow.matches;

    lines.push(`  Ev xG:        ${homeXG.toFixed(2)}`);
    lines.push(`  Dep xG:       ${awayXG.toFixed(2)}`);
    lines.push(`  Fark:         +${(homeXG - awayXG).toFixed(2)} (${((homeXG / awayXG - 1) * 100).toFixed(1)}%)`);
    lines.push('');

    lines.push(`  Ev şut:       ${homeShots.toFixed(1)}`);
    lines.push(`  Dep şut:      ${awayShots.toFixed(1)}`);
    lines.push(`  Fark:         +${(homeShots - awayShots).toFixed(1)} (${((homeShots / awayShots - 1) * 100).toFixed(1)}%)`);
    lines.push('');

    lines.push(`  Ev gol:       ${homeGoals.toFixed(2)}`);
    lines.push(`  Dep gol:      ${awayGoals.toFixed(2)}`);
    lines.push(`  Fark:         +${(homeGoals - awayGoals).toFixed(2)}`);
    lines.push('');

    lines.push(`  Ev possession: ${homePoss.toFixed(1)}%`);
    lines.push(`  Dep possession: ${awayPoss.toFixed(1)}%`);
    lines.push('');

    // ── YORUM ──
    lines.push('📌 YORUM');
    lines.push('');

    if (awayXG < 0.8) {
      lines.push(`  🔴 Dep xG çok düşük (${awayXG.toFixed(2)}).`);
      lines.push(`     Düşük kaliteli takım neredeyse hiç pozisyon üretemiyor.`);
      lines.push(`     Sorun: savunma + pozisyon üretimi zincirinde.`);
    } else if (awayXG < 1.3) {
      lines.push(`  🟡 Dep xG düşük (${awayXG.toFixed(2)}).`);
      lines.push(`     Düşük kaliteli takım az pozisyon üretiyor.`);
    } else {
      lines.push(`  ✅ Dep xG normal (${awayXG.toFixed(2)}).`);
      lines.push(`     Sorun gol dönüşümünde olabilir.`);
    }

    if (homeXG > 3.0) {
      lines.push(`  🔴 Ev xG çok yüksek (${homeXG.toFixed(2)}).`);
      lines.push(`     Yüksek kaliteli takım aşırı pozisyon üretiyor.`);
    } else if (homeXG > 2.5) {
      lines.push(`  🟡 Ev xG yüksek (${homeXG.toFixed(2)}).`);
    } else {
      lines.push(`  ✅ Ev xG normal (${homeXG.toFixed(2)}).`);
    }

    lines.push('');

    console.log(lines.join('\n'));
  }, 180000);
});