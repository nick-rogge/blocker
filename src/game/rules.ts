// The Blocker rules engine. Pure functions only: no DOM, no randomness, no mutation.
// The UI and the link codec both build on these.

import type { Dir, GameState, IllegalReason, Move, MoveCheck, Pos, Side, Wall } from './types.ts';

export const BOARD_SIZE = 9;
export const WALL_ANCHORS = 8; // wall anchors run 0–7 in each direction
export const WALLS_PER_PLAYER = 10;

export const START: Record<Side, Pos> = {
  cow: { r: 8, c: 4 },
  pig: { r: 0, c: 4 },
};

export const GOAL_ROW: Record<Side, number> = { cow: 0, pig: 8 };

const DELTA: Record<Dir, Pos> = {
  U: { r: -1, c: 0 },
  D: { r: 1, c: 0 },
  L: { r: 0, c: -1 },
  R: { r: 0, c: 1 },
  Q: { r: -1, c: -1 },
  E: { r: -1, c: 1 },
  Z: { r: 1, c: -1 },
  X: { r: 1, c: 1 },
};

export const ALL_DIRS: Dir[] = ['U', 'D', 'L', 'R', 'Q', 'E', 'Z', 'X'];

export function other(side: Side): Side {
  return side === 'cow' ? 'pig' : 'cow';
}

/** A fresh game. The player who did NOT create the game moves first. */
export function newGame(firstToMove: Side): GameState {
  return {
    cow: { ...START.cow },
    pig: { ...START.pig },
    walls: [],
    wallsLeft: { cow: WALLS_PER_PLAYER, pig: WALLS_PER_PLAYER },
    turn: firstToMove,
    winner: null,
  };
}

// ---------- small helpers ----------

const add = (p: Pos, d: Pos): Pos => ({ r: p.r + d.r, c: p.c + d.c });
const same = (a: Pos, b: Pos): boolean => a.r === b.r && a.c === b.c;

export function onBoard(p: Pos): boolean {
  return p.r >= 0 && p.r < BOARD_SIZE && p.c >= 0 && p.c < BOARD_SIZE;
}

/** Is there a wall between two orthogonally adjacent tiles? */
export function isBlocked(a: Pos, b: Pos, walls: Wall[]): boolean {
  if (a.c === b.c) {
    // vertical move: crosses the horizontal groove below the upper tile
    const top = Math.min(a.r, b.r);
    return walls.some((w) => w.o === 'h' && w.r === top && (w.c === a.c || w.c === a.c - 1));
  }
  // horizontal move: crosses the vertical groove right of the left tile
  const left = Math.min(a.c, b.c);
  return walls.some((w) => w.o === 'v' && w.c === left && (w.r === a.r || w.r === a.r - 1));
}

/** Can a piece slide from a to the adjacent tile b (on the board, no wall)? */
function canStep(a: Pos, b: Pos, walls: Wall[]): boolean {
  return onBoard(b) && !isBlocked(a, b, walls);
}

// ---------- piece moves ----------

type StepResult = { ok: true; to: Pos } | { ok: false; reason: IllegalReason };

/** Where the piece whose turn it is would land moving in `dir`, or why it can't. */
export function stepTarget(state: GameState, dir: Dir): StepResult {
  const me = state[state.turn];
  const opp = state[other(state.turn)];
  const d = DELTA[dir];
  const isDiagonal = d.r !== 0 && d.c !== 0;

  if (!isDiagonal) {
    const next = add(me, d);
    if (!onBoard(next)) return { ok: false, reason: 'off-board' };
    if (isBlocked(me, next, state.walls)) return { ok: false, reason: 'blocked' };
    if (!same(next, opp)) return { ok: true, to: next };
    // Opponent is in the way: jump straight over if the tile behind is open.
    const behind = add(next, d);
    if (canStep(next, behind, state.walls)) return { ok: true, to: behind };
    return { ok: false, reason: 'jump-blocked' };
  }

  // Diagonal: only legal when the opponent is directly beside us (vertically or
  // horizontally) and the straight jump over them is blocked by a wall or the edge.
  const target = add(me, d);
  if (!onBoard(target)) return { ok: false, reason: 'off-board' };
  const routes: [Pos, Pos][] = [
    [{ r: d.r, c: 0 }, { r: 0, c: d.c }], // opponent above/below, sidestep left/right
    [{ r: 0, c: d.c }, { r: d.r, c: 0 }], // opponent left/right, sidestep up/down
  ];
  for (const [toward, sidestep] of routes) {
    const oppSpot = add(me, toward);
    if (!same(oppSpot, opp)) continue;
    if (isBlocked(me, oppSpot, state.walls)) continue;
    if (canStep(oppSpot, add(oppSpot, toward), state.walls)) continue; // straight jump is open
    if (canStep(oppSpot, add(oppSpot, sidestep), state.walls)) return { ok: true, to: target };
    return { ok: false, reason: 'blocked' };
  }
  return { ok: false, reason: 'diagonal-not-allowed' };
}

