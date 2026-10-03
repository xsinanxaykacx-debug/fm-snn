import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import type { Club, Player } from '../types';
import { MATCH_DURATION_SECONDS, TICK_DURATION } from './config';
import { simulateMatchLive } from './liveMatch';

const DISCOVERY_SEEDS = [
  1000, 1001, 1002, 1003, 1004,
  1005, 1006, 1007, 1008, 1009,
];

const DISCOVERY_MAX_TICKS = 12_000;

interface ChainObservation {
  seed: number;
  dirtyTackleTick: number;
  looseBallObserved: boolean;
  recoveryTick: number;
  recoveredPlayerId: string;
  transitionTick: number;
  transitionFromClubId: string;
  transitionToClubId: string;
}

function resetPlayers(players: Record<string, Player>): void {
  for (const player of Object.values(players)) {
    player.condition = 100;
    player.fatigue = 0;
    player.injuryWeeks = 0;
    player.suspensionWeeks = 0;
    player.sentOff = false;
    player.injured = false;
    player.redCard = false;
  }
}

function getFixture(data: {
  clubs: Record<string, Club>;
}): { home: Club; away: Club } {
  const clubs = Object.values(data.clubs);

  if (clubs.length < 2) {
    throw new Error('C\' acceptance için en az iki kulüp gerekli.');
  }

  return {
    home: clubs[0],
    away: clubs[1],
  };
}

function findCausalChain(
  seed: number,
  maxTicks: number,
): ChainObservation | null {
  const data = generateGameData();
  resetPlayers(data.players);

  const { home, away } = getFixture(data);

  let observedTick = 0;
  let dirtyTackle: {
    tick: number;
    tacklerId: string;
    tacklerClubId: string;
    carrierId: string;
  } | null = null;
  let dirtyTackleLooseObserved = false;
  let recoveriesBeforeDirty = 0;

  let chain: ChainObservation | null = null;

  simulateMatchLive(home, away, data.players, {
    seed,
    maxTicks,
    onTackleResolved: outcome => {
      if (
        chain !== null ||
        outcome.type !== 'won' ||
        outcome.newOwnerId !== null
      ) {
        return;
      }

      const tackler = data.players[outcome.tacklerId];
      if (!tackler) return;

      dirtyTackle = {
        tick: observedTick + 1,
        tacklerId: outcome.tacklerId,
        tacklerClubId: tackler.clubId ?? '',
        carrierId: outcome.ballCarrierId,
      };
    },
    onTick: state => {
      observedTick = state.tick;

      if (chain !== null || dirtyTackle === null) {
        return;
      }

      // The callback is emitted before applyTackleWon(). A dirty outcome
      // therefore proves that the real tackle resolver produced a loose-ball
      // result; this observation confirms the applied state reached loose
      // ball (ownerId === null) or recovered later in the same tick.
      if (
        !dirtyTackleLooseObserved &&
        state.tick >= dirtyTackle.tick &&
        (
          state.ball.ownerId === null ||
          state.ball.lastTouchId === dirtyTackle.tacklerId
        )
      ) {
        dirtyTackleLooseObserved = true;
        recoveriesBeforeDirty = state.stats.counterPressLooseBallRecoveries;
      }

      if (!dirtyTackleLooseObserved) {
        return;
      }

      const recoveriesNow = state.stats.counterPressLooseBallRecoveries;
      if (recoveriesNow <= recoveriesBeforeDirty) {
        return;
      }

      const recoveredOwnerId = state.ball.ownerId;
      if (recoveredOwnerId === null) {
        return;
      }

      const recoveredOwner = state.players[recoveredOwnerId];
      if (!recoveredOwner) return;

      if (recoveredOwner.clubId === dirtyTackle.tacklerClubId) {
        return;
      }

      const transitionMatchesRecovery =
        state.transition.startedAt === state.time &&
        state.transition.counterPressClubId === dirtyTackle.tacklerClubId &&
        state.transition.breakClubId === recoveredOwner.clubId;

      if (!transitionMatchesRecovery) {
        return;
      }

      chain = {
        seed,
        dirtyTackleTick: dirtyTackle.tick,
        looseBallObserved: dirtyTackleLooseObserved,
        recoveryTick: state.tick,
        recoveredPlayerId: recoveredOwnerId,
        transitionTick: state.tick,
        transitionFromClubId: state.transition.counterPressClubId,
        transitionToClubId: state.transition.breakClubId,
      };
    },
  });

  return chain;
}

