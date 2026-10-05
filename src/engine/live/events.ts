// src/engine/live/events.ts

/**
 * OYUN OLAYLARI
 * -------------
 * Bu dosya topun bir tick içindeki hareketinden futbol kuralı
 * açısından ne olduğunu çıkarır.
 *
 * YASAK:
 *  - Fizik uygulama (ball.ts'in işi)
 *  - RNG
 *  - Oyuncu seçme
 *  - Oyuncu hareket ettirme
 *  - Set-piece yerleştirme (setPieces.ts'in işi)
 *  - Stat güncelleme (liveMatch.ts'in işi)
 *  - MatchEvent üretme (liveMatch.ts'in işi)
 *
 * KONTRAT:
 *  - detectBoundaryCrossing() saf 2D'dir; z kontrolü burada yapılır.
 *  - Topun sınırı geçtiği andaki z, lineer interpolasyonla hesaplanır.
 *  - goalHeight pitch geometrisinin parçasıdır (pitch.goalHeight).
 *  - BallPhysicsConfig bu dosyada KULLANILMAZ.
 *  - minute / maç zamanı KULLANILMAZ.
 *  - Own goal ayrı bayrakla işaretlenir.
 *  - RNG yok.
 *  - Sabit sayı gömülmez; config.ts'ten import edilir.
 */

import type {
  PitchDimensions,
  Vec2,
  Vec3,
} from '../types';

import {
  detectBoundaryCrossing,
  getCornerPoint,
  type BoundaryCrossing,
} from './pitch';

// ═══════════════════════════════════════════════
// TİPLER
// ═══════════════════════════════════════════════

export type TeamSide = 'HOME' | 'AWAY';

export type BoundaryOutcome =
  | { type: 'none' }
  | {
      type: 'goal';
      scorerSide: TeamSide;
      ownGoal: boolean;
      point: Vec2;
    }
  | {
      type: 'goal_kick';
      side: TeamSide;
      point: Vec2;
    }
  | {
      type: 'corner';
      side: TeamSide;
      point: Vec2;
    }
  | {
      type: 'throw_in';
      side: TeamSide;
      point: Vec2;
    };

export interface DetectEventInput {
  /** Saha (goalHeight, goalAreaDepth vs. buradan gelir) */
  pitch: PitchDimensions;

  /** Top — tick başındaki konum */
  prevBallPos: Vec3;

  /** Top — tick sonundaki konum */
  nextBallPos: Vec3;

  /** Topa son dokunan oyuncu */
  lastTouchId: string | null;

  /** Topa son dokunan takım */
  lastTouchClubId: string | null;

  /** Ev sahibi kulübün id'si */
  homeClubId: string;

  /** Deplasman kulübün id'si */
  awayClubId: string;
}

// ═══════════════════════════════════════════════
// ANA FONKSİYON
// ═══════════════════════════════════════════════

/**
 * KONTRAT:
 *  • Topun bir tick içindeki hareketinden futbol olayını çıkarır.
 *  • Fizik uygulamaz.
 *  • RNG kullanmaz.
 *  • Oyuncu seçmez, hareket ettirmez.
 *  • Set-piece yerleştirmez.
 *  • Stat güncellemez.
 *  • MatchEvent üretmez. Yalnızca BoundaryOutcome döndürür.
 *
 *  BoundaryOutcome.point:
 *    - goal:      topun kale çizgisini geçtiği nokta
 *    - goal_kick: kale vuruşunun kullanılacağı nokta
 *    - corner:    korner köşesi
 *    - throw_in:  topun taç çizgisini geçtiği nokta
 */
export function detectBoundaryOutcome(
  input: DetectEventInput
): BoundaryOutcome {
  const {
    pitch,
    prevBallPos,
    nextBallPos,
    lastTouchClubId,
    homeClubId,
    awayClubId,
  } = input;

  // 1) 2D sınır geçişi
  const crossing = detectBoundaryCrossing(
    pitch,
    { x: prevBallPos.x, y: prevBallPos.y },
    { x: nextBallPos.x, y: nextBallPos.y }
  );

  let resolvedCrossing = crossing;

  // Güvenlik ağı: ilk sınır olayı kaçırılmışsa top sonraki tick'te
  // zaten saha dışında olabilir. Bu durumda crossing geometrisi artık
  // yeni bir kesişim üretmez ve top deadlock'a girebilir.
  if (!resolvedCrossing.crossed) {
    resolvedCrossing = recoverOutsideCrossing(pitch, nextBallPos);
  }

  const crossingPoint = resolvedCrossing.point;

  if (
    !resolvedCrossing.crossed ||
    crossingPoint === null ||
    resolvedCrossing.side === null
  ) {
    return { type: 'none' };
  }

  // 2) Son dokunan takımın tarafı
  const lastTouchSide: TeamSide | null = resolveSide(
    lastTouchClubId,
    homeClubId,
    awayClubId
  );

  // 3) Sınıflandırma
  switch (resolvedCrossing.type) {
    case 'TOUCHLINE':
      return handleTouchline(crossingPoint, lastTouchSide);

    case 'GOAL_MOUTH':
      return handleGoalMouth(
        pitch,
        resolvedCrossing,
        crossingPoint,
        prevBallPos,
        nextBallPos,
        lastTouchSide
      );

    case 'GOAL_LINE':
      return handleGoalLine(
        pitch,
        resolvedCrossing,
        crossingPoint,
        lastTouchSide
      );

    case 'NONE':
    default:
      return { type: 'none' };
  }
}


