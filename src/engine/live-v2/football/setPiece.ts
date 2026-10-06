import type { MatchState, TeamSide, Vec2 } from '../state';

export type SetPieceType='corner'|'throw_in'|'goal_kick'|'free_kick'|'penalty'|'kickoff';

export function chooseSetPieceTaker(state:MatchState,side:TeamSide,type:SetPieceType):string|undefined{
 const players=Object.values(state.players).filter(p=>p.team===side&&p.onPitch!==false).sort((a,b)=>a.id.localeCompare(b.id));
 const score=(p:(typeof players)[number])=>{
  const a=p.attributes; if(type==='corner')return a?.crossing??0;
  if(type==='free_kick')return Math.max(a?.passing??0,a?.shooting??0);
  if(type==='penalty')return (a?.finishing??0)+(a?.composure??0);
  if(type==='goal_kick')return p.role==='GK'?1000:(a?.passing??0);
  if(type==='throw_in')return -Math.hypot(p.position.x-state.ball.position.x,p.position.y-state.ball.position.y);
  return p.role==='ST'?100:(a?.passing??0);
 };
 return players.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id))[0]?.id;
}
export function restartPoint(state:MatchState,side:TeamSide,type:SetPieceType,crossing:Vec2):Vec2{
 if(type==='corner')return {x:side==='HOME'?0:state.pitch.length,y:crossing.y<state.pitch.width/2?0:state.pitch.width};
 if(type==='goal_kick')return {x:side==='HOME'?5.5:state.pitch.length-5.5,y:state.pitch.width/2};
 if(type==='penalty')return {x:side==='HOME'?11:state.pitch.length-11,y:state.pitch.width/2};
 if(type==='kickoff')return {x:state.pitch.length/2,y:state.pitch.width/2};
 return {x:Math.max(0,Math.min(state.pitch.length,crossing.x)),y:crossing.y<=state.pitch.width/2?0:state.pitch.width};
}
