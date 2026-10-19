import { describe, expect, it } from 'vitest';
import type { GameState, Move, Wall } from './types.ts';
import {
  applyMove,
  checkMove,
  hasPathToGoal,
  isBlocked,
  legalSteps,
  newGame,
  WALLS_PER_PLAYER,
} from './rules.ts';

// Helpers to keep the tests short.
const step = (dir: 'U' | 'D' | 'L' | 'R' | 'Q' | 'E' | 'Z' | 'X'): Move => ({ kind: 'step', dir });
const wall = (o: 'h' | 'v', r: number, c: number): Move => ({ kind: 'wall', wall: { o, r, c } });
const h = (r: number, c: number): Wall => ({ o: 'h', r, c });
const v = (r: number, c: number): Wall => ({ o: 'v', r, c });

/** A game with the Cow to move, with any fields overridden. */
function game(overrides: Partial<GameState> = {}): GameState {
  return { ...newGame('cow'), ...overrides };
}

describe('new game', () => {
  it('puts the pieces in the middle of their home edges', () => {
    const g = newGame('pig');
    expect(g.cow).toEqual({ r: 8, c: 4 });
    expect(g.pig).toEqual({ r: 0, c: 4 });
    expect(g.walls).toEqual([]);
    expect(g.wallsLeft).toEqual({ cow: WALLS_PER_PLAYER, pig: WALLS_PER_PLAYER });
    expect(g.turn).toBe('pig');
    expect(g.winner).toBe(null);
  });
});

describe('piece moves', () => {
  it('moves one tile and passes the turn', () => {
    const g = applyMove(game(), step('U'));
    expect(g.cow).toEqual({ r: 7, c: 4 });
    expect(g.turn).toBe('pig');
  });

  it('does not change the original state', () => {
    const before = game();
    applyMove(before, step('U'));
    expect(before.cow).toEqual({ r: 8, c: 4 });
  });

  it('cannot move off the board', () => {
    expect(checkMove(game(), step('D'))).toEqual({ ok: false, reason: 'off-board' });
  });

  it('is blocked by a horizontal wall', () => {
    // wall in the groove below row 7, covering columns 3 and 4
    const g = game({ walls: [h(7, 3)] });
    expect(checkMove(g, step('U'))).toEqual({ ok: false, reason: 'blocked' });
  });

  it('is blocked by a vertical wall', () => {
    // wall right of column 4, covering rows 7 and 8
    const g = game({ walls: [v(7, 4)] });
    expect(checkMove(g, step('R'))).toEqual({ ok: false, reason: 'blocked' });
    expect(checkMove(g, step('L'))).toEqual({ ok: true });
  });

  it('cannot move diagonally when no jump is involved', () => {
    expect(checkMove(game(), step('Q'))).toEqual({ ok: false, reason: 'diagonal-not-allowed' });
  });

  it('only highlights the three open directions at the start', () => {
    const dests = legalSteps(game()).map((s) => s.to);
    expect(dests).toHaveLength(3);
    expect(dests).toContainEqual({ r: 7, c: 4 });
    expect(dests).toContainEqual({ r: 8, c: 3 });
    expect(dests).toContainEqual({ r: 8, c: 5 });
  });
});

describe('jumping', () => {
  it('jumps straight over an adjacent opponent', () => {
    const g = applyMove(game({ cow: { r: 4, c: 4 }, pig: { r: 3, c: 4 } }), step('U'));
    expect(g.cow).toEqual({ r: 2, c: 4 });
  });

  it('pieces never end up on the same tile', () => {
    const start = game({ cow: { r: 4, c: 4 }, pig: { r: 3, c: 4 } });
    for (const s of legalSteps(start)) {
      expect(s.to.r === 3 && s.to.c === 4).toBe(false);
    }
  });

  it('cannot jump through a wall behind the opponent, but can go diagonal', () => {
    // wall in the groove below row 2 (above the pig), covering columns 4 and 5
    const g = game({ cow: { r: 4, c: 4 }, pig: { r: 3, c: 4 }, walls: [h(2, 4)] });
    expect(checkMove(g, step('U'))).toEqual({ ok: false, reason: 'jump-blocked' });
    expect(applyMove(g, step('Q')).cow).toEqual({ r: 3, c: 3 });
    expect(applyMove(g, step('E')).cow).toEqual({ r: 3, c: 5 });
  });

  it('can go diagonal when the board edge is behind the opponent', () => {
    // pig on its home row, cow right below: jumping would leave the board
    const g = game({ cow: { r: 1, c: 4 }, pig: { r: 0, c: 4 } });
    expect(checkMove(g, step('U'))).toEqual({ ok: false, reason: 'jump-blocked' });
    expect(applyMove(g, step('E')).cow).toEqual({ r: 0, c: 5 });
  });

  it('cannot go diagonal while the straight jump is open', () => {
    const g = game({ cow: { r: 4, c: 4 }, pig: { r: 3, c: 4 } });
    expect(checkMove(g, step('Q'))).toEqual({ ok: false, reason: 'diagonal-not-allowed' });
  });

  it('cannot go diagonal through a wall beside the opponent', () => {
    // jump blocked above, and a vertical wall left of the pig (right of column 3, rows 2–3)
    const g = game({ cow: { r: 4, c: 4 }, pig: { r: 3, c: 4 }, walls: [h(2, 4), v(2, 3)] });
    expect(checkMove(g, step('Q'))).toEqual({ ok: false, reason: 'blocked' });
    expect(checkMove(g, step('E'))).toEqual({ ok: true });
  });

  it('works sideways too', () => {
    // pig directly left of the cow, wall behind the pig
    const g = game({ cow: { r: 4, c: 4 }, pig: { r: 4, c: 3 }, walls: [v(3, 2)] });
    expect(checkMove(g, step('L'))).toEqual({ ok: false, reason: 'jump-blocked' });
    expect(applyMove(g, step('Q')).cow).toEqual({ r: 3, c: 3 });
    expect(applyMove(g, step('Z')).cow).toEqual({ r: 5, c: 3 });
  });
});

