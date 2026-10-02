// src/engine/live/diagnostics/controlBallTrace.ts
//
// DIAGNOSTIC ONLY — controlBall mutation trace.
// Production modülleri bu dosyayı import etmez.

export type ControlBallCaller =
  | 'resolveLooseBallControl'
  | 'applyTackleWon'
  | 'updateSetPieceStatus'
  | 'handlePassAction'
  | 'kickoff'
  | 'other'
  | 'NONE';

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
  ['kickoff', /(?:kickoff|createSetPieceForMatch|handleGoal)/],
];

export function detectCallerFromStack(stack: string): ControlBallCaller {
  for (const [caller, pattern] of CALLER_PATTERNS) {
    if (pattern.test(stack)) return caller;
  }
  return 'other';
}

export class ControlBallTraceBuffer {
  private seq = 0;
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
      seq: this.seq++,
      ownerId,
      clubId,
      caller: detectCallerFromStack(stack),
      ballX,
      ballY,
      previousOwnerId,
    });
  }

  drainAfter(sequenceExclusive: number): readonly ControlBallTrace[] {
    return this.calls.filter(call => call.seq > sequenceExclusive);
  }

  getLastSeq(): number {
    return this.seq - 1;
  }

  clear(): void {
    this.calls.length = 0;
    this.seq = 0;
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