function recoverOutsideCrossing(
  pitch: PitchDimensions,
  nextBallPos: Vec3
): BoundaryCrossing {
  const candidates = [
    { side: 'LEFT' as const, distance: Math.abs(nextBallPos.x), outside: nextBallPos.x < 0 },
    { side: 'RIGHT' as const, distance: Math.abs(nextBallPos.x - pitch.length), outside: nextBallPos.x > pitch.length },
    { side: 'TOP' as const, distance: Math.abs(nextBallPos.y), outside: nextBallPos.y < 0 },
    { side: 'BOTTOM' as const, distance: Math.abs(nextBallPos.y - pitch.width), outside: nextBallPos.y > pitch.width },
  ]
    .filter(candidate => candidate.outside)
    .sort((a, b) => a.distance - b.distance);

  const candidate = candidates[0];
  if (!candidate) {
    return { crossed: false, type: 'NONE', point: null, t: null, half: null, side: null };
  }

  const point = {
    x: Math.max(0, Math.min(pitch.length, nextBallPos.x)),
    y: Math.max(0, Math.min(pitch.width, nextBallPos.y)),
  };

  const goalMouth =
    point.y >= pitch.width / 2 - pitch.goalWidth / 2 &&
    point.y <= pitch.width / 2 + pitch.goalWidth / 2;

  return {
    crossed: true,
    type: candidate.side === 'LEFT' || candidate.side === 'RIGHT'
      ? goalMouth ? 'GOAL_MOUTH' : 'GOAL_LINE'
      : 'TOUCHLINE',
    point,
    t: 1,
    half: point.x < pitch.length / 2 ? 'LEFT' : 'RIGHT',
    side: candidate.side,
  };
}

// ═══════════════════════════════════════════════
// TAÇ ÇİZGİSİ
// ═══════════════════════════════════════════════

function handleTouchline(
  crossingPoint: Vec2,
  lastTouchSide: TeamSide | null
): BoundaryOutcome {
  // Taç: son dokunan takımın rakibi kullanır.
  // lastTouchSide bilinmiyorsa nötr varsayım: HOME kullanır.
  const side: TeamSide =
    lastTouchSide === null
      ? 'HOME'
      : opposite(lastTouchSide);

  return {
    type: 'throw_in',
    side,
    point: crossingPoint,
  };
}

// ═══════════════════════════════════════════════
// KALE AĞZI (GOAL_MOUTH)
// ═══════════════════════════════════════════════

function handleGoalMouth(
  pitch: PitchDimensions,
  crossing: BoundaryCrossing,
  crossingPoint: Vec2,
  prevBallPos: Vec3,
  nextBallPos: Vec3,
  lastTouchSide: TeamSide | null
): BoundaryOutcome {
  // Kesişim anındaki gerçek z — lineer interpolasyon
  const t = crossing.t ?? 0;
  const crossingZ =
    prevBallPos.z + (nextBallPos.z - prevBallPos.z) * t;

  const belowCrossbar = crossingZ < pitch.goalHeight;

  // Hangi kale? LEFT → HOME kalesi, RIGHT → AWAY kalesi
  const goalSide: TeamSide =
    crossing.side === 'LEFT' ? 'HOME' : 'AWAY';

  if (belowCrossbar) {
    // GOL
    // scorerSide: golün hangi takım lehine yazılacağı.
    // ownGoal: topu kendi kalesine atan bir oyuncu mu?
    const ownGoal =
      lastTouchSide !== null && lastTouchSide === goalSide;

    const scorerSide: TeamSide =
      lastTouchSide === null
        ? opposite(goalSide)
        : ownGoal
          ? opposite(goalSide)
          : lastTouchSide;

    return {
      type: 'goal',
      scorerSide,
      ownGoal,
      point: crossingPoint,
    };
  }

  // Aut: top kale çizgisini yüksekten geçti → korner veya kale vuruşu
  return resolveGoalLineOutcome(
    pitch,
    goalSide,
    lastTouchSide,
    crossingPoint
  );
}

// ═══════════════════════════════════════════════
// KALE ÇİZGİSİ (GOAL_LINE — kale ağzı dışı)
// ═══════════════════════════════════════════════

function handleGoalLine(
  pitch: PitchDimensions,
  crossing: BoundaryCrossing,
  crossingPoint: Vec2,
  lastTouchSide: TeamSide | null
): BoundaryOutcome {
  const goalSide: TeamSide =
    crossing.side === 'LEFT' ? 'HOME' : 'AWAY';

  return resolveGoalLineOutcome(
    pitch,
    goalSide,
    lastTouchSide,
    crossingPoint
  );
}

