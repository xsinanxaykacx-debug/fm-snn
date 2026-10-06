import { describe, expect, it } from 'vitest';
import { goalkeeperSaveChance } from './goalkeeper';
import type { PlayerState } from '../state';

const gk:PlayerState={id:'gk',team:'HOME',position:{x:5,y:32},velocity:{x:0,y:0},role:'GK',stamina:100,onPitch:true,attributes:{
 passing:60,firstTouch:60,dribbling:60,crossing:60,shooting:60,finishing:60,decisions:60,vision:60,anticipation:60,positioning:60,offTheBall:60,composure:60,workRate:60,aggression:50,pace:50,acceleration:50,stamina:70,strength:60,tackling:50,marking:50,ballWinning:50,goalkeeper:80,reflexes:80,gkPositioning:80,handling:80
}};
describe('live-v2 goalkeeper',()=>{
 it('gives better keepers a higher save chance',()=>{
  const weak={...gk,attributes:{...gk.attributes!,goalkeeper:40,reflexes:40,gkPositioning:40,handling:40}};
  expect(goalkeeperSaveChance(weak,20,0.5)).toBeLessThan(goalkeeperSaveChance(gk,20,0.5));
 });
 it('clamps save chance',()=>expect(goalkeeperSaveChance(gk,0,0)).toBeGreaterThanOrEqual(0.2));
});
