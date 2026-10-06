import type { FootballState, TeamMatchStats } from './types';

export type FinalMatchStats={
 possession:{home:number;away:number};
 shots:{home:number;away:number};
 onTarget:{home:number;away:number};
 xG:{home:number;away:number};
 passes:{home:number;away:number};
 passAccuracy:{home:number;away:number};
 tackles:{home:number;away:number};
 corners:{home:number;away:number};
 offsides:{home:number;away:number};
 fouls:{home:number;away:number};
};
const n=(s:TeamMatchStats,k:keyof TeamMatchStats)=>s[k] as number;
const pct=(a:number,b:number)=>a+b===0?0:(a/(a+b))*100;
const ratio=(a:number,b:number)=>b===0?0:(a/b)*100;
export function finalizeStats(f:FootballState):FinalMatchStats{
 const h=f.teamStats.HOME,a=f.teamStats.AWAY;
 return {
  possession:{home:pct(h.possessionTicks,h.possessionTicks+a.possessionTicks),away:pct(a.possessionTicks,h.possessionTicks+a.possessionTicks)},
  shots:{home:n(h,'shots'),away:n(a,'shots')},onTarget:{home:n(h,'shotsOnTarget'),away:n(a,'shotsOnTarget')},
  xG:{home:n(h,'xG'),away:n(a,'xG')},passes:{home:n(h,'passes'),away:n(a,'passes')},
  passAccuracy:{home:ratio(n(h,'successfulPasses'),n(h,'passes')),away:ratio(n(a,'successfulPasses'),n(a,'passes'))},
  tackles:{home:n(h,'tackles'),away:n(a,'tackles')},corners:{home:n(h,'corners'),away:n(a,'corners')},
  offsides:{home:n(h,'offsides'),away:n(a,'offsides')},fouls:{home:n(h,'fouls'),away:n(a,'fouls')},
 };
}
export function countEvents(f:FootballState,type:string):number{return f.events.filter(e=>e.type===type).length;}
