// Turns a game into the text after the # in the link, and back.
//
// Format: v1.<creator>.<moves>
//   v1        format version
//   creator   'c' if Player A started as Cow, 'p' if as Pig
//   moves     one token per move, oldest first:
//               U D L R      piece moves (also jumps)
//               Q E Z X      diagonal moves (only after a blocked jump)
//               h? / v?      wall: orientation + one base-64 char for row * 8 + col
// Example: v1.c.DUhAvFLR
//
// Links are never trusted: decoding replays every move through the rules engine,
// so an edited or broken link is caught instead of producing an impossible board.

import { applyMove, IllegalMoveError, newGame, other, WALL_ANCHORS } from '../game/rules.ts';
import type { Dir, GameState, Move, Side } from '../game/types.ts';

export const FORMAT_VERSION = 'v1';

// URL-safe base-64 alphabet: every character survives being texted and tapped.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const DIRS = new Set<string>(['U', 'D', 'L', 'R', 'Q', 'E', 'Z', 'X']);

export interface GameLink {
  /** The animal Player A picked when starting the game. Player B is the other one and moves first. */
  creator: Side;
  moves: Move[];
}

export type DecodeError =
  | { kind: 'bad-format' } // not something this app produced
  | { kind: 'unsupported-version'; version: string } // made by a newer/older format
  | { kind: 'illegal-move'; index: number }; // a move that breaks the rules (edited link)

export type DecodeResult =
  | {
      ok: true;
      link: GameLink;
      /** The current position after every move. */
      state: GameState;
      /** The position before the last move, for highlighting it. Null if no moves yet. */
      previous: GameState | null;
    }
  | { ok: false; error: DecodeError };

// ---------- encoding ----------

export function encodeMove(move: Move): string {
  if (move.kind === 'step') return move.dir;
  const { o, r, c } = move.wall;
  return o + B64[r * WALL_ANCHORS + c];
}

/** The text that goes after the # in the link. */
export function encodeLink(link: GameLink): string {
  const creator = link.creator === 'cow' ? 'c' : 'p';
  const moves = link.moves.map(encodeMove).join('');
  return moves ? `${FORMAT_VERSION}.${creator}.${moves}` : `${FORMAT_VERSION}.${creator}`;
}

// ---------- decoding ----------

/** Splits the moves text into moves. Returns null if any token is malformed. */
export function parseMoves(text: string): Move[] | null {
  const moves: Move[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (DIRS.has(ch)) {
      moves.push({ kind: 'step', dir: ch as Dir });
    } else if (ch === 'h' || ch === 'v') {
      const anchor = text[i + 1];
      const index = anchor === undefined ? -1 : B64.indexOf(anchor);
      if (index < 0) return null; // missing or invalid anchor character
      moves.push({
        kind: 'wall',
        wall: { o: ch, r: Math.floor(index / WALL_ANCHORS), c: index % WALL_ANCHORS },
      });
      i++; // the anchor character is used up
    } else {
      return null;
    }
  }
  return moves;
}

/** Replays the moves from a fresh board. Fails on the first illegal move. */
export function replay(link: GameLink): DecodeResult {
  let state = newGame(other(link.creator));
  let previous: GameState | null = null;
  for (let i = 0; i < link.moves.length; i++) {
    try {
      previous = state;
      state = applyMove(state, link.moves[i]);
    } catch (err) {
      if (err instanceof IllegalMoveError) return { ok: false, error: { kind: 'illegal-move', index: i } };
      throw err;
    }
  }
  return { ok: true, link, state, previous };
}

/** Reads the text after the # (with or without the # itself). */
export function decodeLink(hash: string): DecodeResult {
  const text = hash.trim().replace(/^#/, '');
  const parts = text.split('.');
  if (parts.length < 2 || parts.length > 3) return { ok: false, error: { kind: 'bad-format' } };

  const [version, creatorCode, movesText = ''] = parts;
  if (!/^v\d+$/.test(version)) return { ok: false, error: { kind: 'bad-format' } };
  if (version !== FORMAT_VERSION) return { ok: false, error: { kind: 'unsupported-version', version } };
  if (creatorCode !== 'c' && creatorCode !== 'p') return { ok: false, error: { kind: 'bad-format' } };

  const moves = parseMoves(movesText);
  if (!moves) return { ok: false, error: { kind: 'bad-format' } };

  return replay({ creator: creatorCode === 'c' ? 'cow' : 'pig', moves });
}
