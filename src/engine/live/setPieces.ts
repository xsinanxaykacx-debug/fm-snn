// src/engine/live/setPieces.ts

/**
 * SET-PIECE POZİSYONLAMA
 * -----------------------
 * Bu dosya yalnızca hedef pozisyon üretir ve set-piece durumunu yönetir.
 *
 * YASAK:
 *  - Oyuncu hareket ettirme (movement.ts'in işi)
 *  - Oyuncu hızı hesaplama
 *  - Fizik uygulama (ball.ts'in işi)
 *  - RNG
 *  - MatchEvent üretme (liveMatch.ts'in işi)
 *  - Stat güncelleme
 *  - Gol / aut / korner KARARI (events.ts'in işi)
 *
 * KONTRAT:
 *  - setPieces.ts HEDEF POZİSYONLARI üretir.
 *  - movement.ts oyuncuları bu hedeflere götürür.
 *  - updateSetPiece() immutable'dır; yeni state döner.
 *  - requiredPlayerIds yalnızca TAKER TAKIMININ oyuncularından türetilir.
 *  - Taker seçimi deterministiktir (RNG yok).
 *  - goal_kick'te GK yoksa selectTaker() null döner.
 *  - goalHeight / physics bu dosyada kullanılmaz.
 *  - Yeni attribute eklenmez; mevcut Attributes kullanılır.
 */

import type { Player, PitchDimensions, Tactic, Vec2 } from '../types';
import type { TeamSide } from './events';

// ═══════════════════════════════════════════════
// TİPLER
// ═══════════════════════════════════════════════

export type SetPieceType =
  | 'kickoff'
  | 'goal_kick'
  | 'corner'
  | 'throw_in'
  | 'free_kick'
  | 'penalty';

export type SetPieceStatus =
  | 'positioning'
  | 'ready'
  | 'played';

export interface SetPieceState {
  type: SetPieceType;
  teamSide: TeamSide;

  /** Topu kullanacak oyuncu */
  takerId: string | null;

  /** Topun başlangıç noktası (2D) */
  ballPosition: Vec2;

  /**
   * Her oyuncu için hedef pozisyon. Anahtar = player.id
   *
   * Hem taker takımının hem de savunan takımın hedeflerini içerir.
   * Ancak requiredPlayerIds YALNIZCA taker takımından türetilir.
   */
  targetPositions: Record<string, Vec2>;

  /** `ready` kararı için beklenen oyuncu id'leri (yalnızca taker takımı) */
  requiredPlayerIds: string[];

  /** Set-piece yaşam döngüsü */
  status: SetPieceStatus;

  /** `positioning` başlangıcından bu yana geçen süre (güvenlik valfi) */
  elapsed: number;
}

export interface SetPieceContext {
  pitch: PitchDimensions;

  type: SetPieceType;
  teamSide: TeamSide;

  /** Topun sahaya giriş noktası (korner köşesi, taç noktası vb.) */
  ballPosition: Vec2;

  /** Set-piece'i kullanan takımın oyuncuları */
  takerTeamPlayers: Record<string, Player>;

  /** Rakip takımın oyuncuları */
  defenderTeamPlayers: Record<string, Player>;

  /** Kullanan takımın taktiği */
  takerTactic: Tactic;

  /** Savunan takımın taktiği */
  defenderTactic: Tactic;
}

// ═══════════════════════════════════════════════
// SABİTLER
// ═══════════════════════════════════════════════

export const SET_PIECE_POSITION_TOLERANCE = 0.5;
export const SET_PIECE_MAX_POSITIONING_SECONDS = 8.0;
export const THROW_IN_DISTANCE_FROM_LINE = 0.5;

// ═══════════════════════════════════════════════
// TAKER SEÇİMİ
// ═══════════════════════════════════════════════

/**
 * Taker uygunluk skoru — deterministik, RNG yok.
 */
export function takerScore(type: SetPieceType, player: Player): number {
  const a = player.attributes;

  switch (type) {
    case 'corner':
      return (
        a.crossing * 0.4 +
        a.technique * 0.2 +
        a.setPieces * 0.3 +
        a.passing * 0.1
      );

    case 'free_kick':
      return (
        a.setPieces * 0.4 +
        a.technique * 0.2 +
        a.passing * 0.2 +
        a.finishing * 0.2
      );

    case 'penalty':
      return (
        a.composure * 0.5 +
        a.finishing * 0.3 +
        a.technique * 0.2
      );

    case 'goal_kick':
      // Kaleci zorunlu
      if (player.position !== 'GK') return -1;
      return (
        a.gkPositioning * 0.4 +
        a.handling * 0.3 +
        a.reflexes * 0.3
      );

    case 'throw_in':
      return (
        a.passing * 0.4 +
        a.strength * 0.3 +
        a.stamina * 0.3
      );

    case 'kickoff':
      return (
        a.passing * 0.5 +
        a.vision * 0.3 +
        a.decisions * 0.2
      );
  }
}

