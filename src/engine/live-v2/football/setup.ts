import type { MatchState } from '../state';
import type { FormationName, FootballState, PlayerAttributes, PlayerMatchStats, Tactics } from './types';
import { formationSlots } from './formation';

export const DEFAULT_TACTICS:Tactics={mentality:'balanced',pressing:'medium',tempo:'normal',width:'normal',directness:'mixed',defensiveLine:'normal'};
export const DEFAULT_ATTRIBUTES:PlayerAttributes={
 passing:65,firstTouch:65,dribbling:65,crossing:60,shooting:60,finishing:60,decisions:65,vision:65,anticipation:65,
 positioning:65,offTheBall:65,composure:65,workRate:65,aggression:55,pace:65,acceleration:65,stamina:70,strength:60,
 tackling:55,marking:55,ballWinning:55,goalkeeper:45,reflexes:45,gkPositioning:45,handling:45,
};
export const emptyPlayerStats=():PlayerMatchStats=>({
 shots:0,shotsOnTarget:0,goals:0,assists:0,keyPasses:0,passes:0,successfulPasses:0,tackles:0,interceptions:0,
 fouls:0,yellow:0,red:0,saves:0,dribbles:0,minutes:0,xG:0,
});
const emptyTeamStats=()=>({
 shots:0,shotsOnTarget:0,goals:0,xG:0,passes:0,successfulPasses:0,tackles:0,interceptions:0,fouls:0,
 corners:0,throwIns:0,goalKicks:0,freeKicks:0,penalties:0,offsides:0,possessionTicks:0,
});
export function attachFootball(state:MatchState,homeFormation:FormationName='4-4-2',awayFormation:FormationName='4-4-2'):MatchState {
 const football:FootballState={
  formation:{HOME:homeFormation,AWAY:awayFormation},tactics:{HOME:{...DEFAULT_TACTICS},AWAY:{...DEFAULT_TACTICS}},
  maxSubstitutions:3,substitutionsUsed:{HOME:0,AWAY:0},kickoffSide:'HOME',actionCooldowns:{},passSnapshot:{},
  events:[],playerStats:{},teamStats:{HOME:emptyTeamStats(),AWAY:emptyTeamStats()},lastAssistBySide:{HOME:null,AWAY:null},
 };
 const players={...state.players};
 for(const side of ['HOME','AWAY'] as const){
  const ids=state.teams[side].playerIds.slice().sort();
  const slots=formationSlots(football.formation[side],side,state.pitch,football.tactics[side]);
  ids.forEach((id,index)=>{ const p=players[id]; const slot=slots[index];
   const stats=emptyPlayerStats();
   players[id]={...p,role:slot.role,stamina:100,onPitch:true,yellowCards:0,redCard:false,
    attributes:{...DEFAULT_ATTRIBUTES,...(p.attributes??{})},matchStats:stats,startingPosition:{...slot.position}};
   football.playerStats[id]=stats;
  });
 }
 return {...state,players,football};
}
