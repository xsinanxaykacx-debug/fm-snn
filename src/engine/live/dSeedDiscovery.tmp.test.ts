import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import type { Club, Player } from '../types';
import { simulateMatchLive } from './liveMatch';

const SEED_START = 1000;
const SEED_END = 1199;
const MAX_TICKS = 12_000;

type Fixture = {
  home: Club;
  away: Club;
  players: Record<string, Player>;
};

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

function makeFixture(): Fixture {
  const data = generateGameData();
  const clubs = Object.values(data.clubs);

  if (clubs.length < 2) {
    throw new Error('D discovery: en az iki kulüp gerekli.');
  }

  resetPlayers(data.players);

  return {
    home: clubs[0],
    away: clubs[1],
    players: data.players,
  };
}

function cloneFixture(fixture: Fixture): Fixture {
  return structuredClone(fixture);
}

function findChain(
  events: ReturnType<typeof simulateMatchLive>['events'],
): {
  save: boolean;
  goal: boolean;
  saveIndex: number;
  goalIndex: number;
} {
  let saveIndex = -1;
  let goalIndex = -1;

  for (let i = 0; i < events.length - 2; i += 1) {
    if (
      events[i].type === 'shot' &&
      events[i + 1].type === 'save' &&
      events[i + 2].type === 'goal_kick'
    ) {
      saveIndex = i;
      break;
    }
  }

  for (let i = 0; i < events.length - 2; i += 1) {
    if (
      events[i].type === 'shot' &&
      events[i + 1].type === 'goal' &&
      events[i + 2].type === 'kickoff'
    ) {
      goalIndex = i;
      break;
    }
  }

  return {
    save: saveIndex >= 0,
    goal: goalIndex >= 0,
    saveIndex,
    goalIndex,
  };
}

describe('D seed discovery — temporary', () => {
  it(
    'gerçek motor akışından SAVE ve GOAL fixture seedlerini bulur',
    () => {
      const fixture = makeFixture();

      let saveSeed: number | null = null;
      let goalSeed: number | null = null;
      let saveDetails: unknown = null;
      let goalDetails: unknown = null;

      for (let seed = SEED_START; seed <= SEED_END; seed += 1) {
        if (saveSeed !== null && goalSeed !== null) break;

        const runFixture = cloneFixture(fixture);
        const match = simulateMatchLive(
          runFixture.home,
          runFixture.away,
          runFixture.players,
          {
            seed,
            maxTicks: MAX_TICKS,
          },
        );

        const chain = findChain(match.events);

        if (chain.save && saveSeed === null) {
          saveSeed = seed;
          saveDetails = {
            seed,
            chain: match.events.slice(chain.saveIndex, chain.saveIndex + 3),
            score: [match.homeScore, match.awayScore],
            shots: match.stats.shots,
            onTarget: match.stats.onTarget,
          };
          console.log('[D-DISCOVERY] SAVE', JSON.stringify(saveDetails));
        }

        if (chain.goal && goalSeed === null) {
          goalSeed = seed;
          goalDetails = {
            seed,
            chain: match.events.slice(chain.goalIndex, chain.goalIndex + 3),
            score: [match.homeScore, match.awayScore],
            shots: match.stats.shots,
            onTarget: match.stats.onTarget,
          };
          console.log('[D-DISCOVERY] GOAL', JSON.stringify(goalDetails));
        }

        if (seed % 10 === 0) {
          console.log(
            '[D-DISCOVERY] progress',
            seed,
            'save=',
            saveSeed,
            'goal=',
            goalSeed,
          );
        }
      }

      console.log('[D-DISCOVERY] RESULT', JSON.stringify({
        saveSeed,
        goalSeed,
        saveDetails,
        goalDetails,
      }));

      expect(saveSeed, 'SAVE fixture bulunamadı').not.toBeNull();
      expect(goalSeed, 'GOAL fixture bulunamadı').not.toBeNull();
    },
    10 * 60 * 1000,
  );
});
