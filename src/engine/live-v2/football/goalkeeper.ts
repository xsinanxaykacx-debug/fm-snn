import type { PlayerState } from '../state';
import { clamp } from './geometry';

export function goalkeeperSaveChance(gk:PlayerState,distanceToGoal:number,angleFactor:number):number{
 const a=gk.attributes;
 const skill=((a?.goalkeeper??45)+(a?.reflexes??45)+(a?.gkPositioning??45)+(a?.handling??45))/400;
 const stamina=clamp((gk.stamina??100)/100,0.55,1);
 const distanceFactor=clamp(0.12+distanceToGoal/120,0.12,0.48);
 return clamp(0.16+skill*0.52+distanceFactor*0.18+angleFactor*0.1*stamina,0.2,0.82);
}
