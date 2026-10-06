import { describe, expect, it } from 'vitest';
import { chooseSetPieceTaker, restartPoint } from './setPiece';
import type { MatchState } from '../state';
const state={} as MatchState;
describe('live-v2 set pieces',()=>{
 it('chooses the highest relevant taker with stable id tie-break',()=>{
  const s={...state,pitch:{length:104,width:64,goalWidth:7.32,goalHeight:2.44,goalAreaDepth:5.5},players:{
   a:{id:'a',team:'HOME',position:{x:40,y:20},velocity:{x:0,y:0},attributes:{crossing:80,passing:60},onPitch:true},
   b:{id:'b',team:'HOME',position:{x:40,y:20},velocity:{x:0,y:0},attributes:{crossing:80,passing:60},onPitch:true},
  }} as MatchState;
  expect(chooseSetPieceTaker(s,'HOME','corner')).toBe('a');
 });
 it('places restarts on football geometry',()=>{
  expect(restartPoint(state,'HOME','corner',{x:0,y:0})).toEqual({x:0,y:0});
  expect(restartPoint(state,'AWAY','goal_kick',{x:0,y:0}).x).toBe(98.5);
 });
});
