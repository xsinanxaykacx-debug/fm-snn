import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import type { Club, LiveMatchState, Player } from '../types';
import { MATCH_DURATION_SECONDS, TICK_DURATION } from './config';
import { simulateMatchLive } from './liveMatch';

const DISCOVERY_SEEDS = [
  1000, 1001, 1002, 1003, 1004,
  1005, 1006, 1007, 1008, 1009,
];

const DISCOVERY_MAX_TICKS = 12_000;

interface OwnershipObservation {
  tick: number;
  previousOwnerId: string | null;
  currentOwnerId: string | null;
  previousOwnerClubId: string | null;
  currentOwnerClubId: string | null;
  lastBallOwnerId: string | null;
  counterPressClubId: string | null;
  breakClubId: string | null;
}

interface ChainObservation {
  seed: number;
  dirtyTackleTick: number;
  recoveryTick: number;
  loose: OwnershipObservation;
  recovery: OwnershipObservation;
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

function observeOwnership(
  state: LiveMatchState,
  previousOwnerId: string | null,
): OwnershipObservation {
  const previousOwner =
    previousOwnerId === null ? null : state.players[previousOwnerId];
  const currentOwner =
    state.ball.ownerId === null ? null : state.players[state.ball.ownerId];

  return {
    tick: state.tick,
    previousOwnerId,
    currentOwnerId: state.ball.ownerId,
    previousOwnerClubId: previousOwner?.clubId ?? null,
    currentOwnerClubId: currentOwner?.clubId ?? null,
    lastBallOwnerId: state.lastBallOwnerId,
    counterPressClubId: state.transition.counterPressClubId,
    breakClubId: state.transition.breakClubId,
  };
}

function findCausalChain(
  seed: number,
  maxTicks: number,
): ChainObservation | null {
  const data = generateGameData();
  resetPlayers(data.players);

  const { home, away } = getFixture(data);

  let dirtyTackle: {
    tick: number;
    tacklerId: string;
    tacklerClubId: string;
  } | null = null;

  let loose: OwnershipObservation | null = null;
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
        tick: 0,
        tacklerId: outcome.tacklerId,
        tacklerClubId: tackler.clubId ?? '',
      };
    },
    onOwnershipObserved: (state, previousOwnerId) => {
      if (chain !== null || dirtyTackle === null) return;

      if (dirtyTackle.tick === 0) {
        dirtyTackle.tick = state.tick;
      }

      const observation = observeOwnership(state, previousOwnerId);

      if (
        loose === null &&
        observation.previousOwnerId === dirtyTackle.tacklerId &&
        observation.currentOwnerId === null &&
        observation.lastBallOwnerId === dirtyTackle.tacklerId
      ) {
        loose = observation;
        return;
      }

      if (
        loose !== null &&
        observation.tick === loose.tick &&
        observation.previousOwnerId === null &&
        observation.currentOwnerId !== null &&
        observation.currentOwnerClubId !== dirtyTackle.tacklerClubId &&
        observation.counterPressClubId === dirtyTackle.tacklerClubId &&
        observation.breakClubId === observation.currentOwnerClubId
      ) {
        chain = {
          seed,
          dirtyTackleTick: dirtyTackle.tick,
          recoveryTick: observation.tick,
          loose,
          recovery: observation,
        };
      }
    },
  });

  return chain;
}

