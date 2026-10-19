// Shared types for the Blocker rules engine.
// Everything here uses canonical coordinates: row 0 is the top edge (the Cow's goal),
// row 8 is the bottom edge (the Pig's goal). Rows and columns count from 0.

export type Side = 'cow' | 'pig';

export interface Pos {
  r: number;
  c: number;
}

/**
 * A wall is anchored at the groove intersection (r, c), with r and c from 0 to 7.
 * - 'h' (horizontal): sits in the groove below row r, covering columns c and c+1.
 * - 'v' (vertical):   sits in the groove right of column c, covering rows r and r+1.
 * A horizontal and a vertical wall with the same anchor would cross in an X.
 */
export interface Wall {
  o: 'h' | 'v';
  r: number;
  c: number;
}

/**
 * Piece directions. U/D/L/R are normal steps (and jumps when the opponent is in the way).
 * Q/E/Z/X are diagonals, only allowed when a straight jump is blocked:
 * Q = up-left, E = up-right, Z = down-left, X = down-right.
 */
export type Dir = 'U' | 'D' | 'L' | 'R' | 'Q' | 'E' | 'Z' | 'X';

export type Move =
  | { kind: 'step'; dir: Dir }
  | { kind: 'wall'; wall: Wall };

export interface GameState {
  cow: Pos;
  pig: Pos;
  walls: Wall[];
  wallsLeft: Record<Side, number>;
  turn: Side;
  winner: Side | null;
}

export type IllegalReason =
  | 'game-over' // someone already won
  | 'off-board' // the move would leave the board
  | 'blocked' // a wall is in the way
  | 'jump-blocked' // the opponent is in the way and the tile behind them is blocked (use a diagonal)
  | 'diagonal-not-allowed' // diagonals are only allowed when a straight jump is blocked
  | 'no-walls-left'
  | 'out-of-bounds' // wall anchor outside 0–7
  | 'overlap' // wall overlaps an existing wall
  | 'crosses' // wall crosses an existing wall in an X
  | 'blocks-path'; // wall would cut a piece off from its goal

export type MoveCheck = { ok: true } | { ok: false; reason: IllegalReason };
