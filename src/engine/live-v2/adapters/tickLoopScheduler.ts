const assertPositiveInteger = (value: number, name: string): void => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
};

const assertNonNegativeInteger = (value: number, name: string): void => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
};

export function ticksPerFrame(frameInterval: number): number {
  assertPositiveInteger(frameInterval, 'frameInterval');
  return frameInterval;
}

export function shouldEmitFrame(tick: number, frameInterval: number): boolean {
  assertNonNegativeInteger(tick, 'tick');
  const interval = ticksPerFrame(frameInterval);
  return tick > 0 && tick % interval === 0;
}

export function totalFrames(totalTicks: number, frameInterval: number): number {
  assertNonNegativeInteger(totalTicks, 'totalTicks');
  const interval = ticksPerFrame(frameInterval);
  return Math.floor(totalTicks / interval);
}
