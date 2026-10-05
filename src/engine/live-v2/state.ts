/**
 * Core immutable state model for the live-v2 simulation.
 *
 * The v2 engine treats MatchState as the complete input/output boundary
 * of the simulation. Modules should read state and return new values rather
 * than mutating shared state in place.
 */

export type TeamSide = 'HOME' | 'AWAY';

export type MatchPhase =
  | 'kickoff'
  | 'first_half'
  | 'halftime'
  | 'second_half'
  | 'full_time';

export type Vec2 = {
  x: number;
  y: number;
};

export type Vec3 = Vec2 & {
  z: number;
};

/**
 * Static pitch dimensions used by all spatial modules.
 *
 * x = 0 is the HOME goal line.
 * x = length is the AWAY goal line.
 * y = 0 and y = width are the two touchlines.
 */
export type Pitch = {
  length: number;
  width: number;
  goalWidth: number;
  goalHeight: number;
  goalAreaDepth: number;
};

/**
 * Dynamic ball state.
 *
 * The ball is allowed to cross the pitch boundary during the physics phase,
 * but boundary resolution must turn that state into a football event in the
 * same simulation tick.
 */
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

/**
 * A restart is explicit state, not an implicit side effect.
 *
 * null means the ball is live.
 */
export type RestartState =
  | {
      type: 'kickoff';
      side: TeamSide;
      point: Vec2;
    }
  | {
      type: 'goal_kick';
      side: TeamSide;
      point: Vec2;
    }
  | {
      type: 'corner';
      side: TeamSide;
      point: Vec2;
    }
  | {
      type: 'throw_in';
      side: TeamSide;
      point: Vec2;
    }
  | null;

export type MatchEvent =
  | {
      type: 'goal';
      scorerSide: TeamSide;
      point: Vec2;
    }
  | {
      type: 'goal_kick';
      side: TeamSide;
      point: Vec2;
    }
  | {
      type: 'corner';
      side: TeamSide;
      point: Vec2;
    }
  | {
      type: 'throw_in';
      side: TeamSide;
      point: Vec2;
    };

export type MatchDiagnostics = {
  lastPhase: MatchPhase;
  lastTick: number;
  lastBallPosition: Vec3;
  lastBallVelocity: Vec3;
};

export type MatchState = {
  /** Match clock in simulation seconds. */
  clockSeconds: number;

  /** Monotonically increasing simulation tick number. */
  tick: number;

  /** Current high-level match phase. */
  phase: MatchPhase;

  /** Immutable spatial configuration for this match. */
  pitch: Pitch;

  /** Current score. */
  score: {
    home: number;
    away: number;
  };

  /** Complete ball state for the current tick. */
  ball: BallState;

  /** Player state indexed by stable player id. */
  players: Record<string, PlayerState>;

  /** Team state indexed by HOME/AWAY. */
  teams: Record<TeamSide, TeamState>;

  /** Pending restart, or null while play is live. */
  restart: RestartState;

  /** Ordered football events emitted by the simulation. */
  events: MatchEvent[];

  /** Lightweight runtime diagnostics for progress/debugging. */
  diagnostics: MatchDiagnostics;
};
