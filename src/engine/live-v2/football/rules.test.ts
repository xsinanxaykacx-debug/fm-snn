import { describe, expect, it } from 'vitest';
import { isOffside, isPenaltyAreaFoul } from './rules';
import type { Pitch } from '../state';
const pitch:Pitch={length:104,width:64,goalWidth:7.32,goalHeight:2.44,goalAreaDepth:5.5};
describe('live-v2 rules',()=>{
 it('uses the second-last-defender line for offside',()=>{
  expect(isOffside('HOME',{x:78,y:32},{x:72,y:32},[{x:75,y:20},{x:76,y:44}])).toBe(true);
  expect(isOffside('HOME',{x:74,y:32},{x:72,y:32},[{x:75,y:20},{x:76,y:44}])).toBe(false);
 });
 it('uses penalty-area geometry, not a fixed 16.5m distance',()=>{
  expect(isPenaltyAreaFoul(pitch,'HOME',{x:10,y:32})).toBe(true);
  expect(isPenaltyAreaFoul(pitch,'HOME',{x:30,y:32})).toBe(false);
  expect(isPenaltyAreaFoul(pitch,'AWAY',{x:94,y:32})).toBe(true);
 });
});
