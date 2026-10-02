// src/engine/live/bench1.test.ts
//
// Tek maçlık benchmark — performans + takım güç profili diagnostik.
//
// Kullanım:
//   npx vitest run src/engine/live/bench1.test.ts

import { describe, it } from 'vitest';
import { simulateMatchLive } from './liveMatch';
import { generateGameData } from '../data/generateData';
import {
  installDeterministicRandom,
  DEFAULT_FIXTURE_SEED,
} from './diagnostics/deterministicFixture';
import type { Player, LiveMatchState } from '../types';

const SEED = 1000;
const MATCH_TICKS = 54_000;

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function summarizeTeam(
  label: 'HOME' | 'AWAY',
  playerIds: string[],
  players: Record<string, Player>
): void {
  const rows = playerIds
    .map(id => players[id])
    .filter((p): p is Player => p !== undefined)
    .map(p => ({
      id: p.id,
      name: p.name,
      position: p.position,
      overall: p.overall,
      condition: Math.round(p.condition),
      fatigue: Math.round(p.fatigue),
      pace: p.attributes.pace,
      passing: p.attributes.passing,
      firstTouch: p.attributes.firstTouch,
      technique: p.attributes.technique,
      decisions: p.attributes.decisions,
      vision: p.attributes.vision,
      shooting: p.attributes.shooting,
      finishing: p.attributes.finishing,
      marking: p.attributes.marking,
      tackling: p.attributes.tackling,
      ballWinning: p.attributes.ballWinning,
      defensivePositioning: p.attributes.defensivePositioning,
      goalkeeper: p.attributes.goalkeeper,
      reflexes: p.attributes.reflexes,
    }));

  console.log(`=== ${label} STRENGTH ===`);
  console.table(rows);

  const byPosition = (pos: string) =>
    rows.filter(r => r.position === pos);

  const gk = byPosition('GK')[0];

  console.log(`--- ${label} TEAM SUMMARY ---`);
  console.log(`${label} player count     : ${rows.length}`);
  console.log(`${label} overall avg      : ${avg(rows.map(r => r.overall)).toFixed(2)}`);
  console.log(`${label} condition avg    : ${avg(rows.map(r => r.condition)).toFixed(1)}`);
  console.log(`${label} pace avg         : ${avg(rows.map(r => r.pace)).toFixed(1)}`);
  console.log(`${label} passing avg      : ${avg(rows.map(r => r.passing)).toFixed(1)}`);
  console.log(`${label} firstTouch avg   : ${avg(rows.map(r => r.firstTouch)).toFixed(1)}`);
  console.log(`${label} technique avg    : ${avg(rows.map(r => r.technique)).toFixed(1)}`);
  console.log(`${label} decisions avg    : ${avg(rows.map(r => r.decisions)).toFixed(1)}`);
  console.log(`${label} vision avg       : ${avg(rows.map(r => r.vision)).toFixed(1)}`);
  console.log(`${label} shooting avg     : ${avg(rows.map(r => r.shooting)).toFixed(1)}`);
  console.log(`${label} finishing avg    : ${avg(rows.map(r => r.finishing)).toFixed(1)}`);
  console.log(`${label} marking avg      : ${avg(rows.map(r => r.marking)).toFixed(1)}`);
  console.log(`${label} tackling avg     : ${avg(rows.map(r => r.tackling)).toFixed(1)}`);
  console.log(`${label} ballWinning avg  : ${avg(rows.map(r => r.ballWinning)).toFixed(1)}`);
  console.log(`${label} defPositioning   : ${avg(rows.map(r => r.defensivePositioning)).toFixed(1)}`);
  if (gk) {
    console.log(`${label} GK overall       : ${gk.overall}`);
    console.log(`${label} GK goalkeeper    : ${gk.goalkeeper}`);
    console.log(`${label} GK reflexes      : ${gk.reflexes}`);
  } else {
    console.log(`${label} GK               : NOT FOUND (position === 'GK')`);
  }
}

