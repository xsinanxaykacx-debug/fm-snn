// src/engine/live/pitch.ts

/**
 * SAHA GEOMETRİSİ
 * ----------------
 * Bu dosya yalnızca geometrik hesaplar içerir.
 *
 * YASAK:
 *  - Oyuncu kararı
 *  - Rastgelelik (RNG)
 *  - Simülasyon
 *  - Taktik
 *  - Top fiziği (yalnızca top yarıçapı gerektiğinde dışarıdan gelir)
 *  - Possession / attack / defense mantığı
 *  - Gol / aut / korner KARARI (yalnızca sınıflandırma)
 *
 * KONTRAT:
 *  - PitchDimensions types.ts'ten gelir (tek kaynak).
 *  - detectBoundaryCrossing() saf 2D'dir. Z dikkate alınmaz.
 *  - detectBoundaryCrossing() yalnızca İLK kesişimi döndürür.
 *  - Köşe noktasında entry sırası: LEFT, RIGHT, TOP, BOTTOM.
 *    Bu sayede köşede kale çizgisi taç çizgisinden önce gelir → korner.
 *  - getCornerPoint() hem GOAL_LINE hem GOAL_MOUTH kabul eder.
 */

import type { PitchDimensions } from '../types';

// ═══════════════════════════════════════════════
// SABİTLER
// ═══════════════════════════════════════════════

export const OUT_OF_BOUNDS_MARGIN = 2.0;

const EPSILON = 1e-9;

// ═══════════════════════════════════════════════
// VARSAYILAN SAHA
// ═══════════════════════════════════════════════

export const DEFAULT_PITCH_DIMENSIONS: PitchDimensions = {
  length: 104,
  width: 64,

  goalWidth: 7.32,
  goalHeight: 2.44,
  postRadius: 0.06,

  penaltyAreaDepth: 16.5,
  penaltyAreaWidth: 40.32,

  goalAreaDepth: 5.5,
  goalAreaWidth: 18.32,

  penaltySpotDistance: 11.0,
  centerCircleRadius: 9.15,
  cornerArcRadius: 1.0,
};

// ═══════════════════════════════════════════════
// TİPLER
// ═══════════════════════════════════════════════

export type TeamSide = 'HOME' | 'AWAY';

export type PitchPoint = {
  x: number;
  y: number;
};

export type PitchVector = {
  x: number;
  y: number;
};

export type Segment = {
  start: PitchPoint;
  end: PitchPoint;
};

export type GoalPost = {
  center: PitchPoint;
  radius: number;
};

export type GoalGeometry = {
  side: TeamSide;
  goalLineX: number;
  leftPost: GoalPost;
  rightPost: GoalPost;
  width: number;
  height: number;
  postRadius: number;
};

export type BoundaryType =
  | 'TOUCHLINE'
  | 'GOAL_LINE'
  | 'GOAL_MOUTH'
  | 'NONE';

export type BoundaryCrossing = {
  crossed: boolean;
  type: BoundaryType;
  point: PitchPoint | null;
  t: number | null;
  half: 'LEFT' | 'RIGHT' | null;
  side: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' | null;
};

export type GoalMouth = {
  left: number;
  right: number;
};

export type RectArea = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

// ═══════════════════════════════════════════════
// TEMEL NOKTA / VEKTÖR FONKSİYONLARI
// ═══════════════════════════════════════════════

export function createPoint(x: number, y: number): PitchPoint {
  return { x, y };
}

