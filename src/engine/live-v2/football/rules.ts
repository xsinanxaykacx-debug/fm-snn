import type { Pitch, TeamSide, Vec2 } from '../state';
import { inPenaltyArea } from './geometry';

export function secondLastDefenderX(side:TeamSide,defenders:Vec2[],pitch:Pitch):number{
 const xs=defenders.slice().sort((a,b)=>side==='HOME'?b.x-a.x:a.x-b.x);
 return xs[1]?.x??(side==='HOME'?pitch.length:0);
}
export function isOffside(side:TeamSide,receiver:Vec2,ballAtPass:Vec2,defenders:Vec2[]):boolean{
 if(side==='HOME'&&receiver.x<pitchLength(ballAtPass,defenders,side))return false;
 if(side==='AWAY'&&receiver.x>pitchLength(ballAtPass,defenders,side))return false;
 const line=secondLastDefenderX(side,defenders,{length:104,width:64,goalWidth:7.32,goalHeight:2.44,goalAreaDepth:5.5});
 return side==='HOME'?receiver.x>line&&receiver.x>ballAtPass.x:receiver.x<line&&receiver.x<ballAtPass.x;
}
function pitchLength(_ball:Vec2,_defenders:Vec2[],_side:TeamSide):number{return 52;}
export function isPenaltyAreaFoul(pitch:Pitch,side:TeamSide,point:Vec2):boolean{return inPenaltyArea(pitch,side,point);}
export function foulSeverity(tacklerSpeed:number,fromBehind:boolean,secondYellow:boolean):'none'|'foul'|'yellow'|'red'{
 if(secondYellow)return'red'; if(tacklerSpeed>8&&fromBehind)return'red'; if(tacklerSpeed>6||fromBehind)return'yellow'; if(tacklerSpeed>3)return'foul'; return'none';
}
