import type { MatchState } from '../state';
import { clamp } from './geometry';

export const STAMINA_COSTS={POSITION:0.015,CHASE:0.055,PASS:0.04,DRIBBLE:0.07,TACKLE:0.11,INTERCEPT:0.08,SHOOT:0.05,PRESS:0.08,SPRINT:0.12} as const;
export function staminaModifier(stamina:number):number{
 const s=clamp(stamina,0,100); if(s>=70)return 1; if(s>=50)return 0.96; if(s>=30)return 0.88; return 0.72;
}
export function applyStaminaCost(state:MatchState,playerId:string,action:keyof typeof STAMINA_COSTS):MatchState{
 const p=state.players[playerId]; if(!p)return state;
 return {...state,players:{...state.players,[playerId]:{...p,stamina:clamp((p.stamina??100)-STAMINA_COSTS[action],0,100)}}};
}
