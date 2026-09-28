import type { Club, Match, MatchEvent, Player } from '../types';
import { getStartingXI } from '../data/generateData';
import {
  calculateZones,
  calculateZoneMatchups,
  selectZoneWeighted,
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
  const light = ['Kas Agrisi', 'Kucuk Burkulma', 'Hafif Darbe', 'Burun Kirigi'];
  const medium = ['Hamstring', 'Ayak Bilegi', 'Diz Burkulmasi', 'Kas Yirtigi', 'Omuz Cikigi'];
  const severe = ['Capraz Bag', 'Kaval Kemigi Kirigi', 'Kalca Sakatligi', 'Asil Tendonu'];
  const pool = severity === 'light' ? light : severity === 'medium' ? medium : severe;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ═══════════════════════════════════════════════
// TAKTIK MODIFIKATORLERI
// ═══════════════════════════════════════════════

function tempoModifier(tempo: string): number {
  if (tempo === 'fast') return 1.15;
  if (tempo === 'slow') return 0.85;
  return 1.0;
}

function directnessModifier(directness: string): number {
  if (directness === 'direct') return 1.10;
  if (directness === 'short') return 0.92;
  return 1.0;
}

function widthModifier(width: string): number {
  if (width === 'wide') return 1.15;
  if (width === 'narrow') return 0.85;
  return 1.0;
}

// ═══════════════════════════════════════════════
// PAS
// ═══════════════════════════════════════════════

function passSuccessChance(passer: Player, pressure: number, tempo: number): number {
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
  base *= tempo;

  return Math.max(0.15, Math.min(0.95, base));
}

// ═══════════════════════════════════════════════
// DRIPLING
// ═══════════════════════════════════════════════

function dribbleSuccessChance(dribbler: Player, opponentDefense: number): number {
  const attack =
    eff(dribbler, 'dribbling') * 0.35 +
    eff(dribbler, 'pace') * 0.20 +
    eff(dribbler, 'acceleration') * 0.15 +
    eff(dribbler, 'technique') * 0.15 +
    eff(dribbler, 'decisions') * 0.15;

  let probability = 0.45 + (attack - opponentDefense) / 220;
  return Math.max(0.18, Math.min(0.78, probability));
}

// ═══════════════════════════════════════════════
// ORTA
// ═══════════════════════════════════════════════

function crossSuccessChance(crosser: Player, opponentDefense: number): number {
  const quality =
    eff(crosser, 'crossing') * 0.40 +
    eff(crosser, 'technique') * 0.20 +
    eff(crosser, 'decisions') * 0.20 +
    eff(crosser, 'vision') * 0.20;

  let probability = 0.42 + (quality - opponentDefense) / 240;
  return Math.max(0.20, Math.min(0.80, probability));
}

// ═══════════════════════════════════════════════
// xG
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

  // ⚡ 0.32 (gol ortalamasi icin ayarlandi)
  let xg = 0.32 * distanceFactor;
  xg *= 0.7 + (finishing / 100) * 0.5;
  xg *= 0.8 + (composure / 100) * 0.4;
  xg *= 0.9 + (technique / 100) * 0.2;
  xg *= 1 - (pressure / 100) * 0.4;
  if (isBigChance) xg *= 1.3;

  return Math.max(0.02, Math.min(0.90, xg));
}

// ═══════════════════════════════════════════════
// KALECI
// ═══════════════════════════════════════════════

function applyGoalkeeper(gk: Player | undefined, xg: number): number {
  if (!gk) return xg * 1.2;

  const reflexes = eff(gk, 'reflexes');
  const positioning = eff(gk, 'gkPositioning');
  const handling = eff(gk, 'handling');
  const oneOnOne = eff(gk, 'oneOnOne');

  const gkRating =
    reflexes * 0.3 + positioning * 0.3 + handling * 0.2 + oneOnOne * 0.2;

  // ⚡ /350 (kaleci daha az etki etsin)
  const gkFactor = 1.0 - (gkRating - 50) / 350;
  return Math.max(0.02, Math.min(0.90, xg * gkFactor));
}

// ═══════════════════════════════════════════════
// TAKIM ORTA SAHA GUCU
// ═══════════════════════════════════════════════

