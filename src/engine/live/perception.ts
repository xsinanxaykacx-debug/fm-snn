// src/engine/live/perception.ts

/**
 * ALGILAMA KATMANI
 * -----------------
 * Bu dosya bir oyuncunun ne gördüğünü hesaplar.
 *
 * YASAK:
 *  - Karar verme (decision.ts'in işi)
 *  - Oyuncu hareket ettirme (movement.ts'in işi)
 *  - Top fiziği (ball.ts'in işi)
 *  - RNG
 *  - MatchEvent üretme
 *  - Stat güncelleme
 *
 * KONTRAT:
 *  - FULL perception yalnızca karar zamanı gelen oyuncu için hesaplanır.
 *  - Aynı state + aynı oyuncu konumu → aynı perception.
 *  - Angle relatif: bearing - self.facing, [-180, 180].
 *  - RNG yok.
 *  - Sabit sayı gömülmez; config.ts'ten import edilir.
 */

import type {
  Ball,
  LivePlayer,
  PassOption,
  Perception,
  PerceivedBall,
  PerceivedPlayer,
  PitchDimensions,
  PlayerRole,
  SpaceMap,
  Vec2,
  ZoneType,
} from '../types';

import {
  NEARBY_PLAYER_COUNT,
  OPENNESS_PENALTY,
  OPENNESS_RADIUS,
  PASS_DISTANCE_PENALTY_SCALE,
  PASS_DISTANCE_PENALTY_START,
  PASS_LANE_INTERFERENCE_RADIUS,
  PASS_PROBABILITY_MAX,
  PASS_PROBABILITY_MIN,
  PRESSURE_PER_OPPONENT,
  PRESSURE_RADIUS,
  SPACE_OPPONENT_PENALTY,
  SPACE_OPPONENT_RADIUS,
} from './config';

// ═══════════════════════════════════════════════
// YARDIMCILAR — MATEMATİK
// ═══════════════════════════════════════════════

export function computeDistance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Mutlak saha açısı (derece, [-180, 180]).
 * 0° = +X (sağ), 90° = +Y (aşağı).
 *
 * Bu fonksiyon PerceivedPlayer/PerceivedBall angle'ı için DEĞİL,
 * yalnızca iç hesaplamalar için kullanılır.
 */
export function computeBearing(from: Vec2, to: Vec2): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * Relatif açı — oyuncunun facing'ine göre.
 *
 * KONTRAT:
 *  • [-180, 180] aralığında.
 *  • Önünde = 0°
 *  • Sağında = +90°
 *  • Solunda = -90°
 *  • Arkasında = ±180°
 */
export function computeRelativeAngle(
  from: Vec2,
  to: Vec2,
  selfFacing: number
): number {
  const bearing = computeBearing(from, to);
  let rel = bearing - selfFacing;

  while (rel > 180) rel -= 360;
  while (rel < -180) rel += 360;

  return rel;
}

// ═══════════════════════════════════════════════
// YARDIMCILAR — ZONE
// ═══════════════════════════════════════════════

/**
 * Bir noktanın zone'unu hesaplar.
 *
 * KONTRAT:
 *  • attackDirection: HOME = +1, AWAY = -1.
 *  • X ekseni: kendi yarısı / orta / rakip yarısı (attack yönüne göre).
 *  • Y ekseni: sol / orta / sağ.
 */
export function zoneOf(
  point: Vec2,
  pitch: PitchDimensions,
  attackDirection: 1 | -1
): ZoneType {
  // Kendi yarısına göre normalize et
  const ownX =
    attackDirection === 1
      ? point.x
      : pitch.length - point.x;

  const third = pitch.length / 3;

  let xPart: 'defense' | 'midfield' | 'attack';
  if (ownX < third) xPart = 'defense';
  else if (ownX < third * 2) xPart = 'midfield';
  else xPart = 'attack';

  // Y ekseni
  const yThird = pitch.width / 3;

  let yPart: 'left' | 'center' | 'right';
  if (point.y < yThird) yPart = 'left';
  else if (point.y < yThird * 2) yPart = 'center';
  else yPart = 'right';

  return `${xPart}_${yPart}` as ZoneType;
}

// ═══════════════════════════════════════════════
// YARDIMCILAR — ROL
// ═══════════════════════════════════════════════

