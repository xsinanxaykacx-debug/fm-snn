// src/engine/match/performance.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';

describe('Performance — Maç Simülasyon Hızı', () => {
  it('tek maç ve toplu maç sürelerini ölç', () => {
    console.log('\n⏱️  Motor performans ölçümü...\n');

    const data = generateGameData();
    const clubList = Object.values(data.clubs);
    const home = clubList[0];
    const away = clubList[1];

    // ── WARMUP: JIT derleyicisini ısıt ──
    for (let i = 0; i < 10; i++) {
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
      simulateMatch(home, away, data.players, 1);
    }

    // ── TEK MAÇ ──
    const singleIterations = 100;
    let singleTotal = 0;

    for (let i = 0; i < singleIterations; i++) {
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
      const start = performance.now();
      simulateMatch(home, away, data.players, 1);
      const end = performance.now();
      singleTotal += (end - start);
    }

    const avgSingle = singleTotal / singleIterations;

    // ── 100 MAÇ ──
    const hundredIterations = 100;
    let hundredTotal = 0;

    for (let i = 0; i < hundredIterations; i++) {
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
      const start = performance.now();
      simulateMatch(home, away, data.players, 1);
      const end = performance.now();
      hundredTotal += (end - start);
    }

    // ── 1000 MAÇ ──
    const thousandIterations = 1000;
    let thousandTotal = 0;

    for (let i = 0; i < thousandIterations; i++) {
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
      const start = performance.now();
      simulateMatch(home, away, data.players, 1);
      const end = performance.now();
      thousandTotal += (end - start);
    }

    const f2 = (v: number) => v.toFixed(2);
    const f3 = (v: number) => v.toFixed(3);

    const lines: string[] = [];
    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║                    MOTOR PERFORMANS ÖLÇÜMÜ                                   ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push(`║  Tek maç ortalaması:       ${f2(avgSingle).padStart(8)} ms                                ║`);
    lines.push(`║  100 maç toplamı:          ${f2(hundredTotal).padStart(8)} ms                                ║`);
    lines.push(`║  1000 maç toplamı:         ${f2(thousandTotal).padStart(8)} ms                                ║`);
    lines.push(`║  1000 maç ortalaması:      ${f3(thousandTotal / 1000).padStart(8)} ms                                ║`);
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  ── YORUM ──                                                                 ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    const ms = avgSingle;
    let speedLabel: string;
    if (ms < 5) speedLabel = '⚡ ÇOK HIZLI (gerçek zamanlı simülasyon için ideal)';
    else if (ms < 20) speedLabel = '✅ HIZLI (UI için uygun)';
    else if (ms < 100) speedLabel = '🟡 ORTA (toplu simülasyon için uygun)';
    else if (ms < 500) speedLabel = '🟠 YAVAŞ (toplu simülasyon zor)';
    else speedLabel = '🔴 ÇOK YAVAŞ (optimizasyon gerekli)';

    lines.push(`║  Hız değerlendirmesi:      ${speedLabel.padEnd(46)}║`);
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    lines.push('║  ── SENARYOLAR ──                                                            ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    const scenarios: [string, number][] = [
      ['Tek maç (UI)', 1],
      ['Bir lig haftası (8 maç)', 8],
      ['Bir sezon (240 maç)', 240],
      ['10 sezon (2400 maç)', 2400],
      ['Tüm lig (1000 maç)', 1000],
    ];

    for (const [label, count] of scenarios) {
      const totalMs = avgSingle * count;
      const totalSec = totalMs / 1000;
      const totalMin = totalSec / 60;
      const timeStr = totalMs < 1000
        ? `${f2(totalMs)} ms`
        : totalSec < 60
        ? `${f2(totalSec)} sn`
        : `${f2(totalMin)} dk`;
      lines.push(`║  ${label.padEnd(28)} ${timeStr.padStart(20)}              ║`);
    }

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');
    lines.push('');

    console.log(lines.join('\n'));
  }, 300000);
});