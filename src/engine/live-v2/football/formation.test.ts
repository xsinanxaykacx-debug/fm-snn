import { describe, expect, it } from 'vitest';
import { formationSlots } from './formation';
import type { Pitch } from '../state';
import { DEFAULT_TACTICS } from './setup';

const pitch:Pitch={length:104,width:64,goalWidth:7.32,goalHeight:2.44,goalAreaDepth:5.5};

describe('live-v2 roles and formation',()=>{
 it.each(['4-4-2','4-3-3','3-5-2','4-2-3-1'] as const)('maps %s to 11 stable role slots',formation=>{
  const home=formationSlots(formation,'HOME',pitch,DEFAULT_TACTICS);
  const away=formationSlots(formation,'AWAY',pitch,DEFAULT_TACTICS);
  expect(home).toHaveLength(11); expect(away).toHaveLength(11);
  expect(home.map(x=>x.role)).toEqual(away.map(x=>x.role));
  expect(home.every(x=>x.position.x<=52)).toBe(true);
  expect(away.every(x=>x.position.x>=52)).toBe(true);
  expect(home[0].role).toBe('GK'); expect(away[0].role).toBe('GK');
 });
});
