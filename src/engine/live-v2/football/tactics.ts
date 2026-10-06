import type { Tactics } from './types';

export const TACTICAL_MODIFIERS={
 mentality:{defensive:-4,balanced:0,attacking:4},
 pressing:{low:0,medium:0.5,high:1.2},
 tempo:{slow:0.85,normal:1,fast:1.15},
 width:{narrow:-6,normal:0,wide:10},
 directness:{short:0.25,mixed:0.5,direct:0.75},
 defensiveLine:{deep:-8,normal:0,high:10},
} as const;

export function movementSpeedMultiplier(tactics:Tactics):number{
 return TACTICAL_MODIFIERS.tempo[tactics.tempo];
}
export function pressingIntensity(tactics:Tactics):number{
 return TACTICAL_MODIFIERS.pressing[tactics.pressing];
}
export function directPassBias(tactics:Tactics):number{
 return TACTICAL_MODIFIERS.directness[tactics.directness];
}