function runFullMatch(
  seed: number,
): {
  match: ReturnType<typeof simulateMatchLive>;
  observations: OwnershipObservation[];
  multiChangeTicks: Map<number, OwnershipObservation[]>;
  chain: ChainObservation | null;
} {
  const data = generateGameData();
  resetPlayers(data.players);

  const { home, away } = getFixture(data);

  const observations: OwnershipObservation[] = [];
  const byTick = new Map<number, OwnershipObservation[]>();

  let dirtyTackle: {
    tick: number;
    tacklerId: string;
    tacklerClubId: string;
  } | null = null;

  let loose: OwnershipObservation | null = null;
  let chain: ChainObservation | null = null;

  const match = simulateMatchLive(home, away, data.players, {
    seed,
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
        tick: 0,
        tacklerId: outcome.tacklerId,
        tacklerClubId: tackler.clubId ?? '',
      };
    },
    onOwnershipObserved: (state, previousOwnerId) => {
      const observation = observeOwnership(state, previousOwnerId);
      observations.push(observation);

      const sameTick = byTick.get(observation.tick) ?? [];
      sameTick.push(observation);
      byTick.set(observation.tick, sameTick);

      if (chain !== null || dirtyTackle === null) return;

      if (dirtyTackle.tick === 0) {
        dirtyTackle.tick = state.tick;
      }

      if (
        loose === null &&
        observation.previousOwnerId === dirtyTackle.tacklerId &&
        observation.currentOwnerId === null &&
        observation.lastBallOwnerId === dirtyTackle.tacklerId
      ) {
        loose = observation;
        return;
      }

      if (
        loose !== null &&
        observation.tick === loose.tick &&
        observation.previousOwnerId === null &&
        observation.currentOwnerId !== null &&
        observation.currentOwnerClubId !== dirtyTackle.tacklerClubId &&
        observation.counterPressClubId === dirtyTackle.tacklerClubId &&
        observation.breakClubId === observation.currentOwnerClubId
      ) {
        chain = {
          seed,
          dirtyTackleTick: dirtyTackle.tick,
          recoveryTick: observation.tick,
          loose,
          recovery: observation,
        };
      }
    },
  });

  const multiChangeTicks = new Map<number, OwnershipObservation[]>();
  for (const [tick, tickObservations] of byTick) {
    if (tickObservations.length > 1) {
      multiChangeTicks.set(tick, tickObservations);
    }
  }

  return { match, observations, multiChangeTicks, chain };
}

describe("C' acceptance — live causal ownership", () => {
  it(
    'gerçek 0→90 akışında A → null → B ve historical ownership ayrımını kanıtlar',
    () => {
      let discovery: ChainObservation | null = null;

      for (const seed of DISCOVERY_SEEDS) {
        discovery = findCausalChain(seed, DISCOVERY_MAX_TICKS);
        if (discovery !== null) break;
      }

      expect(
        discovery,
        'DISCOVERY_SEEDS içinde gerçek aynı-tick A → null → B zinciri bulunamadı',
      ).not.toBeNull();

      const result = runFullMatch(discovery!.seed);
      const { match, observations, multiChangeTicks, chain } = result;

      expect(match.played).toBe(true);
      expect(match.stats.simulationSeconds).toBeGreaterThanOrEqual(
        MATCH_DURATION_SECONDS,
      );
      expect(match.stats.ticks).toBe(
        Math.round(MATCH_DURATION_SECONDS / TICK_DURATION),
      );

      expect(observations.length).toBeGreaterThan(0);
      expect(chain).not.toBeNull();

      const { loose, recovery } = chain!;

      // 1) Gerçek aynı-tick ownership sırası: A → null → B.
      expect(loose.tick).toBe(recovery.tick);
      expect(loose.previousOwnerId).toBeTruthy();
      expect(loose.currentOwnerId).toBeNull();
      expect(recovery.previousOwnerId).toBeNull();
      expect(recovery.currentOwnerId).toBeTruthy();
      expect(recovery.currentOwnerClubId).not.toBe(
        loose.previousOwnerClubId,
      );

      // 2) A → null anında history A'yı korur.
      expect(loose.lastBallOwnerId).toBe(loose.previousOwnerId);

      // 3) null → B anında history artık B olsa bile transition A → B'dir.
      //    Böylece historical lastBallOwnerId trigger değildir.
      expect(recovery.lastBallOwnerId).toBe(recovery.currentOwnerId);
      expect(recovery.counterPressClubId).toBe(loose.previousOwnerClubId);
      expect(recovery.breakClubId).toBe(recovery.currentOwnerClubId);
      expect(recovery.counterPressClubId).not.toBe(
        recovery.lastBallOwnerId,
      );

      // 4) Aynı tick'teki her ardışık ownership gözlemi gerçek bir önceki
      //    owner üzerinden ilerlemelidir; historical memory kullanılmamalıdır.
      for (const tickObservations of multiChangeTicks.values()) {
        for (let i = 1; i < tickObservations.length; i += 1) {
          expect(tickObservations[i].previousOwnerId).toBe(
            tickObservations[i - 1].currentOwnerId,
          );
        }
      }

      // 5) Hedef tick'te gerçekten en az iki değişim ve ikinci değişimin
      //    previous owner'ı null olmalıdır.
      const targetTickObservations =
        multiChangeTicks.get(loose.tick) ?? [];

      expect(targetTickObservations.length).toBeGreaterThanOrEqual(2);
      expect(targetTickObservations[0].currentOwnerId).toBeNull();
      expect(targetTickObservations[1].previousOwnerId).toBeNull();
      expect(targetTickObservations[1].currentOwnerId).toBe(
        recovery.currentOwnerId,
      );
    },
    10 * 60 * 1000,
  );
});