/**
 * Taker'ı deterministik olarak seçer.
 *
 * KONTRAT:
 *  • RNG yok.
 *  • Aynı girdi → aynı çıktı.
 *  • Eşitlikte id'ye göre artan sıralama (deterministik tie-break).
 *  • goal_kick'te GK yoksa null döner.
 */
export function selectTaker(
  type: SetPieceType,
  players: Record<string, Player>
): string | null {
  // goal_kick: kaleci zorunlu
  if (type === 'goal_kick') {
    const gkIds = Object.keys(players)
      .filter(id => players[id].position === 'GK')
      .sort();

    if (gkIds.length === 0) return null;

    let bestId: string | null = null;
    let bestScore = -Infinity;

    for (const id of gkIds) {
      const s = takerScore(type, players[id]);
      if (s > bestScore) {
        bestScore = s;
        bestId = id;
      }
    }

    return bestId;
  }

  // Diğer türler: tüm oyuncular arasından en yüksek skor
  const ids = Object.keys(players).sort();
  let bestId: string | null = null;
  let bestScore = -Infinity;

  for (const id of ids) {
    const p = players[id];
    const s = takerScore(type, p);

    if (s > bestScore) {
      bestScore = s;
      bestId = id;
    }
  }

  return bestId;
}

// ═══════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════

function clampToPitch(pitch: PitchDimensions, p: Vec2): Vec2 {
  return {
    x: Math.max(0, Math.min(pitch.length, p.x)),
    y: Math.max(0, Math.min(pitch.width, p.y)),
  };
}

function distanceSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function byDistanceFrom(
  point: Vec2,
  positions: Record<string, Vec2>
): string[] {
  return Object.keys(positions).sort((a, b) => {
    const da = distanceSq(positions[a], point);
    const db = distanceSq(positions[b], point);
    if (da !== db) return da - db;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/**
 * Saha dışına bakan normal (2D).
 * Taç taker pozisyonu için kullanılır.
 */
function outwardNormalFromTouchline(
  pitch: PitchDimensions,
  point: Vec2
): Vec2 {
  const dTop = point.y;
  const dBottom = pitch.width - point.y;

  if (dTop < dBottom) {
    return { x: 0, y: -1 };
  }
  return { x: 0, y: 1 };
}

// ═══════════════════════════════════════════════
// POZİSYON ŞABLONLARI
// ═══════════════════════════════════════════════

/**
 * Savunma yarı sahası slotu.
 *
 * Sözleşme:
 *   HOME → x = halfX * ratio          (0 → kendi kalesi, halfX → orta saha)
 *   AWAY → x = length - halfX * ratio (length → kendi kalesi, halfX → orta saha)
 */
function defensiveHalfSlot(
  pitch: PitchDimensions,
  side: TeamSide,
  position: string
): Vec2 {
  const halfX = pitch.length / 2;
  const y = pitch.width / 2;

  const map: Record<string, number> = {
    GK: 0.05,
    DL: 0.20, DC: 0.18, DR: 0.20,
    WBL: 0.30, WBR: 0.30,
    DMC: 0.35,
    ML: 0.50, MC: 0.45, MR: 0.50,
    AML: 0.60, AMC: 0.55, AMR: 0.60,
    KFL: 0.70, GF: 0.65, KFR: 0.70,
    ST: 0.75,
  };
  const ratio = map[position] ?? 0.5;

  const x =
    side === 'HOME'
      ? halfX * ratio
      : pitch.length - halfX * ratio;

  return clampToPitch(pitch, { x, y });
}

/**
 * Hücum yarı sahası slotu.
 *
 * Sözleşme:
 *   HOME → x = halfX + halfX * ratio  (kendi yarısından rakip yarısına)
 *   AWAY → x = halfX - halfX * ratio  (rakip yarısından kendi yarısına)
 */
function attackingHalfSlot(
  pitch: PitchDimensions,
  side: TeamSide,
  position: string
): Vec2 {
  const halfX = pitch.length / 2;
  const y = pitch.width / 2;

  const map: Record<string, number> = {
    GK: 0.05,
    DL: 0.30, DC: 0.28, DR: 0.30,
    WBL: 0.40, WBR: 0.40,
    DMC: 0.45,
    ML: 0.55, MC: 0.50, MR: 0.55,
    AML: 0.65, AMC: 0.60, AMR: 0.65,
    KFL: 0.75, GF: 0.70, KFR: 0.75,
    ST: 0.85,
  };
  const ratio = map[position] ?? 0.5;

  const x =
    side === 'HOME'
      ? halfX + halfX * ratio
      : halfX - halfX * ratio;

  return clampToPitch(pitch, { x, y });
}

/**
 * Baraj pozisyonu.
 *
 * Top ile kale arasında, 9.15 m mesafede.
 * Oyuncular y ekseninde 0.6 m aralıkla dizilir.
 */
function wallPosition(
  pitch: PitchDimensions,
  attackingSide: TeamSide,
  ballPos: Vec2,
  playerId: string,
  allIds: string[]
): Vec2 {
  const goalX = attackingSide === 'HOME' ? pitch.length : 0;
  const goalY = pitch.width / 2;

  const dx = goalX - ballPos.x;
  const dy = goalY - ballPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const wallDistance = 9.15;
  const ratio = dist > 0 ? wallDistance / dist : 0;

  const wallCenter: Vec2 = {
    x: ballPos.x + dx * ratio,
    y: ballPos.y + dy * ratio,
  };

  const idx = allIds.indexOf(playerId);
  const offset = (idx % 5) - 2;

  return clampToPitch(pitch, {
    x: wallCenter.x,
    y: wallCenter.y + offset * 0.6,
  });
}

// ═══════════════════════════════════════════════
// HEDEF POZİSYONLAR
// ═══════════════════════════════════════════════

/**
 * Hedef pozisyonları üretir.
 *
 * KONTRAT:
 *  • Oyuncu hareket ettirmez; yalnızca hedef koordinat döner.
 *  • targetPositions hem taker hem savunan takımın hedeflerini içerir.
 *  • Saha dışına taşabilir (taç taker'ı için bilinçli istisna).
 *  • Taktik, hedef pozisyon üretiminde kullanılır.
 */
export function computeTargetPositions(
  context: SetPieceContext
): Record<string, Vec2> {
  const { pitch, type, teamSide, ballPosition } = context;

  const positions: Record<string, Vec2> = {};

  const attackers = context.takerTeamPlayers;
  const defenders = context.defenderTeamPlayers;

  const attackerIds = Object.keys(attackers).sort();
  const defenderIds = Object.keys(defenders).sort();

  const takerId = selectTaker(type, attackers);

  // ─── KICKOFF ─────────────────────────────
  if (type === 'kickoff') {
    const halfX = pitch.length / 2;

    for (const id of attackerIds) {
      const x =
        teamSide === 'HOME'
          ? halfX * 0.5
          : halfX * 1.5;
      positions[id] = { x, y: pitch.width / 2 };
    }
    for (const id of defenderIds) {
      const x =
        teamSide === 'HOME'
          ? halfX * 1.5
          : halfX * 0.5;
      positions[id] = { x, y: pitch.width / 2 };
    }

    if (takerId) positions[takerId] = { ...ballPosition };
    return positions;
  }

  // ─── GOAL KICK ───────────────────────────
  if (type === 'goal_kick') {
    if (takerId) positions[takerId] = { ...ballPosition };

    for (const id of attackerIds) {
      if (id === takerId) continue;
      positions[id] = defensiveHalfSlot(
        pitch,
        teamSide,
        attackers[id].position
      );
    }
    for (const id of defenderIds) {
      positions[id] = defensiveHalfSlot(
        pitch,
        teamSide === 'HOME' ? 'AWAY' : 'HOME',
        defenders[id].position
      );
    }
    return positions;
  }

  // ─── CORNER ──────────────────────────────
  if (type === 'corner') {
    const attackingGoalSide: TeamSide =
      teamSide === 'HOME' ? 'AWAY' : 'HOME';

    const boxCenterX =
      attackingGoalSide === 'HOME'
        ? pitch.penaltyAreaDepth * 0.6
        : pitch.length - pitch.penaltyAreaDepth * 0.6;

    const slots: Vec2[] = [
      { x: boxCenterX, y: pitch.width / 2 },
      { x: boxCenterX - 3, y: pitch.width / 2 - 6 },
      { x: boxCenterX - 3, y: pitch.width / 2 + 6 },
      { x: boxCenterX - 6, y: pitch.width / 2 - 2 },
      { x: boxCenterX - 6, y: pitch.width / 2 + 2 },
      { x: boxCenterX - 12, y: pitch.width / 2 - 8 },
      { x: boxCenterX - 12, y: pitch.width / 2 + 8 },
      { x: pitch.length / 2, y: pitch.width / 2 - 12 },
      { x: pitch.length / 2, y: pitch.width / 2 + 12 },
      { x: boxCenterX - 20, y: pitch.width / 2 },
    ];

    const fieldPlayers = attackerIds.filter(id => id !== takerId);
    const gkId = fieldPlayers.find(
      id => attackers[id].position === 'GK'
    );
    const nonGk = fieldPlayers.filter(id => id !== gkId);
    const ordered = [...nonGk, ...(gkId ? [gkId] : [])];

    if (takerId) positions[takerId] = { ...ballPosition };

    ordered.forEach((id, idx) => {
      const slot = slots[Math.min(idx, slots.length - 1)];
      positions[id] = slot;
    });

    defenderIds.forEach((id, idx) => {
      const p = defenders[id];
      if (p.position === 'GK') {
        positions[id] = {
          x: attackingGoalSide === 'HOME'
            ? pitch.goalAreaDepth * 0.4
            : pitch.length - pitch.goalAreaDepth * 0.4,
          y: pitch.width / 2,
        };
      } else {
        const offset = (idx % 8) - 4;
        positions[id] = {
          x: boxCenterX - 2,
          y: pitch.width / 2 + offset * 1.8,
        };
      }
    });

    return positions;
  }

  // ─── THROW IN ────────────────────────────
  if (type === 'throw_in') {
    const normal = outwardNormalFromTouchline(pitch, ballPosition);

    if (takerId) {
      positions[takerId] = {
        x: ballPosition.x + normal.x * THROW_IN_DISTANCE_FROM_LINE,
        y: ballPosition.y + normal.y * THROW_IN_DISTANCE_FROM_LINE,
      };
    }

    for (const id of attackerIds) {
      if (id === takerId) continue;
      const innerDir = { x: -normal.x, y: -normal.y };
      const nearPoint: Vec2 = {
        x: ballPosition.x + innerDir.x * 3,
        y: ballPosition.y + innerDir.y * 3,
      };
      positions[id] = clampToPitch(pitch, nearPoint);
    }
    for (const id of defenderIds) {
      positions[id] = clampToPitch(pitch, {
        x: ballPosition.x + 5,
        y: ballPosition.y + 5,
      });
    }

    return positions;
  }

  // ─── FREE KICK ───────────────────────────
  if (type === 'free_kick') {
    if (takerId) positions[takerId] = { ...ballPosition };

    for (const id of attackerIds) {
      if (id === takerId) continue;
      positions[id] = attackingHalfSlot(
        pitch,
        teamSide,
        attackers[id].position
      );
    }
    for (const id of defenderIds) {
      const p = defenders[id];
      if (p.position === 'GK') {
        positions[id] = {
          x: teamSide === 'HOME'
            ? pitch.length - pitch.goalAreaDepth * 0.4
            : pitch.goalAreaDepth * 0.4,
          y: pitch.width / 2,
        };
      } else {
        positions[id] = wallPosition(
          pitch,
          teamSide,
          ballPosition,
          id,
          defenderIds
        );
      }
    }
    return positions;
  }

  // ─── PENALTY ─────────────────────────────
  if (type === 'penalty') {
    if (takerId) positions[takerId] = { ...ballPosition };

    for (const id of attackerIds) {
      if (id === takerId) continue;
      positions[id] = clampToPitch(pitch, {
        x: teamSide === 'HOME'
          ? pitch.penaltyAreaDepth + 3
          : pitch.length - pitch.penaltyAreaDepth - 3,
        y: pitch.width / 2 + (Object.keys(positions).length - 5) * 2,
      });
    }
    for (const id of defenderIds) {
      const p = defenders[id];
      if (p.position === 'GK') {
        positions[id] = {
          x: teamSide === 'HOME'
            ? pitch.length - pitch.goalAreaDepth * 0.2
            : pitch.goalAreaDepth * 0.2,
          y: pitch.width / 2,
        };
      } else {
        positions[id] = clampToPitch(pitch, {
          x: teamSide === 'HOME'
            ? pitch.length - pitch.penaltyAreaDepth - 3
            : pitch.penaltyAreaDepth + 3,
          y: pitch.width / 2 + (Object.keys(positions).length - 5) * 2,
        });
      }
    }
    return positions;
  }

  return positions;
}

// ═══════════════════════════════════════════════
// REQUIRED PLAYERS
// ═══════════════════════════════════════════════

/**
 * `ready` kararı için gerekli oyuncu id'lerini üretir.
 *
 * KONTRAT:
 *  • YALNIZCA taker takımının oyuncularından seçilir.
 *  • Sert kural gömülmez; targetPositions ve tür üzerinden türetilir.
 *  • Taker her zaman gereklidir (varsa).
 *  • Deterministik sıralama (mesafe + id).
 */
export function computeRequiredPlayers(
  type: SetPieceType,
  takerId: string | null,
  targetPositions: Record<string, Vec2>,
  ballPosition: Vec2,
  takerTeamPlayerIds: string[]
): string[] {
  const required: string[] = [];

  if (takerId) required.push(takerId);

  // Yalnızca taker takımının oyuncuları
  const candidates: Record<string, Vec2> = {};
  for (const id of takerTeamPlayerIds) {
    if (id === takerId) continue;
    if (targetPositions[id]) {
      candidates[id] = targetPositions[id];
    }
  }

  const ordered = byDistanceFrom(ballPosition, candidates);

  const countByType: Record<SetPieceType, number> = {
    kickoff: 2,
    goal_kick: 4,
    corner: 5,
    throw_in: 2,
    free_kick: 4,
    penalty: 5,
  };

  const n = countByType[type];
  for (let i = 0; i < ordered.length && required.length < n + 1; i++) {
    required.push(ordered[i]);
  }

  return required;
}

// ═══════════════════════════════════════════════
// ANA FONKSİYON
// ═══════════════════════════════════════════════

/**
 * Yeni bir set-piece oluşturur.
 *
 * KONTRAT:
 *  • Hedef pozisyonları ve taker'ı belirler.
 *  • RNG kullanmaz.
 *  • Oyuncuları hareket ettirmez.
 *  • status = 'positioning' ile başlar.
 *  • elapsed = 0 ile başlar.
 *  • goal_kick'te GK yoksa takerId = null olur.
 */
export function createSetPiece(
  context: SetPieceContext
): SetPieceState {
  const takerId = selectTaker(context.type, context.takerTeamPlayers);

  const targetPositions = computeTargetPositions(context);

  const takerTeamPlayerIds = Object.keys(context.takerTeamPlayers);

  const requiredPlayerIds = computeRequiredPlayers(
    context.type,
    takerId,
    targetPositions,
    context.ballPosition,
    takerTeamPlayerIds
  );

  return {
    type: context.type,
    teamSide: context.teamSide,
    takerId,
    ballPosition: { ...context.ballPosition },
    targetPositions,
    requiredPlayerIds,
    status: 'positioning',
    elapsed: 0,
  };
}

// ═══════════════════════════════════════════════
// TICK GÜNCELLEMESİ
// ═══════════════════════════════════════════════

/**
 * Her tick çağrılır.
 *
 * KONTRAT:
 *  • Immutable — yeni state döner.
 *  • requiredPlayerIds hedefe ulaştıysa status = 'ready'.
 *  • elapsed >= SET_PIECE_MAX_POSITIONING_SECONDS ise status = 'ready'.
 *  • status 'ready' veya 'played' ise dokunulmaz.
 *  • RNG yok.
 */
export function updateSetPiece(
  state: SetPieceState,
  playerPositions: Record<string, Vec2>,
  tickDuration: number
): SetPieceState {
  if (state.status !== 'positioning') {
    return state;
  }

  const newElapsed = state.elapsed + tickDuration;

  const allRequiredArrived = state.requiredPlayerIds.every(id => {
    const target = state.targetPositions[id];
    const current = playerPositions[id];
    if (!target || !current) return false;
    const d = distanceSq(current, target);
    return d <=
      SET_PIECE_POSITION_TOLERANCE * SET_PIECE_POSITION_TOLERANCE;
  });

  const timedOut =
    newElapsed >= SET_PIECE_MAX_POSITIONING_SECONDS;

  const nextStatus: SetPieceStatus =
    allRequiredArrived || timedOut ? 'ready' : 'positioning';

  return {
    ...state,
    status: nextStatus,
    elapsed: newElapsed,
  };
}

// ═══════════════════════════════════════════════
// DURUM GEÇİŞLERİ
// ═══════════════════════════════════════════════

/**
 * Taker topa vurduğunda çağrılır.
 * status = 'played' ile yeni state döner.
 *
 * KONTRAT:
 *  • Yalnızca 'ready' durumundan çağrılmalı.
 *  • Diğer durumlarda state aynen döner.
 *  • Immutable.
 */
export function markSetPiecePlayed(
  state: SetPieceState
): SetPieceState {
  if (state.status !== 'ready') {
    return state;
  }

  return {
    ...state,
    status: 'played',
  };
}