describe('walls', () => {
  it('places a wall, uses one up, and passes the turn', () => {
    const g = applyMove(game(), wall('h', 3, 3));
    expect(g.walls).toEqual([h(3, 3)]);
    expect(g.wallsLeft.cow).toBe(WALLS_PER_PLAYER - 1);
    expect(g.wallsLeft.pig).toBe(WALLS_PER_PLAYER);
    expect(g.turn).toBe('pig');
  });

  it('blocks the right tiles', () => {
    const walls = [h(3, 3)];
    expect(isBlocked({ r: 3, c: 3 }, { r: 4, c: 3 }, walls)).toBe(true);
    expect(isBlocked({ r: 3, c: 4 }, { r: 4, c: 4 }, walls)).toBe(true);
    expect(isBlocked({ r: 3, c: 5 }, { r: 4, c: 5 }, walls)).toBe(false);
    expect(isBlocked({ r: 2, c: 3 }, { r: 3, c: 3 }, walls)).toBe(false);
  });

  it('rejects walls outside the board', () => {
    expect(checkMove(game(), wall('h', 8, 0))).toEqual({ ok: false, reason: 'out-of-bounds' });
    expect(checkMove(game(), wall('v', 0, 8))).toEqual({ ok: false, reason: 'out-of-bounds' });
    expect(checkMove(game(), wall('h', -1, 0))).toEqual({ ok: false, reason: 'out-of-bounds' });
  });

  it('rejects overlapping walls', () => {
    const g = game({ walls: [h(3, 3)] });
    expect(checkMove(g, wall('h', 3, 3))).toEqual({ ok: false, reason: 'overlap' });
    expect(checkMove(g, wall('h', 3, 4))).toEqual({ ok: false, reason: 'overlap' });
    expect(checkMove(g, wall('h', 3, 2))).toEqual({ ok: false, reason: 'overlap' });
    expect(checkMove(g, wall('h', 3, 5))).toEqual({ ok: true }); // end to end is fine
  });

  it('rejects a wall that crosses another in an X', () => {
    const g = game({ walls: [h(3, 3)] });
    expect(checkMove(g, wall('v', 3, 3))).toEqual({ ok: false, reason: 'crosses' });
    expect(checkMove(g, wall('v', 2, 3))).toEqual({ ok: true }); // T shape is fine
  });

  it('rejects a wall when the player has none left', () => {
    const g = game({ wallsLeft: { cow: 0, pig: 10 } });
    expect(checkMove(g, wall('h', 3, 3))).toEqual({ ok: false, reason: 'no-walls-left' });
  });

  it('rejects a wall that would trap a piece', () => {
    // pig in the top-left corner, already closed in below by h(0,0); v(0,1) would seal it
    const g = game({ pig: { r: 0, c: 0 }, walls: [h(0, 0)] });
    expect(checkMove(g, wall('v', 0, 1))).toEqual({ ok: false, reason: 'blocks-path' });
  });

  it('finds a path around walls', () => {
    const fence = [h(4, 0), h(4, 2), h(4, 4), h(4, 6)]; // row-4 groove blocked except column 8
    expect(hasPathToGoal({ r: 8, c: 0 }, 0, fence)).toBe(true);
    expect(hasPathToGoal({ r: 8, c: 0 }, 0, [...fence, v(3, 7)])).toBe(true);
  });
});

describe('winning', () => {
  it('the cow wins by reaching row 0', () => {
    const g = applyMove(game({ cow: { r: 1, c: 0 } }), step('U'));
    expect(g.winner).toBe('cow');
  });

  it('the pig wins by reaching row 8', () => {
    const g = applyMove(game({ turn: 'pig', pig: { r: 7, c: 0 } }), step('D'));
    expect(g.winner).toBe('pig');
  });

  it('no moves are allowed after someone wins', () => {
    const g = applyMove(game({ cow: { r: 1, c: 0 } }), step('U'));
    expect(checkMove(g, step('D'))).toEqual({ ok: false, reason: 'game-over' });
    expect(legalSteps(g)).toEqual([]);
    expect(() => applyMove(g, step('D'))).toThrow('game-over');
  });
});
