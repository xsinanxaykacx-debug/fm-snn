import { describe, expect, it } from 'vitest';
import { nextRandom, randomSequence } from './rng';

describe('live-v2 rng',()=>{
  it('same seed produces same sequence',()=>expect(randomSequence({seed:123456},8)[0]).toEqual(randomSequence({seed:123456},8)[0]));
  it('different seeds produce different sequences',()=>expect(randomSequence({seed:1},8)[0]).not.toEqual(randomSequence({seed:2},8)[0]));
  it('is deterministic and immutable',()=>{
    const s={seed:987654321}; const before={...s}; const [a,next]=nextRandom(s); const [b,nextAgain]=nextRandom(s);
    expect(a).toBe(b); expect(next).toEqual(nextAgain); expect(s).toEqual(before);
  });
  it('returns values in [0,1)',()=>expect(randomSequence({seed:42},1000)[0].every(v=>v>=0&&v<1)).toBe(true));
});
