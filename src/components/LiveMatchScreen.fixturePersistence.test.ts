import { describe, expect, it } from 'vitest';

import { bindLiveMatchToFixture } from './LiveMatchScreen';
import type { Match } from '../engine/types';

const fixture: Match = {
  id: 'fixture-3',
  week: 3,
  homeId: 'istanbul-fk',
  awayId: 'milano-inter',
  homeScore: 0,
  awayScore: 0,
  events: [],
  sequences: [],
  stats: {},
  played: false,
};

const liveResult: Match = {
  id: 'match_live_istanbul-fk_milano-inter',
  week: 3,
  homeId: 'istanbul-fk',
  awayId: 'milano-inter',
  homeScore: 10,
  awayScore: 9,
  events: [],
  sequences: [],
  stats: {},
  played: true,
};

describe('LiveMatchScreen fixture persistence', () => {
  it('keeps the fixture identity when saving a completed live result', () => {
    const bound = bindLiveMatchToFixture(liveResult, fixture);

    expect(bound.id).toBe(fixture.id);
    expect(bound.week).toBe(fixture.week);
    expect(bound.homeId).toBe(fixture.homeId);
    expect(bound.awayId).toBe(fixture.awayId);
    expect(bound.homeScore).toBe(10);
    expect(bound.awayScore).toBe(9);
    expect(bound.played).toBe(true);
  });
});
