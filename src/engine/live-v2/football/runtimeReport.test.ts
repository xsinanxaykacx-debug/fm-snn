import { describe, expect, it } from 'vitest';
import { createMatchState } from '../adapters/matchStateFactory';
import { simulateMatchV2 } from '../simulation';
import { finalizeStats } from './stats';
import type { Pitch } from '../state';

const pitch:Pitch={length:104,width:64,goalWidth:7.32,goalHeight:2.44,goalAreaDepth:5.5};
function make(seed:number){
 return createMatchState(
  {clubId:'H',players:Array.from({length:14},(_,i)=>({id:'h'+i}))},
  {clubId:'A',players:Array.from({length:14},(_,i)=>({id:'a'+i}))},
  {seed},pitch
 );
}
describe('live-v2 runtime report',()=>{
 it('prints five deterministic 90-minute acceptance results',()=>{
  const rows=Array.from({length:5},(_,i)=>{
   const final=simulateMatchV2(make(900+i),5400);
   const stats=finalizeStats(final.football!);
   return {
    match:i+1,score:final.score.home+'-'+final.score.away,
    shots:stats.shots.home+stats.shots.away,onTarget:stats.onTarget.home+stats.onTarget.away,
    xG:Number((stats.xG.home+stats.xG.away).toFixed(3)),
    saves:final.football!.events.filter(e=>e.type==='save').length,
    corners:final.football!.events.filter(e=>e.type==='corner').length,
    throwIns:final.football!.events.filter(e=>e.type==='throw_in').length,
    goalKicks:final.football!.events.filter(e=>e.type==='goal_kick').length,
    freeKicks:final.football!.events.filter(e=>e.type==='free_kick').length,
    penalties:final.football!.events.filter(e=>e.type==='penalty').length,
    fouls:final.football!.events.filter(e=>e.type==='foul').length,
    yellow:final.football!.events.filter(e=>e.type==='yellow').length,
    red:final.football!.events.filter(e=>e.type==='red').length,
    homeStamina:Number((Object.values(final.players).filter(p=>p.team==='HOME'&&p.onPitch!==false).reduce((s,p)=>s+(p.stamina??0),0)/11).toFixed(2)),
    awayStamina:Number((Object.values(final.players).filter(p=>p.team==='AWAY'&&p.onPitch!==false).reduce((s,p)=>s+(p.stamina??0),0)/11).toFixed(2)),
    homeSubs:final.football!.substitutionsUsed.HOME,awaySubs:final.football!.substitutionsUsed.AWAY,
   };
  });
  console.log('LIVE_V2_RUNTIME_REPORT '+JSON.stringify(rows));
  expect(rows).toHaveLength(5);
  rows.forEach(r=>expect(r.shots).toBeGreaterThan(0));
 });
});
