// src/engine/match/simulate.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';
import type { Club, Match } from '../types';

describe('Maç Motoru — Aksiyon Dağılımı', () => {
  it('1000 maçta aksiyon dağılımını ölç', () => {
    console.log('\n⏳ 1000 maç simüle ediliyor...\n');

    const data = generateGameData();
    const clubList: Club[] = Object.values(data.clubs);

    const actionCounts: Record<string, number> = {
      pass: 0, carry: 0, dribble: 0, cross: 0,
      run: 0, throughBall: 0, recycle: 0, shot: 0,
    };

    let totalSequences = 0;
    let totalActions = 0;
    let totalShotEvents = 0;
    let totalGoals = 0;
    let totalXG = 0;
    let totalShotsOnTarget = 0;

    const cqBuckets = {
      '0': 0, '1-15': 0, '16-30': 0, '31-50': 0, '51-70': 0, '71+': 0,
    };
    let cqSum = 0;
    let cqCount = 0;

    const matches: Match[] = [];

    for (let i = 0; i < 1000; i++) {
      const homeIdx = i % clubList.length;
      const awayIdx = (i + 1) % clubList.length;
      if (homeIdx === awayIdx) continue;

      const home = clubList[homeIdx];
      const away = clubList[awayIdx];

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

      const match = simulateMatch(home, away, data.players, 1);
      matches.push(match);

      totalGoals += match.homeScore + match.awayScore;
      totalXG += match.stats.xG.home + match.stats.xG.away;
      totalShotsOnTarget += match.stats.onTarget.home + match.stats.onTarget.away;

      for (const seq of match.sequences) {
        totalSequences++;
        cqSum += seq.chanceQuality;
        cqCount++;

        const cq = seq.chanceQuality;
        if (cq === 0) cqBuckets['0']++;
        else if (cq <= 15) cqBuckets['1-15']++;
        else if (cq <= 30) cqBuckets['16-30']++;
        else if (cq <= 50) cqBuckets['31-50']++;
        else if (cq <= 70) cqBuckets['51-70']++;
        else cqBuckets['71+']++;

        for (const action of seq.actions) {
          actionCounts[action.action] = (actionCounts[action.action] ?? 0) + 1;
          totalActions++;
        }
      }

      for (const ev of match.events) {
        if (ev.type === 'goal' || ev.type === 'save' || ev.type === 'miss') {
          totalShotEvents++;
        }
      }
    }

    const matchCount = matches.length;
    const shotEventsPerMatch = totalShotEvents / matchCount;
    const goalsPerMatch = totalGoals / matchCount;
    const xGPerMatch = totalXG / matchCount;
    const onTargetPerMatch = totalShotsOnTarget / matchCount;
    const avgCQ = cqCount > 0 ? cqSum / cqCount : 0;

    const actionOrder = ['carry', 'pass', 'dribble', 'cross', 'run', 'throughBall', 'recycle', 'shot'];
    const lines: string[] = [];
    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════╗');
    lines.push('║              AKSİYON DAĞILIMI (1000 maç)             ║');
    lines.push('╠══════════════════════════════════════════════════════╣');
    lines.push('║  AKSİYON         TOPLAM       /MAÇ      %           ║');
    lines.push('╠══════════════════════════════════════════════════════╣');

    for (const key of actionOrder) {
      const total = actionCounts[key] ?? 0;
      const perMatch = total / matchCount;
      const pct = totalActions > 0 ? (total / totalActions) * 100 : 0;
      lines.push(
        `║  ${key.padEnd(15)}${String(total).padStart(7)}${perMatch.toFixed(1).padStart(11)}${(pct.toFixed(1) + '%').padStart(11)}     ║`
      );
    }

    lines.push('╠══════════════════════════════════════════════════════╣');
    lines.push(`║  TOPLAM        ${String(totalActions).padStart(7)}${(totalActions / matchCount).toFixed(1).padStart(11)}                ║`);
    lines.push(`║  SEQUENCE      ${String(totalSequences).padStart(7)}${(totalSequences / matchCount).toFixed(1).padStart(11)}                ║`);
    lines.push(`║  ŞUT (event)   ${String(totalShotEvents).padStart(7)}${shotEventsPerMatch.toFixed(1).padStart(11)}                ║`);
    lines.push('╚══════════════════════════════════════════════════════╝');

    lines.push('');
    lines.push('📊 DETAYLI ANALİZ');
    lines.push('');
    lines.push(`Sequence başına aksiyon: ${(totalActions / totalSequences).toFixed(2)}`);
    lines.push(`Sequence başına pas:      ${((actionCounts.pass ?? 0) / totalSequences).toFixed(2)}`);
    lines.push(`Sequence başına dribble:  ${((actionCounts.dribble ?? 0) / totalSequences).toFixed(2)}`);
    lines.push(`Sequence başına cross:    ${((actionCounts.cross ?? 0) / totalSequences).toFixed(2)}`);
    lines.push(`Sequence başına carry:    ${((actionCounts.carry ?? 0) / totalSequences).toFixed(2)}`);
    lines.push(`Sequence başına run:      ${((actionCounts.run ?? 0) / totalSequences).toFixed(2)}`);
    lines.push('');
    lines.push(`Shot event / sequence:    ${(totalShotEvents / totalSequences).toFixed(2)}`);
    lines.push(`Shot event / maç:         ${shotEventsPerMatch.toFixed(1)}`);
    lines.push(`Gol / maç:                ${goalsPerMatch.toFixed(2)}`);
    lines.push(`xG / maç:                 ${xGPerMatch.toFixed(2)}`);
    lines.push(`İsabetli şut / maç:       ${onTargetPerMatch.toFixed(1)}`);
    lines.push('');
    lines.push(`Toplam pas aksiyonu (action): ${(actionCounts.pass ?? 0) + (actionCounts.throughBall ?? 0) + (actionCounts.recycle ?? 0)}`);
    lines.push(`Toplam pas aksiyonu / maç:    ${(((actionCounts.pass ?? 0) + (actionCounts.throughBall ?? 0) + (actionCounts.recycle ?? 0)) / matchCount).toFixed(1)}`);
    lines.push('');
    lines.push('📈 CHANCEQUALITY DAĞILIMI');
    lines.push('');
    lines.push(`Ortalama chanceQuality: ${avgCQ.toFixed(2)}`);
    lines.push(`  0        : ${cqBuckets['0']} sequence`);
    lines.push(`  1-15     : ${cqBuckets['1-15']} sequence`);
    lines.push(`  16-30    : ${cqBuckets['16-30']} sequence`);
    lines.push(`  31-50    : ${cqBuckets['31-50']} sequence`);
    lines.push(`  51-70    : ${cqBuckets['51-70']} sequence`);
    lines.push(`  71+      : ${cqBuckets['71+']} sequence`);
    lines.push('');

    console.log(lines.join('\n'));
  }, 60000);
});