import type { BallLastAction } from '../types';

declare module '../types' {
  interface Ball {
    lastAction: BallLastAction;
  }
}
