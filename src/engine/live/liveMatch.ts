// src/engine/live/liveMatch.ts

/**
 * CANLI MAÇ ORKESTRASYONU
 * ========================
 *
 * KONTRAT:
 *  - Karar üretmez (decision.ts)
 *  - Hareket uygulamaz (movement.ts)
 *  - Fizik uygulamaz (ball.ts)
 *  - Tackle çözmez (tackle.ts)
 *  - Boundary kararı vermez (events.ts)
 *  - Set-piece pozisyonu üretmez (setPieces.ts)
 *
 *  - Tick sırasını yönetir
 *  - MatchEvent üretir
 *  - Stat + CareerStats günceller
 *  - Set-piece / faz geçişlerini tetikler
 *  - Possession tick sayar
 *
 * BALL FONKSİYONLARI:
 *   controlBall / stepBall / applyPass / applyShot / applyCross
 *   HEPSİ Ball döner. Dönüş değeri state.ball'a MUTLAKA atanır.
 *
 * SET-PIECE:
 *  - set-piece status 'ready' olduğunda taker topu KONTROL EDER.
 *  - Top taker'a verilir.
 *  - Status 'played' işaretlenir.
 *  - Sonraki tick'te normal decision sistemi oyunu devam ettirir.
 *
 * TACKLE + BALL ACTION:
 *  - Aynı tick'te tackle possession değiştirdiyse,
 *    yeni sahibin ball action'ı ÇALIŞTIRILMAZ.
 *
 * GOAL:
 *  - Top merkeze taşınır
 *  - phase = 'goal'
 *  - kickoff set-piece oluşturulur
 *  - İkinci kez shots++ YAPILMAZ
 *
 * USER LINEUP:
 *  - userLineup.length > 0 koşulu (11 şart değil)
 *  - 11'den azsa eksikler otomatik tamamlanır
 *  - 11'den fazlaysa ilk 11 alınır
 */

import type {
  Club,
  Decision,
  LiveMatchState,
  LiveMatchStats,
  LivePlayer,
  LiveTeamState,
  Match,
  Player,
  PitchDimensions,
  SetPieceState,
  TackleOutcome,
  Vec2,
} from '../types';

import { DEFAULT_PITCH_DIMENSIONS } from './pitch';
import type { TeamSide } from './pitch';

import {
  TICK_DURATION,
  MATCH_DURATION_SECONDS,
  HALF_DURATION_SECONDS,
  ADDED_TIME_SECONDS,
  DEFAULT_LIVE_ENGINE_CONFIG,
} from './config';

import {
  createBall,
  stepBall,
  controlBall,
  releaseBall,
  applyPass,
  applyShot,
  applyCross,
  DEFAULT_BALL_PHYSICS,
} from './ball';

import {
  computeCheapPerception,
} from './perception';

import {
  computeAllDecisions,
  type DecisionState,
} from './decision';

import {
  moveAllPlayers,
  computeMaxSpeed,
  computeAcceleration,
  type MovementContext,
} from './movement';

import {
  resolveAllTackles,
} from './tackle';

import {
  createSetPiece,
  updateSetPiece,
  markSetPiecePlayed,
  type SetPieceContext,
  type SetPieceType,
} from './setPieces';

import {
  detectBoundaryOutcome,
  type BoundaryOutcome,
} from './events';

import {
  createRng,
} from './rng';

// ═══════════════════════════════════════════════
// SIMULATE MATCH LIVE
// ═══════════════════════════════════════════════

export interface SimulateMatchLiveOptions {
  seed?: number | null;
  week?: number;
  userLineup?: string[];
  pitchDimensions?: PitchDimensions;
  onTick?: (state: LiveMatchState) => void;
}

