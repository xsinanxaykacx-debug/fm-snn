import { describe, expect, it } from 'vitest';
import { finalizeStats } from './stats';
import type { FootballState } from './types';
describe('live-v2 event/stat consistency',()=>{
 it('derives possession percentages from possession ticks',()=>{
  const football={teamStats:{HOME:{shots:0,shotsOnTarget:0,goals:0,xG:0,passes:0,successfulPasses:0,tackles:0,interceptions:0,fouls:0,corners:0,throwIns:0,goalKicks:0,freeKicks:0,penalties:0,offsides:0,possessionTicks:55},AWAY:{shots:0,shotsOnTarget:0,goals:0,xG:0,passes:0,successfulPasses:0,tackles:0,interceptions:0,fouls:0,corners:0,throwIns:0,goalKicks:0,freeKicks:0,penalties:0,offsides:0,possessionTicks:45}}} as FootballState;
  expect(finalizeStats(football).possession).toEqual({home:55,away:45});
 });
 it('keeps pass accuracy safe at zero attempts',()=>{
  const f={teamStats:{HOME:{passes:0,successfulPasses:0},AWAY:{passes:2,successfulPasses:1}}} as FootballState;
  expect(finalizeStats(f).passAccuracy.home).toBe(0);
  expect(finalizeStats(f).passAccuracy.away).toBe(50);
 });
});
