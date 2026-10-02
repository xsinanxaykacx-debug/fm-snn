import type { LiveMatchState, MatchEvent } from '../../types';
import type { BoundaryOutcome, DetectEventInput } from '../events';

export interface ApplyPassCall {
  tick: number;
  playerId: string;
  clubId: string;
  fromX: number;
  fromY: number;
  targetX: number;
  targetY: number;
  power: number;
  resultVx: number;
  resultVy: number;
  resultSpeed: number;
  dirX: number;
  dirY: number;
  dirMatchesVelocity: boolean;
}

export interface ControlBallCall {
  tick: number;
  ownerId: string;
  clubId: string;
  previousOwnerId: string | null;
  resultingLastTouchId: string | null;
  resultingLastTouchClubId: string | null;
}

export interface BoundaryCall {
  tick: number;
  input: DetectEventInput;
  result: BoundaryOutcome;
}

interface TickSnapshotV7 {
  tick: number;
  scoreHome: number;
  scoreAway: number;
  eventsLength: number;
  newEvents: MatchEvent[];
  ballOwnerId: string | null;
  ballLastTouchId: string | null;
  ballLastTouchClubId: string | null;
  setPieceType: string | null;
  setPieceStatus: string | null;
  setPieceTakerId: string | null;
}

export class PassGoalkeeperChainDiagnostic {
  private snapshots = new Map<number, TickSnapshotV7>();
  private lastEventsLength = 0;
  private applyPassCalls: ApplyPassCall[] = [];
  private controlBallCalls: ControlBallCall[] = [];
  private boundaryCalls: BoundaryCall[] = [];

  constructor(private readonly passTick: number, private readonly boundaryTick: number) {}

  onTick(state: LiveMatchState): void {
    const newEvents: MatchEvent[] = [];
    for (let i = this.lastEventsLength; i < state.events.length; i++) newEvents.push(state.events[i]);
    this.lastEventsLength = state.events.length;
    this.snapshots.set(state.tick, {
      tick: state.tick,
      scoreHome: state.score.home,
      scoreAway: state.score.away,
      eventsLength: state.events.length,
      newEvents,
      ballOwnerId: state.ball.ownerId,
      ballLastTouchId: state.ball.lastTouchId,
      ballLastTouchClubId: state.ball.lastTouchClubId,
      setPieceType: state.setPiece?.type ?? null,
      setPieceStatus: state.setPiece?.status ?? null,
      setPieceTakerId: state.setPiece?.takerId ?? null,
    });
  }

  recordApplyPass(call: ApplyPassCall): void { this.applyPassCalls.push(call); }
  recordControlBall(call: ControlBallCall): void { this.controlBallCalls.push(call); }
  recordBoundary(call: BoundaryCall): void { this.boundaryCalls.push(call); }

  report(): void {
    console.log('');
    console.log('=== V7 PASS CHAIN ===');
    const passCalls = this.applyPassCalls.filter(c => c.tick === this.passTick);
    if (!passCalls.length) console.log('(no applyPass call at target tick)');
    for (const c of passCalls) {
      console.log('tick=' + c.tick + ' player=' + c.playerId + ' club=' + c.clubId);
      console.log('from=(' + c.fromX.toFixed(3) + ',' + c.fromY.toFixed(3) + ') target=(' + c.targetX.toFixed(3) + ',' + c.targetY.toFixed(3) + ')');
      console.log('power=' + c.power.toFixed(6) + ' dir=(' + c.dirX.toFixed(3) + ',' + c.dirY.toFixed(3) + ')');
      console.log('resultV=(' + c.resultVx.toFixed(3) + ',' + c.resultVy.toFixed(3) + ') speed=' + c.resultSpeed.toFixed(3));
      console.log('dirMatchesVelocity=' + c.dirMatchesVelocity);
    }
    console.log('');
    console.log('=== V7 GOALKEEPER / BOUNDARY CHAIN ===');
    const boundaries = this.boundaryCalls.filter(c => c.tick === this.boundaryTick);
    for (const c of boundaries) {
      console.log('boundary prev=(' + c.input.prevBallPos.x.toFixed(3) + ',' + c.input.prevBallPos.y.toFixed(3) + ',' + c.input.prevBallPos.z.toFixed(3) + ') next=(' + c.input.nextBallPos.x.toFixed(3) + ',' + c.input.nextBallPos.y.toFixed(3) + ',' + c.input.nextBallPos.z.toFixed(3) + ')');
      console.log('lastTouch=' + (c.input.lastTouchId ?? 'null') + ' club=' + (c.input.lastTouchClubId ?? 'null') + ' result=' + c.result.type);
      if (c.result.type === 'goal') console.log('scorerSide=' + c.result.scorerSide + ' ownGoal=' + c.result.ownGoal);
    }
    const snap = this.snapshots.get(this.boundaryTick);
    const prev = this.snapshots.get(this.boundaryTick - 1);
    if (snap && prev) {
      const scoreChanged = snap.scoreHome !== prev.scoreHome || snap.scoreAway !== prev.scoreAway;
      console.log('score=' + prev.scoreHome + '-' + prev.scoreAway + ' -> ' + snap.scoreHome + '-' + snap.scoreAway + ' scoreChanged=' + scoreChanged);
      console.log('newEvents=[' + snap.newEvents.map(e => e.type).join(',') + ']');
      console.log('goalEventPushed=' + snap.newEvents.some(e => e.type === 'goal'));
      console.log('goalKickEventPushed=' + snap.newEvents.some(e => e.type === 'goal_kick'));
      console.log('owner=' + (snap.ballOwnerId ?? 'null') + ' lastTouch=' + (snap.ballLastTouchId ?? 'null') + '(' + (snap.ballLastTouchClubId ?? 'null') + ')');
      console.log('setPiece=' + (snap.setPieceType ?? '-') + '/' + (snap.setPieceStatus ?? '-') + '/' + (snap.setPieceTakerId ?? '-'));
    }
    console.log('');
    console.log('=== V7 CONTROL BALL @ 53421 ===');
    const calls = this.controlBallCalls.filter(c => c.tick === 53421);
    if (!calls.length) console.log('(no controlBall call at tick 53421)');
    for (const c of calls) console.log('tick=' + c.tick + ' owner=' + c.ownerId + '(' + c.clubId + ') prevOwner=' + (c.previousOwnerId ?? 'null') + ' lastTouch->' + (c.resultingLastTouchId ?? 'null') + '(' + (c.resultingLastTouchClubId ?? 'null') + ')');
    console.log('total controlBall calls=' + this.controlBallCalls.length);
  }
}
