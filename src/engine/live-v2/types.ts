export type TeamSide = 'HOME' | 'AWAY';

export type MatchPhase = 'kickoff' | 'first_half' | 'halftime' | 'second_half' | 'full_time';

export type Vec2 = { x: number; y: number };
export type Vec3 = Vec2 & { z: number };

export type Pitch = {
  length: number;
  width: number;
  goalWidth: number;
  goalHeight: number;
  goalAreaDepth: number;
};

export type BallState = {
  position: Vec3;
  velocity: Vec3;
  ownerId: string | null;
  lastTouchId: string | null;
  lastTouchSide: TeamSide | null;
};

export type PlayerState = {
  id: string;
  team: TeamSide;
  position: Vec2;
  velocity: Vec2;
};

export type TeamState = {
  id: string;
  side: TeamSide;
  playerIds: string[];
};

export type RestartState =
  | { type: 'kickoff'; side: TeamSide; point: Vec2 }
  | { type: 'goal_kick'; side: TeamSide; point: Vec2 }
  | { type: 'corner'; side: TeamSide; point: Vec2 }
  | { type: 'throw_in'; side: TeamSide; point: Vec2 }
  | null;

export type MatchEvent =
  | { type: 'goal'; scorerSide: TeamSide; point: Vec2 }
  | { type: 'goal_kick'; side: TeamSide; point: Vec2 }
  | { type: 'corner'; side: TeamSide; point: Vec2 }
  | { type: 'throw_in'; side: TeamSide; point: Vec2 };

export type MatchDiagnostics = {
  lastPhase: string;
  lastTick: number;
  lastBallPosition: Vec3;
  lastBallVelocity: Vec3;
};

export type MatchState = {
  clockSeconds: number;
  tick: number;
  phase: MatchPhase;
  pitch: Pitch;
  score: { home: number; away: number };
  ball: BallState;
  players: Record<string, PlayerState>;
  teams: Record<TeamSide, TeamState>;
  restart: RestartState;
  events: MatchEvent[];
  diagnostics: MatchDiagnostics;
};