export function simulateMatchLive(
  home: Club,
  away: Club,
  players: Record<string, Player>,
  options: SimulateMatchLiveOptions = {}
): Match {
  const pitch =
    options.pitchDimensions ?? DEFAULT_PITCH_DIMENSIONS;

  const week = options.week;
  const userLineup = options.userLineup;

  const seed =
    options.seed === null || options.seed === undefined
      ? Date.now()
      : options.seed;

  const rng = createRng(seed);

  // ─── Takımlar ───
  const homeTeam = buildTeamState(
    home,
    players,
    true,
    home.isUser ? userLineup : undefined,
    home.isUser
  );

  const awayTeam = buildTeamState(
    away,
    players,
    false,
    away.isUser ? userLineup : undefined,
    away.isUser
  );

  // ─── LivePlayer'lar ───
  const livePlayers: Record<string, LivePlayer> = {};

  for (const id of homeTeam.players) {
    livePlayers[id] = createLivePlayer(
      players[id],
      homeTeam,
      pitch
    );
  }

  for (const id of awayTeam.players) {
    livePlayers[id] = createLivePlayer(
      players[id],
      awayTeam,
      pitch
    );
  }

  // ─── Top ───
  const ball = createBall(pitch);

  // ─── State ───
  const state: LiveMatchState = {
    time: 0,
    tick: 0,
    phase: 'kickoff',
    addedTime: ADDED_TIME_SECONDS,

    pitch,

    home: homeTeam,
    away: awayTeam,

    ball,
    players: livePlayers,

    score: { home: 0, away: 0 },

    stats: createEmptyStats(),
    events: [],

    setPiece: null,
    decisions: {},
    sequences: [],

    rng,
    perceptionCache: {},

    lastBallOwnerId: null,

    isStopped: false,
    isFinished: false,
  };

  // ─── Possession sayaçları ───
  let homePossessionTicks = 0;
  let awayPossessionTicks = 0;

  // ─── İlk kickoff ───
  state.setPiece = createSetPieceForMatch(
    'kickoff',
    'HOME',
    getCenterPoint(pitch),
    pitch,
    home,
    away,
    players
  );

  state.events.push({
    minute: 0,
    type: 'kickoff',
    clubId: home.id,
    description: `Başlangıç vuruşu: ${home.shortName}`,
  });

  // ─── Tick döngüsü ───
  while (!state.isFinished) {
    runTick(
      state,
      players,
      (s) => {
        if (s.ball.ownerId !== null) {
          const owner = s.players[s.ball.ownerId];
          if (owner) {
            if (owner.isHome) homePossessionTicks++;
            else awayPossessionTicks++;
          }
        }
        options.onTick?.(s);
      }
    );
  }

  // ─── Possession yüzdesi ───
  const totalPossessionTicks =
    homePossessionTicks + awayPossessionTicks;

  if (totalPossessionTicks > 0) {
    const homePct = Math.round(
      (homePossessionTicks / totalPossessionTicks) * 100
    );
    state.stats.possession.home = homePct;
    state.stats.possession.away = 100 - homePct;
  }

  // ─── CareerStats ───
  updateCareerStatsAfterMatch(state, players);

  // ─── Match dönüşümü ───
  return convertToMatch(state, home, away, week);
}

// ═══════════════════════════════════════════════
// ANA TICK
// ═══════════════════════════════════════════════

function runTick(
  state: LiveMatchState,
  players: Record<string, Player>,
  onTick?: (state: LiveMatchState) => void
): void {
  // ─── 1. prevBallPos ───
  const prevBallPos = {
    x: state.ball.position.x,
    y: state.ball.position.y,
    z: state.ball.position.z,
  };

  // ─── 2. Zaman ───
  state.time += TICK_DURATION;
  state.tick += 1;

  // ─── 3. Perception cache ───
  updatePerceptionCaches(state);

  // ─── 4. Kararlar ───
  const decisionState = buildDecisionState(state);

  const { decisions, debugs } = computeAllDecisions(decisionState);

  state.decisions = debugs;

  // ─── 5. Hareket ───
  const movementContext: MovementContext = {
    pitch: state.pitch,
    ball: state.ball,
    players: state.players,
  };

  moveAllPlayers(
    state.players,
    decisions,
    movementContext,
    TICK_DURATION
  );

  // ─── 6. Tackle çözümlemesi ───
  const tackleOutcomes = resolveAllTackles(
    state.players,
    decisions,
    DEFAULT_LIVE_ENGINE_CONFIG.playerPhysics.tackleRadius,
    state.rng
  );

  // ─── 7. Tackle outcome'ları ───
  const tackleChangedPossession = applyTackleOutcomes(
    tackleOutcomes,
    state,
    players
  );

  // ─── 8. Top hareketi ───
  if (state.ball.ownerId === null) {
    state.ball = stepBall(
      state.ball,
      state.pitch,
      DEFAULT_BALL_PHYSICS,
      TICK_DURATION
    );
  }

  // ─── 8b. Ball actions ───
  if (!tackleChangedPossession) {
    applyBallActions(state, decisions);
  }

  // ─── 9. Sınır geçişi ───
  const boundaryOutcome = detectBoundaryOutcome({
    pitch: state.pitch,
    prevBallPos,
    nextBallPos: {
      x: state.ball.position.x,
      y: state.ball.position.y,
      z: state.ball.position.z,
    },
    lastTouchId: state.ball.lastTouchId,
    lastTouchClubId: state.ball.lastTouchClubId,
    homeClubId: state.home.club.id,
    awayClubId: state.away.club.id,
  });

  // ─── 10. Sınır sonucu ───
  applyBoundaryOutcome(boundaryOutcome, state, players);

  // ─── 11. Set-piece güncelle ───
  updateSetPieceStatus(state);

  // ─── 12. Set-piece temizliği ───
  if (
    state.setPiece !== null &&
    state.setPiece.status === 'played'
  ) {
    state.setPiece = null;
  }

  // ─── 13. Faz geçişi ───
  checkPhaseTransition(state);

  // ─── 14. Possession / takım state ───
  syncMatchOwnershipState(state);

  // ─── 15. Callback ───
  if (onTick) onTick(state);
}

// ═══════════════════════════════════════════════
// TAKIM STATE
// ═══════════════════════════════════════════════

