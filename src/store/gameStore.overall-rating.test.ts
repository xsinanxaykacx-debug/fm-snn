import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calculateTeamUnits } from '../engine/units/teamUnits';
import { useGameStore } from './gameStore';

describe('Overall rating decay — season condition reset', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function prepareControlledSeason() {
    useGameStore.getState().newGame();
    const state = useGameStore.getState();
    const players = Object.fromEntries(
      Object.entries(state.players).map(([id, player]) => [
        id,
        {
          ...player,
          age: 20,
          contractYears: 5,
          condition: 40,
          form: 50,
          morale: 50,
          attributes: Object.fromEntries(
            Object.keys(player.attributes).map(key => [key, 12])
          ) as typeof player.attributes,
          careerStats: {
            ...player.careerStats,
            seasonGoals: 7,
            seasonAppearances: 9,
          },
        },
      ])
    );

    useGameStore.setState({ players });
    return useGameStore.getState();
  }

  it('resets condition to 100 after advanceSeason', () => {
    const before = prepareControlledSeason();

    expect(Object.values(before.players).every(player => player.condition === 40)).toBe(true);

    before.advanceSeason();

    const after = useGameStore.getState();

    expect(Object.values(after.players).every(player => player.condition === 100)).toBe(true);
  });

  it('carries form across the season transition without resetting it', () => {
    const before = prepareControlledSeason();
    const trackedId = Object.values(before.players).find(
      player => player.clubId === before.userClubId
    )?.id;

    if (!trackedId) throw new Error('No user player available for condition reset regression');

    expect(before.players[trackedId].form).toBe(50);

    before.advanceSeason();

    expect(useGameStore.getState().players[trackedId]?.form).toBe(50);
  });

  it('carries morale across the season transition without resetting it', () => {
    const before = prepareControlledSeason();
    const trackedId = Object.values(before.players).find(
      player => player.clubId === before.userClubId
    )?.id;

    if (!trackedId) throw new Error('No user player available for condition reset regression');

    expect(before.players[trackedId].morale).toBe(50);

    before.advanceSeason();

    expect(useGameStore.getState().players[trackedId]?.morale).toBe(50);
  });

  it('preserves age, development, and season-stat reset behavior', () => {
    const before = prepareControlledSeason();
    const trackedId = Object.values(before.players).find(
      player => player.clubId === before.userClubId
    )?.id;

    if (!trackedId) throw new Error('No user player available for season regression');

    expect(before.players[trackedId].age).toBe(20);
    expect(before.players[trackedId].attributes.pace).toBe(12);
    expect(before.players[trackedId].careerStats.seasonGoals).toBe(7);

    before.advanceSeason();

    const afterPlayer = useGameStore.getState().players[trackedId];

    expect(afterPlayer.age).toBe(21);
    expect(afterPlayer.attributes.pace).toBe(13);
    expect(afterPlayer.careerStats.seasonGoals).toBe(0);
    expect(afterPlayer.careerStats.seasonAppearances).toBe(0);
  });

  it('restores a low-condition team from roughly 22 overall to 55-60 overall', () => {
    const before = prepareControlledSeason();
    const beforeOverall = calculateTeamUnits(
      before.clubs[before.userClubId],
      before.players
    ).overall;

    expect(beforeOverall).toBeGreaterThanOrEqual(20);
    expect(beforeOverall).toBeLessThanOrEqual(25);

    before.advanceSeason();

    const after = useGameStore.getState();
    const afterOverall = calculateTeamUnits(
      after.clubs[after.userClubId],
      after.players
    ).overall;

    expect(afterOverall).toBeGreaterThanOrEqual(55);
    expect(afterOverall).toBeLessThanOrEqual(60);
  });
});
