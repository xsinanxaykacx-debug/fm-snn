import type { Match, TableRow } from '../types';

export function initTable(clubIds: string[]): Record<string, TableRow> {
  const table: Record<string, TableRow> = {};
  for (const id of clubIds) {
    table[id] = { clubId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
  }
  return table;
}

export function updateTable(table: Record<string, TableRow>, match: Match): void {
  const home = table[match.homeId];
  const away = table[match.awayId];
  if (!home || !away) return;

  home.played++;
  away.played++;
  home.gf += match.homeScore;
  home.ga += match.awayScore;
  away.gf += match.awayScore;
  away.ga += match.homeScore;

  if (match.homeScore > match.awayScore) {
    home.won++; home.points += 3;
    away.lost++;
  } else if (match.homeScore < match.awayScore) {
    away.won++; away.points += 3;
    home.lost++;
  } else {
    home.drawn++; home.points += 1;
    away.drawn++; away.points += 1;
  }
}

export function sortedTable(table: Record<string, TableRow>): TableRow[] {
  return Object.values(table).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.gf - a.ga;
    const gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });
}