// src/engine/live/bench1.test.ts
//
// Tek maçlık benchmark — performans + takım güç profili diagnostik.
//
// Kullanım:
//   npx vitest run src/engine/live/bench1.test.ts

import { describe, it, vi } from 'vitest';
import { simulateMatchLive } from './liveMatch';
import { generateGameData } from '../data/generateData';
import {
  installDeterministicRandom,
  DEFAULT_FIXTURE_SEED,
} from './diagnostics/deterministicFixture';
import type { Player, LiveMatchState, LivePlayer, Decision } from '../types';

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


// ═══════════════════════════════════════════════
// PASS DECOMPOSITION — test scope only
// Production actionResolution.ts'e dokunulmaz.
// ═══════════════════════════════════════════════

interface PassDecomposition {
  tick: number;
  passerId: string;
  passingSkill: number;
  skillProbability: number;
  lane: number;
  lanePenalty: number;
  targetDistance: number;
  distanceFactor: number;
  distancePenaltyContribution: number;
  pressure: number;
  pressurePenalty: number;
  attackingModifier: number;
  tempo: number;
  role: number;
  pressing: number;
  directness: number;
  tacticFactor: number;
  tacticPenalty: number;
  totalPenaltyRaw: number;
  totalPenaltyCapped: number;
  penaltyCapHit: boolean;
  raw: number;
  rawBelowFloor: boolean;
  finalProbability: number;
  originalResultProbability: number;
}

function localClamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function localDistance(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function localConditionFactor(player: LivePlayer): number {
  const condition = localClamp(player.player.condition, 0, 100);
  const fatigue = localClamp(player.player.fatigue, 0, 100);
  const conditionFactor = 0.60 + 0.40 * (condition / 100);
  const fatiguePenalty = 1 - fatigue / 100 * 0.18;
  return conditionFactor * fatiguePenalty;
}

function localLaneClarity(
  owner: LivePlayer,
  target: { x: number; y: number },
  state: LiveMatchState
): number {
  const dx = target.x - owner.position.x;
  const dy = target.y - owner.position.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return 0;

  let interference = 0;

  for (const id of Object.keys(state.players).sort()) {
    const opponent = state.players[id];
    if (opponent.isHome === owner.isHome) continue;

    const px = opponent.position.x - owner.position.x;
    const py = opponent.position.y - owner.position.y;
    const projection = (px * dx + py * dy) / (length * length);
    if (projection <= 0 || projection >= 1) continue;

    const closestX = owner.position.x + dx * projection;
    const closestY = owner.position.y + dy * projection;
    const lateral = Math.hypot(
      opponent.position.x - closestX,
      opponent.position.y - closestY
    );

    if (lateral < 1.5) interference += 0.55;
    else if (lateral < 3) interference += 0.20;
  }

  return localClamp(1 - interference, 0.05, 1);
}

function localPressureAtOwner(
  owner: LivePlayer,
  state: LiveMatchState
): number {
  let pressure = 0;

  for (const id of Object.keys(state.players).sort()) {
    const opponent = state.players[id];
    if (opponent.isHome === owner.isHome) continue;

    const d = localDistance(owner.position, opponent.position);
    if (d <= 2) pressure += 1;
    else if (d <= 4) pressure += 0.65;
    else if (d <= 7) pressure += 0.30;
  }

  return localClamp(pressure / 2.5, 0, 1);
}

function localMentalityModifier(mentality: string, isAttacking: boolean): number {
  if (mentality === 'attacking') return isAttacking ? 1.06 : 0.94;
  if (mentality === 'defensive') return isAttacking ? 0.94 : 1.06;
  return 1.00;
}

function localTempoModifier(tempo: string): number {
  if (tempo === 'fast') return 1.05;
  if (tempo === 'slow') return 0.96;
  return 1.00;
}

function localPressingModifier(pressing: string): number {
  if (pressing === 'high') return 1.12;
  if (pressing === 'low') return 0.90;
  return 1.00;
}

function localRoleModifier(
  role: LivePlayer['role'],
  phase: 'attack' | 'defense' | 'midfield' | 'press'
): number {
  switch (role) {
    case 'GK': return phase === 'defense' ? 1.04 : 1;
    case 'CB': return phase === 'defense' ? 1.08 : phase === 'midfield' ? 1.02 : 0.96;
    case 'FB': return phase === 'defense' ? 1.05 : phase === 'attack' ? 1.02 : 1;
    case 'WB': return phase === 'attack' ? 1.08 : phase === 'defense' ? 0.98 : 1.02;
    case 'DM': return phase === 'defense' ? 1.08 : phase === 'midfield' ? 1.06 : 0.94;
    case 'CM': return phase === 'midfield' ? 1.06 : 1.02;
    case 'AM': return phase === 'attack' ? 1.08 : phase === 'midfield' ? 1.04 : 0.96;
    case 'W':  return phase === 'attack' ? 1.07 : phase === 'press' ? 1.05 : 1;
    case 'ST': return phase === 'attack' ? 1.10 : phase === 'press' ? 1.04 : 0.96;
    default: return 1;
  }
}

function decomposePass(
  tick: number,
  owner: LivePlayer,
  decision: Decision,
  state: LiveMatchState,
  originalProbability: number
): PassDecomposition | null {
  if (decision.target === null) return null;

  const a = owner.player.attributes;

  const passingSkill =
    ((a.passing + a.vision + a.firstTouch + a.technique + a.decisions) / 5)
    * localConditionFactor(owner);

  const skillProbability = passingSkill / 15;

  const lane = localLaneClarity(owner, decision.target, state);
  const lanePenalty = (1 - lane) * 0.35;

  const targetDistance = localDistance(owner.position, decision.target);
  const distanceFactor =
    targetDistance <= 12
      ? 1
      : localClamp(1 - (targetDistance - 12) / 55, 0.55, 1);
  const distancePenaltyContribution = (1 - distanceFactor) * 0.25;

  const pressure = localPressureAtOwner(owner, state);
  const pressurePenalty = pressure * 0.30;

  const tactic =
    state.home.club.id === owner.clubId
      ? state.home.club.tactic
      : state.away.club.tactic;

  const isAttacking = owner.isHome
    ? decision.target.x > owner.position.x
    : decision.target.x < owner.position.x;

  const attackingModifier = localMentalityModifier(tactic.mentality, isAttacking);
  const tempo = localTempoModifier(tactic.tempo);
  const role = localRoleModifier(owner.role, 'midfield');
  const pressing = localPressingModifier(tactic.pressing);
  const directness =
    tactic.directness === 'direct' ? 1.06 :
    tactic.directness === 'short' ? 0.97 : 1;

  const tacticFactor =
    attackingModifier * tempo * role * directness * (0.94 + pressing * 0.06);

  const tacticPenalty = Math.max(0, 1 - tacticFactor) * 0.20;

  const totalPenaltyRaw =
    lanePenalty + distancePenaltyContribution + pressurePenalty + tacticPenalty;

  const totalPenaltyCapped = localClamp(totalPenaltyRaw * 0.6, 0, 0.35);
  const penaltyCapHit = totalPenaltyRaw * 0.6 > 0.35 + 1e-9;

  const raw = skillProbability - totalPenaltyCapped;
  const finalProbability = localClamp(raw, 0.35, 0.92);
  const rawBelowFloor = raw < 0.35 - 1e-9;

  return {
    tick,
    passerId: owner.player.id,
    passingSkill,
    skillProbability,
    lane,
    lanePenalty,
    targetDistance,
    distanceFactor,
    distancePenaltyContribution,
    pressure,
    pressurePenalty,
    attackingModifier,
    tempo,
    role,
    pressing,
    directness,
    tacticFactor,
    tacticPenalty,
    totalPenaltyRaw,
    totalPenaltyCapped,
    penaltyCapHit,
    raw,
    rawBelowFloor,
    finalProbability,
    originalResultProbability: originalProbability,
  };
}

const hoisted = vi.hoisted(() => ({
  PASS_DECOMP: [] as PassDecomposition[],
  currentTick: -1,
}));

vi.mock('./actionResolution', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./actionResolution')>();

  return {
    ...actual,
    resolvePassAction: (
      owner: LivePlayer,
      decision: Decision,
      liveState: LiveMatchState
    ) => {
      const result = actual.resolvePassAction(owner, decision, liveState);

      try {
        const decomp = decomposePass(
          hoisted.currentTick,
          owner,
          decision,
          liveState,
          result.probability
        );
        if (decomp !== null) hoisted.PASS_DECOMP.push(decomp);
      } catch {
        // Diagnostic hata üretse bile maç motorunu etkilemesin.
      }

      return result;
    },
  };
});

