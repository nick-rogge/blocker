import { describe, expect, it } from 'vitest';
import { isBlocked, START } from '../game/rules.ts';
import type { Pos, Wall } from '../game/types.ts';
import { flipTile, flipWall, nearestAnchor, pieceRect, tileAt, tileRect, wallFromTap, wallRect } from './layout.ts';

describe('positions on the board', () => {
  it('places tiles, pieces, and walls using the board measurements', () => {
    expect(tileRect({ r: 0, c: 0 })).toEqual({ x: 12, y: 12, width: 64, height: 64 });
    expect(tileRect({ r: 8, c: 8 })).toEqual({ x: 620, y: 620, width: 64, height: 64 });
    expect(pieceRect({ r: 8, c: 4 })).toEqual({ x: 324, y: 628, width: 48, height: 48 });
    expect(wallRect({ o: 'h', r: 3, c: 2 })).toEqual({ x: 164, y: 304, width: 140, height: 12 });
    expect(wallRect({ o: 'v', r: 5, c: 5 })).toEqual({ x: 456, y: 392, width: 12, height: 140 });
  });

  it('the last wall ends exactly at the edge of the last tile', () => {
    const h = wallRect({ o: 'h', r: 7, c: 7 });
    const v = wallRect({ o: 'v', r: 7, c: 7 });
    const lastTile = tileRect({ r: 8, c: 8 });
    expect(h.x + h.width).toBe(lastTile.x + lastTile.width); // 684
    expect(v.y + v.height).toBe(lastTile.y + lastTile.height);
  });
});

describe('tapping', () => {
  it('finds the tile under a tap', () => {
    expect(tileAt(44, 44)).toEqual({ r: 0, c: 0 });
    expect(tileAt(652, 652)).toEqual({ r: 8, c: 8 });
  });

  it('ignores taps in a groove or on the border', () => {
    expect(tileAt(80, 44)).toBe(null); // groove between columns 0 and 1
    expect(tileAt(5, 44)).toBe(null); // outer border
  });

  it('a tap in a horizontal groove asks for a horizontal wall', () => {
    // groove below row 2 (y = 234), above the left edge of column 4
    expect(wallFromTap(272, 234, 'v')).toEqual({ o: 'h', r: 2, c: 3 });
  });

  it('a tap in a vertical groove asks for a vertical wall', () => {
    // groove right of column 4 (x = 386), beside row 5
    expect(wallFromTap(386, 480, 'h')).toEqual({ o: 'v', r: 5, c: 4 });
  });

  it('a tap right on a groove crossing keeps the current orientation', () => {
    expect(wallFromTap(310, 234, 'v')).toEqual({ o: 'v', r: 2, c: 3 });
    expect(wallFromTap(310, 234, 'h')).toEqual({ o: 'h', r: 2, c: 3 });
  });

  it('a tap on a tile keeps the current orientation', () => {
    expect(wallFromTap(44, 44, 'v')).toEqual({ o: 'v', r: 0, c: 0 });
    expect(wallFromTap(44, 44, 'h')).toEqual({ o: 'h', r: 0, c: 0 });
  });

  it('snaps a tap to the nearest groove crossing', () => {
    expect(nearestAnchor(82, 82)).toEqual({ r: 0, c: 0 });
    expect(nearestAnchor(100, 170)).toEqual({ r: 1, c: 0 });
    expect(nearestAnchor(0, 0)).toEqual({ r: 0, c: 0 }); // clamped to the board
    expect(nearestAnchor(708, 708)).toEqual({ r: 7, c: 7 });
  });
});

describe('the Pig player\'s flipped view', () => {
  it('puts the Pig at the bottom and the Cow at the top', () => {
    expect(flipTile(START.pig, true)).toEqual({ r: 8, c: 4 });
    expect(flipTile(START.cow, true)).toEqual({ r: 0, c: 4 });
    expect(flipTile({ r: 2, c: 1 }, true)).toEqual({ r: 6, c: 7 });
  });

  it('leaves the Cow player\'s view unchanged', () => {
    expect(flipTile({ r: 2, c: 1 }, false)).toEqual({ r: 2, c: 1 });
    expect(flipWall({ o: 'h', r: 2, c: 1 }, false)).toEqual({ o: 'h', r: 2, c: 1 });
  });

  it('flipping twice gets back to the start', () => {
    for (let r = 0; r <= 8; r++) {
      for (let c = 0; c <= 8; c++) {
        expect(flipTile(flipTile({ r, c }, true), true)).toEqual({ r, c });
      }
    }
  });

  it('a tap on the Pig\'s screen maps to the right real tile', () => {
    // The Pig taps the tile just above its piece on screen (view row 7, column 4)...
    const center = tileRect({ r: 7, c: 4 });
    const tapped = tileAt(center.x + 32, center.y + 32)!;
    // ...which is the tile just below the Pig in canonical coordinates.
    expect(flipTile(tapped, true)).toEqual({ r: 1, c: 4 });
  });

  it('a flipped wall blocks exactly the same tiles', () => {
    const flipped = true;
    const walls: Wall[] = [];
    for (const o of ['h', 'v'] as const) {
      for (let r = 0; r <= 7; r++) for (let c = 0; c <= 7; c++) walls.push({ o, r, c });
    }
    const steps: Pos[] = [{ r: 1, c: 0 }, { r: 0, c: 1 }];
    for (const w of walls) {
      const viewWall = [flipWall(w, flipped)];
      for (let r = 0; r <= 8; r++) {
        for (let c = 0; c <= 8; c++) {
          for (const s of steps) {
            const a = { r, c };
            const b = { r: r + s.r, c: c + s.c };
            if (b.r > 8 || b.c > 8) continue;
            const real = isBlocked(a, b, [w]);
            const drawn = isBlocked(flipTile(a, flipped), flipTile(b, flipped), viewWall);
            expect(drawn).toBe(real);
          }
        }
      }
    }
  });
});
