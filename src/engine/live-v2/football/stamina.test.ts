import { describe, expect, it } from 'vitest';
import { applyStaminaCost } from './stamina';
import { makeSubstitution } from './substitution';
import type { MatchState } from '../state';

describe('live-v2 stamina and substitutions',()=>{
 it('clamps stamina and applies deterministic action costs',()=>{
  const p={id:'p',team:'HOME',position:{x:0,y:0},velocity:{x:0,y:0},stamina:1,onPitch:true};
  const s={...({players:{p}} as MatchState),players:{p}};
  expect(applyStaminaCost(s,'p','SPRINT').players.p.stamina).toBeCloseTo(0.88);
 });
 it('never exceeds three substitutions',()=>{
  const s={football:{substitutionsUsed:{HOME:3,AWAY:0},maxSubstitutions:3}} as MatchState;
  expect(makeSubstitution(s,'HOME','out','in')).toBe(s);
 });
});
