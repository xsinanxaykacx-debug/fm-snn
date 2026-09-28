import type { Club, Match, MatchEvent, Player } from '../types';
import { getStartingXI } from '../data/generateData';
import {
  calculateZones,
  calculateZoneMatchups,
  selectAttackZone,
  eff,
} from './matchup';

// ═══════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════

function randomMinute(): number {
  return Math.floor(Math.random() * 90) + 1;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickInjuryType(severity: 'light' | 'medium' | 'severe'): string {
  const light = ['Kas Ağrısı', 'Küçük Burkulma', 'Hafif Darbe', 'Burun Kırığı'];
  const medium = ['Hamstring', 'Ayak Bileği', 'Diz Burkulması', 'Kas Yırtığı', 'Omuz Çıkığı'];
  const severe = ['Çapraz Bağ', 'Kaval Kemiği Kırığı', 'Kalça Sakatlığı', 'Aşil Tendonu'];
  const pool = severity === 'light' ? light : severity === 'medium' ? medium : severe;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ═══════════════════════════════════════════════
// PAS BAŞARI OLASILIĞI
// ═══════════════════════════════════════════════

function passSuccessChance(passer: Player, pressure: number): number {
  const passing = eff(passer, 'passing');
  const vision = eff(passer, 'vision');
  const decisions = eff(passer, 'decisions');
  const technique = eff(passer, 'technique');
  const composure = eff(passer, 'composure');

  let base = 0.70;
  base += (passing - 50) * 0.004;
  base += (vision - 50) * 0.002;
  base += (decisions - 50) * 0.002;
  base += (technique - 50) * 0.001;
  base += (composure - 50) * 0.001;
  base -= (pressure - 50) * 0.003;

  return Math.max(0.15, Math.min(0.95, base));
}

// ═══════════════════════════════════════════════
// xG HESABI
// ═══════════════════════════════════════════════

function calculateXG(
  shooter: Player,
  distance: number,
  pressure: number,
  isBigChance: boolean
): number {
  const finishing = eff(shooter, 'finishing');
  const composure = eff(shooter, 'composure');
  const technique = eff(shooter, 'technique');

  let distanceFactor = 1.0;
  if (distance <= 6) distanceFactor = 1.8;
  else if (distance <= 12) distanceFactor = 1.2;
  else if (distance <= 18) distanceFactor = 0.7;
  else if (distance <= 25) distanceFactor = 0.35;
  else distanceFactor = 0.15;

  // Baz xG: 0.26 (denge testi ile ayarlandı — 2.67 gol/maç)
  let xg = 0.26 * distanceFactor;
  xg *= 0.7 + (finishing / 100) * 0.5;
  xg *= 0.8 + (composure / 100) * 0.4;
  xg *= 0.9 + (technique / 100) * 0.2;
  xg *= 1 - (pressure / 100) * 0.4;
  if (isBigChance) xg *= 1.3;

  return Math.max(0.02, Math.min(0.85, xg));
}

// ═══════════════════════════════════════════════
// KALECİ MODELİ
// ═══════════════════════════════════════════════

function saveChance(gk: Player | undefined, xg: number): number {
  if (!gk) return xg * 1.2;

  const reflexes = eff(gk, 'reflexes');
  const positioning = eff(gk, 'gkPositioning');
  const handling = eff(gk, 'handling');
  const oneOnOne = eff(gk, 'oneOnOne');

  const gkRating =
    reflexes * 0.3 + positioning * 0.3 + handling * 0.2 + oneOnOne * 0.2;

  // Kaleci faktörü: /300 (denge testi ile ayarlandı)
  const gkFactor = 1.0 - (gkRating - 50) / 300;

  return Math.max(0.02, Math.min(0.85, xg * gkFactor));
}

// ═══════════════════════════════════════════════
// ANA MOTOR
// ═══════════════════════════════════════════════

export function simulateMatch(
  home: Club,
  away: Club,
  players: Record<string, Player>,
  week: number
): Match {
  const events: MatchEvent[] = [];
  let homeScore = 0;
  let awayScore = 0;

  const homeState = {
    club: home,
    zones: calculateZones(home, players),
    condition: 100,
    redCards: 0,
  };
  const awayState = {
    club: away,
    zones: calculateZones(away, players),
    condition: 100,
    redCards: 0,
  };

  const stats = {
    homeShots: 0,
    awayShots: 0,
    homeOnTarget: 0,
    awayOnTarget: 0,
    homeXG: 0,
    awayXG: 0,
    homePossession: 0,
    awayPossession: 0,
    homePasses: 0,
    awayPasses: 0,
    homePassesCompleted: 0,
    awayPassesCompleted: 0,
  };

  const homeMidPower = homeState.zones.centerMidfield.attackPower;
  const awayMidPower = awayState.zones.centerMidfield.attackPower;
  const possRatio = homeMidPower / (homeMidPower + awayMidPower);
  stats.homePossession = Math.round(possRatio * 100);
  stats.awayPossession = 100 - stats.homePossession;

  // 36 tick (her 2.5 dakika)
  const totalTicks = 36;
  const minutePerTick = 2.5;
  const pendingEvents: { minute: number; event: MatchEvent }[] = [];

  for (let tick = 0; tick < totalTicks; tick++) {
    const baseMinute = Math.floor(tick * minutePerTick) + 1;
    const minute = Math.min(90, baseMinute + Math.floor(Math.random() * 3));

    const homeChance = possRatio * (1 - (tick / totalTicks) * 0.15);
    const attacking = Math.random() < homeChance ? 'home' : 'away';
    const attackState = attacking === 'home' ? homeState : awayState;
    const defendState = attacking === 'home' ? awayState : homeState;

    const defendBonus = defendState.redCards * 0.15;

    const matchups = calculateZoneMatchups(attackState.zones, defendState.zones);
    const attackZone = selectAttackZone(matchups);
    const relevantMatchup = matchups.find((m) =>
      m.attackZone.includes(
        attackZone.type === 'left' ? 'Sol' :
        attackZone.type === 'right' ? 'Sağ' :
        'Merkez'
      )
    );
    const advPct = relevantMatchup ? relevantMatchup.advantagePct : 50;

    const attackerXI = getStartingXI(
      attackState.club.id,
      players,
      attackState.club.tactic.formation
    );
    const passer =
      pick(
        attackerXI.filter((p) =>
          ['MC', 'DM', 'AMC', 'ML', 'MR'].includes(p.position)
        ) as Player[]
      ) || pick(attackerXI);
    if (!passer) continue;

    const pressure = 50 + (defendState.condition - 50) * 0.3 + defendBonus * 100;
    const passOk = Math.random() < passSuccessChance(passer, pressure);

    if (attacking === 'home') stats.homePasses++;
    else stats.awayPasses++;

    if (!passOk) continue;
    if (attacking === 'home') stats.homePassesCompleted++;
    else stats.awayPassesCompleted++;

    // Şut şansı: 0.80 (denge testi ile ayarlandı)
    const shootChance =
      0.80 +
      (advPct - 50) * 0.012 +
      (attackState.redCards > 0 ? -0.15 : 0);
    if (Math.random() > shootChance) continue;

    const shooters = attackerXI.filter((p) =>
      attackZone.type === 'left'
        ? ['AML', 'ML', 'ST'].includes(p.position)
        : attackZone.type === 'right'
        ? ['AMR', 'MR', 'ST'].includes(p.position)
        : ['ST', 'AMC'].includes(p.position)
    );
    const shooter =
      shooters.length > 0
        ? pick(shooters)
        : pick(attackerXI.filter((p) => p.position === 'ST')) || passer;
    if (!shooter) continue;

    if (attacking === 'home') stats.homeShots++;
    else stats.awayShots++;

    const distance = 8 + Math.random() * 20;
    const shotPressure = 40 + Math.random() * 50;
    const isBigChance = Math.random() < 0.15 + (advPct - 50) * 0.003;
    const xg = calculateXG(shooter, distance, shotPressure, isBigChance);

    if (attacking === 'home') stats.homeXG += xg;
    else stats.awayXG += xg;

    const defXI = getStartingXI(
      defendState.club.id,
      players,
      defendState.club.tactic.formation
    );
    const gk = defXI.find((p) => p.position === 'GK');

    const goalProb = saveChance(gk, xg);
    const isGoal = Math.random() < goalProb;

    const zoneLabel =
      attackZone.type === 'left'
        ? 'sol kanattan'
        : attackZone.type === 'right'
        ? 'sağ kanattan'
        : 'merkezden';

    if (isGoal) {
      if (attacking === 'home') {
        homeScore++;
        stats.homeOnTarget++;
      } else {
        awayScore++;
        stats.awayOnTarget++;
      }
      pendingEvents.push({
        minute,
        event: {
          minute,
          type: 'goal',
          playerId: shooter.id,
          clubId: attackState.club.id,
          description: `⚽ GOL! ${shooter.name} (${attackState.club.shortName}) — ${zoneLabel} ${distance.toFixed(0)}m`,
        },
      });
    } else if (Math.random() < 0.30) {
      if (attacking === 'home') stats.homeOnTarget++;
      else stats.awayOnTarget++;
      pendingEvents.push({
        minute,
        event: {
          minute,
          type: 'save',
          playerId: shooter.id,
          clubId: attackState.club.id,
          description: `🧤 ${shooter.name} şutunu ${gk?.name ?? 'kaleci'} kurtardı (${attackState.club.shortName})`,
        },
      });
    } else {
      pendingEvents.push({
        minute,
        event: {
          minute,
          type: 'miss',
          playerId: shooter.id,
          clubId: attackState.club.id,
          description: `❌ ${shooter.name} şutu auta gitti (${attackState.club.shortName})`,
        },
      });
    }

    attackState.condition = Math.max(40, attackState.condition - 1.5);
    defendState.condition = Math.max(40, defendState.condition - 1);
  }

  // ═══════════════════════════════════════════════
  // KARTLAR
  // ═══════════════════════════════════════════════

  const cardCount = Math.floor(Math.random() * 5) + 2;
  // Bu maçta sarı gören oyuncuları takip et (kırmızı görenler de burada)
  const matchYellows = new Set<string>();
  const sentOff = new Set<string>(); // Kırmızı görenler

  for (let i = 0; i < cardCount; i++) {
    const isHome = Math.random() < 0.5;
    const club = isHome ? home : away;
    const clubState = isHome ? homeState : awayState;
    const xi = getStartingXI(club.id, players, club.tactic.formation);

    // 🔧 BUG FIX: Kırmızı gören oyuncuları listeden çıkar
    const activePlayers = xi.filter((p) => !sentOff.has(p.id));
    const defenders = activePlayers.filter((p) =>
      ['DC', 'DL', 'DR', 'DM', 'MC'].includes(p.position)
    );
    const pool = defenders.length > 0 ? defenders : activePlayers;
    if (pool.length === 0) continue;

    const player = pick(pool);
    if (!player) continue;

    const cardMinute = randomMinute();

    // Bu maçta zaten sarı görmüşse → ikinci sarı → kırmızı
    if (matchYellows.has(player.id)) {
      players[player.id] = { ...player, suspensionWeeks: 2, yellowCards: 0 };
      clubState.redCards++;
      sentOff.add(player.id);
      pendingEvents.push({
        minute: cardMinute,
        event: {
          minute: cardMinute,
          type: 'red',
          playerId: player.id,
          clubId: club.id,
          description: `🟥 KIRMIZI! ${player.name} ikinci sarıdan atıldı (${club.shortName})`,
        },
      });
      continue;
    }

    const red = Math.random() < 0.06;
    if (red) {
      // Direkt kırmızı
      players[player.id] = { ...player, suspensionWeeks: 2, yellowCards: 0 };
      clubState.redCards++;
      sentOff.add(player.id);
      pendingEvents.push({
        minute: cardMinute,
        event: {
          minute: cardMinute,
          type: 'red',
          playerId: player.id,
          clubId: club.id,
          description: `🟥 KIRMIZI! ${player.name} oyundan atıldı (${club.shortName})`,
        },
      });
    } else {
      // Sarı kart
      matchYellows.add(player.id);
      const newYellow = (player.yellowCards ?? 0) + 1;
      if (newYellow >= 4) {
        players[player.id] = { ...player, yellowCards: 0, suspensionWeeks: 1 };
        pendingEvents.push({
          minute: cardMinute,
          event: {
            minute: cardMinute,
            type: 'yellow',
            playerId: player.id,
            clubId: club.id,
            description: `🟨 ${player.name} 4. sarıdan ceza aldı (${club.shortName})`,
          },
        });
      } else {
        players[player.id] = { ...player, yellowCards: newYellow };
        pendingEvents.push({
          minute: cardMinute,
          event: {
            minute: cardMinute,
            type: 'yellow',
            playerId: player.id,
            clubId: club.id,
            description: `🟨 ${player.name} sarı kart gördü (${newYellow}/4) (${club.shortName})`,
          },
        });
      }
    }
  }

  // ═══════════════════════════════════════════════
  // SAKATLIK
  // ═══════════════════════════════════════════════

  if (Math.random() < 0.20) {
    const isHome = Math.random() < 0.5;
    const club = isHome ? home : away;
    const xi = getStartingXI(club.id, players, club.tactic.formation);

    // 🔧 BUG FIX: Kırmızı görenler sakatlanamaz
    const activePlayers = xi.filter((p) => !sentOff.has(p.id));
    if (activePlayers.length === 0) {
      // devam et
    } else {
      const player = activePlayers[Math.floor(Math.random() * activePlayers.length)];
      if (player) {
        const injuryRoll = Math.random();
        let weeks: number;
        let type: string;
        if (injuryRoll < 0.6) {
          weeks = 1;
          type = pickInjuryType('light');
        } else if (injuryRoll < 0.88) {
          weeks = 2 + Math.floor(Math.random() * 3);
          type = pickInjuryType('medium');
        } else {
          weeks = 5 + Math.floor(Math.random() * 4);
          type = pickInjuryType('severe');
        }

        const injMinute = randomMinute();
        players[player.id] = { ...player, injuryWeeks: weeks, injuryType: type };
        pendingEvents.push({
          minute: injMinute,
          event: {
            minute: injMinute,
            type: 'injury',
            playerId: player.id,
            clubId: club.id,
            description: `🚑 ${player.name} sakatlandı — ${type} (${weeks} hafta)`,
          },
        });
      }
    }
  }

  // Event'leri sırala
  events.push(
    ...pendingEvents.sort((a, b) => a.minute - b.minute).map((e) => e.event)
  );

  return {
    id: `match_${week}_${home.id}_${away.id}`,
    week,
    homeId: home.id,
    awayId: away.id,
    homeScore,
    awayScore,
    events,
    stats: {
      possession: { home: stats.homePossession, away: stats.awayPossession },
      shots: { home: stats.homeShots, away: stats.awayShots },
      onTarget: { home: stats.homeOnTarget, away: stats.awayOnTarget },
      chances: { home: stats.homeShots, away: stats.awayShots },
    },
    played: true,
  };
}