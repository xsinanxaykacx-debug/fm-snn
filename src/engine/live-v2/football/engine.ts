import type { MatchState, PlayerState, TeamSide, Vec2 } from '../state';
import { nextRandom } from '../rng';
import { distance, inPenaltyArea, shotXG, clamp } from './geometry';
import { goalkeeperSaveChance } from './goalkeeper';
import { resolvePenalty } from './penalty';
import { movementSpeedMultiplier, pressingIntensity } from './tactics';
import { isOffside } from './rules';
import { chooseFootballAction } from './action';
import { formationSlots } from './formation';
import type { FootballEvent, PlayerMatchStats, TeamMatchStats } from './types';
import { emptyPlayerStats } from './setup';
import { staminaModifier } from './stamina';
import { makeSubstitution } from './substitution';

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
function stableHash(id:string):number {
 let h=2166136261;
 for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);
 return h>>>0;
}
function chaseTarget(ball:Vec2,chaserId:string,chaseIndex:number,pitch:MatchState['pitch']):Vec2 {
 const patterns=[{x:-1.2,y:-1.2},{x:1.2,y:-1.2},{x:0,y:1.2}];
 const rotation=stableHash(chaserId)%3;
 const p=patterns[(chaseIndex+rotation)%patterns.length];
 return {x:clamp(ball.x+p.x,0,pitch.length),y:clamp(ball.y+p.y,0,pitch.width)};
}
function chaserNearOwner(state:MatchState):PlayerState|undefined {
 const ownerId=state.ball.ownerId; if(!ownerId)return undefined;
 return active(state).filter(p=>p.id!==ownerId&&p.team!==state.players[ownerId]?.team)
   .map(p=>({p,d:distance(p.position,state.players[ownerId].position)}))
   .filter(x=>x.d<2)
   .sort((a,b)=>a.d-b.d||a.p.id.localeCompare(b.p.id))[0]?.p;
}
function resolveChaserTackle(state:MatchState):MatchState {
 const ownerId=state.ball.ownerId; const owner=ownerId?state.players[ownerId]:undefined;
 const chaser=chaserNearOwner(state);
 if(!owner||!chaser)return state;
 const [roll,seed]=nextRandom(state.seed);
 let next={...state,seed};
 const tackleChance=clamp(0.28+(chaser.attributes?.tackling??55)/250,0.28,0.62);
 if(roll>=tackleChance)return next;
 next=withTeamStat(next,chaser.team,'tackles');
 next=withPlayerStat(next,chaser.id,'tackles');
 next=addEvent(next,{type:'tackle',playerId:chaser.id,teamId:chaser.team,relatedPlayerId:owner.id,position:chaser.position,description:'tackle'});
 return {...next,ball:{...next.ball,ownerId:chaser.id,lastTouchId:chaser.id,lastTouchSide:chaser.team,position:{...chaser.position,z:0}}};
}
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
   const chaseIndex=chase.indexOf(p.id);
   const target=isChase?chaseTarget(ball,p.id,chaseIndex, state.pitch):slots[index]?.position??p.position;
   const dir=direction(p.position,target);
   const pressing=state.football!.tactics[side].pressing==='high'&&isChase;
   const speed=(pressing?PRESSING_SPEED:PLAYER_SPEED)*movementSpeedMultiplier(state.football!.tactics[side])*(1+(pressing?pressingIntensity(state.football!.tactics[side])*0.08:0));
   const distanceToTarget=distance(p.position,target);
   const step=Math.min(speed,distanceToTarget);
   nextPlayers[p.id]={...p,position:{x:clamp(p.position.x+dir.x*step,0,state.pitch.length),y:clamp(p.position.y+dir.y*step,0,state.pitch.width)},velocity:{x:dir.x*step,y:dir.y*step}};
  });
 }
 const chaseCount=Object.values(nextPlayers).filter(p=>p.onPitch!==false&&p.id!==state.ball.ownerId).map(p=>distance(p.position,ball)).sort((a,b)=>a-b).slice(0,MAX_CHASE).length;
 return {...state,players:nextPlayers,football:{...state.football!,lastChaseCount:chaseCount,lastPositionCount:Math.max(0,active(state).length-1-chaseCount)}};
}
function consumeStamina(state:MatchState,actions:Record<string,keyof typeof STAMINA_COST>):MatchState {
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
 let next:MatchState={...state,ball:{...state.ball,ownerId:p.id,lastTouchId:p.id,lastTouchSide:p.team}};
 if(state.ball.lastTouchSide&&state.ball.lastTouchSide!==p.team){
  next=withTeamStat(next,p.team,'interceptions');
  next=withPlayerStat(next,p.id,'interceptions');
  next=addEvent(next,{type:'intercept',playerId:p.id,teamId:p.team,position:p.position,description:'interception'});
 }
 return next;
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
 let next:MatchState={...state,ball:{...b,position:{x:clamp(x,0,state.pitch.length),y:clamp(y,0,state.pitch.width),z:0},velocity:{x:0,y:0,z:0},ownerId:null},restart:{type:event,side,point} as MatchState['restart']};
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
 const saveChance=gk?goalkeeperSaveChance(gk,distance(gk.position,player.position),1-Math.min(1,pressure/15)):0;
 if(gk&&roll<saveChance){
  next=withTeamStat(next,player.team,'shotsOnTarget'); next=withPlayerStat(next,player.id,'shotsOnTarget');
  next=withPlayerStat(next,gk.id,'saves'); next=addEvent(next,{type:'shot_on_target',playerId:player.id,teamId:player.team,xG,position:player.position,description:'shot on target'});
  next=addEvent(next,{type:'save',playerId:gk.id,teamId:gk.team,relatedPlayerId:player.id,position:gk.position,description:'save'});
  return {...next,ball:{...next.ball,ownerId:null,position:{...gk.position,z:0},velocity:{x:player.team==='HOME'?-5:5,y:0,z:1}}};
 }
 const [goalRoll,seed2]=nextRandom(next.seed); next={...next,seed:seed2};
 const finishing=(player.attributes?.finishing??60)/100;
 const goalChance=clamp(xG*(1.35+finishing*0.35),0.01,0.75);
 if(goalRoll<goalChance){
  const scorer=player.team; next={...next,score:{...next.score,[scorer==='HOME'?'home':'away']:next.score[scorer==='HOME'?'home':'away']+1}};
  next=withTeamStat(next,scorer,'goals'); next=withPlayerStat(next,player.id,'goals'); next=withTeamStat(next,scorer,'shotsOnTarget'); next=withPlayerStat(next,player.id,'shotsOnTarget');
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
   const defenders=active(next).filter(p=>p.team!==owner.team).map(p=>p.position);
   if(isOffside(owner.team,target.position,owner.position,defenders)){
    next=withTeamStat(next,owner.team,'offsides');
    next=addEvent(next,{type:'offside',playerId:target.id,teamId:owner.team,position:target.position,description:'offside'});
    return {...next,ball:{...next.ball,ownerId:null,velocity:{x:0,y:0,z:0}},restart:{type:'goal_kick',side:owner.team==='HOME'?'AWAY':'HOME',point:{x:owner.team==='HOME'?next.pitch.length-5.5:5.5,y:next.pitch.width/2}}};
   }
   const dir=direction(owner.position,target.position); next=withTeamStat(next,owner.team,'passes');next=withPlayerStat(next,owner.id,'passes');
   const success=distance(owner.position,target.position)<28 && roll>0.12;
   next=withPlayerStat(next,owner.id,'successfulPasses',success?1:0);next=withTeamStat(next,owner.team,'successfulPasses',success?1:0);
   next=addEvent(next,{type:'pass',playerId:owner.id,teamId:owner.team,relatedPlayerId:target.id,position:owner.position,description:'pass'});
   if(success && Math.abs((owner.team==='HOME'?next.pitch.length:0)-target.position.x)<28){
    next=withTeamStat(next,owner.team,'successfulPasses',0);
    next=withPlayerStat(next,owner.id,'keyPasses');
    next=addEvent(next,{type:'key_pass',playerId:owner.id,teamId:owner.team,relatedPlayerId:target.id,position:owner.position,description:'key pass'});
   }
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
  const severity=tackleRoll>0.995?'red':tackleRoll>0.97?'yellow':tackleRoll>0.92?'foul':'none';
  if(severity!=='none'&&tackleRoll>0.88){
   next=withTeamStat(next,owner.team,'fouls');
   next=withPlayerStat(next,opponent.id,'fouls');
   next=addEvent(next,{type:'foul',playerId:opponent.id,teamId:opponent.team,relatedPlayerId:owner.id,position:owner.position,description:'foul'});
   if(severity==='yellow'||severity==='red'){
    const yellow=(opponent.yellowCards??0)+1; const red=severity==='red'||yellow>=2;
    const players={...next.players,[opponent.id]:{...opponent,yellowCards:yellow,redCard:red,onPitch:red?false:opponent.onPitch}};
    next={...next,players};
    next=withPlayerStat(next,opponent.id,'yellow');
    next=addEvent(next,{type:red?'red':'yellow',playerId:opponent.id,teamId:opponent.team,position:opponent.position,description:red?'red':'yellow'});
    if(red)next=withPlayerStat(next,opponent.id,'red');
   }
   if(inPenaltyArea(next.pitch,opponent.team,owner.position)){
    next=withTeamStat(next,owner.team,'penalties');
    next={...next,football:{...next.football!,pendingPenalty:{side:owner.team}}};
    return addEvent(next,{type:'penalty',teamId:owner.team,position:owner.position,description:'penalty'});
   }
   next=withTeamStat(next,owner.team,'freeKicks');
   return addEvent(next,{type:'free_kick',teamId:owner.team,position:owner.position,description:'free kick'});
  }
 }
 next=withPlayerStat(next,owner.id,'dribbles'); next=addEvent(next,{type:'dribble',playerId:owner.id,teamId:owner.team,position:owner.position,description:'dribble'});
 const goalDirection=owner.team==='HOME'?1:-1; const stamina=owner.stamina??100; const pace=(owner.attributes?.pace??65)/100;
 const step=(2.2+pace*1.8)*staminaModifier(stamina); const pos={x:clamp(owner.position.x+goalDirection*step,0,next.pitch.length),y:owner.position.y};
 const players={...next.players,[owner.id]:{...owner,position:pos,velocity:{x:goalDirection*step,y:0}}};
 return {...next,players,ball:{...next.ball,position:{...pos,z:0},lastTouchId:owner.id,lastTouchSide:owner.team}};
}
export function runFootballTick(state:MatchState):MatchState {
 if(!state.football)return state;
 if(state.phase==='full_time')return state;
 let next=restartState(state);
 if(next.tick===0&&next.football!.events.length===0)next=addEvent(next,{type:'kickoff',teamId:'HOME',position:next.ball.position,description:'kickoff'});
 if(next.tick===2700&&next.phase!=='halftime'){
  next=addEvent(next,{type:'half_time',description:'half time'});
  return {...next,phase:'halftime',clockSeconds:2700,tick:2700};
 }
 if(next.phase==='halftime'){ next={...next,phase:'second_half'}; }
 if(next.football!.pendingPenalty){ next=resolvePenalty({...next,football:{...next.football!,pendingPenalty:null}},next.football!.pendingPenalty.side); }
 const owner=next.ball.ownerId?next.players[next.ball.ownerId]:undefined;
 if(owner&&owner.onPitch!==false){
  const beforeOwner=next.ball.ownerId;
  next=resolveChaserTackle(next);
  const newOwner=next.ball.ownerId?next.players[next.ball.ownerId]:undefined;
  if(newOwner&&next.ball.ownerId!==beforeOwner){
   next=resolveOwnerAction(next,newOwner);
  }else{
   next=resolveOwnerAction(next,owner);
  }
 }
 else {next=advanceBall(next);next=applyPossession(next);}
 next=movePlayers(next);
 const actionMap:Record<string,keyof typeof STAMINA_COST>={};
 for(const p of active(next)){actionMap[p.id]=p.id===next.ball.ownerId?'DRIBBLE':distance(p.position,next.ball.position)<18?'CHASE':'POSITION';}
 next=consumeStamina(next,actionMap);
 if(next.tick>=3600&&next.tick%300===0){
  for(const side of ['HOME','AWAY'] as const){
   if(next.football!.substitutionsUsed[side]>=3)continue;
   const out=Object.values(next.players).filter(p=>p.team===side&&p.onPitch!==false&&(p.stamina??100)<25&&p.redCard!==true).sort((a,b)=>(a.stamina??100)-(b.stamina??100)||a.id.localeCompare(b.id))[0];
   const incoming=Object.values(next.players).filter(p=>p.team===side&&p.onPitch===false&&p.redCard!==true).sort((a,b)=>a.id.localeCompare(b.id))[0];
   if(out&&incoming)next=makeSubstitution(next,side,out.id,incoming.id);
  }
 }
 if(next.ball.ownerId){ const ownerPlayer=next.players[next.ball.ownerId]; next={...next,ball:{...next.ball,position:{...ownerPlayer.position,z:0}}}; next=withTeamStat(next,ownerPlayer.team,'possessionTicks'); }
 if(!next.ball.ownerId)next=resolveBoundary(next);
 const nextTick=next.tick+1; const nextClock=next.clockSeconds+1;
 if(nextTick===2700){
  next=addEvent(next,{type:'half_time',description:'half time'});
  return {...next,tick:2700,clockSeconds:2700,phase:'halftime'};
 }
 if(nextTick>=5400){
  next=addEvent(next,{type:'full_time',description:'full time'});
  return {...next,tick:5400,clockSeconds:5400,phase:'full_time'};
 }
 return {...next,tick:nextTick,clockSeconds:nextClock,phase:nextClock>=2700?'second_half':'first_half'};
}
