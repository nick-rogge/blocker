// Board geometry and the Pig player's flipped view. Pure math, no DOM, so it can be tested.
//
// "Canonical" coordinates are what the rules engine and the link use (Cow starts at the bottom).
// "View" coordinates are what's drawn on this player's screen. The Cow sees the canonical board;
// the Pig sees it rotated 180°, so each player always has their own animal at the bottom.

import type { Pos, Side, Wall } from '../game/types.ts';

// Sizes in SVG units, matching blocker-board.svg (viewBox 0 0 708 708).
export const BOARD = 708;
export const GROOVE = 12;
export const TILE = 64;
export const STEP = TILE + GROOVE; // 76: distance from one tile to the next
export const PIECE = 48;
export const WALL_LENGTH = 2 * TILE + GROOVE; // 140
export const LAST_INDEX = 8; // tiles run 0–8
const LAST_ANCHOR = 7; // wall anchors run 0–7

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function isFlipped(viewer: Side): boolean {
  return viewer === 'pig';
}

/** Canonical tile → view tile. Rotating 180° twice gets you back, so this also converts view → canonical. */
export function flipTile(p: Pos, flipped: boolean): Pos {
  return flipped ? { r: LAST_INDEX - p.r, c: LAST_INDEX - p.c } : { ...p };
}

/**
 * Canonical wall → view wall (and back). A horizontal wall below row r covering columns c and c+1
 * lands, after rotating, below row 7−r covering columns 7−c and 8−c. Same idea for vertical walls.
 */
export function flipWall(w: Wall, flipped: boolean): Wall {
  return flipped ? { o: w.o, r: LAST_ANCHOR - w.r, c: LAST_ANCHOR - w.c } : { ...w };
}

/** Where a tile is drawn (view coordinates). */
export function tileRect(p: Pos): Rect {
  return { x: GROOVE + STEP * p.c, y: GROOVE + STEP * p.r, width: TILE, height: TILE };
}

/** Where a piece is drawn on a tile (view coordinates), centered with an even margin. */
export function pieceRect(p: Pos): Rect {
  const inset = (TILE - PIECE) / 2;
  return { x: GROOVE + inset + STEP * p.c, y: GROOVE + inset + STEP * p.r, width: PIECE, height: PIECE };
}

/** Where a wall is drawn (view coordinates). It fills its groove exactly. */
export function wallRect(w: Wall): Rect {
  if (w.o === 'h') {
    return { x: GROOVE + STEP * w.c, y: STEP + STEP * w.r, width: WALL_LENGTH, height: GROOVE };
  }
  return { x: STEP + STEP * w.c, y: GROOVE + STEP * w.r, width: GROOVE, height: WALL_LENGTH };
}

/** Which tile (view coordinates) a tap at SVG point (x, y) landed on, or null for a groove or the border. */
export function tileAt(x: number, y: number): Pos | null {
  const c = Math.floor((x - GROOVE) / STEP);
  const r = Math.floor((y - GROOVE) / STEP);
  if (r < 0 || r > LAST_INDEX || c < 0 || c > LAST_INDEX) return null;
  const rect = tileRect({ r, c });
  const inside = x >= rect.x && x < rect.x + TILE && y >= rect.y && y < rect.y + TILE;
  return inside ? { r, c } : null;
}

/**
 * The wall (view coordinates) a tap at SVG point (x, y) asks for. Tapping in a horizontal groove
 * gives a horizontal wall and tapping in a vertical groove gives a vertical one. A tap on a tile,
 * away from any groove, keeps `current` orientation (the one the rotate button set).
 */
export function wallFromTap(x: number, y: number, current: 'h' | 'v'): Wall {
  const center = STEP + GROOVE / 2; // first groove crossing, 82
  const distToGroove = (n: number) => {
    const k = Math.max(0, Math.min(LAST_ANCHOR, Math.round((n - center) / STEP)));
    return Math.abs(n - (center + STEP * k));
  };
  const toVertical = distToGroove(x); // how far the tap is from a vertical groove line
  const toHorizontal = distToGroove(y);
  const nearGroove = Math.min(toVertical, toHorizontal) <= GROOVE;
  // Right where two grooves cross, either direction could be meant, so keep the current one.
  const atCrossing = Math.abs(toVertical - toHorizontal) < GROOVE / 2;
  const o = nearGroove && !atCrossing ? (toVertical < toHorizontal ? 'v' : 'h') : current;
  return { o, ...nearestAnchor(x, y) };
}

/** The wall anchor (view coordinates) whose groove crossing is nearest to SVG point (x, y). */
export function nearestAnchor(x: number, y: number): { r: number; c: number } {
  // Groove crossings sit at x = 76 + 76·c + 6 (the middle of the groove), same for y.
  const center = STEP + GROOVE / 2;
  const clamp = (n: number) => Math.max(0, Math.min(LAST_ANCHOR, n));
  return { r: clamp(Math.round((y - center) / STEP)), c: clamp(Math.round((x - center) / STEP)) };
}
