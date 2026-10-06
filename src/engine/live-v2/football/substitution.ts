import type { MatchState, TeamSide } from '../state';
import { emptyPlayerStats } from './setup';

export function makeSubstitution(state:MatchState,side:TeamSide,outId:string,inId:string):MatchState{
 const f=state.football; if(!f||f.substitutionsUsed[side]>=f.maxSubstitutions)return state;
 const out=state.players[outId], incoming=state.players[inId]; if(!out||!incoming||out.team!==side||incoming.team!==side||out.onPitch===false)return state;
 const used=f.substitutionsUsed[side]+1;
 const players={...state.players,[outId]:{...out,onPitch:false,velocity:{x:0,y:0}},[inId]:{...incoming,onPitch:true,stamina:100,redCard:false,matchStats:emptyPlayerStats()}};
 const event={id:state.tick+'-'+f.events.length,type:'substitution' as const,minute:Math.floor(state.clockSeconds/60),tick:state.tick,teamId:side,playerId:inId,relatedPlayerId:outId,description:'substitution'};
 return {...state,players,football:{...f,substitutionsUsed:{...f.substitutionsUsed,[side]:used},events:[...f.events,event]}};
}
export function substitutionCandidate(state:MatchState,side:TeamSide):string|undefined{
 return Object.values(state.players).filter(p=>p.team===side&&p.onPitch!==false&&(p.stamina??100)<25&&p.redCard!==true).sort((a,b)=>(a.stamina??100)-(b.stamina??100)||a.id.localeCompare(b.id))[0]?.id;
}
