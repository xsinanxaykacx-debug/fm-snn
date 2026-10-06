import { describe, expect, it } from 'vitest';
import { decide } from './decision';
import { perceive } from './perception';
import type { MatchState } from './state';

function state(): MatchState {
  return {
    seed: { seed: 123456 },
    clockSeconds:0,tick:0,phase:'first_half',
    pitch:{length:104,width:64,goalWidth:7.32,goalHeight:2.44,goalAreaDepth:5.5},
    score:{home:0,away:0},
    ball:{position:{x:50,y:32,z:0},velocity:{x:0,y:0,z:0},ownerId:'h1',lastTouchId:'h1',lastTouchSide:'HOME'},
    players:{
      h1:{id:'h1',team:'HOME',position:{x:90,y:32},velocity:{x:0,y:0}},
      h2:{id:'h2',team:'HOME',position:{x:70,y:20},velocity:{x:0,y:0}},
      a1:{id:'a1',team:'AWAY',position:{x:20,y:20},velocity:{x:0,y:0}},
    },
    teams:{HOME:{id:'home',side:'HOME',playerIds:['h1','h2']},AWAY:{id:'away',side:'AWAY',playerIds:['a1']}},
    restart:null,events:[],diagnostics:{lastPhase:'first_half',lastTick:0,lastBallPosition:{x:50,y:32,z:0},lastBallVelocity:{x:0,y:0,z:0}},
  };
}
describe('live-v2 decision',()=>{
  it('owner near goal chooses shot',()=>expect(decide(state(),perceive(state())).find(i=>i.playerId==='h1')?.action).toBe('SHOOT'));
  it('non-owner chases ball',()=>expect(decide(state(),perceive(state())).find(i=>i.playerId==='h2')?.action).toBe('CHASE'));
  it('pressured owner chooses pass',()=>{
    const s=state(); const p={...s,players:{...s.players,a1:{...s.players.a1,position:{x:92,y:32}}}};
    expect(decide(p,perceive(p)).find(i=>i.playerId==='h1')?.action).toBe('PASS');
  });
  it('owner away from goal dribbles',()=>{
    const s=state(); const p={...s,players:{...s.players,h1:{...s.players.h1,position:{x:50,y:32}}}};
    expect(decide(p,perceive(p)).find(i=>i.playerId==='h1')?.action).toBe('DRIBBLE');
  });
  it('is deterministic',()=>expect(decide(state(),perceive(state()))).toEqual(decide(state(),perceive(state()))));
});
