// src/engine/live/tackle.ts

/**
 * TACKLE ÇÖZÜMLEMESİ
 * -------------------
 * Bu dosya bir tackle'ın başarı/başarısızlık/faul sonucunu hesaplar.
 *
 * YASAK:
 *  - Kart değerlendirmesi (events.ts / match rules)
 *  - State mutasyonu (ball.ownerId, player.position vb.)
 *  - MatchEvent üretme
 *  - Math.random()
 *
 * KONTRAT:
 *  - RNG kullanır ama SEEDED (replay + test mümkün).
 *  - Sadece sonuç döner (TackleOutcome).
 *  - State uygulaması dış katmanda (movement / liveMatch).
 *  - ball.ts controlBall/releaseBall çağrıları dışarıda.
 */

import type { LivePlayer, Vec2 } from '../types';
import { nextBool, nextFloat, type RngState } from './rng';

// ═══════════════════════════════════════════════
// TİPLER
// ═══════════════════════════════════════════════

export type TackleOutcome =
  | {
      type: 'won';
      tacklerId: string;
      ballCarrierId: string;
      /** Temiz kazanım → tacklerId, loose ball → null */
      newOwnerId: string | null;
      point: Vec2;
    }
  | {
      type: 'failed';
      tacklerId: string;
      ballCarrierId: string;
      /** Top hâlâ aynı oyuncuda */
    }
  | {
      type: 'foul';
      tacklerId: string;
      ballCarrierId: string;
      /** Faul şiddeti — kart değerlendirmesi events.ts'te */
      severity: 'light' | 'medium' | 'severe';
      point: Vec2;
    };

export interface TackleContext {
  tackler: LivePlayer;
  ballCarrier: LivePlayer;
  distance: number;
  angle: number;
  relativeSpeed: number;
  rng: RngState;
}

// ═══════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════

function attrRatio(v: number): number {
  return Math.max(0, Math.min(1, v / 20));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ═══════════════════════════════════════════════
// ANA FONKSİYON
// ═══════════════════════════════════════════════

/**
 * Bir tackle'ın sonucunu çözer.
 *
 * KONTRAT:
 *  • Seeded RNG kullanır.
 *  • Kart değerlendirmesi yapmaz.
 *  • Faul kararı verir, şiddetini belirler.
 *  • State mutate etmez.
 */
export function resolveTackle(context: TackleContext): TackleOutcome {
  const { tackler, ballCarrier, distance, relativeSpeed, rng } = context;

  const ta = tackler.player.attributes;
  const ca = ballCarrier.player.attributes;

  // Attack (tackler) gücü
  const attackPower =
    attrRatio(ta.tackling) * 1.0 +
    attrRatio(ta.aggression) * 0.5 +
    attrRatio(ta.bravery) * 0.3;

  // Defense (carrier) gücü
  const defensePower =
    attrRatio(ca.dribbling) * 1.0 +
    attrRatio(ca.agility) * 0.5 +
    attrRatio(ca.balance) * 0.3 +
    attrRatio(relativeSpeed / 10) * 0.5;

  // Mesafe cezası — uzaktan tackle zor
  const distancePenalty = clamp(distance / 1.5, 0, 0.5);

  // Net güç
  const netPower = (attackPower - defensePower) - distancePenalty;

  // Kazanma olasılığı
  const winChance = clamp(sigmoid(netPower * 2.5), 0.05, 0.95);

  // Roll
  const won = nextBool(rng, winChance);

  if (won) {
    // Loose ball olasılığı — tackling'e göre
    const cleanChance = clamp(
      0.6 + attrRatio(ta.tackling) * 0.3,
      0.5,
      0.95
    );
    const clean = nextBool(rng, cleanChance);

    return {
      type: 'won',
      tacklerId: tackler.player.id,
      ballCarrierId: ballCarrier.player.id,
      newOwnerId: clean ? tackler.player.id : null,
      point: { ...ballCarrier.position },
    };
  }

  // Kazanamadı — faul mü?
  const foulProb = computeFoulProbability(
    tackler.player.id,
    tackler,
    ballCarrier,
    distance
  );

  if (nextBool(rng, foulProb)) {
    const severity = computeFoulSeverity(tackler, distance);
    return {
      type: 'foul',
      tacklerId: tackler.player.id,
      ballCarrierId: ballCarrier.player.id,
      severity,
      point: { ...ballCarrier.position },
    };
  }

  return {
    type: 'failed',
    tacklerId: tackler.player.id,
    ballCarrierId: ballCarrier.player.id,
  };
}

// ═══════════════════════════════════════════════
// FAUL OLASILIĞI VE ŞİDDETİ
// ═══════════════════════════════════════════════

/**
 * Başarısız tackle sonrası faul olasılığını hesaplar.
 * Deterministik. RNG kullanmaz (yalnızca olasılık üretir).
 */
export function computeFoulProbability(
  _tacklerId: string,
  tackler: LivePlayer,
  _ballCarrier: LivePlayer,
  distance: number
): number {
  const a = tackler.player.attributes;

  // Agresif + uzak mesafe → daha çok faul
  const base = 0.15;
  const aggBonus = attrRatio(a.aggression) * 0.2;
  const distBonus = clamp(distance / 1.5, 0, 0.25);

  return clamp(base + aggBonus + distBonus, 0.05, 0.6);
}

/**
 * Faul şiddetini belirler.
 * Deterministik. RNG kullanmaz.
 */
export function computeFoulSeverity(
  tackler: LivePlayer,
  distance: number
): 'light' | 'medium' | 'severe' {
  const a = tackler.player.attributes;

  const agg = attrRatio(a.aggression);
  const bravery = attrRatio(a.bravery);
  const dist = clamp(distance / 1.5, 0, 1);

  const severityScore = agg * 0.5 + bravery * 0.3 + dist * 0.2;

  if (severityScore < 0.35) return 'light';
  if (severityScore < 0.65) return 'medium';
  return 'severe';
}