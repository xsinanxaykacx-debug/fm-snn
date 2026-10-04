import { beforeEach, describe, expect, it, vi } from 'vitest';

class TestStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('BUG-026 save/load persistence acceptance', () => {
  const storage = new TestStorage();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: storage,
    });
  });

  it('round-trips a changed game through the real Zustand persist middleware', async () => {
    const { useGameStore: firstStore } = await import('./gameStore');
    await firstStore.persist.rehydrate();

    firstStore.getState().newGame();
    const initial = firstStore.getState();

    const userClub = initial.clubs[initial.userClubId];
    if (!userClub) throw new Error('User club missing');

    firstStore.setState({
      season: 3,
      currentWeek: 17,
      seasonOver: false,
      news: ['PERSISTENCE-CHECK'],
      userLineup: [Object.values(initial.players)[0].id],
      clubs: {
        ...initial.clubs,
        [initial.userClubId]: {
          ...userClub,
          reputation: 19,
        },
      },
    });

    // The real persist middleware writes synchronously for synchronous storage.
    const saved = JSON.parse(storage.getItem('fm-clone-save') ?? 'null');
    expect(saved?.state?.season).toBe(3);
    expect(saved?.state?.currentWeek).toBe(17);
    expect(saved?.state?.news).toContain('PERSISTENCE-CHECK');

    // Simulate a reload by replacing the in-memory state, then rehydrate from storage.
    firstStore.setState({
      season: 99,
      currentWeek: 99,
      news: ['IN-MEMORY-ONLY'],
    });
    await firstStore.persist.rehydrate();
    const loaded = firstStore.getState();

    expect(loaded.season).toBe(3);
    expect(loaded.currentWeek).toBe(17);
    expect(loaded.news).toContain('PERSISTENCE-CHECK');
    expect(loaded.clubs[loaded.userClubId].reputation).toBe(19);
    expect(loaded.userLineup).toHaveLength(1);
  });
});
