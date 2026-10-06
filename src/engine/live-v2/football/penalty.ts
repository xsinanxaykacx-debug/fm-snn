import type { MatchState, TeamSide, Vec2 } from '../state';
import { nextRandom } from '../rng';
import { clamp } from './geometry';
import { goalkeeperSaveChance } from './goalkeeper';
import { chooseSetPieceTaker } from './setPiece';

export function penaltySpot(pitch:{length:number;width:number},defendingSide:TeamSide):Vec2{
 return {x:defendingSide==='HOME'?11:pitch.length-11,y:pitch.width/2};
}
export function resolvePenalty(state:MatchState,side:TeamSide):MatchState{
 const spot=penaltySpot(state.pitch,side); const takerId=chooseSetPieceTaker(state,side,'penalty');
 if(!takerId)return {...state,football:{...state.football!,pendingPenalty:null}};
 const taker=state.players[takerId]; const gk=Object.values(state.players).filter(p=>p.team!==side&&p.role==='GK'&&p.onPitch!==false).sort((a,b)=>a.id.localeCompare(b.id))[0];
 let next={...state,ball:{...state.ball,position:{...spot,z:0},ownerId:null,velocity:{x:0,y:0,z:0}},football:{...state.football!,pendingPenalty:null}};
 next={...next,football:{...next.football!,events:[...next.football!.events,{id:next.tick+'-'+next.football!.events.length,type:'penalty',minute:Math.floor(next.clockSeconds/60),tick:next.tick,playerId:takerId,teamId:side,position:spot,description:'penalty'}]}};
 const [roll,seed]=nextRandom(next.seed); next={...next,seed};
 const save=gk?goalkeeperSaveChance(gk,11,1):0.38;
 const goalChance=clamp(0.76+((taker.attributes?.finishing??60)-60)/500,0.55,0.9);
 if(gk&&roll<save){
  const stats={...gk.matchStats!,saves:(gk.matchStats?.saves??0)+1};
  return {...next,players:{...next.players,[gk.id]:{...gk,matchStats:stats}},football:{...next.football!,playerStats:{...next.football!.playerStats,[gk.id]:stats},events:[...next.football!.events,{id:next.tick+'-'+next.football!.events.length,type:'save',minute:Math.floor(next.clockSeconds/60),tick:next.tick,playerId:gk.id,teamId:gk.team,relatedPlayerId:takerId,position:gk.position,description:'penalty save'}]}};
 }
 const [goalRoll,seed2]=nextRandom(next.seed); next={...next,seed:seed2};
 if(goalRoll<goalChance){
  const key=side==='HOME'?'home':'away'; const score={...next.score,[key]:next.score[key]+1};
  return {...next,score,ball:{...next.ball,position:{x:next.pitch.length/2,y:next.pitch.width/2,z:0}},football:{...next.football!,teamStats:{...next.football!.teamStats,[side]:{...next.football!.teamStats[side],goals:next.football!.teamStats[side].goals+1,shots:next.football!.teamStats[side].shots+1,shotsOnTarget:next.football!.teamStats[side].shotsOnTarget+1,penalties:next.football!.teamStats[side].penalties+1}},events:[...next.football!.events,{id:next.tick+'-'+next.football!.events.length,type:'penalty_goal',minute:Math.floor(next.clockSeconds/60),tick:next.tick,playerId:takerId,teamId:side,position:spot,xG:goalChance,description:'penalty goal'}]},restart:{type:'kickoff',side:side==='HOME'?'AWAY':'HOME',point:{x:next.pitch.length/2,y:next.pitch.width/2}}};
 }
 return {...next,football:{...next.football!,teamStats:{...next.football!.teamStats,[side]:{...next.football!.teamStats[side],shots:next.football!.teamStats[side].shots+1,penalties:next.football!.teamStats[side].penalties+1}},events:[...next.football!.events,{id:next.tick+'-'+next.football!.events.length,type:'shot_off_target',minute:Math.floor(next.clockSeconds/60),tick:next.tick,playerId:takerId,teamId:side,position:spot,description:'penalty miss'}]}};
}
