import { describe, expect, it } from 'vitest';
import { createMatchState } from '../adapters/matchStateFactory';
import { runTick } from '../tick';
import type { Pitch } from '../state';

const pitch: Pitch = { length:104, width:64, goalWidth:7.32, goalHeight:2.44, goalAreaDepth:5.5 };

function state() {
  return createMatchState(
    { clubId:'H', players:Array.from({length:11},(_,i)=>({id:'h'+i})) },
    { clubId:'A', players:Array.from({length:11},(_,i)=>({id:'a'+i})) },
    { seed:7 }, pitch,
  );
}
describe('live-v2 time flow', () => {
  it('preserves state through half time and ends at tick 5400', () => {
    let current=state();
    for(let i=0;i<2700;i+=1) current=runTick(current);
    expect(current.tick).toBe(2700);
    expect(current.phase).toBe('halftime');
    expect(current.football?.events.some((event)=>event.type==='half_time')).toBe(true);
    const scoreAtHalf={...current.score};
    for(let i=0;i<2700;i+=1) current=runTick(current);
    expect(current.tick).toBe(5400);
    expect(current.phase).toBe('full_time');
    expect(current.football?.events.some((event)=>event.type==='full_time')).toBe(true);
    expect(current.score.home).toBeGreaterThanOrEqual(scoreAtHalf.home);
    expect(current.score.away).toBeGreaterThanOrEqual(scoreAtHalf.away);
  });
});
