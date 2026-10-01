// src/engine/live/tackle.ts

/**
 * TACKLE ÇÖZÜMLEMESİ
 * -------------------
 * Bu dosya bir tackle'ın başarı / başarısızlık / faul sonucunu hesaplar.
 *
 * YASAK:
 *  - Kart değerlendirmesi (events.ts / match rules katmanı)
 *  - State mutasyonu (ball.ownerId, player.position vb.)
 *  - MatchEvent üretimi
 *  - Math.random()
 *  - Foul severity → kart kararı
 *
 * KONTRAT:
 *  - Seeded RNG kullanır (replay + test mümkün).
 *  - Sadece sonuç döner (TackleOutcome).
 *  - State uygulaması dış katmanda (liveMatch.ts).
 *  - Faul kararı verir, KART kararı vermez.
 *  - ball.ts controlBall/releaseBall çağrıları liveMatch.ts'te.
 *  - Sabit sayı gömülmez; config.ts'ten import edilir.
 */

import type {
  Decision,
  LivePlayer,
  RngState,
  TackleOutcome,
} from '../types';

import {
  // Attack ağırlıkları
  TACKLE_ATTACK_TACKLING_WEIGHT,
  TACKLE_ATTACK_AGGRESSION_WEIGHT,
  TACKLE_ATTACK_BRAVERY_WEIGHT,

  // Defense ağırlıkları
  TACKLE_DEFENSE_DRIBBLING_WEIGHT,
  TACKLE_DEFENSE_AGILITY_WEIGHT,
  TACKLE_DEFENSE_BALANCE_WEIGHT,
  TACKLE_DEFENSE_RELATIVE_SPEED_WEIGHT,
  TACKLE_RELATIVE_SPEED_SCALE,

  // Clean chance
  TACKLE_CLEAN_MIN,
  TACKLE_CLEAN_MAX,
  TACKLE_CLEAN_CHANCE_BASE,
  TACKLE_CLEAN_CHANCE_TACKLING,

  // Kazanma sınırları
  TACKLE_WIN_MIN,
  TACKLE_WIN_MAX,

  // Sigmoid + mesafe
  TACKLE_SIGMOID_SCALE,
  TACKLE_DISTANCE_PENALTY_SCALE,

  // Faul
  FOUL_BASE_PROBABILITY,
  FOUL_AGGRESSION_WEIGHT,
  FOUL_DISTANCE_WEIGHT,
  FOUL_PROBABILITY_MIN,
  FOUL_PROBABILITY_MAX,

  // Faul şiddeti
  FOUL_SEVERITY_LIGHT,
  FOUL_SEVERITY_MEDIUM,
  FOUL_SEVERITY_AGGRESSION,
  FOUL_SEVERITY_BRAVERY,
  FOUL_SEVERITY_DISTANCE,
} from './config';

import { nextBool } from './rng';

// ═══════════════════════════════════════════════
// TACKLE CONTEXT
// ═══════════════════════════════════════════════

export interface TackleContext {
  tackler: LivePlayer;
  ballCarrier: LivePlayer;

  /** Tackler ile carrier arası mesafe (m). */
  distance: number;

  /**
   * Tackler → carrier arası açı (radyan).
   *
   * V1'de kullanılmıyor.
   * İleride "arkadan müdahale" gibi faktörler için ayrılmıştır.
   */
  angle: number;

  /** İki oyuncunun göreli hızı (m/s). */
  relativeSpeed: number;

