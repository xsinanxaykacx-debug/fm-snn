// src/engine/live/diagnostics/controlBallTrace.ts
//
// Diagnostic-only shared trace buffer for the v3 C-transition harness.
// No production module imports this file.

export type ControlBallCaller =
  | 'resolveLooseBallControl'
  | 'applyTackleWon'
  | 'updateSetPieceStatus'
  | 'handlePassAction'
  | 'kickoff'
  | 'other';

export interface ControlBallTrace {
  seq: number;
  ownerId: string;
  clubId: string;
  caller: ControlBallCaller;
  ballX: number;
  ballY: number;
  previousOwnerId: string | null;
}

const CALLER_PATTERNS: Array<[ControlBallCaller, RegExp]> = [
  ['resolveLooseBallControl', /resolveLooseBallControl/],
  ['applyTackleWon', /applyTackleWon/],
  ['updateSetPieceStatus', /updateSetPieceStatus/],
  ['handlePassAction', /handlePassAction/],
  ['kickoff', /(?:kickoff|createSetPieceForMatch)/],
];

export function detectCallerFromStack(stack: string): ControlBallCaller {
  for (const [caller, pattern] of CALLER_PATTERNS) {
    if (pattern.test(stack)) return caller;
  }
  return 'other';
}

export class ControlBallTraceBuffer {
  private nextSequence = 0;
  private readonly calls: ControlBallTrace[] = [];

  record(
    ownerId: string,
    clubId: string,
    ballX: number,
    ballY: number,
    previousOwnerId: string | null,
    stack: string,
  ): void {
    this.calls.push({
      seq: this.nextSequence++,
      ownerId,
      clubId,
      caller: detectCallerFromStack(stack),
      ballX,
      ballY,
      previousOwnerId,
    });
  }

  getSince(sequenceExclusive: number): readonly ControlBallTrace[] {
    return this.calls.filter(call => call.seq > sequenceExclusive);
  }

  getLastSequence(): number {
    return this.nextSequence - 1;
  }

  clear(): void {
    this.calls.length = 0;
    this.nextSequence = 0;
  }
}

export const traceBuffer = new ControlBallTraceBuffer();

export function recordControlBallTrace(
  ownerId: string,
  clubId: string,
  ballX: number,
  ballY: number,
  previousOwnerId: string | null,
  stack: string,
): void {
  traceBuffer.record(
    ownerId,
    clubId,
    ballX,
    ballY,
    previousOwnerId,
    stack,
  );
}
