import { describe, expect, it } from 'vitest';
import { penaltySpot } from './penalty';
const pitch={length:104,width:64,goalWidth:7.32,goalHeight:2.44,goalAreaDepth:5.5};
describe('live-v2 penalty',()=>{
 it('uses the 11m penalty spot from the defending goal line',()=>{
  expect(penaltySpot(pitch,'HOME')).toEqual({x:11,y:32});
  expect(penaltySpot(pitch,'AWAY')).toEqual({x:93,y:32});
 });
});