function buildTeamState(
  club: Club,
  players: Record<string, Player>,
  isHome: boolean,
  userLineup: string[] | undefined,
  isUserClub: boolean
): LiveTeamState {
  let roster: string[];

  if (isUserClub && userLineup && userLineup.length > 0) {
    // Kullanıcı kadrosu — geçerli oyuncular
    roster = userLineup.filter(id => {
      const p = players[id];
      return (
        p !== undefined &&
        p.clubId === club.id &&
        p.injuryWeeks === 0 &&
        p.suspensionWeeks === 0
      );
    });

    // 11'i geçmesin
    if (roster.length > 11) {
      roster = roster.slice(0, 11);
    }

    // Eksikse en iyilerle tamamla
    if (roster.length < 11) {
      const used = new Set(roster);
      const fill = Object.values(players)
        .filter(p => p.clubId === club.id)
        .filter(p => p.squadRole !== 'u21')
        .filter(p => p.injuryWeeks === 0)
        .filter(p => p.suspensionWeeks === 0)
        .filter(p => !used.has(p.id))
        .sort((a, b) => b.overall - a.overall);

      for (const p of fill) {
        if (roster.length >= 11) break;
        roster.push(p.id);
      }
    }
  } else {
    // Fallback — otomatik 11
    roster = Object.values(players)
      .filter(p => p.clubId === club.id)
      .filter(p => p.squadRole !== 'u21')
      .filter(p => p.injuryWeeks === 0)
      .filter(p => p.suspensionWeeks === 0)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 11)
      .map(p => p.id);
  }

  return {
    club,
    players: roster,
    formation: club.formation,
    tactic: club.tactic,
    mentality: club.tactic.mentality,
    hasPossession: false,
    isHome,
    attackingDirection: isHome ? 1 : -1,
    formationZones: [],
  };
}

function createLivePlayer(
  player: Player,
  team: LiveTeamState,
  pitch: PitchDimensions
): LivePlayer {
  const homePosition = computeHomePosition(player, team, pitch);

  const livePlayer: LivePlayer = {
    player,
    position: { ...homePosition },
    velocity: { x: 0, y: 0 },
    facing: team.isHome ? 0 : 180,

    nextDecisionTime: 0,

    currentDecision: null,
    currentIntent: 'idle',

    isBallOwner: false,
    isChasingBall: false,
    isMarking: null,

    clubId: team.club.id,
    isHome: team.isHome,
    role: normalizeRole(player.position),

    homePosition,

    maxSpeed: 0,
    acceleration: 0,
  };

  livePlayer.maxSpeed = computeMaxSpeed(
    livePlayer,
    DEFAULT_LIVE_ENGINE_CONFIG.playerPhysics
  );
  livePlayer.acceleration = computeAcceleration(
    livePlayer,
    DEFAULT_LIVE_ENGINE_CONFIG.playerPhysics
  );

  return livePlayer;
}

function normalizeRole(position: string): LivePlayer['role'] {
  switch (position) {
    case 'GK': return 'GK';
    case 'DC': return 'CB';
    case 'DL':
    case 'DR': return 'FB';
    case 'WBL':
    case 'WBR': return 'WB';
    case 'DMC': return 'DM';
    case 'MC': return 'CM';
    case 'ML':
    case 'MR':
    case 'AML':
    case 'AMR': return 'W';
    case 'AMC': return 'AM';
    case 'ST':
    case 'KFL':
    case 'KFR':
    case 'GF': return 'ST';
    default: return 'CM';
  }
}

function computeHomePosition(
  player: Player,
  team: LiveTeamState,
  pitch: PitchDimensions
): Vec2 {
  const xBase = team.isHome ? 0 : pitch.length;
  const direction = team.isHome ? 1 : -1;

  const xOffset = getXOffsetForPosition(player.position);
  const yOffset = getYOffsetForPosition(player.position, pitch);

  return {
    x: xBase + direction * xOffset,
    y: yOffset,
  };
}

function getXOffsetForPosition(position: string): number {
  switch (position) {
    case 'GK': return 5;
    case 'DL':
    case 'DC':
    case 'DR': return 18;
    case 'WBL':
    case 'WBR': return 30;
    case 'DMC': return 38;
    case 'ML':
    case 'MC':
    case 'MR': return 48;
    case 'AML':
    case 'AMC':
    case 'AMR': return 65;
    case 'ST':
    case 'KFL':
    case 'KFR':
    case 'GF': return 80;
    default: return 50;
  }
}

function getYOffsetForPosition(
  position: string,
  pitch: PitchDimensions
): number {
  const center = pitch.width / 2;

  switch (position) {
    case 'GK':
    case 'DC':
    case 'DMC':
    case 'MC':
    case 'AMC':
    case 'ST':
    case 'GF':
      return center;

    case 'DL':
    case 'WBL':
    case 'ML':
    case 'AML':
    case 'KFL':
      return center - 12;

    case 'DR':
    case 'WBR':
    case 'MR':
    case 'AMR':
    case 'KFR':
      return center + 12;

    default:
      return center;
  }
}

