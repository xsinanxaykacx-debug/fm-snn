// src/engine/match/pickDistribution.test.ts

import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { pickPlayerForZone, calculateAttackerPower, calculateDefenderPower } from './attackSequence';
import { pickDefender } from './attack';
import type { Player } from '../types';
import type { TeamMatchState } from './matchState';

/**
 * PICK DISTRIBUTION — HAM SEÇİM DAĞILIMI
 *
 * Amaç: pickPlayerForZone ve pickDefender'ın zone'a göre
 * HAM seçim dağılımını ölçmek. Survivorship bias olmadan.
 *
 * İhtimal A: pickPlayerForZone zone'a göre farklı güçte oyuncu seçiyor.
 * İhtimal B: pickPlayerForZone normal seçiyor, survivorship bias var.
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

const ZONES = [
  'centerMidfield', 'leftMidfield', 'rightMidfield',
  'centerAttack', 'leftAttack', 'rightAttack',
];

const ACTIONS = ['pass', 'dribble', 'cross', 'throughBall', 'run', 'recycle'];

describe('Pick Distribution — Ham Seçim Dağılımı', () => {
  it('pickPlayerForZone ve pickDefender ham dağılımını ölç', () => {
    console.log('\n⏳ Pick distribution (3 senaryo × 6 zone × 10.000 seçim)...\n');

    const SAMPLE_PER_ZONE = 10000;

    const scenarios = [
      { label: 'Düşük-Düşük (10 vs 10)', homeQ: 10, awayQ: 10 },
      { label: 'Yüksek-Düşük (18 vs 10)', homeQ: 18, awayQ: 10 },
      { label: 'Yüksek-Yüksek (18 vs 18)', homeQ: 18, awayQ: 18 },
    ];

    const lines: string[] = [];
    const f1 = (v: number) => v.toFixed(1);

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║      PICK DISTRIBUTION — HAM SEÇİM DAĞILIMI (survivorship bias yok)          ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (const scenario of scenarios) {
      const data = generateGameData();
      const clubList = Object.values(data.clubs);
      const home = clubList[0];
      const away = clubList[1];

      const homePlayers = Object.values(data.players).filter(p => p.clubId === home.id);
      const awayPlayers = Object.values(data.players).filter(p => p.clubId === away.id);

      for (const p of homePlayers) setAttributeLevel(p, scenario.homeQ, 4);
      for (const p of awayPlayers) setAttributeLevel(p, scenario.awayQ, 4);

      lines.push(`║  ${scenario.label}${' '.repeat(72 - scenario.label.length)}║`);
      lines.push('║  ZONE             ATT_PWR(avg)  DEF_PWR(avg)  FARK    ATK_POS_TOP  DEF_POS_TOP  ║');
      lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

      for (const zone of ZONES) {
        // pickPlayerForZone: home takımı (yüksek kaliteli) hücum ediyor
        const attPowers: number[] = [];
        const attPositions: Record<string, number> = {};

        for (let i = 0; i < SAMPLE_PER_ZONE; i++) {
          const p = pickPlayerForZone(homePlayers, zone);
          if (!p) continue;
          const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
          // calculateDefenderPower için sahte bir TeamMatchState gerekmiyor;
          // calculateAttackerPower sadece player ve action alır.
          attPowers.push(calculateAttackerPower(p, action));
          attPositions[p.position] = (attPositions[p.position] || 0) + 1;
        }

        // pickDefender: away takımı (düşük kaliteli) savunuyor
        const defPowers: number[] = [];
        const defPositions: Record<string, number> = {};

        // calculateDefenderPower'ı çağırmak için basit bir TeamMatchState benzeri obje
        const fakeTeamState = { pressing: 'medium' } as unknown as TeamMatchState;

        for (let i = 0; i < SAMPLE_PER_ZONE; i++) {
          const d = pickDefender(awayPlayers, zone);
          if (!d) continue;
          defPowers.push(calculateDefenderPower(d, fakeTeamState));
          defPositions[d.position] = (defPositions[d.position] || 0) + 1;
        }

        const avgAtt = attPowers.reduce((a, b) => a + b, 0) / Math.max(1, attPowers.length);
        const avgDef = defPowers.reduce((a, b) => a + b, 0) / Math.max(1, defPowers.length);
        const diff = avgAtt - avgDef;

        const topAtt = Object.entries(attPositions)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([p, c]) => `${p}:${((c / attPowers.length) * 100).toFixed(0)}%`)
          .join(' ');

        const topDef = Object.entries(defPositions)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([p, c]) => `${p}:${((c / defPowers.length) * 100).toFixed(0)}%`)
          .join(' ');

        lines.push(
          `║  ${zone.padEnd(18)}${f1(avgAtt).padStart(11)}${f1(avgDef).padStart(14)}${(diff >= 0 ? '+' : '')}${f1(diff).padStart(8)}  ${topAtt.padEnd(12)} ${topDef.padEnd(12)} ║`
        );
      }

      lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');
    }

    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    // ── Analiz ──
    lines.push('');
    lines.push('🔍 ANALİZ');
    lines.push('');
    lines.push('  Her zone için ATT_PWR ve DEF_PWR farkına bak:');
    lines.push('  • Fark zone\'a göre DEĞİŞİYORSA → pickPlayerForZone/pickDefender zone-bağımlı (İhtimal A)');
    lines.push('  • Fark zone\'a göre SABİTSE → survivorship bias (İhtimal B)');
    lines.push('');

    console.log(lines.join('\n'));
  }, 300000);
});