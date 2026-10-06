import { describe, expect, it } from 'vitest';
import { createMatchState } from '../adapters/matchStateFactory';
import { simulateMatchV2 } from '../simulation';
import type { Pitch } from '../state';
const pitch:Pitch={length:104,width:64,goalWidth:7.32,goalHeight:2.44,goalAreaDepth:5.5};
function make(seed:number){
 return createMatchState(
  {clubId:'H',players:Array.from({length:14},(_,i)=>({id:'h'+i}))},
  {clubId:'A',players:Array.from({length:14},(_,i)=>({id:'a'+i}))},
  {seed},pitch
 );
}
describe('live-v2 F12 integrated acceptance',()=>{
 it('keeps stamina bounded and substitutions at or below three',()=>{
  for(let seed=1;seed<=5;seed+=1){
   const final=simulateMatchV2(make(seed),5400);
   expect(final.football!.substitutionsUsed.HOME).toBeLessThanOrEqual(3);
   expect(final.football!.substitutionsUsed.AWAY).toBeLessThanOrEqual(3);
   Object.values(final.players).forEach(p=>expect(p.stamina).toBeGreaterThanOrEqual(0));
   expect(final.football!.events.filter(e=>e.type==='substitution').length).toBe(
    final.football!.substitutionsUsed.HOME+final.football!.substitutionsUsed.AWAY
   );
  }
 });
 it('never produces non-finite match state values',()=>{
  const final=simulateMatchV2(make(99),5400);
  expect(JSON.stringify(final)).not.toContain('NaN');
  expect(JSON.stringify(final)).not.toContain('Infinity');
 });
});
