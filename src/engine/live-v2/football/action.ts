import type { MatchState } from '../state';
import { nextRandom } from '../rng';
import type { DecisionAction } from '../decision';
import type { Role, Tactics } from './types';
import { distance, goalX } from './geometry';

export type FootballDecision = { action:DecisionAction; playerId:string; targetId?:string };

function sortedPlayers(state:MatchState,side:'HOME'|'AWAY') {
  return Object.values(state.players).filter(p=>p.team===side && p.onPitch!==false).sort((a,b)=>a.id.localeCompare(b.id));
}
function bestTeammate(state:MatchState,playerId:string,side:'HOME'|'AWAY'):string|undefined {
  const p=state.players[playerId]; if(!p)return undefined;
  return sortedPlayers(state,side).filter(x=>x.id!==playerId)
    .sort((a,b)=>{
      const ap=goalX(side,state.pitch)-a.position.x, bp=goalX(side,state.pitch)-b.position.x;
      const da=distance(a.position,p.position), db=distance(b.position,p.position);
      const scoreA=da + Math.max(0,ap)*0.25, scoreB=db + Math.max(0,bp)*0.25;
      return scoreA-scoreB || a.id.localeCompare(b.id);
    })[0]?.id;
}
export function chooseFootballAction(state:MatchState,playerId:string,tactics:Tactics,random:number):FootballDecision {
  const p=state.players[playerId]; if(!p)throw new Error('live-v2 football: unknown player');
  const nearGoal=Math.abs(goalX(p.team,state.pitch)-p.position.x)<22;
  const role=p.role as Role|undefined;
  const pressure=Object.values(state.players).filter(x=>x.team!==p.team&&x.onPitch!==false)
    .map(x=>distance(x.position,p.position)).sort((a,b)=>a-b)[0]??99;
  const passBias=tactics.directness==='short'?0.48:tactics.directness==='direct'?0.22:0.36;
  const shootBias=nearGoal && ['ST','GF','KFL','KFR','AMC','AML','AMR'].includes(role??'') ? 0.12 : nearGoal ? 0.07 : 0;
  if(nearGoal && random<shootBias)return {action:'SHOOT',playerId};
  if(random<shootBias+passBias)return {action:'PASS',playerId,targetId:bestTeammate(state,playerId,p.team)};
  if(pressure<3.5)return {action:'DRIBBLE',playerId};
  return {action:'DRIBBLE',playerId};
}
export function nextDecision(state:MatchState,playerId:string,tactics:Tactics):[FootballDecision,MatchState] {
  const [r,seed]=nextRandom(state.seed);
  return [chooseFootballAction(state,playerId,tactics,r),{...state,seed}];
}
