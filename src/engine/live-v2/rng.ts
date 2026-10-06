export type RngState = { seed: number };
const UINT32 = 0x100000000;
function assertSeed(seed:number):void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('live-v2 rng: seed must be an unsigned 32-bit integer');
}
export function nextRandom(state:RngState):[number,RngState] {
  assertSeed(state.seed);
  const nextSeed=(Math.imul(1664525,state.seed)+1013904223)>>>0;
  return [nextSeed/UINT32,{seed:nextSeed}];
}
export function randomSequence(state:RngState,count:number):[number[],RngState] {
  if(!Number.isInteger(count)||count<0) throw new Error('live-v2 rng: invalid count');
  const values:number[]=[]; let current=state;
  for(let i=0;i<count;i++){const [value,next]=nextRandom(current);values.push(value);current=next;}
  return [values,current];
}
