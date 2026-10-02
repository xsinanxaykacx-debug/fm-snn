// src/engine/live/pendingRecoveryDecisionDiagnostic.test.ts
//
// v5 — Pending Recovery Decision Zinciri Tanısı
//
// Amaç:
//   Seed 1008'de pending recovery'nin GERÇEK başlangıç tick'ini tüm maç
//   boyunca izleyerek tespit etmek; ardından pending recovery oyuncusunun
//   Decision/target zincirini tick tick gözlemlemek.
//
// Kapsam:
//   - Yalnızca seed 1008.
//   - pendingLooseBallRecoveryPlayerId için null → playerId geçişi
//     maç boyunca izlenir.
//   - İlk pending başlangıcı raporlanır; 4359 civarı mı doğrulanır.
//   - Raporlama: 4359–4417.
//   - Pending'in expiry anı, pending alanı o tick'te temizlendiği için
//     önceki aktif oyuncu ID'si üzerinden ayrıca yakalanır.
//
// Üç senaryoyu ayırt etmek için:
//   A) Karar problemi       → reason chase değil, target top değil
//   B) Karar doğru ama eski → nextDecisionTime ileride, decisionChanges=0
//   C) Karar doğru          → reason=chase, target≈ball, yine de yetişemiyor
//
// Kullanım:
//   $env:RUN_LIVE_DIAGNOSTIC="1"
//   npx vitest run src/engine/live/pendingRecoveryDecisionDiagnostic.test.ts
//
// Bu dosya production kodunu değiştirmez.

import { describe, it, expect } from 'vitest';
import { simulateMatchLive } from './liveMatch';
import { generateGameData } from '../data/generateData';
import type { LiveMatchState, LivePlayer } from '../types';

const RUN = process.env.RUN_LIVE_DIAGNOSTIC === '1';
const SEED = 1008;

const REPORT_START = 4359;
const REPORT_END = 4417;

// ---------------------------------------------------------------------------
// Güvenli vektör yardımcıları
// ---------------------------------------------------------------------------

function safeNorm(x: number, y: number): number {
  const len = Math.sqrt(x * x + y * y);
  return len > 1e-9 ? len : 0;
}

function dotSafe(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const na = safeNorm(ax, ay);
  const nb = safeNorm(bx, by);
  if (na === 0 || nb === 0) return 0;
  return (ax / na) * (bx / nb) + (ay / nb) * (by / nb);
}

