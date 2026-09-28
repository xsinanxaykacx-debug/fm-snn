import type { Club, Match, MatchEvent, Player } from '../types';
import { getStartingXI } from '../data/generateData';
import { analyzeTeam } from './teamAnalysis';
import {
  createTeamMatchState,
  updateDynamicTactics,
  consumeCondition,
  calculatePossession,
  type MatchState,
} from './matchState';
import {
  choosePossessionTeam,
  chooseAttackZone,
  calculateTurnoverChance,
} from './possession';
import {
  chooseAction,
  passSuccessChance,
  dribbleSuccessChance,
  crossSuccessChance,
  pickPasser,
  pickDribbler,
  pickShooter,
  pickDefender,
} from './attack';
import { calculateChance } from './chance';
import { resolveDefense } from './defense';
import { resolveShot } from './goalkeeper';

function randomMinute(): number {
  return Math.floor(Math.random() * 90) + 1;
}

function pickInjuryType(severity: 'light' | 'medium' | 'severe'): string {
  const light = ['Kas Agrisi', 'Kucuk Burkulma', 'Hafif Darbe'];
  const medium = ['Hamstring', 'Ayak Bilegi', 'Diz Burkulmasi'];
  const severe = ['Capraz Bag', 'Kaval Kemigi Kirigi', 'Asil Tendonu'];
  const pool = severity === 'light' ? light : severity === 'medium' ? medium : severe;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function simulateMatch(
  home: Club,
  away: Club,
  players: Record<string, Player>,
  week: number
): Match {
  const events: MatchEvent[] = [];
  const pendingEvents: { minute: number; event: MatchEvent }[] = [];

  const homeAnalysis = analyzeTeam(home, players);
  const awayAnalysis = analyzeTeam(away, players);

  const state: MatchState = {
    minute: 0,
    home: createTeamMatchState(home, homeAnalysis),
    away: createTeamMatchState(away, awayAnalysis),
    homeScore: 0,
    awayScore: 0,
    possessionTeam: 'home',
    ballZone: 'centerMidfield',
    events: [],
    possessionCount: { home: 0, away: 0 },
  };

  const totalTicks = 36;
  const minutePerTick = 2.5;
  const sentOff = new Set<string>();
  const matchYellows = new Set<string>();

  for (let tick = 0; tick < totalTicks; tick++) {
    const baseMinute = Math.floor(tick * minutePerTick) + 1;
    state.minute = Math.min(90, baseMinute + Math.floor(Math.random() * 3));

    updateDynamicTactics(state);

    const possessionTeam = choosePossessionTeam(state);
    state.possessionCount[possessionTeam]++;
    state.possessionTeam = possessionTeam;

    const attackState = possessionTeam === 'home' ? state.home : state.away;
    const defendState = possessionTeam === 'home' ? state.away : state.home;
    const attackClub = attackState.club;
    const defendClub = defendState.club;

    const { zone, advantagePct } = chooseAttackZone(state, attackState, defendState);

    const attackXI = getStartingXI(attackClub.id, players, attackClub.tactic.formation)
      .filter(p => !sentOff.has(p.id));
    const defendXI = getStartingXI(defendClub.id, players, defendClub.tactic.formation)
      .filter(p => !sentOff.has(p.id));

    if (attackXI.length < 7 || defendXI.length < 7) continue;

    const attacker = pickDribbler(attackXI, zone) || pickPasser(attackXI);
    if (!attacker) continue;

    const action = chooseAction(attackState, zone, attacker);

    const turnoverChance = calculateTurnoverChance(attackState, defendState);
    if (Math.random() < turnoverChance) {
      attackState.turnovers++;
      defendState.recoveries++;
      consumeCondition(state);
      continue;
    }

    let success = false;
    const defender = pickDefender(defendXI, zone);

    if (action === 'pass') {
      attackState.passes++;
      const prob = passSuccessChance(attacker, defender, zone, attackState.tempo);
      success = Math.random() < prob;
      if (success) attackState.passesCompleted++;
    } else if (action === 'dribble') {
      attackState.dribbles++;
      const prob = dribbleSuccessChance(attacker, defender);
      success = Math.random() < prob;
      if (success) attackState.dribblesSuccess++;
    } else if (action === 'cross') {
      attackState.crosses++;
      const prob = crossSuccessChance(attacker, defender);
      success = Math.random() < prob;
      if (success) attackState.crossesSuccess++;
    } else if (action === 'longShot') {
      success = true;
    } else if (action === 'counter') {
      const prob = dribbleSuccessChance(attacker, defender);
      success = Math.random() < prob;
    } else {
      success = true;
    }

    if (success && (action === 'pass' || action === 'dribble' || action === 'cross')) {
      const defenseResult = resolveDefense(action, attacker, defender, attackState, defendState);
      if (defenseResult.turnover) {
        success = false;
        attackState.turnovers++;
        defendState.recoveries++;
      }
    }

    if (!success) {
      consumeCondition(state);
      continue;
    }

    const chanceProbability = calculateChanceCreation(zone, action, advantagePct);
    if (Math.random() > chanceProbability) {
      consumeCondition(state);
      continue;
    }

    const shooter = pickShooter(attackXI, zone);
    if (!shooter) continue;

    const chance = calculateChance(
      shooter,
      zone,
      action,
      attackState,
      defendState,
      action === 'counter'
    );

    attackState.shots++;
    attackState.xG += chance.xG;

    const gk = defendXI.find(p => p.position === 'GK') || null;
    const shotResult = resolveShot(chance, gk, defendState);

    const attackerClub = attackState.club;
    const isHome = possessionTeam === 'home';

    if (shotResult.outcome === 'goal') {
      if (isHome) {
        state.homeScore++;
        attackState.score++;
      } else {
        state.awayScore++;
        attackState.score++;
      }
      attackState.onTarget++;
      attackState.dangerousAttacks++;

      pendingEvents.push({
        minute: state.minute,
        event: {
          minute: state.minute,
          type: 'goal',
          playerId: shooter.id,
          clubId: attackerClub.id,
          description: `⚽ GOL! ${shooter.name} (${attackerClub.shortName}) - ${getZoneLabel(zone)} ${chance.distance.toFixed(0)}m (xG: ${chance.xG.toFixed(2)})`,
        },
      });
    } else if (shotResult.outcome === 'save') {
      attackState.onTarget++;
      attackState.dangerousAttacks++;
      pendingEvents.push({
        minute: state.minute,
        event: {
          minute: state.minute,
          type: 'save',
          playerId: shooter.id,
          clubId: attackerClub.id,
          description: `🧤 ${shooter.name} şutunu ${gk?.name ?? 'kaleci'} kurtardı (${attackerClub.shortName})`,
        },
      });
    } else if (shotResult.outcome === 'blocked') {
      pendingEvents.push({
        minute: state.minute,
        event: {
          minute: state.minute,
          type: 'miss',
          playerId: shooter.id,
          clubId: attackerClub.id,
          description: `🛡️ ${shooter.name} şutu savunmaya çarptı (${attackerClub.shortName})`,
        },
      });
    } else {
      pendingEvents.push({
        minute: state.minute,
        event: {
          minute: state.minute,
          type: 'miss',
          playerId: shooter.id,
          clubId: attackerClub.id,
          description: `❌ ${shooter.name} şutu auta gitti (${attackerClub.shortName})`,
        },
      });
    }

    consumeCondition(state);
  }

  const cardCount = Math.floor(Math.random() * 5) + 2;

  for (let i = 0; i < cardCount; i++) {
    const isHome = Math.random() < 0.5;
    const club = isHome ? home : away;
    const teamState = isHome ? state.home : state.away;
    const xi = getStartingXI(club.id, players, club.tactic.formation);
    const activePlayers = xi.filter(p => !sentOff.has(p.id));
    const defenders = activePlayers.filter(p => ['DC', 'DL', 'DR', 'DM', 'MC'].includes(p.position));
    const pool = defenders.length > 0 ? defenders : activePlayers;
    if (pool.length === 0) continue;

    const player = pool[Math.floor(Math.random() * pool.length)];
    if (!player) continue;
    const cardMinute = randomMinute();

    if (matchYellows.has(player.id)) {
      players[player.id] = { ...player, suspensionWeeks: 2, yellowCards: 0 };
      teamState.redCards++;
      sentOff.add(player.id);
      pendingEvents.push({
        minute: cardMinute,
        event: {
          minute: cardMinute, type: 'red', playerId: player.id, clubId: club.id,
          description: `🟥 KIRMIZI! ${player.name} ikinci sarıdan atıldı (${club.shortName})`,
        },
      });
      continue;
    }

    const red = Math.random() < 0.06;
    if (red) {
      players[player.id] = { ...player, suspensionWeeks: 2, yellowCards: 0 };
      teamState.redCards++;
      sentOff.add(player.id);
      pendingEvents.push({
        minute: cardMinute,
        event: {
          minute: cardMinute, type: 'red', playerId: player.id, clubId: club.id,
          description: `🟥 KIRMIZI! ${player.name} oyundan atıldı (${club.shortName})`,
        },
      });
    } else {
      matchYellows.add(player.id);
      const newYellow = (player.yellowCards ?? 0) + 1;
      if (newYellow >= 4) {
        players[player.id] = { ...player, yellowCards: 0, suspensionWeeks: 1 };
        pendingEvents.push({
          minute: cardMinute,
          event: {
            minute: cardMinute, type: 'yellow', playerId: player.id, clubId: club.id,
            description: `🟨 ${player.name} 4. sarıdan ceza aldı (${club.shortName})`,
          },
        });
      } else {
        players[player.id] = { ...player, yellowCards: newYellow };
        pendingEvents.push({
          minute: cardMinute,
          event: {
            minute: cardMinute, type: 'yellow', playerId: player.id, clubId: club.id,
            description: `🟨 ${player.name} sarı kart gördü (${newYellow}/4) (${club.shortName})`,
          },
        });
      }
    }
  }

  if (Math.random() < 0.20) {
    const isHome = Math.random() < 0.5;
    const club = isHome ? home : away;
    const xi = getStartingXI(club.id, players, club.tactic.formation);
    const activePlayers = xi.filter(p => !sentOff.has(p.id));
    if (activePlayers.length > 0) {
      const player = activePlayers[Math.floor(Math.random() * activePlayers.length)];
      const injuryRoll = Math.random();
      let weeks: number;
      let type: string;
      if (injuryRoll < 0.6) { weeks = 1; type = pickInjuryType('light'); }
      else if (injuryRoll < 0.88) { weeks = 2 + Math.floor(Math.random() * 3); type = pickInjuryType('medium'); }
      else { weeks = 5 + Math.floor(Math.random() * 4); type = pickInjuryType('severe'); }
      const injMinute = randomMinute();
      players[player.id] = { ...player, injuryWeeks: weeks, injuryType: type };
      pendingEvents.push({
        minute: injMinute,
        event: {
          minute: injMinute, type: 'injury', playerId: player.id, clubId: club.id,
          description: `🚑 ${player.name} sakatlandı - ${type} (${weeks} hafta)`,
        },
      });
    }
  }

  events.push(...pendingEvents.sort((a, b) => a.minute - b.minute).map(e => e.event));

  const possession = calculatePossession(state);

  return {
    id: `match_${week}_${home.id}_${away.id}`,
    week,
    homeId: home.id,
    awayId: away.id,
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    events,
    stats: {
      possession: { home: possession.home, away: possession.away },
      shots: { home: state.home.shots, away: state.away.shots },
      onTarget: { home: state.home.onTarget, away: state.away.onTarget },
      chances: { home: state.home.dangerousAttacks, away: state.away.dangerousAttacks },
      xG: { home: Math.round(state.home.xG * 100) / 100, away: Math.round(state.away.xG * 100) / 100 },
      passes: { home: state.home.passes, away: state.away.passes },
      passesCompleted: { home: state.home.passesCompleted, away: state.away.passesCompleted },
      dribbles: { home: state.home.dribbles, away: state.away.dribbles },
      dribblesSuccess: { home: state.home.dribblesSuccess, away: state.away.dribblesSuccess },
      crosses: { home: state.home.crosses, away: state.away.crosses },
      crossesSuccess: { home: state.home.crossesSuccess, away: state.away.crossesSuccess },
      dangerousAttacks: { home: state.home.dangerousAttacks, away: state.away.dangerousAttacks },
      recoveries: { home: state.home.recoveries, away: state.away.recoveries },
    },
    played: true,
  };
}

function calculateChanceCreation(
  zone: string,
  action: string,
  advantagePct: number
): number {
  // 2.67 gol/maç hedefi için
  let base = 0.75;
  if (zone.includes('Attack')) base = 0.95;
  else if (zone.includes('Midfield')) base = 0.55;

  if (action === 'cross') base += 0.02;
  else if (action === 'dribble') base += 0.03;
  else if (action === 'longShot') base = 0.70;
  else if (action === 'counter') base += 0.08;

  base += (advantagePct - 50) * 0.005;

  return Math.max(0.30, Math.min(0.98, base));
}

function getZoneLabel(zone: string): string {
  const labels: Record<string, string> = {
    'leftAttack': 'sol kanattan',
    'centerAttack': 'merkezden',
    'rightAttack': 'sağ kanattan',
    'leftMidfield': 'sol orta',
    'centerMidfield': 'merkez orta',
    'rightMidfield': 'sağ orta',
  };
  return labels[zone] || zone;
}