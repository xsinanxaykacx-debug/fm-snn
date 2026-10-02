// src/engine/live/diagnostics/loadFixture.ts
//
// Deterministik fixture yükleyici.
// installDeterministicRandom() aktifken çağrılmalıdır.

import { generateGameData } from '../../data/generateData';
import type { Club, Player } from '../../types';

export interface Fixture {
  clubs: Club[];
  players: Record<string, Player>;
}

/**
 * generateGameData() çağrısını sarmalar.
 * Dönüş: { clubs: Club[]; players: Record<string, Player> }
 * (clubs bir Record<string, Club> olarak gelir → Object.values ile diziye çevrilir.)
 */
export function loadDeterministicFixture(): Fixture {
  const data = generateGameData();
  return {
    clubs: Object.values(data.clubs),
    players: data.players,
  };
}

/**
 * Belirli bir fixture'dan home/away/players klonu üretir.
 * Her maç temiz baseline ile başlar.
 */
export function cloneFixture(fixture: Fixture): {
  home: Club;
  away: Club;
  players: Record<string, Player>;
} {
  return {
    home: structuredClone(fixture.clubs[0]),
    away: structuredClone(fixture.clubs[1]),
    players: structuredClone(fixture.players),
  };
}