export function addPoints(a: PitchPoint, b: PitchPoint): PitchPoint {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtractPoints(a: PitchPoint, b: PitchPoint): PitchVector {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function multiplyVector(v: PitchVector, s: number): PitchVector {
  return { x: v.x * s, y: v.y * s };
}

export function distanceSquared(a: PitchPoint, b: PitchPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function distance(a: PitchPoint, b: PitchPoint): number {
  return Math.sqrt(distanceSquared(a, b));
}

export function lerpPoint(a: PitchPoint, b: PitchPoint, t: number): PitchPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

// ═══════════════════════════════════════════════
// SAHA SINIRLARI
// ═══════════════════════════════════════════════

export function isInsidePitch(d: PitchDimensions, p: PitchPoint): boolean {
  return (
    p.x >= 0 &&
    p.x <= d.length &&
    p.y >= 0 &&
    p.y <= d.width
  );
}

export function isOutsidePitchWithMargin(
  d: PitchDimensions,
  p: PitchPoint
): boolean {
  return (
    p.x < -OUT_OF_BOUNDS_MARGIN ||
    p.x > d.length + OUT_OF_BOUNDS_MARGIN ||
    p.y < -OUT_OF_BOUNDS_MARGIN ||
    p.y > d.width + OUT_OF_BOUNDS_MARGIN
  );
}

// ═══════════════════════════════════════════════
// KALE GEOMETRİSİ
// ═══════════════════════════════════════════════

export function getGoalMouth(d: PitchDimensions): GoalMouth {
  const center = d.width / 2;
  const half = d.goalWidth / 2;

  return {
    left: center - half,
    right: center + half,
  };
}

export function getGoalGeometry(
  d: PitchDimensions,
  side: TeamSide
): GoalGeometry {
  const mouth = getGoalMouth(d);
  const goalLineX = side === 'HOME' ? 0 : d.length;

  return {
    side,
    goalLineX,

    leftPost: {
      center: { x: goalLineX, y: mouth.left },
      radius: d.postRadius,
    },

    rightPost: {
      center: { x: goalLineX, y: mouth.right },
      radius: d.postRadius,
    },

    width: d.goalWidth,
    height: d.goalHeight,
    postRadius: d.postRadius,
  };
}

export function isInsideGoalMouth(
  d: PitchDimensions,
  p: PitchPoint
): boolean {
  const m = getGoalMouth(d);
  return p.y >= m.left && p.y <= m.right;
}

// ═══════════════════════════════════════════════
// DİREK GEOMETRİSİ
// ═══════════════════════════════════════════════

export function distanceToPost(post: GoalPost, p: PitchPoint): number {
  return distance(post.center, p);
}

export function isPointTouchingPost(
  post: GoalPost,
  p: PitchPoint
): boolean {
  return distanceSquared(post.center, p) <= post.radius * post.radius;
}

// ═══════════════════════════════════════════════
// CEZA ALANI
// ═══════════════════════════════════════════════

export function getPenaltyArea(
  d: PitchDimensions,
  side: TeamSide
): RectArea {
  const centerY = d.width / 2;
  const half = d.penaltyAreaWidth / 2;

  const top = centerY - half;
  const bottom = centerY + half;

  if (side === 'HOME') {
    return {
      left: 0,
      right: d.penaltyAreaDepth,
      top,
      bottom,
    };
  }

  return {
    left: d.length - d.penaltyAreaDepth,
    right: d.length,
    top,
    bottom,
  };
}

export function isInsidePenaltyArea(
  d: PitchDimensions,
  p: PitchPoint,
  side: TeamSide
): boolean {
  const a = getPenaltyArea(d, side);
  return (
    p.x >= a.left &&
    p.x <= a.right &&
    p.y >= a.top &&
    p.y <= a.bottom
  );
}

// ═══════════════════════════════════════════════
// KALE ALANI
// ═══════════════════════════════════════════════

export function getGoalArea(
  d: PitchDimensions,
  side: TeamSide
): RectArea {
  const centerY = d.width / 2;
  const half = d.goalAreaWidth / 2;

  const top = centerY - half;
  const bottom = centerY + half;

  if (side === 'HOME') {
    return {
      left: 0,
      right: d.goalAreaDepth,
      top,
      bottom,
    };
  }

  return {
    left: d.length - d.goalAreaDepth,
    right: d.length,
    top,
    bottom,
  };
}

export function isInsideGoalArea(
  d: PitchDimensions,
  p: PitchPoint,
  side: TeamSide
): boolean {
  const a = getGoalArea(d, side);
  return (
    p.x >= a.left &&
    p.x <= a.right &&
    p.y >= a.top &&
    p.y <= a.bottom
  );
}

// ═══════════════════════════════════════════════
// SEGMENT KESİŞİMİ
// ═══════════════════════════════════════════════

type SegmentIntersection = {
  intersects: boolean;
  t: number;
  point: PitchPoint;
};

export function segmentIntersection(
  first: Segment,
  second: Segment
): SegmentIntersection | null {
  const { x: x1, y: y1 } = first.start;
  const { x: x2, y: y2 } = first.end;
  const { x: x3, y: y3 } = second.start;
  const { x: x4, y: y4 } = second.end;

  const denom =
    (x1 - x2) * (y3 - y4) -
    (y1 - y2) * (x3 - x4);

  if (Math.abs(denom) <= EPSILON) return null;

  const t =
    ((x1 - x3) * (y3 - y4) -
      (y1 - y3) * (x3 - x4)) /
    denom;

  const u = -(
    (x1 - x2) * (y1 - y3) -
    (y1 - y2) * (x1 - x3)
  ) / denom;

  if (
    t < -EPSILON ||
    t > 1 + EPSILON ||
    u < -EPSILON ||
    u > 1 + EPSILON
  ) {
    return null;
  }

  const clampedT = Math.max(0, Math.min(1, t));

  return {
    intersects: true,
    t: clampedT,
    point: lerpPoint(first.start, first.end, clampedT),
  };
}

// ═══════════════════════════════════════════════
// SAHA SINIR SEGMENTLERİ
// ═══════════════════════════════════════════════

export function getPitchBoundarySegments(
  d: PitchDimensions
): {
  top: Segment;
  bottom: Segment;
  left: Segment;
  right: Segment;
} {
  return {
    top: {
      start: { x: 0, y: 0 },
      end: { x: d.length, y: 0 },
    },
    bottom: {
      start: { x: 0, y: d.width },
      end: { x: d.length, y: d.width },
    },
    left: {
      start: { x: 0, y: 0 },
      end: { x: 0, y: d.width },
    },
    right: {
      start: { x: d.length, y: 0 },
      end: { x: d.length, y: d.width },
    },
  };
}

// ═══════════════════════════════════════════════
// SINIR SINIFLANDIRMA
// ═══════════════════════════════════════════════

function classifyBoundary(
  d: PitchDimensions,
  point: PitchPoint,
  boundary: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT'
): BoundaryType {
  if (boundary === 'LEFT' || boundary === 'RIGHT') {
    return isInsideGoalMouth(d, point)
      ? 'GOAL_MOUTH'
      : 'GOAL_LINE';
  }
  return 'TOUCHLINE';
}

function getHalf(
  d: PitchDimensions,
  point: PitchPoint
): 'LEFT' | 'RIGHT' {
  return point.x < d.length / 2 ? 'LEFT' : 'RIGHT';
}

// ═══════════════════════════════════════════════
// SINIR GEÇİŞİ (2D — saf geometri)
// ═══════════════════════════════════════════════

/**
 * KONTRAT:
 *  • Sadece 2D. Top yüksekliği (z) burada dikkate ALINMAZ.
 *  • Sadece İLK kesişim döner (en küçük t).
 *  • start noktası saha içinde olmalı. Aksi halde sonuç anlamsızdır.
 *  • Gol / aut / korner / kale vuruşu KARARI VERMEZ.
 *
 * ENTRY ÖNCELİĞİ:
 *  LEFT, RIGHT, TOP, BOTTOM
 *
 *  Köşe noktasında (x=0, y=0) iki kesişim aynı t değerine sahip olabilir.
 *  Stable sort + entry sırası LEFT/RIGHT'ı öne alır. Böylece köşeden çıkan
 *  top taç yerine kale çizgisi (korner / kale vuruşu) olarak sınıflandırılır.
 */
export function detectBoundaryCrossing(
  d: PitchDimensions,
  start: PitchPoint,
  end: PitchPoint
): BoundaryCrossing {
  const movement: Segment = { start, end };
  const boundaries = getPitchBoundarySegments(d);

  const entries: Array<{
    boundary: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
    segment: Segment;
  }> = [
    { boundary: 'LEFT', segment: boundaries.left },
    { boundary: 'RIGHT', segment: boundaries.right },
    { boundary: 'TOP', segment: boundaries.top },
    { boundary: 'BOTTOM', segment: boundaries.bottom },
  ];

  const candidates: Array<{
    boundary: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
    result: SegmentIntersection;
  }> = [];

  for (const e of entries) {
    const x = segmentIntersection(movement, e.segment);
    if (!x) continue;

    // Başlangıç zaten çizgi üzerindeyse yeni "çıkış" sayılmaz.
    if (x.t <= EPSILON) continue;

    candidates.push({ boundary: e.boundary, result: x });
  }

  if (candidates.length === 0) {
    return {
      crossed: false,
      type: 'NONE',
      point: null,
      t: null,
      half: null,
      side: null,
    };
  }

  // Stable sort: eşit t'de entry sırası korunur.
  candidates.sort((a, b) => a.result.t - b.result.t);

  const first = candidates[0];
  const pt = first.result.point;

  return {
    crossed: true,
    type: classifyBoundary(d, pt, first.boundary),
    point: pt,
    t: first.result.t,
    half: getHalf(d, pt),
    side: first.boundary,
  };
}

// ═══════════════════════════════════════════════
// KORNER KÖŞESİ
// ═══════════════════════════════════════════════

/**
 * KONTRAT:
 *  • Karar vermez. Yalnızca geometrik köşeyi döndürür.
 *  • GOAL_LINE ve GOAL_MOUTH kabul edilir.
 *    Yükseklik kontrolü events.ts'tedir.
 *  • Taç çizgisinden çıkışta null döner (korner değildir).
 *  • `crossing.half` kullanılmaz; karar `crossing.point.y` üzerinden verilir.
 */
export function getCornerPoint(
  d: PitchDimensions,
  crossing: BoundaryCrossing
): PitchPoint | null {
  if (!crossing.crossed) return null;
  if (crossing.point === null) return null;
  if (crossing.side !== 'LEFT' && crossing.side !== 'RIGHT') return null;
  if (crossing.type !== 'GOAL_LINE' && crossing.type !== 'GOAL_MOUTH') {
    return null;
  }

  const onLeft = crossing.side === 'LEFT';
  const onTop = crossing.point.y < d.width / 2;

  if (onLeft && onTop) return { x: 0, y: 0 };
  if (onLeft && !onTop) return { x: 0, y: d.width };
  if (!onLeft && onTop) return { x: d.length, y: 0 };
  return { x: d.length, y: d.width };
}

export function isInsideCornerArc(
  d: PitchDimensions,
  point: PitchPoint,
  corner: PitchPoint
): boolean {
  return (
    distanceSquared(point, corner) <=
    d.cornerArcRadius * d.cornerArcRadius
  );
}

// ═══════════════════════════════════════════════
// MERKEZ
// ═══════════════════════════════════════════════

export function getPitchCenter(d: PitchDimensions): PitchPoint {
  return { x: d.length / 2, y: d.width / 2 };
}

export function getHalfwayLine(d: PitchDimensions): Segment {
  const cx = d.length / 2;
  return {
    start: { x: cx, y: 0 },
    end: { x: cx, y: d.width },
  };
}

export function isOnHalfwayLine(
  d: PitchDimensions,
  p: PitchPoint
): boolean {
  return (
    Math.abs(p.x - d.length / 2) <= EPSILON &&
    p.y >= 0 &&
    p.y <= d.width
  );
}

// ═══════════════════════════════════════════════
// ÇİZGİ TESTLERİ
// ═══════════════════════════════════════════════

export function isOnGoalLine(
  d: PitchDimensions,
  p: PitchPoint,
  side: TeamSide
): boolean {
  const gx = side === 'HOME' ? 0 : d.length;
  return (
    Math.abs(p.x - gx) <= EPSILON &&
    p.y >= 0 &&
    p.y <= d.width
  );
}

export function isOnTouchline(
  d: PitchDimensions,
  p: PitchPoint
): boolean {
  const onTop = Math.abs(p.y) <= EPSILON;
  const onBottom = Math.abs(p.y - d.width) <= EPSILON;
  return (
    p.x >= 0 &&
    p.x <= d.length &&
    (onTop || onBottom)
  );
}

// ═══════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════

export function closestPointOnPitchBoundary(
  d: PitchDimensions,
  p: PitchPoint
): PitchPoint {
  const x = Math.max(0, Math.min(d.length, p.x));
  const y = Math.max(0, Math.min(d.width, p.y));

  const options = [
    { dist: Math.abs(y), pt: { x, y: 0 } },
    { dist: Math.abs(d.width - y), pt: { x, y: d.width } },
    { dist: Math.abs(x), pt: { x: 0, y } },
    { dist: Math.abs(d.length - x), pt: { x: d.length, y } },
  ];

  options.sort((a, b) => a.dist - b.dist);
  return options[0].pt;
}

export function projectPointToPitch(
  d: PitchDimensions,
  p: PitchPoint
): PitchPoint {
  return {
    x: Math.max(0, Math.min(d.length, p.x)),
    y: Math.max(0, Math.min(d.width, p.y)),
  };
}

// ═══════════════════════════════════════════════
// DOĞRULAMA
// ═══════════════════════════════════════════════

export function validatePitchDimensions(d: PitchDimensions): void {
  const fail = (msg: string): never => {
    throw new Error(`PitchDimensions: ${msg}`);
  };

  if (!Number.isFinite(d.length) || d.length <= 0) fail('length geçersiz');
  if (!Number.isFinite(d.width) || d.width <= 0) fail('width geçersiz');

  if (d.goalWidth <= 0 || d.goalWidth > d.width) fail('goalWidth geçersiz');
  if (d.goalHeight <= 0) fail('goalHeight geçersiz');
  if (d.postRadius < 0) fail('postRadius negatif');

  if (d.penaltyAreaDepth < 0 || d.penaltyAreaDepth > d.length) {
    fail('penaltyAreaDepth geçersiz');
  }
  if (d.penaltyAreaWidth < 0 || d.penaltyAreaWidth > d.width) {
    fail('penaltyAreaWidth geçersiz');
  }
  if (d.goalAreaDepth < 0 || d.goalAreaDepth > d.length) {
    fail('goalAreaDepth geçersiz');
  }
  if (d.goalAreaWidth < 0 || d.goalAreaWidth > d.width) {
    fail('goalAreaWidth geçersiz');
  }

  if (d.penaltySpotDistance < 0) fail('penaltySpotDistance negatif');
  if (d.centerCircleRadius < 0) fail('centerCircleRadius negatif');
  if (d.cornerArcRadius < 0) fail('cornerArcRadius negatif');

  // Mantıksal tutarlılık
  if (d.goalAreaDepth > d.penaltyAreaDepth) {
    fail('goalAreaDepth, penaltyAreaDepth\'tan büyük olamaz');
  }
  if (d.goalAreaWidth > d.penaltyAreaWidth) {
    fail('goalAreaWidth, penaltyAreaWidth\'tan büyük olamaz');
  }
  if (d.penaltyAreaDepth > d.length / 2) {
    fail('penaltyAreaDepth saha uzunluğunun yarısından büyük olamaz');
  }
  if (d.penaltyAreaWidth > d.width) {
    fail('penaltyAreaWidth saha genişliğinden büyük olamaz');
  }
}