describe('single match bench', () => {
  it(`fixtureSeed=${DEFAULT_FIXTURE_SEED}, matchSeed=${SEED}, ticks=${MATCH_TICKS}`, () => {
    hoisted.PASS_DECOMP.length = 0;
    hoisted.currentTick = -1;

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
        onTick: liveState => {
          hoisted.currentTick = liveState.tick;

          if (firstState === null) {
            firstState = liveState;
            capturedTick = liveState.tick;
            firstStatePlayers = Object.fromEntries(
              Object.entries(liveState.players).map(([id, livePlayer]) => [
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
      
      // ── PASS DECOMPOSITION AGGREGATE ──
      console.log('=== PASS DECOMPOSITION AGGREGATE ===');
      console.log('total samples:', hoisted.PASS_DECOMP.length);

      function stats(arr: number[]) {
        if (arr.length === 0) {
          return { mean: 0, median: 0, min: 0, max: 0 };
        }

        const sorted = [...arr].sort((a, b) => a - b);
        return {
          mean: arr.reduce((sum, value) => sum + value, 0) / arr.length,
          median: sorted[Math.floor(sorted.length / 2)],
          min: sorted[0],
          max: sorted[sorted.length - 1],
        };
      }

      const fields: Array<keyof PassDecomposition> = [
        'passingSkill',
        'skillProbability',
        'lane',
        'lanePenalty',
        'targetDistance',
        'distanceFactor',
        'distancePenaltyContribution',
        'pressure',
        'pressurePenalty',
        'attackingModifier',
        'tempo',
        'role',
        'pressing',
        'directness',
        'tacticFactor',
        'tacticPenalty',
        'totalPenaltyRaw',
        'totalPenaltyCapped',
        'raw',
        'finalProbability',
        'originalResultProbability',
      ];

      console.table(
        fields.map(field => {
          const values = hoisted.PASS_DECOMP
            .map(d => d[field])
            .filter((value): value is number => typeof value === 'number');

          const s = stats(values);

          return {
            field,
            mean: s.mean.toFixed(4),
            median: s.median.toFixed(4),
            min: s.min.toFixed(4),
            max: s.max.toFixed(4),
          };
        })
      );

      const capHitCount = hoisted.PASS_DECOMP.filter(
        d => d.penaltyCapHit
      ).length;
      const floorHitCount = hoisted.PASS_DECOMP.filter(
        d => d.rawBelowFloor
      ).length;
      const n = hoisted.PASS_DECOMP.length;

      console.log('=== HIT COUNTS ===');
      console.table({
        penaltyCapHit: capHitCount,
        penaltyCapHitPct:
          n > 0 ? ((capHitCount / n) * 100).toFixed(1) + '%' : 'n/a',
        rawBelowFloor: floorHitCount,
        rawBelowFloorPct:
          n > 0 ? ((floorHitCount / n) * 100).toFixed(1) + '%' : 'n/a',
      });

      if (n > 0) {
        const avgLane =
          hoisted.PASS_DECOMP.reduce((sum, d) => sum + d.lanePenalty, 0) / n;
        const avgDist =
          hoisted.PASS_DECOMP.reduce(
            (sum, d) => sum + d.distancePenaltyContribution,
            0
          ) / n;
        const avgPress =
          hoisted.PASS_DECOMP.reduce((sum, d) => sum + d.pressurePenalty, 0) / n;
        const avgTactic =
          hoisted.PASS_DECOMP.reduce((sum, d) => sum + d.tacticPenalty, 0) / n;

        console.log('=== AVG PENALTY CONTRIBUTIONS ===');
        console.table({
          lanePenalty: avgLane.toFixed(4),
          distancePenaltyContribution: avgDist.toFixed(4),
          pressurePenalty: avgPress.toFixed(4),
          tacticPenalty: avgTactic.toFixed(4),
        });
      }

    } finally {
      handle.restore();
    }
  }, 30 * 60 * 1000);
});