/** Every legal piece move for the side to play, with where each one lands. For move highlights. */
export function legalSteps(state: GameState): { dir: Dir; to: Pos }[] {
  if (state.winner) return [];
  const out: { dir: Dir; to: Pos }[] = [];
  for (const dir of ALL_DIRS) {
    const res = stepTarget(state, dir);
    if (res.ok) out.push({ dir, to: res.to });
  }
  return out;
}

// ---------- walls ----------

/** Does a new wall clash with an existing one? */
export function wallConflict(w: Wall, walls: Wall[]): 'overlap' | 'crosses' | null {
  for (const x of walls) {
    if (x.o === w.o) {
      if (w.o === 'h' && x.r === w.r && Math.abs(x.c - w.c) <= 1) return 'overlap';
      if (w.o === 'v' && x.c === w.c && Math.abs(x.r - w.r) <= 1) return 'overlap';
    } else if (x.r === w.r && x.c === w.c) {
      return 'crosses';
    }
  }
  return null;
}

/** Can a piece at `from` still reach `goalRow` (pieces ignored, only walls and edges)? */
export function hasPathToGoal(from: Pos, goalRow: number, walls: Wall[]): boolean {
  const seen = new Set<number>([from.r * BOARD_SIZE + from.c]);
  const queue: Pos[] = [from];
  const steps: Pos[] = [DELTA.U, DELTA.D, DELTA.L, DELTA.R];
  while (queue.length > 0) {
    const p = queue.shift()!;
    if (p.r === goalRow) return true;
    for (const d of steps) {
      const n = add(p, d);
      const key = n.r * BOARD_SIZE + n.c;
      if (!seen.has(key) && canStep(p, n, walls)) {
        seen.add(key);
        queue.push(n);
      }
    }
  }
  return false;
}

function checkWall(state: GameState, w: Wall): MoveCheck {
  const inRange = (n: number) => Number.isInteger(n) && n >= 0 && n < WALL_ANCHORS;
  if (state.wallsLeft[state.turn] <= 0) return { ok: false, reason: 'no-walls-left' };
  if (!inRange(w.r) || !inRange(w.c)) return { ok: false, reason: 'out-of-bounds' };
  const clash = wallConflict(w, state.walls);
  if (clash) return { ok: false, reason: clash };
  const walls = [...state.walls, w];
  if (!hasPathToGoal(state.cow, GOAL_ROW.cow, walls) || !hasPathToGoal(state.pig, GOAL_ROW.pig, walls)) {
    return { ok: false, reason: 'blocks-path' };
  }
  return { ok: true };
}

// ---------- the public move API ----------

export function checkMove(state: GameState, move: Move): MoveCheck {
  if (state.winner) return { ok: false, reason: 'game-over' };
  if (move.kind === 'wall') return checkWall(state, move.wall);
  const res = stepTarget(state, move.dir);
  return res.ok ? { ok: true } : res;
}

export class IllegalMoveError extends Error {
  readonly reason: IllegalReason;
  constructor(reason: IllegalReason) {
    super(`Illegal move: ${reason}`);
    this.name = 'IllegalMoveError';
    this.reason = reason;
  }
}

/** Returns the new state after `move`. Throws IllegalMoveError if the move isn't legal. */
export function applyMove(state: GameState, move: Move): GameState {
  if (state.winner) throw new IllegalMoveError('game-over');
  const side = state.turn;

  if (move.kind === 'wall') {
    const check = checkWall(state, move.wall);
    if (!check.ok) throw new IllegalMoveError(check.reason);
    return {
      ...state,
      walls: [...state.walls, { ...move.wall }],
      wallsLeft: { ...state.wallsLeft, [side]: state.wallsLeft[side] - 1 },
      turn: other(side),
    };
  }

  const res = stepTarget(state, move.dir);
  if (!res.ok) throw new IllegalMoveError(res.reason);
  return {
    ...state,
    [side]: res.to,
    turn: other(side),
    winner: res.to.r === GOAL_ROW[side] ? side : null,
  };
}
