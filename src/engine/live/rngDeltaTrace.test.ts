// src/engine/live/rngDeltaTrace.test.ts
//
// RNG DELTA TRACE — DIAGNOSTIC-ONLY
// ==================================
//
// Amaç:
//   Current production'ın her tick'te kaç RNG çağrısı tükettiğini
//   ölçmek. Call-level trace'e geçmeden önce ucuz bir ön tarama.
//
// KONTRAT:
//   • Production koduna dokunulmaz.
//   • Sadece onTick üzerinden state.rng.counter okunur.
//   • Deterministik (tek seed, tek maç).
//
// ÇIKTI:
//   • Delta != 0 olan tick'lerin listesi
//   • İlk delta spike (gözlem amaçlı)
//   • Toplam RNG tüketimi
//   • Max delta ve hangi tick'te
//   • Delta frekans dağılımı
//   • Özel tick işaretleri: 4359, 5000, 5010, 5011
//
// KULLANIM:
//   $env:RUN_LIVE_DIAGNOSTIC="1"
//   npx vitest run src/engine/live/rngDeltaTrace.test.ts
//
// NOT:
//   V4 referansı HENÜZ varsayılmıyor. Bu dosya yalnızca current
//   production profilini çıkarır. 8b6117f öncesi ile karşılaştırma
//   ayrı bir diagnostic'te yapılacak.

import { describe, it } from 'vitest';
import { simulateMatchLive } from './liveMatch';
import { generateGameData } from '../data/generateData';

const RUN = process.env.RUN_LIVE_DIAGNOSTIC === '1';
const SEED = 1008;

const MARKER_TICKS = new Set([
  4359,
  5000,
  5010,
  5011,
]);

interface DeltaRecord {
  tick: number;
  counter: number;
  delta: number;
  marked: boolean;
}

