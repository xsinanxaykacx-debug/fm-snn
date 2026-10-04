// src/engine/live/rng.ts

/**
 * SEEDED RNG
 * ----------
 * Bu dosya motorun TEK rastgelelik kaynağıdır.
 *
 * YASAK:
 *  - Math.random()  (bu dosya dışında hiçbir yerde kullanılmayacak)
 *  - Date.now()     (seed kaynağı olarak liveMatch.ts kullanır, bu dosya değil)
 *  - Global mutable state (RngState dışarıdan taşınır)
 *
 * KONTRAT:
 *  - Aynı seed + aynı çağrı sırası → aynı çıktı.
 *  - RngState dışarıdan taşınır (LiveMatchState.rng).
 *  - Her çağrı counter'ı 1 artırır → replay deterministik.
 *  - mulberry32 algoritması kullanılır.
 *
 * KULLANIM:
 *   const rng = createRng(12345);
 *   nextFloat(rng);   // [0, 1)
 *   nextInt(rng, 10); // [0, 10)
 *   nextBool(rng, 0.3);
 *   weightedChoice(rng, items, weights);
 */

// ═══════════════════════════════════════════════
// TİP
// ═══════════════════════════════════════════════

/**
 * RNG durumu.
 *
 * LiveMatchState içinde taşınır.
 * Doğrudan mutate edilir — her çağrı counter'ı artırır.
 */
export interface RngState {
  /** 32-bit unsigned seed */
  seed: number;

  /** Kaçıncı çağrı — her nextFloat() ile artar */
  counter: number;
}

// ═══════════════════════════════════════════════
// OLUŞTURMA
// ═══════════════════════════════════════════════

/**
 * Yeni bir RNG durumu oluşturur.
 *
 * KONTRAT:
 *  • Seed 32-bit unsigned'a dönüştürülür.
 *  • counter = 0 ile başlar.
 *  • RNG state'i mutate edilebilir; çağıran tarafından taşınmalıdır.
 */
export function createMatchSeed(fixtureId: string, week: number): number {
  let hash = 2166136261;

  const input = `${fixtureId}:${week}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createRng(seed: number): RngState {
  return {
    seed: seed >>> 0,
    counter: 0,
  };
}

/**
 * RNG durumunu kopyalar (immutable snapshot için).
 */
export function cloneRng(rng: RngState): RngState {
  return {
    seed: rng.seed,
    counter: rng.counter,
  };
}

// ═══════════════════════════════════════════════
// ÇEKİRDEK — mulberry32
// ═══════════════════════════════════════════════

/**
 * mulberry32 — 32-bit, hızlı, iyi dağılım.
 *
 * Deterministik: aynı (seed, counter) → aynı çıktı.
 * Counter dışarıdan gelir, bu fonksiyon state tutmaz.
 */
function mulberry32(seed: number, counter: number): number {
  let t = (seed + counter * 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ═══════════════════════════════════════════════
// TEMEL ÇAĞRILAR
// ═══════════════════════════════════════════════

/**
 * [0, 1) aralığında float döner.
 *
 * KONTRAT:
 *  • RngState.counter'ı 1 artırır.
 *  • Deterministik.
 */
export function nextFloat(rng: RngState): number {
  const value = mulberry32(rng.seed, rng.counter);
  rng.counter++;
  return value;
}

/**
 * [0, max) aralığında int döner.
 *
 * KONTRAT:
 *  • max <= 0 ise throw eder.
 *  • Deterministik.
 */
export function nextInt(rng: RngState, max: number): number {
  if (!Number.isFinite(max) || max <= 0) {
    throw new Error(`nextInt: max must be > 0 (got ${max})`);
  }
  return Math.floor(nextFloat(rng) * max);
}

/**
 * [min, max) aralığında int döner.
 */
export function nextIntRange(
  rng: RngState,
  min: number,
  max: number
): number {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    throw new Error(
      `nextIntRange: invalid range [${min}, ${max})`
    );
  }
  return min + Math.floor(nextFloat(rng) * (max - min));
}

/**
 * p olasılıkla true döner.
 *
 * KONTRAT:
 *  • p ∈ [0, 1] dışındaysa clamp edilir.
 *  • p <= 0 → her zaman false.
 *  • p >= 1 → her zaman true.
 *  • Deterministik.
 */
export function nextBool(rng: RngState, p: number): boolean {
  if (p <= 0) return false;
  if (p >= 1) return true;
  return nextFloat(rng) < p;
}

// ═══════════════════════════════════════════════
// AĞIRLIKLI SEÇİM
// ═══════════════════════════════════════════════

/**
 * Ağırlıklı rastgele seçim.
 *
 * KONTRAT:
 *  • items boşsa throw eder.
 *  • items.length !== weights.length ise throw eder.
 *  • Negatif ağırlıklar 0'a clamp edilir.
 *  • Toplam ağırlık 0 ise throw eder (sessiz hata yasak).
 *  • Deterministik.
 *  • RngState.counter'ı tam olarak 1 artırır.
 */
export function weightedChoice<T>(
  rng: RngState,
  items: T[],
  weights: number[]
): T {
  if (items.length === 0) {
    throw new Error('weightedChoice: empty items');
  }

  if (items.length !== weights.length) {
    throw new Error(
      `weightedChoice: items/weights length mismatch (${items.length} vs ${weights.length})`
    );
  }

  const w = weights.map(v => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = w.reduce((a, b) => a + b, 0);

  if (total <= 0) {
    throw new Error('weightedChoice: total weight is zero');
  }

  let r = nextFloat(rng) * total;

  for (let i = 0; i < items.length; i++) {
    r -= w[i];
    if (r <= 0) return items[i];
  }

  // Sayısal hassasiyet güvenlik ağı — teorik olarak buraya düşülmez
  return items[items.length - 1];
}

// ═══════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════

/**
 * Diziyi Fisher–Yates ile karıştırır.
 *
 * KONTRAT:
 *  • In-place karıştırır (yeni dizi döndürmez).
 *  • Deterministik — seeded RNG kullanır.
 *  • Boş veya tek elemanlı dizide no-op.
 */
export function shuffleInPlace<T>(rng: RngState, items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat(rng) * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
}

/**
 * Diziden rastgele bir eleman seçer.
 *
 * KONTRAT:
 *  • Boşsa throw eder.
 *  • Deterministik.
 */
export function pickOne<T>(rng: RngState, items: T[]): T {
  if (items.length === 0) {
    throw new Error('pickOne: empty items');
  }
  return items[nextInt(rng, items.length)];
}

/**
 * Gaussian (Box–Muller) — 0 ortalamalı, 1 standart sapmalı.
 *
 * KONAY:
 *  • İki nextFloat() çağrısı kullanır.
 *  • Deterministik.
 */
export function nextGaussian(rng: RngState): number {
  let u = 0;
  let v = 0;

  while (u === 0) u = nextFloat(rng);
  while (v === 0) v = nextFloat(rng);

  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}