import { describe, expect, it } from 'vitest';
import { checkMove, legalSteps, applyMove, newGame, other } from '../game/rules.ts';
import type { Move, Side } from '../game/types.ts';
import { decodeLink, encodeLink, encodeMove } from './codec.ts';

/** Small seeded random number generator, so the "random" games are the same on every run. */
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

/** Plays a random legal game of up to `maxMoves` moves. */
function randomGame(seed: number, creator: Side, maxMoves: number): Move[] {
  const rand = seededRandom(seed);
  let state = newGame(other(creator));
  const moves: Move[] = [];
  while (moves.length < maxMoves && !state.winner) {
    let move: Move;
    if (rand() < 0.4 && state.wallsLeft[state.turn] > 0) {
      const wall = { o: rand() < 0.5 ? 'h' : 'v', r: Math.floor(rand() * 8), c: Math.floor(rand() * 8) } as const;
      move = { kind: 'wall', wall };
      if (!checkMove(state, move).ok) continue;
    } else {
      const steps = legalSteps(state);
      move = { kind: 'step', dir: steps[Math.floor(rand() * steps.length)].dir };
    }
    state = applyMove(state, move);
    moves.push(move);
  }
  return moves;
}

describe('encoding', () => {
  it('encodes a new game with no moves', () => {
    expect(encodeLink({ creator: 'cow', moves: [] })).toBe('v1.c');
    expect(encodeLink({ creator: 'pig', moves: [] })).toBe('v1.p');
  });

  it('encodes piece moves as one letter and walls as two characters', () => {
    expect(encodeMove({ kind: 'step', dir: 'U' })).toBe('U');
    expect(encodeMove({ kind: 'wall', wall: { o: 'h', r: 0, c: 0 } })).toBe('hA');
    expect(encodeMove({ kind: 'wall', wall: { o: 'v', r: 0, c: 5 } })).toBe('vF');
    expect(encodeMove({ kind: 'wall', wall: { o: 'h', r: 7, c: 7 } })).toBe('h_');
  });

  it('decodes the example from CLAUDE.md', () => {
    const res = decodeLink('#v1.c.DUhAvFLR');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.link.creator).toBe('cow');
    expect(res.link.moves).toHaveLength(6);
    expect(res.state.pig).toEqual({ r: 1, c: 3 });
    expect(res.state.cow).toEqual({ r: 7, c: 5 });
    expect(res.state.walls).toHaveLength(2);
    expect(res.state.turn).toBe('pig');
  });
});

describe('round trip', () => {
  it('decode(encode(game)) gives back the same game, for many random games', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const creator: Side = seed % 2 ? 'cow' : 'pig';
      const moves = randomGame(seed, creator, 60);
      const text = encodeLink({ creator, moves });
      const res = decodeLink('#' + text);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.link).toEqual({ creator, moves });
      expect(encodeLink(res.link)).toBe(text);
    }
  });
});

describe('who moves', () => {
  it('Player B (the other animal) moves first', () => {
    const asCow = decodeLink('v1.c');
    const asPig = decodeLink('v1.p');
    expect(asCow.ok && asCow.state.turn).toBe('pig');
    expect(asPig.ok && asPig.state.turn).toBe('cow');
  });

  it('remembers the position before the last move', () => {
    const res = decodeLink('v1.c.D');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.previous?.pig).toEqual({ r: 0, c: 4 });
    expect(res.state.pig).toEqual({ r: 1, c: 4 });

    const fresh = decodeLink('v1.c');
    expect(fresh.ok && fresh.previous).toBe(null);
  });
});

describe('broken or edited links', () => {
  it('rejects text that is not a game link', () => {
    for (const bad of ['', '#', 'hello', 'v1', 'v1.x', 'v1.c.D.U', 'x1.c.D']) {
      expect(decodeLink(bad)).toEqual({ ok: false, error: { kind: 'bad-format' } });
    }
  });

  it('rejects unknown move characters', () => {
    expect(decodeLink('v1.c.DUk')).toEqual({ ok: false, error: { kind: 'bad-format' } });
  });

  it('rejects a wall with its anchor cut off', () => {
    expect(decodeLink('v1.c.DUh')).toEqual({ ok: false, error: { kind: 'bad-format' } });
  });

  it('rejects a different format version', () => {
    expect(decodeLink('v2.c.DU')).toEqual({ ok: false, error: { kind: 'unsupported-version', version: 'v2' } });
  });

  it('rejects an illegal move and says which one', () => {
    // pig moves first from row 0, so "U" would take it off the board
    expect(decodeLink('v1.c.U')).toEqual({ ok: false, error: { kind: 'illegal-move', index: 0 } });
    // third move places a wall on top of the second move's wall
    expect(decodeLink('v1.c.hAhA')).toEqual({ ok: false, error: { kind: 'illegal-move', index: 1 } });
  });

  it('rejects moves added after the game was won', () => {
    // pig walks straight down column 4; the cow steps aside to column 3 and shuffles up/down
    const won = 'v1.c.' + 'DLDUDDDUDDDUDDD';
    const res = decodeLink(won);
    expect(res.ok && res.state.winner).toBe('pig');
    expect(decodeLink(won + 'U')).toEqual({ ok: false, error: { kind: 'illegal-move', index: 15 } });
  });
});