// ═══════════════════════════════════════════════
// PERCEPTION CACHE
// ═══════════════════════════════════════════════

function updatePerceptionCaches(state: LiveMatchState): void {
  for (const id of Object.keys(state.players).sort()) {
    const player = state.players[id];

    const cheap = computeCheapPerception(player, {
      ball: state.ball,
      players: state.players,
      pitch: state.pitch,
    });

    const existing = state.perceptionCache[id];

    state.perceptionCache[id] = {
      cheap,
      full: existing?.full ?? null,
      fullAt: existing?.fullAt ?? 0,
    };
  }
}

// ═══════════════════════════════════════════════
// DECISION STATE
// ═══════════════════════════════════════════════

function buildDecisionState(state: LiveMatchState): DecisionState {
  return {
    ball: state.ball,
    players: state.players,
    pitch: state.pitch,
    time: state.time,
    rng: state.rng,
    playerPhysics: {
      tackleRadius: DEFAULT_LIVE_ENGINE_CONFIG.playerPhysics.tackleRadius,
    },
    setPiece: state.setPiece,
  };
}

// ═══════════════════════════════════════════════
// TACKLE OUTCOMES
// ═══════════════════════════════════════════════

function applyTackleOutcomes(
  outcomes: TackleOutcome[],
  state: LiveMatchState,
  players: Record<string, Player>
): boolean {
  for (const outcome of outcomes) {
    if (outcome.type === 'failed') continue;

    if (outcome.type === 'won') {
      applyTackleWon(outcome, state);
      return true;
    }

    if (outcome.type === 'foul') {
      applyTackleFoul(outcome, state, players);
      return true;
    }
  }

  return false;
}

function applyTackleWon(
  outcome: TackleOutcome & { type: 'won' },
  state: LiveMatchState
): void {
  const tackler = state.players[outcome.tacklerId];
  if (!tackler) return;

  if (outcome.newOwnerId !== null) {
    state.ball = controlBall(
      state.ball,
      outcome.newOwnerId,
      tackler.clubId
    );
  } else {
    state.ball.position.x = outcome.point.x;
    state.ball.position.y = outcome.point.y;
    state.ball.position.z = DEFAULT_BALL_PHYSICS.radius;
    state.ball.velocity = { x: 0, y: 0, z: 0 };
    state.ball.ownerId = null;
    state.ball.isMoving = false;
    state.ball.lastTouchId = outcome.tacklerId;
    state.ball.lastTouchClubId = tackler.clubId;
  }

  syncBallOwnerFlags(state);
}

function applyTackleFoul(
  outcome: TackleOutcome & { type: 'foul' },
  state: LiveMatchState,
  players: Record<string, Player>
): void {
  const tackler = state.players[outcome.tacklerId];
  if (!tackler) return;

  const foulSide: 'home' | 'away' = tackler.isHome ? 'home' : 'away';
  state.stats.fouls[foulSide] += 1;

  state.ball = releaseBall(state.ball);
  state.ball.position.x = outcome.point.x;
  state.ball.position.y = outcome.point.y;
  state.ball.position.z = DEFAULT_BALL_PHYSICS.radius;
  state.ball.velocity = { x: 0, y: 0, z: 0 };
  state.ball.isMoving = false;
  state.ball.lastTouchId = outcome.tacklerId;
  state.ball.lastTouchClubId = tackler.clubId;

  syncBallOwnerFlags(state);

  state.events.push({
    minute: Math.floor(state.time / 60),
    type: 'foul',
    playerId: tackler.player.id,
    clubId: tackler.clubId,
    description: `Faul: ${tackler.player.name}`,
  });

  const freeKickSide: TeamSide = tackler.isHome ? 'AWAY' : 'HOME';

  state.setPiece = createSetPieceForMatch(
    'free_kick',
    freeKickSide,
    outcome.point,
    state.pitch,
    state.home.club,
    state.away.club,
    players
  );
}

function syncBallOwnerFlags(state: LiveMatchState): void {
  for (const id of Object.keys(state.players)) {
    state.players[id].isBallOwner = state.ball.ownerId === id;
  }
}

// ═══════════════════════════════════════════════
// BALL ACTIONS
// ═══════════════════════════════════════════════

function applyBallActions(
  state: LiveMatchState,
  decisions: Record<string, Decision>
): void {
  const ownerId = state.ball.ownerId;
  if (ownerId === null) return;

  const owner = state.players[ownerId];
  if (!owner) return;

  const decision = decisions[ownerId];
  if (!decision) return;

  switch (decision.intent) {
    case 'pass':
      handlePassAction(owner, decision, state);
      break;

    case 'shoot':
      handleShootAction(owner, decision, state);
      break;

    case 'cross':
      handleCrossAction(owner, decision, state);
      break;

    case 'dribble':
      handleDribbleAction(owner, state);
      break;

    default:
      break;
  }
}

