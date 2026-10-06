import type { Pitch, Vec2 } from '../state';

export const GOAL_HALF_WIDTH = 3.66;
export const PENALTY_AREA_DEPTH = 16.5;
export const PENALTY_AREA_HALF_WIDTH = 20.16;

export function distance(a:Vec2,b:Vec2):number { return Math.hypot(a.x-b.x,a.y-b.y); }
export function clamp(value:number,min:number,max:number):number { return Math.max(min,Math.min(max,value)); }
export function goalX(side:'HOME'|'AWAY',pitch:Pitch):number { return side==='HOME'?pitch.length:0; }
export function inGoalMouth(pitch:Pitch,p:Vec2):boolean {
  return Math.abs(p.y-pitch.width/2)<=GOAL_HALF_WIDTH;
}
export function inPenaltyArea(pitch:Pitch,side:'HOME'|'AWAY',p:Vec2):boolean {
  const home=side==='HOME';
  const depth=home?PENALTY_AREA_DEPTH:pitch.length-PENALTY_AREA_DEPTH;
  const xOk=home?p.x<=PENALTY_AREA_DEPTH:p.x>=pitch.length-PENALTY_AREA_DEPTH;
  return xOk && Math.abs(p.y-pitch.width/2)<=PENALTY_AREA_HALF_WIDTH && Number.isFinite(depth);
}
export function shotXG(pitch:Pitch,side:'HOME'|'AWAY',from:Vec2,pressure:number):number {
  const gx=goalX(side,pitch), dx=Math.abs(gx-from.x), dy=Math.abs(pitch.width/2-from.y);
  const distanceFactor=clamp(1-dx/42,0.04,0.95);
  const angleFactor=clamp(1-dy/22,0.25,1);
  const pressureFactor=clamp(1-pressure/12,0.55,1);
  return clamp(0.04 + 0.24*distanceFactor*angleFactor*pressureFactor,0,1);
}