/**
 * Player.position → PlayerRole.
 *
 * KONTRAT:
 *  • 17 pozisyon 9 role indirgenir.
 *  - KFL / KFR / GF → ST (kanat forvet ve gizli forvet de forvet sayılır)
 *  - RNG yok.
 */
export function normalizeRole(player: LivePlayer): PlayerRole {
  const pos = player.player.position;

  switch (pos) {
    case 'GK':
      return 'GK';
    case 'DC':
      return 'CB';
    case 'DL':
    case 'DR':
      return 'FB';
    case 'WBL':
    case 'WBR':
      return 'WB';
    case 'DMC':
      return 'DM';
    case 'MC':
      return 'CM';
    case 'ML':
    case 'MR':
    case 'AML':
    case 'AMR':
      return 'W';
    case 'AMC':
      return 'AM';
    case 'ST':
    case 'KFL':
    case 'KFR':
    case 'GF':
      return 'ST';
    default:
      return 'CM';
  }
}

// ═══════════════════════════════════════════════
// YARDIMCILAR — ATTRIBUTE ORANI
// ═══════════════════════════════════════════════

function attrRatio(v: number): number {
  return Math.max(0, Math.min(1, v / 20));
}

// ═══════════════════════════════════════════════
// OPENNESS
// ═══════════════════════════════════════════════

/**
 * Bir oyuncunun ne kadar açık olduğunu hesaplar (0-100).
 *
 * KONTRAT:
 *  • 100 = tamamen açık, 0 = sıkı markaj.
 *  • Yalnızca rakipler openness'ı düşürür.
 *  • RNG yok.
 */
export function computeOpenness(
  subject: LivePlayer,
  players: Record<string, LivePlayer>
): number {
  let openness = 100;

  for (const id of Object.keys(players)) {
    const other = players[id];
    if (other.clubId === subject.clubId) continue;

    const d = computeDistance(subject.position, other.position);
    if (d < OPENNESS_RADIUS) {
      openness -=
        (1 - d / OPENNESS_RADIUS) * OPENNESS_PENALTY;
    }
  }

  return Math.max(0, Math.min(100, openness));
}

// ═══════════════════════════════════════════════
// FULL PERCEPTION
// ═══════════════════════════════════════════════

/**
 * Tam algılama — yalnızca karar zamanı gelen oyuncu için çağrılır.
 *
 * KONTRAT:
 *  • 5 teammate + 5 opponent (NEARBY_PLAYER_COUNT).
 *  • Space map.
 *  • Pressure.
 *  • Pass options.
 *  • RNG yok.
 *  • Deterministik.
 */