describe('single match bench', () => {
  it(`fixtureSeed=${DEFAULT_FIXTURE_SEED}, matchSeed=${SEED}, ticks=${MATCH_TICKS}`, () => {
    const handle = installDeterministicRandom(DEFAULT_FIXTURE_SEED);

    try {
      const data = generateGameData();
      const clubs = Object.values(data.clubs);
      const home = structuredClone(clubs[0]);
      const away = structuredClone(clubs[1]);
      const players = structuredClone(data.players);

      console.log('=== ACTIVE PASS MODEL ===');
      console.log('skillProbability divisor : 15');
      console.log('totalPenalty multiplier  : 0.6');
      console.log('totalPenalty cap         : 0.35');
      console.log('probability clamp        : (0.35, 0.92)');
      console.log('actionResolution SHA     : 3c87e5480b33f3662e999e47bd2de83e9120ab59');

      const homeSquadCount = Object.values(players).filter(
        player => player.clubId === home.id && player.squadRole !== 'u21'
      ).length;
      const awaySquadCount = Object.values(players).filter(
        player => player.clubId === away.id && player.squadRole !== 'u21'
      ).length;

      console.log('=== ROSTER INPUT ===');
      console.log('home squad count    :', homeSquadCount);
      console.log('away squad count    :', awaySquadCount);
      console.log('home lineup input   :', home.lineup?.length ?? 0);
      console.log('away lineup input   :', away.lineup?.length ?? 0);

      let firstState: LiveMatchState | null = null;
      let capturedTick = -1;
      let firstStatePlayers: Record<string, Player> | null = null;

      const t0 = Date.now();

      const result = simulateMatchLive(home, away, players, {
        seed: SEED,
        maxTicks: MATCH_TICKS,
        onTick: state => {
          if (firstState === null) {
            firstState = state;
            capturedTick = state.tick;
            firstStatePlayers = Object.fromEntries(
              Object.entries(state.players).map(([id, livePlayer]) => [
                id,
                structuredClone(livePlayer.player),
              ])
            );
          }
        },
      });

      const elapsedMs = Date.now() - t0;

      if (firstState !== null) {
        const onPitchIds = Object.keys(firstState.players);
        const homeIds = onPitchIds.filter(id => firstState!.players[id].isHome);
        const awayIds = onPitchIds.filter(id => !firstState!.players[id].isHome);

        console.log(`=== ON PITCH at tick=${capturedTick} ===`);
        console.log('home on-pitch count :', homeIds.length);
        console.log('away on-pitch count :', awayIds.length);

        summarizeTeam('HOME', homeIds, firstStatePlayers ?? players);
        summarizeTeam('AWAY', awayIds, firstStatePlayers ?? players);
      } else {
        console.log('!! firstState could not be captured (onTick never fired)');
      }

      const s = result.stats;
      const goals = result.homeScore + result.awayScore;
      const shots = s.shots.home + s.shots.away;
      const passes = s.passes.home + s.passes.away;
      const passesCompleted =
        s.passesCompleted.home + s.passesCompleted.away;
      const pcr = passes > 0 ? (passesCompleted / passes) * 100 : 0;

      console.log('=== BENCH ===');
      console.table({
        fixtureSeed: DEFAULT_FIXTURE_SEED,
        matchSeed: SEED,
        ticks: s.ticks,
        elapsedMs,
        elapsedSec: (elapsedMs / 1000).toFixed(2),
        score: `${result.homeScore}-${result.awayScore}`,
        goals,
        shots,
        shotsHome: s.shots.home,
        shotsAway: s.shots.away,
        passes,
        passesCompleted,
        passCompletionRate: pcr.toFixed(2) + '%',
        possessionHome: s.possession.home,
        possessionAway: s.possession.away,
      });
    } finally {
      handle.restore();
    }
  }, 30 * 60 * 1000);
});