function handlePassAction(
  owner: LivePlayer,
  decision: Decision,
  state: LiveMatchState
): void {
  if (!decision.target) return;

  state.ball = applyPass(
    state.ball,
    {
      x: owner.position.x,
      y: owner.position.y,
      z: DEFAULT_BALL_PHYSICS.radius,
    },
    decision.target,
    decision.power,
    DEFAULT_BALL_PHYSICS,
    owner.player.id,
    owner.clubId
  );

  syncBallOwnerFlags(state);

  const side = owner.isHome ? 'home' : 'away';
  state.stats.passes[side] += 1;

  state.events.push({
    minute: Math.floor(state.time / 60),
    type: 'pass',
    playerId: owner.player.id,
    clubId: owner.clubId,
    description: `Pas: ${owner.player.name}`,
  });
}

function handleShootAction(
  owner: LivePlayer,
  decision: Decision,
  state: LiveMatchState
): void {
  if (!decision.target) return;

  const debug = state.decisions[owner.player.id];
  const selected = debug?.selected;
  const shotXG =
    selected?.type === 'shoot'
      ? selected.successProbability
      : 0;

  state.ball = applyShot(
    state.ball,
    {
      x: owner.position.x,
      y: owner.position.y,
      z: DEFAULT_BALL_PHYSICS.radius,
    },
    decision.target,
    decision.power,
    DEFAULT_BALL_PHYSICS,
    owner.player.id,
    owner.clubId
  );

  syncBallOwnerFlags(state);

  const side = owner.isHome ? 'home' : 'away';
  state.stats.shots[side] += 1;
  state.stats.xG[side] += shotXG;
  state.stats.chances[side] += 1;

  state.events.push({
    minute: Math.floor(state.time / 60),
    type: 'shot',
    playerId: owner.player.id,
    clubId: owner.clubId,
    xG: shotXG,
    description: `Şut: ${owner.player.name}`,
  });
}

function handleCrossAction(
  owner: LivePlayer,
  decision: Decision,
  state: LiveMatchState
): void {
  if (!decision.target) return;

  state.ball = applyCross(
    state.ball,
    {
      x: owner.position.x,
      y: owner.position.y,
      z: DEFAULT_BALL_PHYSICS.radius,
    },
    decision.target,
    decision.power,
    DEFAULT_BALL_PHYSICS,
    owner.player.id,
    owner.clubId
  );

  syncBallOwnerFlags(state);

  const side = owner.isHome ? 'home' : 'away';
  state.stats.crosses[side] += 1;

  state.events.push({
    minute: Math.floor(state.time / 60),
    type: 'cross',
    playerId: owner.player.id,
    clubId: owner.clubId,
    description: `Orta: ${owner.player.name}`,
  });
}

function handleDribbleAction(
  owner: LivePlayer,
  state: LiveMatchState
): void {
  const side = owner.isHome ? 'home' : 'away';
  state.stats.dribbles[side] += 1;

  state.events.push({
    minute: Math.floor(state.time / 60),
    type: 'dribble',
    playerId: owner.player.id,
    clubId: owner.clubId,
    description: `Çalım: ${owner.player.name}`,
  });
}

// ═══════════════════════════════════════════════
// BOUNDARY OUTCOMES
// ═══════════════════════════════════════════════

function applyBoundaryOutcome(
  outcome: BoundaryOutcome,
  state: LiveMatchState,
  players: Record<string, Player>
): void {
  if (outcome.type === 'none') return;

  if (outcome.type === 'goal') {
    if (resolveGoalkeeperSave(outcome, state)) {
      return;
    }

    handleGoal(outcome, state, players);
    return;
  }

  if (outcome.type === 'corner') {
    handleCorner(outcome, state, players);
    return;
  }

  if (outcome.type === 'throw_in') {
    handleThrowIn(outcome, state, players);
    return;
  }

  if (outcome.type === 'goal_kick') {
    handleGoalKick(outcome, state, players);
    return;
  }
}

