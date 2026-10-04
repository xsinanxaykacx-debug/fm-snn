import { describe, expect, it } from 'vitest';

describe('BUG-004 live match result persistence', () => {
  it('updates table, marks fixture played, advances week, and persists to storage', async () => {
    const { useGameStore, getPersistedGameState } = await import('./gameStore');
    useGameStore.getState().newGame();

    const before = useGameStore.getState();
    const fixture = before.fixtures.find(
      match =>
        match.week === before.currentWeek &&
        !match.played &&
        (match.homeId === before.userClubId || match.awayId === before.userClubId)
    );

    expect(fixture?.id).toBeTruthy();
    expect(fixture?.homeId).toBeTruthy();
    expect(fixture?.awayId).toBeTruthy();

    if (!fixture?.id || !fixture.homeId || !fixture.awayId) return;

    const isUserHome = fixture.homeId === before.userClubId;
    const homeScore = isUserHome ? 10 : 9;
    const awayScore = isUserHome ? 9 : 10;
    const previousPoints = before.table[before.userClubId].points;

    useGameStore.getState().applyLiveMatchResult({
      ...fixture,
      homeScore,
      awayScore,
      played: true,
    });

    const after = useGameStore.getState();
    const savedFixture = after.fixtures.find(match => match.id === fixture.id);
    expect(after.table[before.userClubId].points).toBe(previousPoints + 3);
    expect(savedFixture?.played).toBe(true);
    expect(savedFixture?.homeScore).toBe(homeScore);
    expect(savedFixture?.awayScore).toBe(awayScore);
    expect(after.currentWeek).toBe(before.currentWeek + 1);
    const persisted = getPersistedGameState(after);
    expect(persisted.currentWeek).toBe(before.currentWeek + 1);
    expect(persisted.fixtures.find(match => match.id === fixture.id)?.played).toBe(true);
  });
});


describe('BUG-022 transfer buyer budget', () => {
  it('does not complete a sale when the buyer cannot afford the player', async () => {
    const { useGameStore } = await import('./gameStore');
    useGameStore.getState().newGame();

    const before = useGameStore.getState();
    const player = Object.values(before.players).find(
      p => p.clubId === before.userClubId && p.squadRole !== 'u21'
    );
    const buyer = Object.values(before.clubs).find(
      c => c.id !== before.userClubId
    );

    expect(player).toBeDefined();
    expect(buyer).toBeDefined();
    if (!player || !buyer) return;

    useGameStore.setState({
      clubs: {
        ...before.clubs,
        [buyer.id]: { ...buyer, budget: 0 },
      },
      currentWeek: 1,
    });

    useGameStore.getState().transferSell(player.id, buyer.id);

    const after = useGameStore.getState();
    expect(after.players[player.id].clubId).toBe(before.userClubId);
    expect(after.clubs[buyer.id].budget).toBe(0);
  });
});
