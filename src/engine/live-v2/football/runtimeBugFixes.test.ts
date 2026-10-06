import { describe, expect, it } from 'vitest';
import { createMatchState } from '../adapters/matchStateFactory';
import { runFootballTick } from './engine';
import { chooseFootballAction } from './action';
import { DEFAULT_TACTICS } from './setup';
import type { Pitch, PlayerState } from '../state';

const pitch:Pitch={length:104,width:64,goalWidth:7.32,goalHeight:2.44,goalAreaDepth:5.5};
function make(){
 return createMatchState(
  {clubId:'H',players:Array.from({length:14},(_,i)=>({id:'h'+i}))},
  {clubId:'A',players:Array.from({length:14},(_,i)=>({id:'a'+i}))},
  {seed:1},pitch
 );
}
function withPlayers(state:ReturnType<typeof make>,players:Record<string,PlayerState>){
 return {...state,players:{...state.players,...players}};
}

describe('live-v2 runtime bug fixes',()=>{
 it('gives a goalkeeper the deterministic defender-pass decision and never DRIBBLE/SHOOT',()=>{
  const state=make();
  const gk=state.players['h0'];
  const decision=chooseFootballAction(state,'h0',DEFAULT_TACTICS,0.999);
  expect(gk.role).toBe('GK');
  expect(decision.action).toBe('PASS');
  expect(decision.targetId).toBeDefined();
  expect(state.players[decision.targetId!].role).toMatch(/^(DR|DL|WBR|WBL|DC|DMC)$/);
 });
 it('distributes the three CHASE targets instead of sending all three to the ball center',()=>{
  let state=make();
  state={...state,ball:{...state.ball,position:{x:50,y:32,z:0},ownerId:'h0'}};
  state=withPlayers(state,{
   h0:{...state.players.h0,position:{x:50,y:32}},
   a0:{...state.players.a0,position:{x:35,y:32}},
   a1:{...state.players.a1,position:{x:35,y:32}},
   a2:{...state.players.a2,position:{x:35,y:32}},
  });
  const next=runFootballTick(state);
  const positions=['a0','a1','a2'].map(id=>next.players[id].position).map(p=>`${p.x.toFixed(4)},${p.y.toFixed(4)}`);
  expect(new Set(positions).size).toBe(3);
 });
 it('lets a nearby CHASE player deterministically tackle the ball owner',()=>{
  let state=make();
  state={...state,ball:{...state.ball,position:{x:5,y:32,z:0},ownerId:'h0'}};
  state=withPlayers(state,{
   h0:{...state.players.h0,position:{x:5,y:32}},
   a0:{...state.players.a0,position:{x:5.5,y:32}},
  });
  const next=runFootballTick(state);
  expect(next.football!.events.some(e=>e.type==='tackle'&&e.playerId==='a0')).toBe(true);
  expect(next.ball.ownerId).toBe('a0');
 });
 it('keeps formation positions inside the pitch and bench players off the pitch',()=>{
  const state=make();
  const home=Object.values(state.players).filter(p=>p.team==='HOME');
  const away=Object.values(state.players).filter(p=>p.team==='AWAY');
  expect(home.filter(p=>p.onPitch!==false)).toHaveLength(11);
  expect(away.filter(p=>p.onPitch!==false)).toHaveLength(11);
  expect(home.filter(p=>p.onPitch===false)).toHaveLength(3);
  expect(away.filter(p=>p.onPitch===false)).toHaveLength(3);
  for(const p of [...home,...away]){
   expect(p.startingPosition!.x).toBeGreaterThanOrEqual(0);
   expect(p.startingPosition!.x).toBeLessThanOrEqual(pitch.length);
   expect(p.startingPosition!.y).toBeGreaterThan(0);
   expect(p.startingPosition!.y).toBeLessThan(pitch.width);
   expect(Number.isFinite(p.position.x)&&Number.isFinite(p.position.y)).toBe(true);
  }
 });
 it('keeps the goalkeeper from holding the ball for repeated ticks',()=>{
  let state=make();
  state={...state,ball:{...state.ball,position:{x:5,y:32,z:0},ownerId:'h0'}};
  state=withPlayers(state,{h0:{...state.players.h0,position:{x:5,y:32}}});
  for(let i=0;i<5;i++){
   state=runFootballTick(state);
   expect(state.ball.ownerId).not.toBe('h0');
  }
 });
});
