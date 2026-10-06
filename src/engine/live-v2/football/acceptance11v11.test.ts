import { describe, expect, it } from 'vitest';
import { createMatchState } from '../adapters/matchStateFactory';
import { simulateMatchV2 } from '../simulation';
import type { Pitch } from '../state';

const pitch:Pitch={length:104,width:64,goalWidth:7.32,goalHeight:2.44,goalAreaDepth:5.5};
function make(seed:number){
 return createMatchState(
  {clubId:'H',players:Array.from({length:11},(_,i)=>({id:'h'+i}))},
  {clubId:'A',players:Array.from({length:11},(_,i)=>({id:'a'+i}))},
  {seed},pitch
 );
}
describe('live-v2 F11 11v11 acceptance',()=>{
 it('runs five full deterministic matches with 22-player invariants',()=>{
  const finals=[1,2,3,4,5].map(s=>simulateMatchV2(make(s),5400));
  finals.forEach(final=>{
   expect(Object.keys(final.players)).toHaveLength(22);
   expect(Object.values(final.players).filter(p=>p.onPitch!==false&&p.team==='HOME').length).toBeLessThanOrEqual(11);
   expect(Object.values(final.players).filter(p=>p.onPitch!==false&&p.team==='AWAY').length).toBeLessThanOrEqual(11);
   expect(final.phase).toBe('full_time');
   expect(final.football?.lastChaseCount).toBeLessThanOrEqual(3);
   expect(final.football?.events.length).toBeGreaterThan(0);
   Object.values(final.players).forEach(p=>expect(Number.isFinite(p.position.x)&&Number.isFinite(p.position.y)&&Number.isFinite(p.stamina??0)).toBe(true));
  });
 });
 it('is exactly deterministic for the same seed',()=>{
  const a=simulateMatchV2(make(777),5400);
  const b=simulateMatchV2(make(777),5400);
  expect(a).toEqual(b);
 });
});
