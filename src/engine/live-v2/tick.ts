import type { MatchState } from './state';
import { runFootballTick } from './football/engine';
import { perceive } from './perception';
import { decide } from './decision';
import { resolveActions } from './actionResolution';
import { updatePossession } from './possession';
import { applyMovement, type MovementIntent } from './movement';
import { stepBall } from './ball';
import { resolveBoundary } from './boundary';
import { applyRestart, playRestart } from './restart';

function phaseAt(clockSeconds:number):MatchState['phase'] {
  if(clockSeconds>=5400)return'full_time';
  if(clockSeconds===2700)return'halftime';
  if(clockSeconds>2700)return'second_half';
  return clockSeconds===0?'kickoff':'first_half';
}
function horizontalSpeed(v:MatchState['ball']['velocity']):number{return Math.hypot(v.x,v.y);}
function passTarget(state:MatchState,playerId:string):{x:number;y:number}|null{
 const player=state.players[playerId]; if(!player)return null;
 return Object.values(state.players).filter(p=>p.team===player.team&&p.id!==player.id)
  .sort((a,b)=>{const da=Math.hypot(a.position.x-player.position.x,a.position.y-player.position.y),db=Math.hypot(b.position.x-player.position.x,b.position.y-player.position.y);return da!==db?da-db:a.id.localeCompare(b.id);})[0]?.position??null;
}
export function runTick(state:MatchState):MatchState {
 if(state.football)return runFootballTick(state);
 const liveState=playRestart(state);
 const lastBallVelocityBefore={...liveState.ball.velocity};
 let lastZeroVelocitySource:MatchState['diagnostics']['lastZeroVelocitySource']=null;
 const previousBallPosition={...liveState.ball.position,z:liveState.ball.position.z??0};
 const ballStepped=stepBall(liveState);
 const boundary=resolveBoundary(liveState.pitch,previousBallPosition,ballStepped.ball.position,ballStepped.ball,liveState.players);
 let liveForDecision=ballStepped,restartActivated=false;
 if(horizontalSpeed(ballStepped.ball.velocity)===0&&horizontalSpeed(liveState.ball.velocity)>0)lastZeroVelocitySource='stepBall';
 if(boundary.event){
  const restarted=applyRestart(ballStepped,boundary.event);
  if(horizontalSpeed(restarted.ball.velocity)===0&&horizontalSpeed(ballStepped.ball.velocity)>0)lastZeroVelocitySource='applyRestart';
  liveForDecision=playRestart({...restarted,events:[...ballStepped.events,boundary.event]});restartActivated=true;
 }
 const perceptions=perceive(liveForDecision); const decisions:ReturnType<typeof decide>=decide(liveForDecision,perceptions);
 const withActions=resolveActions(liveForDecision,decisions);
 const actionDecision=decisions.find(d=>d.action==='PASS'||d.action==='SHOOT'||d.action==='DRIBBLE'||d.action==='CHASE');
 const lastAction=actionDecision?.action==='PASS'||actionDecision?.action==='SHOOT'||actionDecision?.action==='DRIBBLE'||actionDecision?.action==='CHASE'?actionDecision.action:null;
 const passDecision=decisions.find(d=>d.action==='PASS');
 if(withActions.ball.velocity.x===0&&withActions.ball.velocity.y===0&&(lastAction==='PASS'||lastAction==='SHOOT'||lastAction==='DRIBBLE'))lastZeroVelocitySource=lastAction==='PASS'?'resolvePass':lastAction==='SHOOT'?'resolveShot':'resolveDribble';
 const intents:MovementIntent[]=decisions; const moved=applyMovement(withActions,intents);
 const next=restartActivated?moved:updatePossession(moved); const nextClock=next.clockSeconds+1; const nextPhase=phaseAt(nextClock);
 return {...next,seed:withActions.seed,clockSeconds:nextClock,tick:next.tick+1,phase:nextPhase,diagnostics:{lastPhase:nextPhase,lastTick:next.tick+1,lastBallPosition:{...next.ball.position},lastBallVelocity:{...next.ball.velocity},lastDecisionAction:decisions[0]?.action,lastAction,lastPassTarget:passDecision?passTarget(liveForDecision,passDecision.playerId):null,lastBallVelocityBefore,lastBallVelocityAfter:{...next.ball.velocity},lastZeroVelocitySource:lastZeroVelocitySource??(horizontalSpeed(next.ball.velocity)===0?'unknown':null),perceivedPlayerCount:Object.keys(liveState.players).length,restartState:next.restart,lastBoundaryEvent:boundary.event}};
}
