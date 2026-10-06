import type { Pitch, TeamSide, Vec2 } from '../state';
export function penaltySpot(pitch:Pitch,defendingSide:TeamSide):Vec2{
 return {x:defendingSide==='HOME'?pitch.penaltyAreaDepth+(-5):pitch.length-pitch.penaltyAreaDepth+5,y:pitch.width/2};
}