export function computeFullPerception(
  self: LivePlayer,
  state: {
    ball: Ball;
    players: Record<string, LivePlayer>;
    pitch: PitchDimensions;
    time: number;
  },
  spaceMap: SpaceMap
): Perception {
  const ball = state.ball;
  const ballPos2: Vec2 = { x: ball.position.x, y: ball.position.y };
  const attackDirection: 1 | -1 = self.isHome ? 1 : -1;

  // ─── Ball ───
  const ballDistance = computeDistance(self.position, ballPos2);
  const ballAngle = computeRelativeAngle(
    self.position,
    ballPos2,
    self.facing
  );

  const ownerIsTeammate =
    ball.ownerId !== null &&
    state.players[ball.ownerId]?.clubId === self.clubId;

  const perceivedBall: PerceivedBall = {
    position: { ...ball.position },
    velocity: { ...ball.velocity },
    distance: ballDistance,
    angle: ballAngle,
    airborne: ball.position.z > 0.5,
    ownerId: ball.ownerId,
    ownerIsTeammate,
  };

  // ─── Teammates / Opponents ───
  const teammatesAcc: Array<{ p: LivePlayer; d: number }> = [];
  const opponentsAcc: Array<{ p: LivePlayer; d: number }> = [];

  for (const id of Object.keys(state.players).sort()) {
    if (id === self.player.id) continue;
    const other = state.players[id];
    const d = computeDistance(self.position, other.position);

    if (other.clubId === self.clubId) {
      teammatesAcc.push({ p: other, d });
    } else {
      opponentsAcc.push({ p: other, d });
    }
  }

  // Deterministik sıralama: distance ASC, id ASC
  const sortFn = (
    a: { p: LivePlayer; d: number },
    b: { p: LivePlayer; d: number }
  ): number => {
    if (a.d !== b.d) return a.d - b.d;
    return a.p.player.id < b.p.player.id ? -1 : 1;
  };

  teammatesAcc.sort(sortFn);
  opponentsAcc.sort(sortFn);

  const perceivedTeammates: PerceivedPlayer[] = teammatesAcc
    .slice(0, NEARBY_PLAYER_COUNT)
    .map(({ p, d }) => ({
      id: p.player.id,
      position: { ...p.position },
      velocity: { ...p.velocity },
      distance: d,
      angle: computeRelativeAngle(
        self.position,
        p.position,
        self.facing
      ),
      role: normalizeRole(p),
      hasBall: ball.ownerId === p.player.id,
      openness: computeOpenness(p, state.players),
    }));

  const perceivedOpponents: PerceivedPlayer[] = opponentsAcc
    .slice(0, NEARBY_PLAYER_COUNT)
    .map(({ p, d }) => ({
      id: p.player.id,
      position: { ...p.position },
      velocity: { ...p.velocity },
      distance: d,
      angle: computeRelativeAngle(
        self.position,
        p.position,
        self.facing
      ),
      role: normalizeRole(p),
      hasBall: ball.ownerId === p.player.id,
      openness: computeOpenness(p, state.players),
    }));

  // ─── Space map ───
  const space = spaceMap;

  // ─── Pressure ───
  const pressure = computePressure(self, state.players);

  // ─── Pass options ───
  const passOptions = computePassOptions(
    self,
    state.players,
    state.pitch,
    attackDirection
  );

  return {
    time: state.time,
    self,
    ball: perceivedBall,
    teammates: perceivedTeammates,
    opponents: perceivedOpponents,
    space,
    pressure,
    passOptions,
    availablePassOptions: passOptions.length,
    zone: {
      ball: zoneOf(ballPos2, state.pitch, attackDirection),
      self: zoneOf(self.position, state.pitch, attackDirection),
      attackDirection,
    },
  };
}

// ═══════════════════════════════════════════════
// SPACE MAP
// ═══════════════════════════════════════════════

/**
 * Boş alan haritası.
 *
 * KONTRAT:
 *  • Yalnızca rakipler alanı kapatır.
 *  • 15 m yarıçapında lineer ceza.
 *  • RNG yok.
 */
export function computeSpaceMap(
  selfClubId: string,
  players: Record<string, LivePlayer>,
  pitch: PitchDimensions,
  gridSize: number
): SpaceMap {
  const cols = Math.ceil(pitch.length / gridSize);
  const rows = Math.ceil(pitch.width / gridSize);
  const cells = new Float32Array(cols * rows);

  // Rakipleri topla
  const opponents: Vec2[] = [];
  for (const id of Object.keys(players).sort()) {
    const p = players[id];
    if (p.clubId !== selfClubId) {
      opponents.push(p.position);
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = (col + 0.5) * gridSize;
      const cy = (row + 0.5) * gridSize;

      let penalty = 0;
      for (const opp of opponents) {
        const dx = cx - opp.x;
        const dy = cy - opp.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        if (d < SPACE_OPPONENT_RADIUS) {
          penalty +=
            ((SPACE_OPPONENT_RADIUS - d) /
              SPACE_OPPONENT_RADIUS) *
            SPACE_OPPONENT_PENALTY;
        }
      }

      cells[row * cols + col] = Math.max(
        0,
        Math.min(100, 100 - penalty)
      );
    }
  }

  return { gridSize, cols, rows, cells };
}

// ═══════════════════════════════════════════════
// PRESSURE
// ═══════════════════════════════════════════════

/**
 * Rakip baskısı (0-100).
 *
 * KONTRAT:
 *  • 10 m yarıçapındaki rakipler baskı yapar.
 *  • Lineer falloff.
 *  • RNG yok.
 */
export function computePressure(
  self: LivePlayer,
  players: Record<string, LivePlayer>
): number {
  let pressure = 0;

  for (const id of Object.keys(players).sort()) {
    const other = players[id];
    if (other.clubId === self.clubId) continue;

    const d = computeDistance(self.position, other.position);
    if (d < PRESSURE_RADIUS) {
      const distFactor = 1 - d / PRESSURE_RADIUS;
      pressure += distFactor * PRESSURE_PER_OPPONENT;
    }
  }

  return Math.max(0, Math.min(100, pressure));
}