function distanceXY(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

type DecisionSnapshot = {
  intent: string;
  reason: string;
  targetX: number | null;
  targetY: number | null;
  timestamp: number;
};

type TickRecord = {
  tick: number;
  elapsedTicks: number;
  playerX: number;
  playerY: number;
  playerVx: number;
  playerVy: number;
  ballX: number;
  ballY: number;
  distance: number;
  decision: DecisionSnapshot | null;
  currentIntent: string;
  isChasingBall: boolean;
  nextDecisionTime: number;
  decisionChanged: boolean;
  dot: number;
};

type PendingStartSnapshot = {
  seed: number;
  tick: number;
  pendingPlayerId: string;
  pendingClubId: string;
  playerX: number;
  playerY: number;
  playerVx: number;
  playerVy: number;
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  distance: number;
  decision: DecisionSnapshot | null;
  currentIntent: string;
  isChasingBall: boolean;
  nextDecisionTime: number;
  stateTime: number;
};

// ---------------------------------------------------------------------------
// Ana tanı
// ---------------------------------------------------------------------------

describe('Pending recovery decision diagnostic (v5)', () => {
  it(
    'seed 1008 için gerçek pending başlangıcını tespit eder ve decision zincirini izler',
    () => {
      if (!RUN) {
        console.log('[v5] RUN_LIVE_DIAGNOSTIC=1 değil, tanı atlandı.');
        return;
      }

      let pendingStart: PendingStartSnapshot | null = null;
      let prevPendingId: string | null = null;
      let activePendingPlayerId: string | null = null;

      const ticks: TickRecord[] = [];
      let decisionChanges = 0;
      let lastDecisionTimestamp: number | null = null;

      const recordTick = (
        state: LiveMatchState,
        tick: number,
        player: LivePlayer,
        elapsedTicks: number,
      ): void => {
        const snapshot = toSnapshot(player);

        let decisionChanged = false;
        if (snapshot !== null) {
          if (
            lastDecisionTimestamp !== null &&
            snapshot.timestamp !== lastDecisionTimestamp
          ) {
            decisionChanges++;
            decisionChanged = true;
          }
          lastDecisionTimestamp = snapshot.timestamp;
        }

        const dx = state.ball.position.x - player.position.x;
        const dy = state.ball.position.y - player.position.y;

        const distance = distanceXY(
          player.position.x,
          player.position.y,
          state.ball.position.x,
          state.ball.position.y,
        );

        const dot = dotSafe(
          player.velocity.x,
          player.velocity.y,
          dx,
          dy,
        );

        ticks.push({
          tick,
          elapsedTicks,
          playerX: player.position.x,
          playerY: player.position.y,
          playerVx: player.velocity.x,
          playerVy: player.velocity.y,
          ballX: state.ball.position.x,
          ballY: state.ball.position.y,
          distance,
          decision: snapshot,
          currentIntent: player.currentIntent,
          isChasingBall: player.isChasingBall,
          nextDecisionTime: player.nextDecisionTime,
          decisionChanged,
          dot,
        });
      };

      const onTick = (state: LiveMatchState) => {
        const tick = state.tick;
        const pendingId: string | null =
          state.transition.pendingLooseBallRecoveryPlayerId ?? null;

        // Gerçek pending başlangıcı: null → playerId.
        const isPendingStart =
          prevPendingId === null &&
          pendingId !== null &&
          pendingStart === null;

        if (isPendingStart) {
          const player = state.players[pendingId];

          if (player) {
            const snapshot = toSnapshot(player);
            const distance = distanceXY(
              player.position.x,
              player.position.y,
              state.ball.position.x,
              state.ball.position.y,
            );

            pendingStart = {
              seed: SEED,
              tick,
              pendingPlayerId: pendingId,
              pendingClubId: player.clubId,
              playerX: player.position.x,
              playerY: player.position.y,
              playerVx: player.velocity.x,
              playerVy: player.velocity.y,
              ballX: state.ball.position.x,
              ballY: state.ball.position.y,
              ballVx: state.ball.velocity.x,
              ballVy: state.ball.velocity.y,
              distance,
              decision: snapshot,
              currentIntent: player.currentIntent,
              isChasingBall: player.isChasingBall,
              nextDecisionTime: player.nextDecisionTime,
              stateTime: state.time,
            };

            activePendingPlayerId = pendingId;

            // Başlangıç kararı referanstır; decisionChanges'e sayılmaz.
            if (snapshot !== null) {
              lastDecisionTimestamp = snapshot.timestamp;
            }
          }
        }

        // Pending aktifse oyuncu ID'sini koru.
        if (pendingId !== null) {
          activePendingPlayerId = pendingId;
        }

        // Raporlama penceresindeki aktif pending tick'i.
        if (
          pendingStart !== null &&
          pendingId !== null &&
          tick >= REPORT_START &&
          tick <= REPORT_END
        ) {
          const player = state.players[pendingId];

          if (player) {
            recordTick(
              state,
              tick,
              player,
              tick - pendingStart.tick,
            );
          }
        }

        // Production akışında pending, expiry tick'inde callback'ten önce
        // temizlenmiş olabilir. Bu yüzden null → expiry geçişini yakala:
        // önceki tick'teki aktif pending oyuncusunun mevcut state'ini
        // expiry tick'i olarak kaydet.
        const isPendingExpiry =
          pendingStart !== null &&
          prevPendingId !== null &&
          pendingId === null &&
          activePendingPlayerId === prevPendingId &&
          tick >= REPORT_START &&
          tick <= REPORT_END;

        if (isPendingExpiry) {
          const player = state.players[activePendingPlayerId];

          if (player) {
            recordTick(
              state,
              tick,
              player,
              tick - pendingStart.tick,
            );
          }
        }

        prevPendingId = pendingId;

        if (pendingId === null) {
          activePendingPlayerId = null;
        }
      };

      const data = generateGameData();
      const clubs = Object.values(data.clubs);
      const home = clubs[0];
      const away = clubs[1];

      simulateMatchLive(home, away, data.players, {
        seed: SEED,
        onTick,
      });

      // ---------------------------------------------------------------------
      // RAPOR
      // ---------------------------------------------------------------------

      console.log('\n=== PENDING RECOVERY DECISION DIAGNOSTIC (v5) ===\n');

      if (pendingStart === null) {
        console.log('Gerçek pending başlangıcı maç boyunca yakalanamadı.');
        expect(true).toBe(true);
        return;
      }

      const ps = pendingStart;

      console.log('--- GERÇEK PENDING BAŞLANGICI (tüm maç taraması) ---');
      console.table([
        {
          seed: ps.seed,
          tick: ps.tick,
          beklenen: REPORT_START,
          fark: ps.tick - REPORT_START,
          pendingPlayerId: ps.pendingPlayerId,
          pendingClubId: ps.pendingClubId,
          distance: round3(ps.distance),
          currentIntent: ps.currentIntent,
          isChasingBall: ps.isChasingBall,
          nextDecisionTime: round3(ps.nextDecisionTime),
          stateTime: round3(ps.stateTime),
          decisionIntent: ps.decision?.intent ?? null,
          decisionReason: ps.decision?.reason ?? null,
          decisionTargetX: ps.decision?.targetX ?? null,
          decisionTargetY: ps.decision?.targetY ?? null,
        },
      ]);

      if (ps.tick !== REPORT_START) {
        console.log(
          '\nUYARI: Gerçek pending başlangıcı ' +
            ps.tick +
            ', beklenen ' +
            REPORT_START +
            ' değil.',
        );
      }

      if (ticks.length === 0) {
        console.log('Pending tick kaydı oluşmadı (raporlama penceresi dışı).');
        expect(true).toBe(true);
        return;
      }

      console.log('\n--- TICK TABLOSU ---');
      console.table(
        ticks.map((t) => ({
          tick: t.tick,
          elapsedTicks: t.elapsedTicks,
          playerX: round3(t.playerX),
          playerY: round3(t.playerY),
          ballX: round3(t.ballX),
          ballY: round3(t.ballY),
          distance: round3(t.distance),
          intent: t.decision?.intent ?? null,
          reason: t.decision?.reason ?? null,
          targetX: t.decision?.targetX ?? null,
          targetY: t.decision?.targetY ?? null,
          currentIntent: t.currentIntent,
          isChasingBall: t.isChasingBall,
          nextDecisionTime: round3(t.nextDecisionTime),
          decisionChanged: t.decisionChanged,
          dot: round3(t.dot),
        })),
      );

      const first = ticks[0];
      const last = ticks[ticks.length - 1];

      let minDistance = Infinity;
      let minDistanceTick = first.tick;
      let sumDot = 0;

      for (const t of ticks) {
        if (t.distance < minDistance) {
          minDistance = t.distance;
          minDistanceTick = t.tick;
        }
        sumDot += t.dot;
      }

      const meanDot = ticks.length > 0 ? sumDot / ticks.length : 0;

      console.log('\n--- ÖZET ---');
      console.table([
        {
          seed: SEED,
          realStartTick: ps.tick,
          reportStartTick: first.tick,
          expiryTick: last.tick,
          elapsedTicks: last.tick - first.tick,

          initialIntent: first.decision?.intent ?? null,
          initialReason: first.decision?.reason ?? null,
          initialTargetX: first.decision?.targetX ?? null,
          initialTargetY: first.decision?.targetY ?? null,

          finalIntent: last.decision?.intent ?? null,
          finalReason: last.decision?.reason ?? null,
          finalTargetX: last.decision?.targetX ?? null,
          finalTargetY: last.decision?.targetY ?? null,

          decisionChanges,
          minDistance: round3(minDistance),
          minDistanceTick,
          expiryDistance: round3(last.distance),
          meanDot: round3(meanDot),
        },
      ]);

      console.log('\n=== SON ===\n');

      expect(true).toBe(true);
    },
    60 * 60 * 1000,
  );
});

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

function toSnapshot(player: LivePlayer): DecisionSnapshot | null {
  const d = player.currentDecision;
  if (!d) return null;

  return {
    intent: d.intent,
    reason: d.reason,
    targetX: d.target ? d.target.x : null,
    targetY: d.target ? d.target.y : null,
    timestamp: d.timestamp,
  };
}
