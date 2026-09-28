import type { Club, Match, MatchEvent, Player, TeamUnits } from '../types';
import { getStartingXI } from '../data/generateData';
import { calculateTeamUnits } from '../units/teamUnits';

function randomMinute(): number {
  return Math.floor(Math.random() * 90) + 1;
}

function pickScorer(club: Club, players: Record<string, Player>): Player | undefined {
  const xi = getStartingXI(club.id, players, club.tactic.formation);
  const attackers = xi.filter(p => ['ST', 'AML', 'AMR', 'AMC', 'ML', 'MR', 'MC'].includes(p.position));
  const pool = attackers.length > 0 ? attackers : xi;

  const weights = pool.map(p => {
    let w = p.attributes.finishing + 5;
    if (p.position === 'ST') w *= 1.8;
    if (p.position === 'AML' || p.position === 'AMR') w *= 1.4;
    if (p.position === 'AMC') w *= 1.2;
    if (p.position === 'MC') w *= 0.6;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function pickPlayerForCard(club: Club, players: Record<string, Player>): Player | undefined {
  const xi = getStartingXI(club.id, players, club.tactic.formation);
  const defenders = xi.filter(p => ['DC', 'DL', 'DR', 'DM', 'MC'].includes(p.position));
  const pool = defenders.length > 0 ? defenders : xi;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickInjuryType(severity: 'light' | 'medium' | 'severe'): string {
  const light = ['Kas Ağrısı', 'Küçük Burkulma', 'Hafif Darbe', 'Burun Kırığı'];
  const medium = ['Hamstring', 'Ayak Bileği', 'Diz Burkulması', 'Kas Yırtığı', 'Omuz Çıkığı'];
  const severe = ['Çapraz Bağ', 'Kaval Kemiği Kırığı', 'Kalça Sakatlığı', 'Aşil Tendonu'];
  const pool = severity === 'light' ? light : severity === 'medium' ? medium : severe;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getMatchCharacter(): { name: string; chanceMult: number; goalProb: number } {
  const roll = Math.random();
  if (roll < 0.18) return { name: 'kısır', chanceMult: 0.55, goalProb: 0.055 };
  if (roll < 0.78) return { name: 'normal', chanceMult: 0.95, goalProb: 0.10 };
  if (roll < 0.94) return { name: 'açık', chanceMult: 1.35, goalProb: 0.13 };
  return { name: 'çılgın', chanceMult: 1.75, goalProb: 0.16 };
}

/**
 * Yeni motor: 6 birimden maç sonucu
 * Şimdilik eski şans-yaratma modeli, ama birimlerle beslenir
 */
export function simulateMatch(
  home: Club,
  away: Club,
  players: Record<string, Player>,
  week: number
): Match {
  const homeUnits: TeamUnits = calculateTeamUnits(home, players);
  const awayUnits: TeamUnits = calculateTeamUnits(away, players);

  // Genel güç (ev avantajı %10)
  const homeStrength = homeUnits.overall * 1.10;
  const awayStrength = awayUnits.overall;

  const character = getMatchCharacter();
  const baseChancesPerTeam = 10 + Math.floor(Math.random() * 5);
  const ratio = homeStrength / (homeStrength + awayStrength);

  let homeChances = Math.round(baseChancesPerTeam * character.chanceMult * (0.5 + ratio));
  let awayChances = Math.round(baseChancesPerTeam * character.chanceMult * (0.5 + (1 - ratio)));

  homeChances = Math.max(3, Math.min(28, homeChances));
  awayChances = Math.max(3, Math.min(28, awayChances));

  const events: MatchEvent[] = [];
  let homeScore = 0;
  let awayScore = 0;
  let homeShots = 0, awayShots = 0;
  let homeOnTarget = 0, awayOnTarget = 0;

  const possessionHome = Math.round(ratio * 100);
  const possessionAway = 100 - possessionHome;

  const processChances = (chances: number, club: Club, isHome: boolean) => {
    for (let i = 0; i < chances; i++) {
      const minute = randomMinute();
      const scorer = pickScorer(club, players);
      const roll = Math.random();
      if (isHome) homeShots++; else awayShots++;

      if (roll < character.goalProb) {
        if (isHome) { homeScore++; homeOnTarget++; }
        else { awayScore++; awayOnTarget++; }
        events.push({
          minute,
          type: 'goal',
          playerId: scorer?.id,
          clubId: club.id,
          description: `⚽ GOL! ${scorer?.name ?? 'Oyuncu'} (${club.shortName})`,
        });
      } else if (roll < character.goalProb + 0.28) {
        if (isHome) homeOnTarget++; else awayOnTarget++;
        events.push({
          minute,
          type: 'save',
          playerId: scorer?.id,
          clubId: club.id,
          description: `🧤 ${scorer?.name ?? 'Oyuncu'} şutunu kaleci kurtardı (${club.shortName})`,
        });
      } else {
        events.push({
          minute,
          type: 'miss',
          playerId: scorer?.id,
          clubId: club.id,
          description: `❌ ${scorer?.name ?? 'Oyuncu'} şutu auta gitti (${club.shortName})`,
        });
      }
    }
  };

  processChances(homeChances, home, true);
  processChances(awayChances, away, false);

  const baseCards = character.name === 'kısır' ? 2 :
                    character.name === 'normal' ? 3 :
                    character.name === 'açık' ? 4 : 6;
  const cardCount = Math.max(0, baseCards + Math.floor(Math.random() * 3) - 1);

    // Maç içi kart takibi
  const matchYellows = new Set<string>(); // Bu maçta sarı görenler

  for (let i = 0; i < cardCount; i++) {
    const isHome = Math.random() < 0.5;
    const club = isHome ? home : away;
    const player = pickPlayerForCard(club, players);
    if (!player) continue;

    // Zaten bu maçta sarı görmüşse → kırmızı
    if (matchYellows.has(player.id)) {
      players[player.id] = { ...player, suspensionWeeks: 2, yellowCards: 0 };
      events.push({
        minute: randomMinute(),
        type: 'red',
        playerId: player.id,
        clubId: club.id,
        description: `🟥 KIRMIZI! ${player.name} ikinci sarıdan atıldı — 2 maç ceza (${club.shortName})`,
      });
      continue;
    }

    const red = Math.random() < 0.06;

    if (red) {
      players[player.id] = { ...player, suspensionWeeks: 2, yellowCards: 0 };
      events.push({
        minute: randomMinute(),
        type: 'red',
        playerId: player.id,
        clubId: club.id,
        description: `🟥 KIRMIZI! ${player.name} oyundan atıldı — 2 maç ceza (${club.shortName})`,
      });
    } else {
      matchYellows.add(player.id);
      const newYellow = (player.yellowCards ?? 0) + 1;
      if (newYellow >= 4) {
        players[player.id] = { ...player, yellowCards: 0, suspensionWeeks: 1 };
        events.push({
          minute: randomMinute(),
          type: 'yellow',
          playerId: player.id,
          clubId: club.id,
          description: `🟨 ${player.name} 4. sarı kartı gördü — 1 maç ceza (${club.shortName})`,
        });
      } else {
        players[player.id] = { ...player, yellowCards: newYellow };
        events.push({
          minute: randomMinute(),
          type: 'yellow',
          playerId: player.id,
          clubId: club.id,
          description: `🟨 ${player.name} sarı kart gördü (${newYellow}/4) (${club.shortName})`,
        });
      }
    }
  }

  if (Math.random() < 0.08) {
    const isHome = Math.random() < 0.5;
    const club = isHome ? home : away;
    const xi = getStartingXI(club.id, players, club.tactic.formation);
    const player = xi[Math.floor(Math.random() * xi.length)];
    if (player) {
      const injuryRoll = Math.random();
      let weeks: number;
      let type: string;
      if (injuryRoll < 0.6) { weeks = 1; type = pickInjuryType('light'); }
      else if (injuryRoll < 0.88) { weeks = 2 + Math.floor(Math.random() * 3); type = pickInjuryType('medium'); }
      else { weeks = 5 + Math.floor(Math.random() * 4); type = pickInjuryType('severe'); }

      players[player.id] = { ...player, injuryWeeks: weeks, injuryType: type };
      events.push({
        minute: randomMinute(),
        type: 'injury',
        playerId: player.id,
        clubId: club.id,
        description: `🚑 ${player.name} sakatlandı — ${type} (${weeks} hafta)`,
      });
    }
  }

  events.sort((a, b) => a.minute - b.minute);

  return {
    id: `match_${week}_${home.id}_${away.id}`,
    week,
    homeId: home.id,
    awayId: away.id,
    homeScore,
    awayScore,
    events,
    stats: {
      possession: { home: possessionHome, away: possessionAway },
      shots: { home: homeShots, away: awayShots },
      onTarget: { home: homeOnTarget, away: awayOnTarget },
      chances: { home: homeChances, away: awayChances },
    },
    played: true,
  };
}