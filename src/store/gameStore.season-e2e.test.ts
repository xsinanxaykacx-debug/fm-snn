import { describe, expect, it } from 'vitest';

import { useGameStore } from './gameStore';

describe('BUG-027 season lifecycle acceptance', () => {
  it('starts a season, completes every league week, then starts the next season', () => {
    const store = useGameStore.getState();

    store.newGame();
    store.setUseLiveEngine(false);

    let safety = 0;
    while (!useGameStore.getState().seasonOver) {
      useGameStore.getState().playWeek();
      safety += 1;
      expect(safety).toBeLessThanOrEqual(40);
    }

    const endState = useGameStore.getState();

    expect(endState.season).toBe(1);
    expect(endState.currentWeek).toBe(30);
    expect(endState.seasonOver).toBe(true);

    const playedLeagueFixtures = endState.fixtures.filter(
      fixture =>
        fixture.week !== undefined &&
        fixture.week >= 1 &&
        fixture.week <= 30 &&
        fixture.played === true
    );

    expect(playedLeagueFixtures.length).toBeGreaterThan(0);

    const tableRows = Object.values(endState.table);
    expect(tableRows.length).toBeGreaterThan(0);
    expect(tableRows.every(row => row.played >= 0)).toBe(true);

    useGameStore.getState().advanceSeason();

    const nextState = useGameStore.getState();

    expect(nextState.season).toBe(2);
    expect(nextState.currentWeek).toBe(1);
    expect(nextState.seasonOver).toBe(false);
    expect(nextState.cup.season).toBe(2);
    expect(
      nextState.fixtures.some(
        fixture => fixture.week === 1 && fixture.played === false
      )
    ).toBe(true);
  });
});