function teamMidfieldPower(club: Club, players: Record<string, Player>): number {
  const xi = getStartingXI(club.id, players, club.tactic.formation);
  const mcs = xi.filter(p => ['MC', 'DM', 'AMC', 'ML', 'MR'].includes(p.position));
  if (mcs.length === 0) return 50;
  return mcs.reduce((s, p) => s + (eff(p, 'passing') + eff(p, 'vision') + eff(p, 'decisions')) / 3, 0) / mcs.length;
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
    dynamicTactic: { ...home.tactic },
  };
  const awayState = {
    club: away,
    zones: calculateZones(away, players),
    condition: 100,
    redCards: 0,
    dynamicTactic: { ...away.tactic },
  };

  const stats = {
    homeShots: 0, awayShots: 0,
    homeOnTarget: 0, awayOnTarget: 0,
    homeXG: 0, awayXG: 0,
    homePossession: 0, awayPossession: 0,
    homePasses: 0, awayPasses: 0,
    homePassesCompleted: 0, awayPassesCompleted: 0,
    homeDribbles: 0, awayDribbles: 0,
    homeDribblesSuccess: 0, awayDribblesSuccess: 0,
    homeCrosses: 0, awayCrosses: 0,
    homeCrossesSuccess: 0, awayCrossesSuccess: 0,
    homeDangerousAttacks: 0, awayDangerousAttacks: 0,
    homeRecoveries: 0, awayRecoveries: 0,
  };

  const homeMid = teamMidfieldPower(home, players);
  const awayMid = teamMidfieldPower(away, players);
  const possRatio = homeMid / (homeMid + awayMid);
  stats.homePossession = Math.round(possRatio * 100);
  stats.awayPossession = 100 - stats.homePossession;

  const totalTicks = 36;
  const minutePerTick = 2.5;
  const pendingEvents: { minute: number; event: MatchEvent }[] = [];

  for (let tick = 0; tick < totalTicks; tick++) {
    const baseMinute = Math.floor(tick * minutePerTick) + 1;
    const minute = Math.min(90, baseMinute + Math.floor(Math.random() * 3));

    // MAC DURUMU
    const homeBehind = homeScore < awayScore;
    const awayBehind = awayScore < homeScore;
    const isLateGame = tick > totalTicks * 0.7;

    homeState.dynamicTactic.mentality = homeBehind && isLateGame ? 'attacking' : home.tactic.mentality;
    homeState.dynamicTactic.tempo = homeBehind && isLateGame ? 'fast' : home.tactic.tempo;
    awayState.dynamicTactic.mentality = awayBehind && isLateGame ? 'attacking' : away.tactic.mentality;
    awayState.dynamicTactic.tempo = awayBehind && isLateGame ? 'fast' : away.tactic.tempo;

    const homeChance = possRatio * (1 - (tick / totalTicks) * 0.15);
    const attacking = Math.random() < homeChance ? 'home' : 'away';
    const attackState = attacking === 'home' ? homeState : awayState;
    const defendState = attacking === 'home' ? awayState : homeState;

    const defendBonus = defendState.redCards * 0.15;
    const attackPenalty = attackState.redCards * 0.15;

    const matchups = calculateZoneMatchups(attackState.zones, defendState.zones);
    const zoneChoice = selectZoneWeighted(matchups);
    const advPct = zoneChoice.advantagePct;

    const attackerXI = getStartingXI(attackState.club.id, players, attackState.club.tactic.formation);
    const passer = pick(attackerXI.filter(p => ['MC', 'DM', 'AMC', 'ML', 'MR'].includes(p.position)) as Player[]) || pick(attackerXI);
    if (!passer) continue;

    // PAS
    const pressure = 50 + (defendState.condition - 50) * 0.3 + defendBonus * 100;
    const tempo = tempoModifier(attackState.dynamicTactic.tempo);
    const passOk = Math.random() < passSuccessChance(passer, pressure, tempo);

    if (attacking === 'home') stats.homePasses++; else stats.awayPasses++;

    if (!passOk) continue;
    if (attacking === 'home') stats.homePassesCompleted++; else stats.awayPassesCompleted++;

    const widthMult = widthModifier(attackState.dynamicTactic.width);
    const actionRoll = Math.random();

    // KONTRA / DIREKT
    if (attackState.dynamicTactic.directness === 'direct' && actionRoll < 0.18) {
      const dribbler = pick(attackerXI.filter(p => ['ST', 'AML', 'AMR', 'AMC'].includes(p.position)) as Player[]) || passer;
      const defPower = defendState.zones.centerDefense.defensePower;
      const dribbleOk = Math.random() < dribbleSuccessChance(dribbler, defPower);
      if (attacking === 'home') stats.homeDribbles++; else stats.awayDribbles++;
      if (dribbleOk) {
        if (attacking === 'home') stats.homeDribblesSuccess++; else stats.awayDribblesSuccess++;
        if (attacking === 'home') stats.homeDangerousAttacks++; else stats.awayDangerousAttacks++;
        const shooter = dribbler;
        const distance = 10 + Math.random() * 15;
        const xg = calculateXG(shooter, distance, 50, Math.random() < 0.20);
        if (attacking === 'home') { stats.homeShots++; stats.homeXG += xg; } else { stats.awayShots++; stats.awayXG += xg; }
        const defXI = getStartingXI(defendState.club.id, players, defendState.club.tactic.formation);
        const gk = defXI.find(p => p.position === 'GK');
        const goalProb = applyGoalkeeper(gk, xg);
        if (Math.random() < goalProb) {
          if (attacking === 'home') { homeScore++; stats.homeOnTarget++; } else { awayScore++; stats.awayOnTarget++; }
          pendingEvents.push({ minute, event: { minute, type: 'goal', playerId: shooter.id, clubId: attackState.club.id, description: `GOL! ${shooter.name} (${attackState.club.shortName}) - kontra ${distance.toFixed(0)}m` } });
        } else if (Math.random() < 0.30) {
          if (attacking === 'home') stats.homeOnTarget++; else stats.awayOnTarget++;
          pendingEvents.push({ minute, event: { minute, type: 'save', playerId: shooter.id, clubId: attackState.club.id, description: `${shooter.name} sutunu ${gk?.name ?? 'kaleci'} kurtardi (${attackState.club.shortName})` } });
        } else {
          pendingEvents.push({ minute, event: { minute, type: 'miss', playerId: shooter.id, clubId: attackState.club.id, description: `${shooter.name} sutu auta gitti (${attackState.club.shortName})` } });
        }
      }
      attackState.condition = Math.max(40, attackState.condition - 1.5);
      defendState.condition = Math.max(40, defendState.condition - 1);
      continue;
    }

    // KANAT OYUNU
    if (zoneChoice.zone !== 'center' && actionRoll < 0.45 * widthMult) {
      const winger = pick(attackerXI.filter(p => ['AML', 'AMR', 'ML', 'MR'].includes(p.position)) as Player[]) || passer;
      const defPower = zoneChoice.zone === 'left' ? defendState.zones.rightDefense.defensePower : defendState.zones.leftDefense.defensePower;
      const dribbleOk = Math.random() < dribbleSuccessChance(winger, defPower);
      if (attacking === 'home') stats.homeDribbles++; else stats.awayDribbles++;
      if (!dribbleOk) {
        attackState.condition = Math.max(40, attackState.condition - 1.5);
        defendState.condition = Math.max(40, defendState.condition - 1);
        continue;
      }
      if (attacking === 'home') stats.homeDribblesSuccess++; else stats.awayDribblesSuccess++;

      if (Math.random() < 0.58) {
        const crossOk = Math.random() < crossSuccessChance(winger, defPower);
        if (attacking === 'home') stats.homeCrosses++; else stats.awayCrosses++;
        if (!crossOk) {
          attackState.condition = Math.max(40, attackState.condition - 1.5);
          defendState.condition = Math.max(40, defendState.condition - 1);
          continue;
        }
        if (attacking === 'home') stats.homeCrossesSuccess++; else stats.awayCrossesSuccess++;
        if (attacking === 'home') stats.homeDangerousAttacks++; else stats.awayDangerousAttacks++;

        const target = pick(attackerXI.filter(p => ['ST', 'AMC'].includes(p.position)) as Player[]) || winger;
        const distance = 6 + Math.random() * 10;
        const xg = calculateXG(target, distance, 50, true);
        if (attacking === 'home') { stats.homeShots++; stats.homeXG += xg; } else { stats.awayShots++; stats.awayXG += xg; }
        const defXI = getStartingXI(defendState.club.id, players, defendState.club.tactic.formation);
        const gk = defXI.find(p => p.position === 'GK');
        const goalProb = applyGoalkeeper(gk, xg);
        if (Math.random() < goalProb) {
          if (attacking === 'home') { homeScore++; stats.homeOnTarget++; } else { awayScore++; stats.awayOnTarget++; }
          pendingEvents.push({ minute, event: { minute, type: 'goal', playerId: target.id, clubId: attackState.club.id, description: `GOL! ${target.name} (${attackState.club.shortName}) - ${zoneChoice.zone === 'left' ? 'sol' : 'sag'} kanattan orta, kafa ${distance.toFixed(0)}m` } });
        } else if (Math.random() < 0.40) {
          if (attacking === 'home') stats.homeOnTarget++; else stats.awayOnTarget++;
          pendingEvents.push({ minute, event: { minute, type: 'save', playerId: target.id, clubId: attackState.club.id, description: `${target.name} kafa vurusunu ${gk?.name ?? 'kaleci'} kurtardi (${attackState.club.shortName})` } });
        } else {
          pendingEvents.push({ minute, event: { minute, type: 'miss', playerId: target.id, clubId: attackState.club.id, description: `${target.name} kafayi auta gonderdi (${attackState.club.shortName})` } });
        }
      } else {
        const distance = 12 + Math.random() * 15;
        const xg = calculateXG(winger, distance, 55, false);
        if (attacking === 'home') { stats.homeShots++; stats.homeXG += xg; } else { stats.awayShots++; stats.awayXG += xg; }
        const defXI = getStartingXI(defendState.club.id, players, defendState.club.tactic.formation);
        const gk = defXI.find(p => p.position === 'GK');
        const goalProb = applyGoalkeeper(gk, xg);
        if (Math.random() < goalProb) {
          if (attacking === 'home') { homeScore++; stats.homeOnTarget++; } else { awayScore++; stats.awayOnTarget++; }
          pendingEvents.push({ minute, event: { minute, type: 'goal', playerId: winger.id, clubId: attackState.club.id, description: `GOL! ${winger.name} (${attackState.club.shortName}) - ${zoneChoice.zone === 'left' ? 'sol' : 'sag'} kanattan ${distance.toFixed(0)}m` } });
        } else if (Math.random() < 0.30) {
          if (attacking === 'home') stats.homeOnTarget++; else stats.awayOnTarget++;
          pendingEvents.push({ minute, event: { minute, type: 'save', playerId: winger.id, clubId: attackState.club.id, description: `${winger.name} sutunu ${gk?.name ?? 'kaleci'} kurtardi (${attackState.club.shortName})` } });
        } else {
          pendingEvents.push({ minute, event: { minute, type: 'miss', playerId: winger.id, clubId: attackState.club.id, description: `${winger.name} sutu auta gitti (${attackState.club.shortName})` } });
        }
      }
    } else {
      // MERKEZ
      const shootChance = 0.80 + (advPct - 50) * 0.012 + attackPenalty;
      if (Math.random() > shootChance) {
        attackState.condition = Math.max(40, attackState.condition - 1.5);
        defendState.condition = Math.max(40, defendState.condition - 1);
        continue;
      }

      const shooter = pick(attackerXI.filter(p => ['ST', 'AMC'].includes(p.position)) as Player[]) || passer;
      const distance = 8 + Math.random() * 20;
      const shotPressure = 40 + Math.random() * 50;
      const isBigChance = Math.random() < 0.15 + (advPct - 50) * 0.003;
      const xg = calculateXG(shooter, distance, shotPressure, isBigChance);
      if (attacking === 'home') { stats.homeShots++; stats.homeXG += xg; } else { stats.awayShots++; stats.awayXG += xg; }
      const defXI = getStartingXI(defendState.club.id, players, defendState.club.tactic.formation);
      const gk = defXI.find(p => p.position === 'GK');
      const goalProb = applyGoalkeeper(gk, xg);

      if (Math.random() < goalProb) {
        if (attacking === 'home') { homeScore++; stats.homeOnTarget++; } else { awayScore++; stats.awayOnTarget++; }
        pendingEvents.push({ minute, event: { minute, type: 'goal', playerId: shooter.id, clubId: attackState.club.id, description: `GOL! ${shooter.name} (${attackState.club.shortName}) - merkezden ${distance.toFixed(0)}m` } });
      } else if (Math.random() < 0.30) {
        if (attacking === 'home') stats.homeOnTarget++; else stats.awayOnTarget++;
        pendingEvents.push({ minute, event: { minute, type: 'save', playerId: shooter.id, clubId: attackState.club.id, description: `${shooter.name} sutunu ${gk?.name ?? 'kaleci'} kurtardi (${attackState.club.shortName})` } });
      } else {
        pendingEvents.push({ minute, event: { minute, type: 'miss', playerId: shooter.id, clubId: attackState.club.id, description: `${shooter.name} sutu auta gitti (${attackState.club.shortName})` } });
      }
    }

    attackState.condition = Math.max(40, attackState.condition - 1.5);
    defendState.condition = Math.max(40, defendState.condition - 1);
  }

  // ═══════════════════════════════════════════════
  // KARTLAR (BUG FIX: sentOff Set'i dogru kullaniliyor)
  // ═══════════════════════════════════════════════

  const cardCount = Math.floor(Math.random() * 5) + 2;
  const matchYellows = new Set<string>();
  const sentOff = new Set<string>();

  for (let i = 0; i < cardCount; i++) {
    const isHome = Math.random() < 0.5;
    const club = isHome ? home : away;
    const clubState = isHome ? homeState : awayState;
    const xi = getStartingXI(club.id, players, club.tactic.formation);

    // Kirmizi goren oyunculari cikar
    const activePlayers = xi.filter(p => !sentOff.has(p.id));
    const defenders = activePlayers.filter(p => ['DC', 'DL', 'DR', 'DM', 'MC'].includes(p.position));
    const pool = defenders.length > 0 ? defenders : activePlayers;
    if (pool.length === 0) continue;

    const player = pick(pool);
    if (!player) continue;
    const cardMinute = randomMinute();

    // Ikinci sari -> kirmizi
    if (matchYellows.has(player.id)) {
      players[player.id] = { ...player, suspensionWeeks: 2, yellowCards: 0 };
      clubState.redCards++;
      sentOff.add(player.id);
      pendingEvents.push({ minute: cardMinute, event: { minute: cardMinute, type: 'red', playerId: player.id, clubId: club.id, description: `KIRMIZI! ${player.name} ikinci saridan atildi (${club.shortName})` } });
      continue;
    }

    const red = Math.random() < 0.06;
    if (red) {
      players[player.id] = { ...player, suspensionWeeks: 2, yellowCards: 0 };
      clubState.redCards++;
      sentOff.add(player.id);
      pendingEvents.push({ minute: cardMinute, event: { minute: cardMinute, type: 'red', playerId: player.id, clubId: club.id, description: `KIRMIZI! ${player.name} oyundan atildi (${club.shortName})` } });
    } else {
      matchYellows.add(player.id);
      const newYellow = (player.yellowCards ?? 0) + 1;
      if (newYellow >= 4) {
        players[player.id] = { ...player, yellowCards: 0, suspensionWeeks: 1 };
        pendingEvents.push({ minute: cardMinute, event: { minute: cardMinute, type: 'yellow', playerId: player.id, clubId: club.id, description: `${player.name} 4. saridan ceza aldi (${club.shortName})` } });
      } else {
        players[player.id] = { ...player, yellowCards: newYellow };
        pendingEvents.push({ minute: cardMinute, event: { minute: cardMinute, type: 'yellow', playerId: player.id, clubId: club.id, description: `${player.name} sari kart gordu (${newYellow}/4) (${club.shortName})` } });
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
    const activePlayers = xi.filter(p => !sentOff.has(p.id));
    if (activePlayers.length > 0) {
      const player = activePlayers[Math.floor(Math.random() * activePlayers.length)];
      if (player) {
        const injuryRoll = Math.random();
        let weeks: number;
        let type: string;
        if (injuryRoll < 0.6) { weeks = 1; type = pickInjuryType('light'); }
        else if (injuryRoll < 0.88) { weeks = 2 + Math.floor(Math.random() * 3); type = pickInjuryType('medium'); }
        else { weeks = 5 + Math.floor(Math.random() * 4); type = pickInjuryType('severe'); }
        const injMinute = randomMinute();
        players[player.id] = { ...player, injuryWeeks: weeks, injuryType: type };
        pendingEvents.push({ minute: injMinute, event: { minute: injMinute, type: 'injury', playerId: player.id, clubId: club.id, description: `${player.name} sakatlandi - ${type} (${weeks} hafta)` } });
      }
    }
  }

  events.push(...pendingEvents.sort((a, b) => a.minute - b.minute).map(e => e.event));

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
      xG: { home: Math.round(stats.homeXG * 100) / 100, away: Math.round(stats.awayXG * 100) / 100 },
      passes: { home: stats.homePasses, away: stats.awayPasses },
      passesCompleted: { home: stats.homePassesCompleted, away: stats.awayPassesCompleted },
      dribbles: { home: stats.homeDribbles, away: stats.awayDribbles },
      dribblesSuccess: { home: stats.homeDribblesSuccess, away: stats.awayDribblesSuccess },
      crosses: { home: stats.homeCrosses, away: stats.awayCrosses },
      crossesSuccess: { home: stats.homeCrossesSuccess, away: stats.awayCrossesSuccess },
      dangerousAttacks: { home: stats.homeDangerousAttacks, away: stats.awayDangerousAttacks },
      recoveries: { home: stats.homeRecoveries, away: stats.awayRecoveries },
    },
    played: true,
  };
}