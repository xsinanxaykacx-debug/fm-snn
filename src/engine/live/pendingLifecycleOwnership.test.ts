import { describe, it } from 'vitest';
import { simulateMatchLive } from './liveMatch';
import { generateGameData } from '../data/generateData';
import type { LiveMatchState } from './types';

const RUN = process.env.RUN_LIVE_DIAGNOSTIC === '1';
const SEED = 1008;
const CYCLE_START = 44360;
const CYCLE_END = 45930;

interface Change {
  tick:number; rng:number; prev:string|null; next:string|null;
  prevClub:string|null; nextClub:string|null;
  intent:string|null; reason:string|null;
  vx:number; vy:number; moving:boolean;
  lastTouch:string|null; lastTouchClub:string|null;
}

describe.skipIf(!RUN)('Pending lifecycle + ownership cycle', () => {
  it('captures recovery lifecycle and ownership source without changing production', () => {
    const data = generateGameData();
    const clubs = Object.values(data.clubs);
    for (const p of Object.values(data.players)) {
      p.condition=100; p.fatigue=0; p.injuryWeeks=0; p.suspensionWeeks=0;
      p.sentOff=false; p.injured=false; p.redCard=false;
    }

    const changes: Change[] = [];
    const starts:any[]=[]; const ends:any[]=[]; const active:any[]=[];
    let finalLooseBallRecoveries=0, finalRecoveries=0, totalTicks=0;
    let prevOwner:string|null=null, prevPending:string|null=null;

    simulateMatchLive(clubs[0], clubs[1], data.players, {
      seed: SEED,
      onTick:(state:LiveMatchState)=>{
        totalTicks=state.tick+1;
        finalLooseBallRecoveries=state.stats.counterPressLooseBallRecoveries;
        finalRecoveries=state.stats.counterPressRecoveries;
        const pending=state.transition.pendingLooseBallRecoveryPlayerId;
        const pendingClub=state.transition.pendingLooseBallRecoveryClubId;
        const owner=state.ball.ownerId;

        if(pending) active.push({tick:state.tick,pending,pendingClub,owner,
          loose:state.stats.counterPressLooseBallRecoveries,total:state.stats.counterPressRecoveries});
        if(!prevPending && pending) starts.push({tick:state.tick,pending,pendingClub,owner,
          loose:state.stats.counterPressLooseBallRecoveries,total:state.stats.counterPressRecoveries});
        if(prevPending && !pending) ends.push({tick:state.tick,owner,
          loose:state.stats.counterPressLooseBallRecoveries,total:state.stats.counterPressRecoveries});

        if(state.tick>=CYCLE_START && state.tick<=CYCLE_END && owner!==prevOwner){
          const p=owner?state.players[owner]:null;
          const d=owner?state.decisions[owner]?.decision:null;
          changes.push({
            tick:state.tick,rng:state.rng.counter,prev:prevOwner,next:owner,
            prevClub:prevOwner?state.players[prevOwner]?.clubId??null:null,
            nextClub:p?.clubId??null,intent:p?.currentIntent??null,
            reason:d?.reason??null,vx:state.ball.velocity.x,vy:state.ball.velocity.y,
            moving:state.ball.isMoving,lastTouch:state.ball.lastTouchId,
            lastTouchClub:state.ball.lastTouchClubId
          });
        }
        prevOwner=owner; prevPending=pending;
      }
    });

    console.log('\n=====================================================\nBÖLÜM A — PENDING LIFECYCLE\n=====================================================\n');
    console.log('pending aktif tick sayısı:',active.length);
    console.log('pending start olayı:',starts.length);
    console.log('pending end olayı:',ends.length);
    console.log('total ticks:',totalTicks);
    console.log('counterPressLooseBallRecoveries:',finalLooseBallRecoveries);
    console.log('counterPressRecoveries:',finalRecoveries);

    console.log('\n--- PENDING START OLAYLARI ---');
    console.table(starts);
    console.log('\n--- PENDING END OLAYLARI ---');
    console.table(ends);

    const cls={pass:0,dribble:0,looseBall:0,other:0,unknown:0};
    for(const c of changes){
      if(c.next===null) cls.looseBall++;
      else if(c.intent==='pass') cls.pass++;
      else if(c.intent==='dribble') cls.dribble++;
      else if((c.intent==='hold'||c.intent==='move') && !c.moving && c.vx===0 && c.vy===0) cls.looseBall++;
      else if(c.intent==='hold'||c.intent==='move') cls.other++;
      else cls.unknown++;
    }

    const diffs:number[]=[];
    for(let i=1;i<changes.length;i++) diffs.push(changes[i].tick-changes[i-1].tick);
    const hist=new Map<number,number>();
    for(const d of diffs) hist.set(d,(hist.get(d)??0)+1);

    console.log('\n=====================================================\nBÖLÜM B — OWNERSHIP CYCLE\n=====================================================\n');
    console.log('ownership change sayısı:',changes.length);
    console.log('\n--- OWNERSHIP DEĞİŞİM SINIFLANDIRMASI ---');
    console.log('PASS:',cls.pass,'DRIBBLE:',cls.dribble,'LOOSE-BALL:',cls.looseBall,'OTHER:',cls.other,'UNKNOWN:',cls.unknown);
    console.log('\n--- TÜM OWNERSHIP DEĞİŞİMLERİ ---');
    console.table(changes.map(c=>({tick:c.tick,rng:c.rng,prev:c.prev?.slice(-5)??'null',
      next:c.next?.slice(-5)??'null',intent:c.intent,reason:c.reason,
      vx:+c.vx.toFixed(2),vy:+c.vy.toFixed(2),moving:c.moving,lastTouch:c.lastTouch?.slice(-5)??'null'})));
    console.log('\n--- TICK FARKLARI ---');
    console.table([...hist.entries()].map(([delta,count])=>({deltaTicks:delta,count,saniye:delta*.1}))
      .sort((a,b)=>b.count-a.count).slice(0,20));

    console.log('\n=== ÖZET ===');
    console.log(JSON.stringify({seed:SEED,pending:{activeTicks:active.length,startEvents:starts.length,endEvents:ends.length,looseBallRecoveries:finalLooseBallRecoveries,recoveries:finalRecoveries},
      ownershipCycle:{window:[CYCLE_START,CYCLE_END],changeCount:changes.length,classification:cls,
        meanDelta:diffs.length?diffs.reduce((a,b)=>a+b,0)/diffs.length:0}},null,2));
  }, 60*60*1000);
});