function resolveGoalkeeperSave(
  outcome: BoundaryOutcome & { type: 'goal' },
  state: LiveMatchState
): boolean {
  const shotEvent = [...state.events]
    .reverse()
    .find(event =>
      event.type === 'shot' &&
      event.playerId === state.ball.lastTouchId
    );

  if (!shotEvent) {
    return false;
  }

  const defendingSide = outcome.scorerSide === 'HOME' ? 'AWAY' : 'HOME';
  const goalkeeper = Object.values(state.players).find(
    player =>
      player.role === 'GK' &&
      ((defendingSide === 'HOME' && player.isHome) ||
        (defendingSide === 'AWAY' && !player.isHome))
  );

  if (!goalkeeper) {
    return false;
  }

  const shotXG = typeof shotEvent.xG === 'number'
    ? Math.max(0.02, Math.min(0.7, shotEvent.xG))
    : 0.2;

  const gkSkill = Math.max(
    0,
    Math.min(
      1,
      (
        goalkeeper.player.attributes.goalkeeper +
        goalkeeper.player.attributes.reflexes +
        goalkeeper.player.attributes.gkPositioning +
        goalkeeper.player.attributes.handling +
        goalkeeper.player.attributes.oneOnOne
      ) / 100
    )
  );

  const saveChance = Math.max(
    0.25,
    Math.min(
      0.80,
      0.65 + gkSkill * 0.15 - shotXG * 0.35
    )
  );

  if (!nextBool(state.rng, saveChance)) {
    return false;
  }

  const side = outcome.scorerSide === 'HOME' ? 'home' : 'away';
  state.stats.onTarget[side] += 1;

  state.events.push({
    minute: Math.floor(state.time / 60),
    type: 'goal_kick',
    clubId: defendingSide === 'HOME'
      ? state.home.club.id
      : state.away.club.id,
    description: `Kurtarış: ${goalkeeper.player.name}`,
  });

  state.ball = releaseBall(state.ball);

  const goalLineX = defendingSide === 'HOME'
    ? 0.5
    : state.pitch.length - 0.5;

  state.ball.position.x = goalLineX;
  state.ball.position.y = Math.max(
    8,
    Math.min(
      state.pitch.width - 8,
      state.ball.position.y
    )
  );
  state.ball.position.z = DEFAULT_BALL_PHYSICS.radius;
  state.ball.velocity = { x: 0, y: 0, z: 0 };
  state.ball.isMoving = false;

  syncBallOwnerFlags(state);

  state.setPiece = createSetPieceForMatch(
    'goal_kick',
    defendingSide,
    { x: goalLineX, y: state.ball.position.y },
    state.pitch,
    state.home.club,
    state.away.club,
    playersForSetPiece(state)
  );

  return true;
}

/**
 * GOL.
 *
 * KONTRAT:
 *  - Skor +1
 *  - onTarget +1
 *  - shots +1 YOK (shot anında zaten yapıldı)
 *  - CareerStats (own goal hariç)
 *  - Top MERKEZE taşınır
 *  - phase = 'goal'
 *  - kickoff set-piece oluşturulur
 *  - kickoff event üretilir
 */
function handleGoal(
  outcome: BoundaryOutcome & { type: 'goal' },
  state: LiveMatchState,
  players: Record<string, Player>
): void {
  const scorerId = state.ball.lastTouchId;

  if (outcome.scorerSide === 'HOME') {
    state.score.home += 1;
  } else {
    state.score.away += 1;
  }

  const side = outcome.scorerSide === 'HOME' ? 'home' : 'away';
  state.stats.onTarget[side] += 1;

  // CareerStats — own goal hariç
  if (!outcome.ownGoal && scorerId && players[scorerId]) {
    const p = players[scorerId];
    p.careerStats.goals += 1;
    p.careerStats.seasonGoals += 1;
  }

  state.events.push({
    minute: Math.floor(state.time / 60),
    type: 'goal',
    playerId: scorerId ?? undefined,
    clubId: outcome.scorerSide === 'HOME'
      ? state.home.club.id
      : state.away.club.id,
    description: outcome.ownGoal
      ? `Kendi kalesine gol!`
      : `GOL! ${scorerId && players[scorerId] ? players[scorerId].name : '?'}`,
  });

  // ─── Top merkeze ───
  state.ball = releaseBall(state.ball);

  const center = getCenterPoint(state.pitch);

  state.ball.position.x = center.x;
  state.ball.position.y = center.y;
  state.ball.position.z = DEFAULT_BALL_PHYSICS.radius;
  state.ball.velocity = { x: 0, y: 0, z: 0 };
  state.ball.isMoving = false;

  syncBallOwnerFlags(state);

  // ─── Faz ───
  state.phase = 'goal';

  // ─── Kickoff set-piece ───
  const kickoffSide: TeamSide =
    outcome.scorerSide === 'HOME' ? 'AWAY' : 'HOME';

  state.setPiece = createSetPieceForMatch(
    'kickoff',
    kickoffSide,
    center,
    state.pitch,
    state.home.club,
    state.away.club,
    players
  );

  state.events.push({
    minute: Math.floor(state.time / 60),
    type: 'kickoff',
    clubId: kickoffSide === 'HOME'
      ? state.home.club.id
      : state.away.club.id,
    description: `Başlangıç vuruşu: ${
      kickoffSide === 'HOME'
        ? state.home.club.shortName
        : state.away.club.shortName
    }`,
  });
}