// ═══════════════════════════════════════════════
// ORTAK: KALE ÇİZGİSİ DIŞI → KORNER / KALE VURUŞU
// ═══════════════════════════════════════════════

function resolveGoalLineOutcome(
  pitch: PitchDimensions,
  goalSide: TeamSide,
  lastTouchSide: TeamSide | null,
  crossingPoint: Vec2
): BoundaryOutcome {
  // Son dokunan takım bilinmiyorsa, hücum takımının son dokunduğunu varsay.
  // Yani savunan takım kale vuruşu kullanır.
  const attackerTouchedLast =
    lastTouchSide === null || lastTouchSide !== goalSide;

  if (attackerTouchedLast) {
    return {
      type: 'goal_kick',
      side: goalSide,
      point: goalKickPoint(pitch, goalSide),
    };
  }

  // Son dokunan savunan takım → korner
  const cornerCrossing: BoundaryCrossing = {
    crossed: true,
    type: 'GOAL_LINE',
    point: crossingPoint,
    t: null,
    half: null,
    side: goalSide === 'HOME' ? 'LEFT' : 'RIGHT',
  };

  const cornerPoint = getCornerPoint(pitch, cornerCrossing);

  return {
    type: 'corner',
    side: opposite(goalSide),
    point: cornerPoint ?? crossingPoint,
  };
}

// ═══════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════

function resolveSide(
  clubId: string | null,
  homeClubId: string,
  awayClubId: string
): TeamSide | null {
  if (clubId === null) return null;
  if (clubId === homeClubId) return 'HOME';
  if (clubId === awayClubId) return 'AWAY';
  return null;
}

function opposite(side: TeamSide): TeamSide {
  return side === 'HOME' ? 'AWAY' : 'HOME';
}

/**
 * Kale vuruşu noktası:
 *   HOME: (goalAreaDepth/2, width/2)
 *   AWAY: (length - goalAreaDepth/2, width/2)
 *
 * 104 × 64 saha için:
 *   HOME → (2.75, 32)
 *   AWAY → (101.25, 32)
 */
function goalKickPoint(
  pitch: PitchDimensions,
  side: TeamSide
): Vec2 {
  const y = pitch.width / 2;

  return side === 'HOME'
    ? { x: pitch.goalAreaDepth / 2, y }
    : { x: pitch.length - pitch.goalAreaDepth / 2, y };
}

// ═══════════════════════════════════════════════
// YER TUTUCULAR (sonraki iterasyonlar)
// ═══════════════════════════════════════════════

export type OffsideOutcome =
  | { type: 'offside'; side: TeamSide; freeKickPoint: Vec2 }
  | { type: 'none' };

/**
 * Ofsayt tespiti — HENÜZ İMPLEMENTE EDİLMEDİ.
 */
export function detectOffside(
  pitch: PitchDimensions,
  attackingDirection: 1 | -1,
  defendingClubId: string,
  passOrigin: Vec2,
  receiverPosition: Vec2,
  defenders: Array<{ clubId: string; position: Vec2 }>
): OffsideOutcome {
  const defendingPositions = defenders
    .filter(player => player.clubId === defendingClubId)
    .map(player => player.position);

  if (defendingPositions.length < 2) {
    return { type: 'none' };
  }

  const receiverInOppositionHalf =
    attackingDirection === 1
      ? receiverPosition.x > pitch.length / 2
      : receiverPosition.x < pitch.length / 2;

  if (!receiverInOppositionHalf) {
    return { type: 'none' };
  }

  const sortedDefenders = [...defendingPositions].sort((a, b) =>
    attackingDirection === 1
      ? b.x - a.x
      : a.x - b.x
  );

  const secondLastDefenderX = sortedDefenders[1].x;

  const beyondDefender =
    attackingDirection === 1
      ? receiverPosition.x > secondLastDefenderX
      : receiverPosition.x < secondLastDefenderX;

  const beyondBall =
    attackingDirection === 1
      ? receiverPosition.x > passOrigin.x
      : receiverPosition.x < passOrigin.x;

  if (!beyondDefender || !beyondBall) {
    return { type: 'none' };
  }

  return {
    type: 'offside',
    side: attackingDirection === 1 ? 'AWAY' : 'HOME',
    freeKickPoint: {
      x: Math.max(2, Math.min(pitch.length - 2, passOrigin.x)),
      y: Math.max(2, Math.min(pitch.width - 2, passOrigin.y)),
    },
  };
}

/**
 * Topun bir oyuncunun kontrolüne girip girmediği — HENÜZ İMPLEMENTE EDİLMEDİ.
 */
export function detectBallControl(
  _ballPosition: Vec3,
  _players: Array<{ id: string; position: Vec2; clubId: string }>,
  _controlRadius: number
): string | null {
  return null;
}

/**
 * Ölü top tespiti — HENÜZ İMPLEMENTE EDİLMEDİ.
 */
export function detectDeadBall(
  _ballPosition: Vec3,
  _ballVelocity: Vec3,
  _players: Array<{ id: string; position: Vec2 }>,
  _speedThreshold: number
): boolean {
  return false;
}