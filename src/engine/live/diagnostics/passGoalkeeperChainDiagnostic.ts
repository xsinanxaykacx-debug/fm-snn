// V7 targeted forensic diagnostic: pass -> loose ball -> boundary -> goalkeeper save.
// Production untouched.

import type { LiveMatchState, MatchEvent, DecisionDebug } from '../../types';

export interface PassCallRecord {
  playerId: string | null | undefined;
  clubId: string | null | undefined;
  from: { x: number; y: number; z: number };
  to: { x: number; y: number };
  power: number;
  speed: number;
}

export class PassGoalkeeperChainDiagnostic {
  private lastEventLength = 0;
  private lastScore = { home: 0, away: 0 };

  constructor(private readonly passTick: number, private readonly boundaryTick: number) {}

  onTick(state: LiveMatchState, passCalls: readonly PassCallRecord[]): void {
    const newEvents: MatchEvent[] = [];
    for (let i = this.lastEventLength; i < state.events.length; i++) newEvents.push(state.events[i]);
    this.lastEventLength = state.events.length;

    const scoreChanged = state.score.home !== this.lastScore.home || state.score.away !== this.lastScore.away;

    if (state.tick === this.passTick) {
      const passEvent = newEvents.find(event => event.type === 'pass');
      const playerId = passEvent?.playerId ?? null;
      const decisionDebug: DecisionDebug | undefined = playerId ? state.decisions[playerId] : undefined;
      const callsForPlayer = passCalls.filter(call => call.playerId === playerId);

      console.log('=== V7 PASS CHAIN ===');
      console.log('tick=' + state.tick + ' passEventPlayer=' + (playerId ?? 'null'));
      console.log('event=' + (passEvent?.type ?? 'none') + ' club=' + (passEvent?.clubId ?? 'null'));
      if (decisionDebug) {
        const d = decisionDebug.decision;
        const s = decisionDebug.selected;
        console.log('decision intent=' + d.intent + ' targetPlayerId=' + (d.targetPlayerId ?? 'null') +
          ' target=(' + (d.target?.x.toFixed(3) ?? '?') + ',' + (d.target?.y.toFixed(3) ?? '?') + ')' +
          ' power=' + d.power.toFixed(6));
        console.log('selected type=' + (s?.type ?? 'null') + ' targetPlayerId=' + (s?.targetPlayerId ?? 'null') +
          ' score=' + (s?.score.toFixed(6) ?? '?') + ' successProbability=' + (s?.successProbability.toFixed(6) ?? '?'));
      } else console.log('decisionDebug=none');
      console.log('applyPassCallsForPlayer=' + callsForPlayer.length);
      for (const call of callsForPlayer.slice(-3)) {
        console.log('applyPass from=(' + call.from.x.toFixed(3) + ',' + call.from.y.toFixed(3) + ',' + call.from.z.toFixed(3) + ')' +
          ' to=(' + call.to.x.toFixed(3) + ',' + call.to.y.toFixed(3) + ')' +
          ' power=' + call.power.toFixed(6) + ' speed=' + call.speed.toFixed(6) +
          ' delta=(' + (call.to.x-call.from.x).toFixed(3) + ',' + (call.to.y-call.from.y).toFixed(3) + ')');
      }
    }

    if (state.tick === this.boundaryTick) {
      const goalEvent = newEvents.find(event => event.type === 'goal');
      const goalKickEvent = newEvents.find(event => event.type === 'goal_kick');
      console.log('');
      console.log('=== V7 GOALKEEPER / BOUNDARY CHAIN ===');
      console.log('tick=' + state.tick + ' score=' + state.score.home + '-' + state.score.away +
        ' scoreChanged=' + scoreChanged + ' prevScore=' + this.lastScore.home + '-' + this.lastScore.away);
      console.log('newEvents=' + (newEvents.map(event => event.type).join(',') || '-'));
      console.log('goalEvent=' + (goalEvent ? 'YES' : 'NO') + ' goalKickEvent=' + (goalKickEvent ? 'YES' : 'NO'));
      console.log('ballOwner=' + (state.ball.ownerId ?? 'null') + ' lastTouch=' + (state.ball.lastTouchId ?? 'null') +
        ' lastTouchClub=' + (state.ball.lastTouchClubId ?? 'null'));
    }

    this.lastScore = { home: state.score.home, away: state.score.away };
  }
}