function handleCorner(
  outcome: BoundaryOutcome & { type: 'corner' },
  state: LiveMatchState,
  players: Record<string, Player>
): void {
  const side = outcome.side === 'HOME' ? 'home' : 'away';
  state.stats.corners[side] += 1;

  state.events.push({
    minute: Math.floor(state.time / 60),
    type: 'corner',
    clubId: outcome.side === 'HOME'
      ? state.home.club.id
      : state.away.club.id,
    description: `Korner: ${
      outcome.side === 'HOME'
        ? state.home.club.shortName
        : state.away.club.shortName
    }`,
  });

  state.ball = releaseBall(state.ball);
  state.ball.position.x = outcome.point.x;
  state.ball.position.y = outcome.point.y;
  state.ball.position.z = DEFAULT_BALL_PHYSICS.radius;
  state.ball.velocity = { x: 0, y: 0, z: 0 };
  state.ball.isMoving = false;
  syncBallOwnerFlags(state);

  state.setPiece = createSetPieceForMatch(
    'corner',
    outcome.side,
    outcome.point,
    state.pitch,
    state.home.club,
    state.away.club,
    players
  );
}

function handleThrowIn(
  outcome: BoundaryOutcome & { type: 'throw_in' },
  state: LiveMatchState,
  players: Record<string, Player>
): void {
  const side = outcome.side === 'HOME' ? 'home' : 'away';
  state.stats.throwIns[side] += 1;

  state.events.push({
    minute: Math.floor(state.time / 60),
    type: 'throw_in',
    clubId: outcome.side === 'HOME'
      ? state.home.club.id
      : state.away.club.id,
    description: `Taç: ${
      outcome.side === 'HOME'
        ? state.home.club.shortName
        : state.away.club.shortName
    }`,
  });

  state.ball = releaseBall(state.ball);
  state.ball.position.x = outcome.point.x;
  state.ball.position.y = outcome.point.y;
  state.ball.position.z = DEFAULT_BALL_PHYSICS.radius;
  state.ball.velocity = { x: 0, y: 0, z: 0 };
  state.ball.isMoving = false;
  syncBallOwnerFlags(state);

  state.setPiece = createSetPieceForMatch(
    'throw_in',
    outcome.side,
    outcome.point,
    state.pitch,
    state.home.club,
    state.away.club,
    players
  );
}

function handleGoalKick(
  outcome: BoundaryOutcome & { type: 'goal_kick' },
  state: LiveMatchState,
  players: Record<string, Player>
): void {
  const side = outcome.side === 'HOME' ? 'home' : 'away';
  state.stats.goalKicks[side] += 1;

  state.events.push({
    minute: Math.floor(state.time / 60),
    type: 'goal_kick',
    clubId: outcome.side === 'HOME'
      ? state.home.club.id
      : state.away.club.id,
    description: `Kale vuruşu: ${
      outcome.side === 'HOME'
        ? state.home.club.shortName
        : state.away.club.shortName
    }`,
  });

  state.ball = releaseBall(state.ball);
  state.ball.position.x = outcome.point.x;
  state.ball.position.y = outcome.point.y;
  state.ball.position.z = DEFAULT_BALL_PHYSICS.radius;
  state.ball.velocity = { x: 0, y: 0, z: 0 };
  state.ball.isMoving = false;
  syncBallOwnerFlags(state);

  state.setPiece = createSetPieceForMatch(
    'goal_kick',
    outcome.side,
    outcome.point,
    state.pitch,
    state.home.club,
    state.away.club,
    players
  );
}

// ═══════════════════════════════════════════════
// SET-PIECE
// ═══════════════════════════════════════════════

function createSetPieceForMatch(
  type: SetPieceType,
  teamSide: TeamSide,
  ballPosition: Vec2,
  pitch: PitchDimensions,
  home: Club,
  away: Club,
  players: Record<string, Player>
): SetPieceState {
  const takerClub = teamSide === 'HOME' ? home : away;
  const defenderClub = teamSide === 'HOME' ? away : home;

  const takerTeamPlayers: Record<string, Player> = {};
  const defenderTeamPlayers: Record<string, Player> = {};

  for (const id of Object.keys(players).sort()) {
    const p = players[id];

    if (
      p.clubId === takerClub.id &&
      p.squadRole !== 'u21' &&
      p.injuryWeeks === 0 &&
      p.suspensionWeeks === 0
    ) {
      takerTeamPlayers[id] = p;
    } else if (
      p.clubId === defenderClub.id &&
      p.squadRole !== 'u21' &&
      p.injuryWeeks === 0 &&
      p.suspensionWeeks === 0
    ) {
      defenderTeamPlayers[id] = p;
    }
  }

  const context: SetPieceContext = {
    pitch,
    type,
    teamSide,
    ballPosition,
    takerTeamPlayers,
    defenderTeamPlayers,
    takerTactic: takerClub.tactic,
    defenderTactic: defenderClub.tactic,
  };

  return createSetPiece(context);
}

/**
 * Set-piece tick güncellemesi.
 *
 * KRİTİK:
 *  - status 'ready' olduğunda taker topu KONTROL EDER.
 *  - Top taker'a verilir.
 *  - Status 'played' işaretlenir.
 *  - Sonraki tick'te normal decision sistemi oyunu devam ettirir.
 */