// ═══════════════════════════════════════════════
// PASS OPTIONS
// ═══════════════════════════════════════════════

/**
 * Pas seçenekleri — perception pas SEÇMEZ, yalnızca ölçer.
 *
 * KONTRAT:
 *  • Tüm takım arkadaşları için 1 aday.
 *  • Mesafe, açı, başarı olasılığı, yol açıklığı, taktik değer.
 *  • RNG yok.
 */
export function computePassOptions(
  self: LivePlayer,
  players: Record<string, LivePlayer>,
  pitch: PitchDimensions,
  attackDirection: 1 | -1
): PassOption[] {
  const options: PassOption[] = [];

  for (const id of Object.keys(players).sort()) {
    if (id === self.player.id) continue;
    const target = players[id];
    if (target.clubId !== self.clubId) continue;

    const targetPos: Vec2 = { ...target.position };
    const distance = computeDistance(self.position, targetPos);
    const angle = computeRelativeAngle(
      self.position,
      targetPos,
      self.facing
    );

    const laneClarity = computeLaneClarity(
      self.position,
      targetPos,
      players,
      self.clubId
    );

    const successProbability = computePassSuccessProbability(
      self,
      distance,
      laneClarity
    );

    const tacticalValue = computePassTacticalValue(
      self.position,
      targetPos,
      attackDirection,
      pitch
    );

    options.push({
      targetPlayerId: id,
      targetPosition: targetPos,
      distance,
      angle,
      successProbability,
      laneClarity,
      tacticalValue,
    });
  }

  return options;
}

/**
 * Pas yolunda rakip var mı?
 *
 * KONTRAT:
 *  • Hat üzerinde 3 m içindeki rakipler yolu kirletir.
 *  • 0 = tamamen kapalı, 1 = tamamen açık.
 *  • RNG yok.
 */
export function computeLaneClarity(
  from: Vec2,
  to: Vec2,
  players: Record<string, LivePlayer>,
  ownClubId: string
): number {
  let interference = 0;

  for (const id of Object.keys(players).sort()) {
    const other = players[id];
    if (other.clubId === ownClubId) continue;

    const d = pointToSegmentDistance(other.position, from, to);
    if (d < PASS_LANE_INTERFERENCE_RADIUS) {
      interference +=
        1 - d / PASS_LANE_INTERFERENCE_RADIUS;
    }
  }

  return Math.max(0, 1 - interference * 0.3);
}

function pointToSegmentDistance(
  p: Vec2,
  a: Vec2,
  b: Vec2
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 1e-9) {
    return computeDistance(p, a);
  }

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;

  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

/**
 * Pas başarı olasılığı.
 *
 * KONTRAT:
 *  • Mesafe + yol açıklığı + attribute.
 *  • RNG yok.
 */
export function computePassSuccessProbability(
  from: LivePlayer,
  distance: number,
  laneClarity: number
): number {
  const passing = attrRatio(from.player.attributes.passing);
  const vision = attrRatio(from.player.attributes.vision);
  const technique = attrRatio(from.player.attributes.technique);

  const attrBonus = (passing + vision + technique) / 3;

  const distancePenalty = Math.max(
    0,
    (distance - PASS_DISTANCE_PENALTY_START) /
      PASS_DISTANCE_PENALTY_SCALE
  );

  const p =
    0.9 * laneClarity +
    0.1 * attrBonus -
    distancePenalty * 0.4;

  return Math.max(
    PASS_PROBABILITY_MIN,
    Math.min(PASS_PROBABILITY_MAX, p)
  );
}

/**
 * Pas taktik değeri.
 *
 * KONTRAT:
 *  • İleri doğru ise yüksek, geriye ise düşük.
 *  • attackDirection'a göre.
 *  • RNG yok.
 */
export function computePassTacticalValue(
  from: Vec2,
  to: Vec2,
  attackDirection: 1 | -1,
  pitch: PitchDimensions
): number {
  const forwardDelta = (to.x - from.x) * attackDirection;
  const forwardRatio = forwardDelta / pitch.length;

  // 0.5 = nötr, 1 = ileri, 0 = geri
  return Math.max(
    0,
    Math.min(1, 0.5 + forwardRatio * 2)
  );
}