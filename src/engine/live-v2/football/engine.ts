import type { MatchState, PlayerState, TeamSide, Vec2 } from '../state';
import { nextRandom } from '../rng';
import { distance, inGoalMouth, inPenaltyArea, shotXG, clamp } from './geometry';
import { chooseFootballAction } from './action';
import { formationSlots } from './formation';
import type { FootballEvent, FootballState, PlayerMatchStats, TeamMatchStats } from './types';
import { emptyPlayerStats, DEFAULT_ATTRIBUTES } from './setup';

const MAX_CHASE=3;
const BALL_DECELERATION=0.88;
const BALL_CONTROL_DISTANCE=1.8;
const PLAYER_SPEED=5.8;
const PRESSING_SPEED=6.8;
const STAMINA_COST={POSITION:0.015,CHASE:0.055,PASS:0.04,DRIBBLE:0.07,TACKLE:0.11,INTERCEPT:0.08,SHOOT:0.05,PRESS:0.08} as const;

function eventId(state:MatchState):string { return state.tick+'-'+state.football!.events.length; }
function addEvent(state:MatchState,event:Omit<FootballEvent,'id'|'tick'|'minute'>):MatchState {
 const football=state.football!; const full:FootballEvent={...event,id:eventId(state),tick:state.tick,minute:Math.floor(state.clockSeconds/60)};
 return {...state,football:{...football,events:[...football.events,full]}};
}
function withTeamStat(state:MatchState,side:TeamSide,key:keyof TeamMatchStats,delta=1):MatchState {
 const f=state.football!; return {...state,football:{...f,teamStats:{...f.teamStats,[side]:{...f.teamStats[side],[key]:f.teamStats[side][key]+delta}}}};
}
function withPlayerStat(state:MatchState,id:string,key:keyof PlayerMatchStats,delta=1):MatchState {
 const f=state.football!; const old=f.playerStats[id]??emptyPlayerStats();
 const next={...old,[key]:old[key]+delta};
 return {...state,football:{...f,playerStats:{...f.playerStats,[id]:next}},players:{...state.players,[id]:{...state.players[id],matchStats:next}}};
}
function direction(from:Vec2,to:Vec2):Vec2 { const dx=to.x-from.x,dy=to.y-from.y,l=Math.hypot(dx,dy); return l===0?{x:0,y:0}:{x:dx/l,y:dy/l}; }
function active(state:MatchState):PlayerState[] { return Object.values(state.players).filter(p=>p.onPitch!==false); }
function movePlayers(state:MatchState):MatchState {
 const ball=state.ball.position; const nextPlayers={...state.players};
 for(const side of ['HOME','AWAY'] as const){
  const team=active(state).filter(p=>p.team===side).sort((a,b)=>a.id.localeCompare(b.id));
  const chase=team.filter(p=>p.id!==state.ball.ownerId).map(p=>({p,d:distance(p.position,ball)}))
    .sort((a,b)=>a.d-b.d||a.p.id.localeCompare(b.p.id)).slice(0,MAX_CHASE).map(x=>x.p.id);
  const slots=formationSlots(state.football!.formation[side],side,state.pitch,state.football!.tactics[side]);
  team.forEach((p,index)=>{
   const isChase=chase.includes(p.id);
   const target=isChase?ball:slots[index]?.position??p.position;
   const dir=direction(p.position,target);
   const pressing=state.football!.tactics[side].pressing==='high'&&isChase;
   const speed=pressing?PRESSING_SPEED:PLAYER_SPEED;
   const distanceToTarget=distance(p.position,target);
   const step=Math.min(speed,distanceToTarget);
   nextPlayers[p.id]={...p,position:{x:clamp(p.position.x+dir.x*step,0,state.pitch.length),y:clamp(p.position.y+dir.y*step,0,state.pitch.width)},velocity:{x:dir.x*step,y:dir.y*step}};
  });
 }
 return {...state,players:nextPlayers};
}
function consumeStamina(state:MatchState,actions:Record<string,typeof STAMINA_COST[keyof typeof STAMINA_COST]>):MatchState {
 const players={...state.players};
 for(const p of active(state)){const cost=STAMINA_COST[actions[p.id]??'POSITION']; const stamina=clamp((p.stamina??100)-cost,0,100); players[p.id]={...p,stamina};}
 return {...state,players};
}
function nearestOpponent(state:MatchState,p:PlayerState):PlayerState|undefined {
 return active(state).filter(x=>x.team!==p.team).sort((a,b)=>distance(a.position,p.position)-distance(b.position,p.position)||a.id.localeCompare(b.id))[0];
}
function applyPossession(state:MatchState):MatchState {
 if(state.ball.ownerId&&state.players[state.ball.ownerId]?.onPitch!==false)return state;
 const candidates=active(state).filter(p=>distance(p.position,state.ball.position)<=BALL_CONTROL_DISTANCE)
   .sort((a,b)=>distance(a.position,state.ball.position)-distance(b.position,state.ball.position)||a.id.localeCompare(b.id));
 if(!candidates[0])return state;
 const p=candidates[0];
 return {...state,ball:{...state.ball,ownerId:p.id,lastTouchId:p.id,lastTouchSide:p.team}};
}
function advanceBall(state:MatchState):MatchState {
 if(state.ball.ownerId)return state;
 const b=state.ball; const nextPos={x:b.position.x+b.velocity.x,y:b.position.y+b.velocity.y,z:Math.max(0,b.position.z+b.velocity.z)};
 return {...state,ball:{...b,position:nextPos,velocity:{x:b.velocity.x*BALL_DECELERATION,y:b.velocity.y*BALL_DECELERATION,z:b.velocity.z*BALL_DECELERATION}}};
}
function restartState(state:MatchState):MatchState {
 if(!state.restart)return state;
 const side=state.restart.side; const ids=state.teams[side].playerIds.slice().filter(id=>state.players[id]?.onPitch!==false).sort();
 const taker=ids.find(id=>state.players[id]?.role==='GK'&&state.restart?.type==='goal_kick')??ids[0];
 const point=state.restart.point;
 return {...state,restart:null,ball:{...state.ball,position:{x:point.x,y:point.y,z:0},velocity:{x:0,y:0,z:0},ownerId:taker,lastTouchId:taker,lastTouchSide:side}};
}
function resolveBoundary(state:MatchState):MatchState {
 const b=state.ball; const {x,y}=b.position;
 if(x>=0&&x<=state.pitch.length&&y>=0&&y<=state.pitch.width)return state;
 const last=b.lastTouchSide??'HOME';
 const other=last==='HOME'?'AWAY':'HOME';
 let event:'corner'|'goal_kick'|'throw_in'; let side:TeamSide;
 if(y<0||y>state.pitch.width){event='throw_in';side=other;}
 else if(x<0){event=last==='HOME'?'corner':'goal_kick';side=last==='HOME'?'AWAY':'HOME';}
 else {event=last==='AWAY'?'corner':'goal_kick';side=last==='AWAY'?'HOME':'AWAY';}
 const point=event==='throw_in'?{x:clamp(x,0,state.pitch.length),y:y<0?0:state.pitch.width}:event==='corner'?{x:side==='HOME'?0:state.pitch.length,y:y<state.pitch.width/2?0:state.pitch.width}:{x:side==='HOME'?5.5:state.pitch.length-5.5,y:state.pitch.width/2};
 let next={...state,ball:{...b,position:{x:clamp(x,0,state.pitch.length),y:clamp(y,0,state.pitch.width),z:0},velocity:{x:0,y:0,z:0},ownerId:null},restart:{type:event,side,point} as MatchState['restart']};
 next=withTeamStat(next,side,event==='corner'?'corners':event==='throw_in'?'throwIns':'goalKicks');
 return addEvent(next,{type:event,teamId:side,position:point,description:event});
}
function resolveShot(state:MatchState,player:PlayerState):MatchState {
 let next=withTeamStat(state,player.team,'shots'); next=withPlayerStat(next,player.id,'shots');
 const opponents=active(next).filter(p=>p.team!==player.team); const pressure=Math.min(...opponents.map(p=>distance(p.position,player.position)),99);
 const xG=shotXG(next.pitch,player.team,player.position,pressure);
 next=withTeamStat(next,player.team,'xG',xG); next=withPlayerStat(next,player.id,'xG',xG);
 next=addEvent(next,{type:'shot',playerId:player.id,teamId:player.team,xG,position:player.position,description:'shot'});
 const [roll,seed]=nextRandom(next.seed); next={...next,seed};
 const gk=active(next).filter(p=>p.team!==player.team&&p.role==='GK').sort((a,b)=>a.id.localeCompare(b.id))[0];
 const gkSkill=gk?(gk.attributes?.goalkeeper??45)+(gk.attributes?.reflexes??45)+(gk.attributes?.gkPositioning??45):45;
 const saveChance=clamp(0.28+gkSkill/500+(1-xG)*0.12,0.2,0.72);
 if(gk&&roll<saveChance){
  next=withTeamStat(next,player.team,'shotsOnTarget'); next=withPlayerStat(next,player.id,'shotsOnTarget');
  next=withPlayerStat(next,gk.id,'saves'); next=addEvent(next,{type:'shot_on_target',playerId:player.id,teamId:player.team,xG,position:player.position,description:'shot on target'});
  next=addEvent(next,{type:'save',playerId:gk.id,teamId:gk.team,relatedPlayerId:player.id,position:gk.position,description:'save'});
  return {...next,ball:{...next.ball,ownerId:null,position:{...gk.position,z:0},velocity:{x:player.team==='HOME'?-5:5,y:0,z:1}}};
 }
 const [goalRoll,seed2]=nextRandom(next.seed); next={...next,seed:seed2};
 const finishing=(player.attributes?.finishing??60)/100;
 const goalChance=clamp(xG*(0.72+finishing*0.35),0.01,0.75);
 if(goalRoll<goalChance){
  const scorer=player.team; next={...next,score:{...next.score,[scorer==='HOME'?'home':'away']:next.score[scorer==='HOME'?'home':'away']+1}};
  next=withTeamStat(next,scorer,'goals'); next=withPlayerStat(next,player.id,'goals');
  next=addEvent(next,{type:'goal',playerId:player.id,teamId:scorer,xG,position:{x:scorer==='HOME'?next.pitch.length:0,y:next.pitch.width/2},description:'goal'});
  const assist=next.football!.lastAssistBySide[scorer]; if(assist&&assist!==player.id){next=withPlayerStat(next,assist,'assists');next=addEvent(next,{type:'assist',playerId:assist,teamId:scorer,relatedPlayerId:player.id,description:'assist'});}
  return {...next,ball:{...next.ball,position:{x:next.pitch.length/2,y:next.pitch.width/2,z:0},velocity:{x:0,y:0,z:0},ownerId:null},restart:{type:'kickoff',side:scorer==='HOME'?'AWAY':'HOME',point:{x:next.pitch.length/2,y:next.pitch.width/2}}};
 }
 next=withTeamStat(next,player.team,'shotsOnTarget',roll>0.45?1:0);
 next=withPlayerStat(next,player.id,'shotsOnTarget',roll>0.45?1:0);
 return addEvent(next,{type:roll>0.45?'shot_on_target':'shot_off_target',playerId:player.id,teamId:player.team,xG,position:player.position,description:roll>0.45?'shot on target':'shot off target'});
}
function resolveOwnerAction(state:MatchState,owner:PlayerState):MatchState {
 const f=state.football!; const cd=f.actionCooldowns[owner.id]??0;
 if(cd>0)return {...state,football:{...f,actionCooldowns:{...f.actionCooldowns,[owner.id]:cd-1}}};
 const [roll,seed]=nextRandom(state.seed); let next={...state,seed};
 const decision=chooseFootballAction(next,owner.id,f.tactics[owner.team],roll);
 next={...next,football:{...next.football!,actionCooldowns:{...next.football!.actionCooldowns,[owner.id]:2}}};
 if(decision.action==='SHOOT')return resolveShot(next,owner);
 if(decision.action==='PASS'&&decision.targetId){
  const target=next.players[decision.targetId]; if(target){
   const dir=direction(owner.position,target.position); next=withTeamStat(next,owner.team,'passes');next=withPlayerStat(next,owner.id,'passes');
   const success=distance(owner.position,target.position)<28 && roll>0.12;
   next=withPlayerStat(next,owner.id,'successfulPasses',success?1:0);next=withTeamStat(next,owner.team,'successfulPasses',success?1:0);
   next=addEvent(next,{type:'pass',playerId:owner.id,teamId:owner.team,relatedPlayerId:target.id,position:owner.position,description:'pass'});
   if(success){next={...next,football:{...next.football!,lastAssistBySide:{...next.football!.lastAssistBySide,[owner.team]:owner.id}},ball:{...next.ball,ownerId:null,lastTouchId:owner.id,lastTouchSide:owner.team,velocity:{x:dir.x*12,y:dir.y*12,z:0}}};}
   else next={...next,ball:{...next.ball,ownerId:null,lastTouchId:owner.id,lastTouchSide:owner.team,velocity:{x:dir.x*9,y:dir.y*9,z:0}}};
   return next;
  }
 }
 const opponent=nearestOpponent(next,owner);
 if(opponent&&distance(owner.position,opponent.position)<2.2){
  const [tackleRoll,seed2]=nextRandom(next.seed); next={...next,seed:seed2};
  if(tackleRoll<0.28+(owner.attributes?.dribbling??60)/500){
   next=withTeamStat(next,opponent.team,'tackles'); next=withPlayerStat(next,opponent.id,'tackles');
   next=addEvent(next,{type:'tackle',playerId:opponent.id,teamId:opponent.team,relatedPlayerId:owner.id,position:owner.position,description:'tackle'});
   return {...next,ball:{...next.ball,ownerId:opponent.id,lastTouchId:opponent.id,lastTouchSide:opponent.team}};
  }
 }
 next=withPlayerStat(next,owner.id,'dribbles'); next=addEvent(next,{type:'dribble',playerId:owner.id,teamId:owner.team,position:owner.position,description:'dribble'});
 const goalDirection=owner.team==='HOME'?1:-1; const stamina=owner.stamina??100; const pace=(owner.attributes?.pace??65)/100;
 const step=(2.2+pace*1.8)*(stamina/100); const pos={x:clamp(owner.position.x+goalDirection*step,0,next.pitch.length),y:owner.position.y};
 const players={...next.players,[owner.id]:{...owner,position:pos,velocity:{x:goalDirection*step,y:0}}};
 return {...next,players,ball:{...next.ball,position:{...pos,z:0},lastTouchId:owner.id,lastTouchSide:owner.team}};
}
export function runFootballTick(state:MatchState):MatchState {
 if(!state.football)return state;
 if(state.phase==='full_time')return state;
 let next=restartState(state);
 if(next.tick===0&&next.football!.events.length===0)next=addEvent(next,{type:'kickoff',teamId:'HOME',position:next.ball.position,description:'kickoff'});
 if(next.tick===2700){
  next=addEvent(next,{type:'half_time',description:'half time'});
  return {...next,phase:'halftime',clockSeconds:2700,tick:2700};
 }
 if(next.phase==='halftime'){ next={...next,phase:'second_half'}; }
 const owner=next.ball.ownerId?next.players[next.ball.ownerId]:undefined;
 if(owner&&owner.onPitch!==false)next=resolveOwnerAction(next,owner);
 else {next=advanceBall(next);next=applyPossession(next);}
 next=movePlayers(next);
 const actionMap:Record<string,typeof STAMINA_COST[keyof typeof STAMINA_COST]>={};
 for(const p of active(next)){actionMap[p.id]=p.id===next.ball.ownerId?'DRIBBLE':distance(p.position,next.ball.position)<18?'CHASE':'POSITION';}
 next=consumeStamina(next,actionMap);
 if(next.ball.ownerId)next={...next,ball:{...next.ball,position:{...next.players[next.ball.ownerId].position,z:0}}};
 if(!next.ball.ownerId)next=resolveBoundary(next);
 const nextTick=next.tick+1; const nextClock=next.clockSeconds+1;
 if(nextTick>=5400){
  next=addEvent(next,{type:'full_time',description:'full time'});
  return {...next,tick:5400,clockSeconds:5400,phase:'full_time'};
 }
 return {...next,tick:nextTick,clockSeconds:nextClock,phase:nextClock>=2700?'second_half':'first_half'};
}