describe.skipIf(!RUN)('RNG delta trace — current production profile', () => {
  it(`seed ${SEED} için tick-bazlı RNG tüketim profilini çıkarır`, () => {
    const data = generateGameData();
    const clubs = Object.values(data.clubs);
    const home = clubs[0];
    const away = clubs[1];

    for (const player of Object.values(data.players)) {
      player.condition = 100;
      player.fatigue = 0;
      player.injuryWeeks = 0;
      player.suspensionWeeks = 0;
      player.sentOff = false;
      player.injured = false;
      player.redCard = false;
    }

    const deltas: DeltaRecord[] = [];
    let previousCounter = 0;

    simulateMatchLive(home, away, data.players, {
      seed: SEED,
      onTick: (state) => {
        const counter = state.rng.counter;
        const delta = counter - previousCounter;

        deltas.push({
          tick: state.tick,
          counter,
          delta,
          marked: MARKER_TICKS.has(state.tick),
        });

        previousCounter = counter;
      },
    });

    const finalCounter = deltas[deltas.length - 1]?.counter ?? 0;
    const totalTicks = deltas.length;

    const nonZero = deltas.filter(d => d.delta !== 0);
    const zeroCount = totalTicks - nonZero.length;

    const maxDelta = nonZero.reduce(
      (max, d) => (d.delta > max.delta ? d : max),
      { tick: 0, counter: 0, delta: 0, marked: false } as DeltaRecord,
    );

    const baselineWindow = 100;
    const baselineSlice = deltas
      .slice(0, baselineWindow)
      .filter(d => d.delta > 0);

    const baselineMean =
      baselineSlice.length > 0
        ? baselineSlice.reduce((s, d) => s + d.delta, 0) / baselineSlice.length
        : 0;

    const divergenceThreshold = baselineMean * 3;
    const firstDeltaSpike = deltas.find(
      d => d.delta > 0 && d.delta > divergenceThreshold,
    );

    const freq: Record<number, number> = {};
    for (const d of nonZero) {
      freq[d.delta] = (freq[d.delta] ?? 0) + 1;
    }

    const freqSorted = Object.entries(freq)
      .map(([delta, count]) => ({ delta: Number(delta), count }))
      .sort((a, b) => a.delta - b.delta);

    const markedRecords = deltas.filter(d => d.marked);

    console.log('\n=== RNG DELTA TRACE (seed ' + SEED + ') ===\n');

    console.log('--- GENEL ---');
    console.log('total ticks:        ' + totalTicks);
    console.log('final counter:      ' + finalCounter);
    console.log('delta != 0 ticks:   ' + nonZero.length);
    console.log('delta == 0 ticks:   ' + zeroCount);
    console.log(
      'delta == 0 oranı:   ' +
        ((zeroCount / totalTicks) * 100).toFixed(2) +
        '%',
    );
    console.log(
      'ortalama delta (tüm tick): ' +
        (finalCounter / totalTicks).toFixed(4),
    );
    console.log(
      'ortalama delta (non-zero): ' +
        (finalCounter / Math.max(1, nonZero.length)).toFixed(4),
    );
    console.log('max delta:          ' + maxDelta.delta);
    console.log('max delta tick:     ' + maxDelta.tick);
    console.log(
      'baseline mean (ilk ' + baselineWindow + ' tick): ' +
        baselineMean.toFixed(4),
    );
    console.log(
      'divergence threshold (baseline × 3): ' +
        divergenceThreshold.toFixed(4),
    );
    console.log(
      'first delta spike:  ' +
        (firstDeltaSpike
          ? 'tick=' + firstDeltaSpike.tick + ' delta=' + firstDeltaSpike.delta
          : 'none'),
    );

    console.log('\n--- DELTA FREKANS DAĞILIMI ---');
    console.table(
      freqSorted.map(f => ({
        delta: f.delta,
        count: f.count,
        yüzde: ((f.count / nonZero.length) * 100).toFixed(2) + '%',
      })),
    );

    console.log('\n--- İŞARETLİ TICK\'LER ---');
    console.table(
      markedRecords.map(d => ({
        tick: d.tick,
        counter: d.counter,
        delta: d.delta,
      })),
    );

    console.log('\n--- İŞARETLİ TICK ÇEVRELERİ (±3 tick) ---');
    const neighborhood = new Set<number>();
    for (const t of MARKER_TICKS) {
      for (let offset = -3; offset <= 3; offset++) {
        neighborhood.add(t + offset);
      }
    }

    const neighborhoodRecords = deltas.filter(d =>
      neighborhood.has(d.tick),
    );

    console.table(
      neighborhoodRecords.map(d => ({
        tick: d.tick,
        delta: d.delta,
        counter: d.counter,
        marker: d.marked ? '★' : '',
      })),
    );

    console.log('\n--- İLK 30 DELTA != 0 TICK ---');
    console.table(
      nonZero.slice(0, 30).map(d => ({
        tick: d.tick,
        delta: d.delta,
        counter: d.counter,
      })),
    );

    console.log('\n--- SON 30 DELTA != 0 TICK ---');
    console.table(
      nonZero.slice(-30).map(d => ({
        tick: d.tick,
        delta: d.delta,
        counter: d.counter,
      })),
    );

    const bursts: {
      startTick: number;
      length: number;
      totalDelta: number;
    }[] = [];

    let currentBurst: {
      startTick: number;
      length: number;
      totalDelta: number;
    } | null = null;

    for (const d of deltas) {
      if (d.delta !== 0) {
        if (currentBurst === null) {
          currentBurst = {
            startTick: d.tick,
            length: 1,
            totalDelta: d.delta,
          };
        } else {
          currentBurst.length += 1;
          currentBurst.totalDelta += d.delta;
        }
      } else if (currentBurst !== null) {
        bursts.push(currentBurst);
        currentBurst = null;
      }
    }

    if (currentBurst !== null) {
      bursts.push(currentBurst);
    }

    const topBursts = [...bursts]
      .sort((a, b) => b.totalDelta - a.totalDelta)
      .slice(0, 10);

    console.log('\n--- EN YOĞUN 10 RNG BURST (ardışık delta != 0) ---');
    console.table(
      topBursts.map(b => ({
        startTick: b.startTick,
        uzunluk: b.length,
        toplamDelta: b.totalDelta,
      })),
    );

    console.log('\n=== SON ===\n');
  }, 60 * 60 * 1000);
});
