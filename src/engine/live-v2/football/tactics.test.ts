import { describe, expect, it } from 'vitest';
import { formationSlots } from './formation';
import { DEFAULT_TACTICS } from './setup';
import type { Pitch } from '../state';
const pitch:Pitch={length:104,width:64,goalWidth:7.32,goalHeight:2.44,goalAreaDepth:5.5};

describe('live-v2 tactics',()=>{
 it('changes defensive line deterministically',()=>{
  const deep=formationSlots('4-4-2','HOME',pitch,{...DEFAULT_TACTICS,defensiveLine:'deep'});
  const high=formationSlots('4-4-2','HOME',pitch,{...DEFAULT_TACTICS,defensiveLine:'high'});
  expect(high[1].position.x).toBeGreaterThan(deep[1].position.x);
 });
 it('changes width only for wide roles',()=>{
  const narrow=formationSlots('4-4-2','HOME',pitch,{...DEFAULT_TACTICS,width:'narrow'});
  const wide=formationSlots('4-4-2','HOME',pitch,{...DEFAULT_TACTICS,width:'wide'});
  expect(wide[5].position.y).toBeLessThan(narrow[5].position.y);
 });
 it('keeps tactics free of RNG',()=>expect({...DEFAULT_TACTICS}).toEqual({
  mentality:'balanced',pressing:'medium',tempo:'normal',width:'normal',directness:'mixed',defensiveLine:'normal'
 }));
});