describe("C' acceptance — live causal chain", () => {
  it(
    'gerçek motor akışında 0→90 tamamlanır ve tackle → loose → recovery → possession → transition kanıtlanır',
    () => {
      const discoveryChains: ChainObservation[] = [];

      for (const seed of DISCOVERY_SEEDS) {
        const chain = findCausalChain(seed, DISCOVERY_MAX_TICKS);
        if (chain) {
          discoveryChains.push(chain);
          break;
        }
      }

      expect(
        discoveryChains.length,
        'DISCOVERY_SEEDS içinde gerçek dirty-tackle causal chain bulunamadı',
      ).toBeGreaterThan(0);

      const selectedSeed = discoveryChains[0].seed;
      const data = generateGameData();
      resetPlayers(data.players);
      const { home, away } = getFixture(data);

      let lastObservedOwnerId: string | null = null;
      let ownershipChanges = 0;
      let fullMatchChain: ChainObservation | null = null;
      let pendingDirty: {
        tick: number;
        tacklerId: string;
        tacklerClubId: string;
      } | null = null;
      let looseObserved = false;
      let recoveriesBefore = 0;

      const match = simulateMatchLive(home, away, data.players, {
        seed: selectedSeed,
        onTackleResolved: outcome => {
          if (
            fullMatchChain !== null ||
            outcome.type !== 'won' ||
            outcome.newOwnerId !== null
          ) {
            return;
          }

          const tackler = data.players[outcome.tacklerId];
          if (!tackler) return;

          pendingDirty = {
            tick: 0,
            tacklerId: outcome.tacklerId,
            tacklerClubId: tackler.clubId ?? '',
          };
        },
        onTick: state => {
          if (state.ball.ownerId !== lastObservedOwnerId) {
            ownershipChanges += 1;
          }

          if (pendingDirty !== null && pendingDirty.tick === 0) {
            pendingDirty.tick = state.tick;
          }

          if (
            pendingDirty !== null &&
            !looseObserved &&
            (
              state.ball.ownerId === null ||
              state.ball.lastTouchId === pendingDirty.tacklerId
            )
          ) {
            looseObserved = true;
            recoveriesBefore = state.stats.counterPressLooseBallRecoveries;
          }

          if (
            pendingDirty !== null &&
            looseObserved &&
            fullMatchChain === null &&
            state.stats.counterPressLooseBallRecoveries > recoveriesBefore &&
            state.ball.ownerId !== null
          ) {
            const recoveredOwner = state.players[state.ball.ownerId];

            if (
              recoveredOwner &&
              recoveredOwner.clubId !== pendingDirty.tacklerClubId &&
              state.transition.startedAt === state.time &&
              state.transition.counterPressClubId ===
                pendingDirty.tacklerClubId &&
              state.transition.breakClubId === recoveredOwner.clubId
            ) {
              fullMatchChain = {
                seed: selectedSeed,
                dirtyTackleTick: pendingDirty.tick,
                looseBallObserved: true,
                recoveryTick: state.tick,
                recoveredPlayerId: recoveredOwner.player.id,
                transitionTick: state.tick,
                transitionFromClubId:
                  state.transition.counterPressClubId,
                transitionToClubId:
                  state.transition.breakClubId,
              };
            }
          }

          lastObservedOwnerId = state.ball.ownerId;
        },
      });

      expect(match.played).toBe(true);
      expect(match.stats.simulationSeconds).toBeGreaterThanOrEqual(
        MATCH_DURATION_SECONDS,
      );
      expect(match.stats.ticks).toBe(
        Math.round(MATCH_DURATION_SECONDS / TICK_DURATION),
      );
      expect(ownershipChanges).toBeGreaterThan(0);

      expect(fullMatchChain).not.toBeNull();
      expect(fullMatchChain?.looseBallObserved).toBe(true);
      expect(fullMatchChain?.recoveredPlayerId).toBeTruthy();
      expect(fullMatchChain?.transitionFromClubId).toBeTruthy();
      expect(fullMatchChain?.transitionToClubId).toBeTruthy();
      expect(fullMatchChain?.transitionFromClubId).not.toBe(
        fullMatchChain?.transitionToClubId,
      );

      expect(fullMatchChain?.recoveryTick).toBeGreaterThanOrEqual(
        fullMatchChain?.dirtyTackleTick ?? 0,
      );
    },
    10 * 60 * 1000,
  );
});