function updateSetPieceStatus(state: LiveMatchState): void {
  if (state.setPiece === null) return;

  const playerPositions: Record<string, Vec2> = {};
  for (const id of Object.keys(state.players)) {
    playerPositions[id] = state.players[id].position;
  }

  state.setPiece = updateSetPiece(
    state.setPiece,
    playerPositions,
    TICK_DURATION
  );

  if (state.setPiece.status === 'ready') {
    const takerId = state.setPiece.takerId;

    if (takerId !== null) {
      const taker = state.players[takerId];

      if (taker) {
        // Top taker'ın ayağına
        state.ball.position.x = taker.position.x;
        state.ball.position.y = taker.position.y;
        state.ball.position.z = DEFAULT_BALL_PHYSICS.radius;
        state.ball.velocity = { x: 0, y: 0, z: 0 };
        state.ball.isMoving = false;

        // Top sahibi = taker
        state.ball = controlBall(
          state.ball,
          takerId,
          taker.clubId
        );

        syncBallOwnerFlags(state);
      }
    }

    // ─── Set-piece oynandı ───
    state.setPiece = markSetPiecePlayed(state.setPiece);
  }
}

// ═══════════════════════════════════════════════
// FAZ GEÇİŞLERİ
// ═══════════════════════════════════════════════

function checkPhaseTransition(state: LiveMatchState): void {
  if (state.setPiece !== null) return;

  if (state.phase === 'kickoff' || state.phase === 'goal') {
    state.phase = state.time < HALF_DURATION_SECONDS
      ? 'first_half'
      : 'second_half';
    return;
  }

  if (
    state.phase === 'first_half' &&
    state.time >= HALF_DURATION_SECONDS
  ) {
    state.phase = 'half_time';

    state.events.push({
      minute: 45,
      type: 'halftime',
      description: 'İlk yarı sonu',
    });

    return;
  }

  if (state.phase === 'half_time') {
    state.phase = 'second_half';
    return;
  }

  if (
    state.phase === 'second_half' &&
    state.time >= MATCH_DURATION_SECONDS
  ) {
    state.phase = 'full_time';
    state.isFinished = true;

    state.events.push({
      minute: 90,
      type: 'fulltime',
      description: 'Maç sonu',
    });
  }
}

// ═══════════════════════════════════════════════
// POSSESSION / OWNERSHIP
// ═══════════════════════════════════════════════

function syncMatchOwnershipState(state: LiveMatchState): void {
  const ownerId = state.ball.ownerId;

  state.lastBallOwnerId = ownerId;

  state.home.hasPossession =
    ownerId !== null &&
    state.players[ownerId]?.isHome === true;

  state.away.hasPossession =
    ownerId !== null &&
    state.players[ownerId]?.isHome === false;
}

// ═══════════════════════════════════════════════
// CAREER STATS
// ═══════════════════════════════════════════════

function updateCareerStatsAfterMatch(
  state: LiveMatchState,
  players: Record<string, Player>
): void {
  const minutesPlayed = Math.floor(state.time / 60);

  for (const id of Object.keys(state.players)) {
    const p = players[id];
    if (!p) continue;

    const isStarter =
      state.home.players.includes(id) ||
      state.away.players.includes(id);

    if (!isStarter) continue;

    p.careerStats.appearances += 1;
    p.careerStats.seasonAppearances += 1;
    p.careerStats.minutesPlayed += minutesPlayed;
    p.careerStats.seasonMinutesPlayed += minutesPlayed;
  }
}

// ═══════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════

function getCenterPoint(pitch: PitchDimensions): Vec2 {
  return { x: pitch.length / 2, y: pitch.width / 2 };
}

function createEmptyStats(): LiveMatchStats {
  return {
    possession: { home: 50, away: 50 },
    shots: { home: 0, away: 0 },
    onTarget: { home: 0, away: 0 },
    chances: { home: 0, away: 0 },
    xG: { home: 0, away: 0 },
    passes: { home: 0, away: 0 },
    passesCompleted: { home: 0, away: 0 },
    dribbles: { home: 0, away: 0 },
    dribblesSuccess: { home: 0, away: 0 },
    crosses: { home: 0, away: 0 },
    crossesSuccess: { home: 0, away: 0 },
    dangerousAttacks: { home: 0, away: 0 },
    recoveries: { home: 0, away: 0 },
    fouls: { home: 0, away: 0 },
    yellowCards: { home: 0, away: 0 },
    redCards: { home: 0, away: 0 },
    corners: { home: 0, away: 0 },
    throwIns: { home: 0, away: 0 },
    goalKicks: { home: 0, away: 0 },
    offsides: { home: 0, away: 0 },
    ticks: 0,
    simulationSeconds: 0,
  };
}

function convertToMatch(
  state: LiveMatchState,
  home: Club,
  away: Club,
  week: number | undefined
): Match {
  state.stats.ticks = state.tick;
  state.stats.simulationSeconds = state.time;

  return {
    id: `match_live_${home.id}_${away.id}`,
    week,
    homeId: home.id,
    awayId: away.id,
    homeScore: state.score.home,
    awayScore: state.score.away,
    events: state.events,
    sequences: state.sequences,
    stats: state.stats,
    played: true,
  };
}