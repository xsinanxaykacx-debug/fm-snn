// src/engine/match/actionSuccessCalibration.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import { setActionSuccessDivisor } from './attackSequence';
import type { Player } from '../types';

/**
 * ACTION SUCCESS CALIBRATION — İNCE AYAR
 *
 * Hedef: pas isabet farkı +7–9 puan.
 * Önceki test: /150 → +11.0, /200 → +5.3
 * Yeni test: /160, /170, /180, /190
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

interface ScenarioStats {
  label: string;
  matches: number;
  sequences: number;
  avgActionsPerSequence: number;
  shotsPerMatch: number;
  xGPerMatch: number;
  goalsPerMatch: number;
  avgPassSuccessRate: number;
  avgChanceQuality: number;
  homeWinRate: number;
  drawRate: number;
  awayWinRate: number;
  maxActionsRate: number;
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

  let sequences = 0;
  let totalActions = 0;
  let shots = 0;
  let xG = 0;
  let goals = 0;
  let wins = 0, draws = 0, losses = 0;
  let passAttempts = 0, passSuccesses = 0;
  let cqSum = 0, cqCount = 0;
  let maxActionsReached = 0;

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

    sequences += match.sequences.length;
    shots += match.stats.shots.home + match.stats.shots.away;
    xG += match.stats.xG.home + match.stats.xG.away;
    goals += match.homeScore + match.awayScore;

    if (match.homeScore > match.awayScore) wins++;
    else if (match.homeScore === match.awayScore) draws++;
    else losses++;

    passAttempts += match.stats.passes.home + match.stats.passes.away;
    passSuccesses += match.stats.passesCompleted.home + match.stats.passesCompleted.away;

    for (const seq of match.sequences) {
      totalActions += seq.actions.length;
      cqSum += seq.chanceQuality;
      cqCount++;
      if (seq.actions.length >= 8) maxActionsReached++;
    }
  }

  const safeDiv = (a: number, b: number) => b === 0 ? 0 : a / b;

  return {
    label,
    matches: matchCount,
    sequences,
    avgActionsPerSequence: safeDiv(totalActions, sequences),
    shotsPerMatch: safeDiv(shots, matchCount),
    xGPerMatch: safeDiv(xG, matchCount),
    goalsPerMatch: safeDiv(goals, matchCount),
    avgPassSuccessRate: safeDiv(passSuccesses, passAttempts),
    avgChanceQuality: safeDiv(cqSum, cqCount),
    homeWinRate: safeDiv(wins, matchCount),
    drawRate: safeDiv(draws, matchCount),
    awayWinRate: safeDiv(losses, matchCount),
    maxActionsRate: safeDiv(maxActionsReached, sequences),
  };
}

describe('Action Success Calibration — İnce Ayar', () => {
  it('160/170/180/190 divisor değerlerini karşılaştır', () => {
    console.log('\n⏳ İnce ayar (4 divisor × 3 senaryo × 500 maç)...\n');

    const N = 500;
    const divisors = [160, 170, 180, 190];

    const lines: string[] = [];
    const f2 = (v: number) => v.toFixed(2);
    const f1 = (v: number) => v.toFixed(1);
    const pct = (v: number) => (v * 100).toFixed(1) + '%';

    interface Result {
      divisor: number;
      lowLow: ScenarioStats;
      highLow: ScenarioStats;
      highHigh: ScenarioStats;
    }

    const results: Result[] = [];

    for (const divisor of divisors) {
      setActionSuccessDivisor(divisor);
      console.log(`  → Divisor ${divisor} çalışıyor...`);

      const lowLow = runScenario('LOW-LOW', 10, 10, 4, N);
      const highLow = runScenario('HIGH-LOW', 18, 10, 4, N);
      const highHigh = runScenario('HIGH-HIGH', 18, 18, 4, N);

      results.push({ divisor, lowLow, highLow, highHigh });
    }

    setActionSuccessDivisor(150);

    // ═══ PAS İSABET FARKI ═══
    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║  PAS İSABET FARKI (LOW-LOW → HIGH-LOW)   [hedef: +7 ~ +9]                    ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  DIVISOR   LOW-LOW     HIGH-LOW    FARK (puan)                              ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (const r of results) {
      const low = r.lowLow.avgPassSuccessRate;
      const high = r.highLow.avgPassSuccessRate;
      const diff = (high - low) * 100;
      const target = diff >= 7 && diff <= 9 ? '  ✅' : '';
      lines.push(
        `║  ${String(r.divisor).padEnd(9)}${pct(low).padStart(10)}${pct(high).padStart(13)}${('+' + diff.toFixed(1)).padStart(13)}${target.padEnd(6)}                    ║`
      );
    }
    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ═══ HIGH-LOW SONUÇLARI ═══
    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║  HIGH-LOW SONUÇLARI                                                          ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  DIVISOR   ACT/SEQ   ŞUT    xG    GOL   EV KAZ %   BERABERE %              ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (const r of results) {
      const s = r.highLow;
      lines.push(
        `║  ${String(r.divisor).padEnd(9)}${f2(s.avgActionsPerSequence).padStart(7)}${f1(s.shotsPerMatch).padStart(7)}${f2(s.xGPerMatch).padStart(6)}${f2(s.goalsPerMatch).padStart(7)}${pct(s.homeWinRate).padStart(11)}${pct(s.drawRate).padStart(13)}        ║`
      );
    }
    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ═══ HIGH-HIGH DENGESİ ═══
    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║  HIGH-HIGH DENGESİ (hedef: ~33/33/33)                                        ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  DIVISOR   EV KAZ %   BERABERE %   EV KAYBET %                               ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (const r of results) {
      const s = r.highHigh;
      lines.push(
        `║  ${String(r.divisor).padEnd(9)}${pct(s.homeWinRate).padStart(11)}${pct(s.drawRate).padStart(13)}${pct(s.awayWinRate).padStart(13)}                    ║`
      );
    }
    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ═══ LOW-LOW BASELINE ═══
    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║  LOW-LOW BASELINE                                                            ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  DIVISOR   ACT/SEQ   ŞUT    xG    GOL   EV KAZ %                            ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (const r of results) {
      const s = r.lowLow;
      lines.push(
        `║  ${String(r.divisor).padEnd(9)}${f2(s.avgActionsPerSequence).padStart(7)}${f1(s.shotsPerMatch).padStart(7)}${f2(s.xGPerMatch).padStart(6)}${f2(s.goalsPerMatch).padStart(7)}${pct(s.homeWinRate).padStart(11)}                  ║`
      );
    }
    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ═══ KARAR ═══
    lines.push('');
    lines.push('📌 KARAR İÇİN İPUÇLARI');
    lines.push('');
    lines.push('  Hedef:');
    lines.push('    • Pas isabet farkı: +7–9 puan   ⬅️ EN ÖNEMLİ');
    lines.push('    • HIGH-LOW xG: ~2.8–3.0');
    lines.push('    • HIGH-HIGH dengesi: ~33/33/33');
    lines.push('    • LOW-LOW baseline: xG ~2.4–2.5, gol ~2.3–2.4');
    lines.push('');

    console.log(lines.join('\n'));
  }, 400000);
});