  /** Seeded RNG. */
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
 *  • Deterministik DEĞİL (RNG var), ama replay için tekrarlanabilir.
 */
export function resolveTackle(
  context: TackleContext
): TackleOutcome {
  const {
    tackler,
    ballCarrier,
    distance,
    relativeSpeed,
    rng,
  } = context;

  const ta = tackler.player.attributes;
  const ca = ballCarrier.player.attributes;

  // ─── Attack (tackler) gücü ───
  const attackPower =
    attrRatio(ta.tackling) * TACKLE_ATTACK_TACKLING_WEIGHT +
    attrRatio(ta.aggression) * TACKLE_ATTACK_AGGRESSION_WEIGHT +
    attrRatio(ta.bravery) * TACKLE_ATTACK_BRAVERY_WEIGHT;

  // ─── Defense (carrier) gücü ───
  // ÖNEMLİ: relativeSpeed doğrudan normalize edilir (attrRatio değil).
  const relativeSpeedFactor = clamp(
    relativeSpeed / TACKLE_RELATIVE_SPEED_SCALE,
    0,
    1
  );

  const defensePower =
    attrRatio(ca.dribbling) * TACKLE_DEFENSE_DRIBBLING_WEIGHT +
    attrRatio(ca.agility) * TACKLE_DEFENSE_AGILITY_WEIGHT +
    attrRatio(ca.balance) * TACKLE_DEFENSE_BALANCE_WEIGHT +
    relativeSpeedFactor * TACKLE_DEFENSE_RELATIVE_SPEED_WEIGHT;

  // ─── Mesafe cezası ───
  const distancePenalty = clamp(
    distance / TACKLE_DISTANCE_PENALTY_SCALE,
    0,
    0.5
  );

  // ─── Net güç ───
  const netPower =
    attackPower - defensePower - distancePenalty;

  // ─── Kazanma olasılığı ───
  const winChance = clamp(
    sigmoid(netPower * TACKLE_SIGMOID_SCALE),
    TACKLE_WIN_MIN,
    TACKLE_WIN_MAX
  );

  // ─── Roll ───
  const won = nextBool(rng, winChance);

  if (won) {
    // Loose ball olasılığı — tackling'e göre
    const cleanChance = clamp(
      TACKLE_CLEAN_CHANCE_BASE +
        attrRatio(ta.tackling) * TACKLE_CLEAN_CHANCE_TACKLING,
      TACKLE_CLEAN_MIN,
      TACKLE_CLEAN_MAX
    );

    const clean = nextBool(rng, cleanChance);

    return {
      type: 'won',
      tacklerId: tackler.player.id,
      ballCarrierId: ballCarrier.player.id,
      newOwnerId: clean ? tackler.player.id : null,
      point: { ...ballCarrier.position },
      debug: { winChance, cleanChance, relativeSpeed, distance },
    };
  }

  // ─── Kazanamadı — faul mü? ───
  const foulProb = computeFoulProbability(
    tackler,
    distance
  );

  if (nextBool(rng, foulProb)) {
    const severity = computeFoulSeverity(
      tackler,
      distance
    );

    return {
      type: 'foul',
      tacklerId: tackler.player.id,
      ballCarrierId: ballCarrier.player.id,
      severity,
      debug: { winChance, relativeSpeed, distance },
      point: { ...ballCarrier.position },
    };
  }

  return {
    type: 'failed',
    tacklerId: tackler.player.id,
    ballCarrierId: ballCarrier.player.id,
    debug: { winChance, relativeSpeed, distance },
  };
}

// ═══════════════════════════════════════════════
// FAUL OLASILIĞI
// ═══════════════════════════════════════════════

/**
 * Başarısız tackle sonrası faul olasılığını hesaplar.
 *
 * KONTRAT:
 *  • Deterministik. RNG kullanmaz.
 *  • Yalnızca olasılık üretir, karar vermez.
 */
export function computeFoulProbability(
  tackler: LivePlayer,
  distance: number
): number {
  const a = tackler.player.attributes;

  const base = FOUL_BASE_PROBABILITY;
  const aggBonus =
    attrRatio(a.aggression) * FOUL_AGGRESSION_WEIGHT;
  const distBonus = clamp(
    distance / TACKLE_DISTANCE_PENALTY_SCALE,
    0,
    FOUL_DISTANCE_WEIGHT
  );

  return clamp(
    base + aggBonus + distBonus,
    FOUL_PROBABILITY_MIN,
    FOUL_PROBABILITY_MAX
  );
}

// ═══════════════════════════════════════════════
// FAUL ŞİDDETİ
// ═══════════════════════════════════════════════

/**
 * Faul şiddetini belirler.
 *
 * KONTRAT:
 *  • Deterministik. RNG kullanmaz.
 *  • Kart değerlendirmesi YAPMAZ — events.ts'in işi.
 *  • Yalnızca 'light' | 'medium' | 'severe' döner.
 */
export function computeFoulSeverity(
  tackler: LivePlayer,
  distance: number
): 'light' | 'medium' | 'severe' {
  const a = tackler.player.attributes;

  const agg = attrRatio(a.aggression);
  const bravery = attrRatio(a.bravery);
  const dist = clamp(
    distance / TACKLE_DISTANCE_PENALTY_SCALE,
    0,
    1
  );

  const severityScore =
    agg * FOUL_SEVERITY_AGGRESSION +
    bravery * FOUL_SEVERITY_BRAVERY +
    dist * FOUL_SEVERITY_DISTANCE;

  if (severityScore < FOUL_SEVERITY_LIGHT) return 'light';
  if (severityScore < FOUL_SEVERITY_MEDIUM) return 'medium';
  return 'severe';
}

// ═══════════════════════════════════════════════
// RESOLVE ALL TACKLES
// ═══════════════════════════════════════════════

/**
 * Bir tick'te tackle intent'i olan tüm oyuncular için tackle çözer.
 *
 * KONTRAT:
 *  • Deterministik iterasyon sırası (player.id ASC).
 *  • Her tackle bağımsız seeded RNG ile çözülür.
 *  • State mutate ETMEZ; sadece outcome listesi döner.
 *  • Mesafe tackle.ts'e parametre olarak geçirilir; çağıran hesap eder.
 *  • Ball-owner kontrolü: hem tackler hem carrier gerçekten
 *    o tick'teki rollerini taşımalıdır.
 *  • Karar eski olabilir → gerçek pozisyon sonrası doğrula.
 *
 * NOT: Bu fonksiyon moveAllPlayers() SONRASI çağrılmalıdır.
 *      Oyuncular gerçek pozisyonlarına ulaştıktan sonra tackle
 *      mesafesi gerçek koordinattan hesaplanır.
 */
export function resolveAllTackles(
  players: Record<string, LivePlayer>,
  decisions: Record<string, Decision>,
  tackleRadius: number,
  rng: RngState
): TackleOutcome[] {
  const outcomes: TackleOutcome[] = [];

  for (const id of Object.keys(players).sort()) {
    const player = players[id];
    const decision = decisions[id];

    if (!decision) continue;
    if (decision.intent !== 'tackle') continue;
    if (decision.targetPlayerId === null) continue;

    // Tackler top sahibi olmamalı
    if (player.isBallOwner) continue;

    const carrier = players[decision.targetPlayerId];
    if (!carrier) continue;

    // Rakip mi?
    if (carrier.clubId === player.clubId) continue;

    // Carrier gerçekten top sahibi mi?
    if (!carrier.isBallOwner) continue;

    // Mesafe
    const dx = carrier.position.x - player.position.x;
    const dy = carrier.position.y - player.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > tackleRadius) continue;

    // Açı
    const angle = Math.atan2(dy, dx);

    // Göreli hız
    const relVx = player.velocity.x - carrier.velocity.x;
    const relVy = player.velocity.y - carrier.velocity.y;
    const relativeSpeed = Math.sqrt(
      relVx * relVx + relVy * relVy
    );

    const outcome = resolveTackle({
      tackler: player,
      ballCarrier: carrier,
      distance: dist,
      angle,
      relativeSpeed,
      rng,
    });

    outcomes.push(outcome);
  }

  return outcomes;
}