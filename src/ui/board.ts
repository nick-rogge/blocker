// Draws the board as one SVG: background, last-move marks, highlights, walls, then pieces.
// Everything is placed in the board's own 708-unit coordinates, so it scales to any screen.

import type { GameState, Pos, Side, Wall } from '../game/types.ts';
import { asset } from './dom.ts';
import { BOARD, flipTile, flipWall, isFlipped, pieceRect, tileRect, wallRect, type Rect } from './layout.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface BoardView {
  state: GameState;
  /** The position before the last move, so the last move can be highlighted. */
  previous: GameState | null;
  /** Whose screen this is. The Pig's screen is drawn rotated 180°. */
  viewer: Side;
  /** Tiles to highlight as legal destinations (canonical coordinates). */
  highlights?: Pos[];
  /** A move the player has picked but not confirmed: a see-through piece on this tile (canonical). */
  pendingTo?: Pos;
  /** A wall the player has picked but not confirmed (canonical), drawn see-through; red if not allowed. */
  ghostWall?: { wall: Wall; legal: boolean };
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function image(name: string, rect: Rect, cls = ''): SVGImageElement {
  return svgEl('image', { href: asset(name), ...rect, class: cls, preserveAspectRatio: 'none' });
}

function grow(rect: Rect, by: number): Rect {
  return { x: rect.x - by, y: rect.y - by, width: rect.width + 2 * by, height: rect.height + 2 * by };
}

export function createBoardSvg(): SVGSVGElement {
  return svgEl('svg', {
    viewBox: `0 0 ${BOARD} ${BOARD}`,
    class: 'board',
    role: 'img',
    'aria-label': 'Game board',
  });
}

export function drawBoard(svg: SVGSVGElement, view: BoardView): void {
  const { state, previous } = view;
  const flipped = isFlipped(view.viewer);
  const tile = (p: Pos) => flipTile(p, flipped);

  svg.replaceChildren(image('blocker-board.svg', { x: 0, y: 0, width: BOARD, height: BOARD }));

  // Last move: a glow behind a new wall, or a dashed outline where the piece came from.
  if (previous) {
    const mover = previous.turn;
    if (state.walls.length > previous.walls.length) {
      const newest = state.walls[state.walls.length - 1];
      svg.append(svgEl('rect', { ...grow(wallRect(flipWall(newest, flipped)), 5), rx: 3, class: 'last-wall' }));
    } else {
      svg.append(svgEl('rect', { ...grow(tileRect(tile(previous[mover])), -4), rx: 4, class: 'last-from' }));
      svg.append(svgEl('rect', { ...grow(tileRect(tile(state[mover])), -2), rx: 5, class: 'last-to' }));
    }
  }

  for (const p of view.highlights ?? []) {
    svg.append(svgEl('rect', { ...grow(tileRect(tile(p)), -6), rx: 6, class: 'highlight' }));
  }

  for (const w of state.walls) {
    const viewWall = flipWall(w, flipped);
    svg.append(image(w.o === 'h' ? 'wall-horizontal.svg' : 'wall-vertical.svg', wallRect(viewWall)));
  }

  if (view.ghostWall) {
    const { wall, legal } = view.ghostWall;
    const rect = wallRect(flipWall(wall, flipped));
    svg.append(image(wall.o === 'h' ? 'wall-horizontal.svg' : 'wall-vertical.svg', rect, 'ghost'));
    svg.append(svgEl('rect', { ...grow(rect, 2), class: legal ? 'ghost-ok' : 'ghost-bad' }));
  }

  for (const side of ['cow', 'pig'] as const) {
    svg.append(image(`${side}.svg`, pieceRect(tile(state[side])), `piece piece-${side}`));
  }

  if (view.pendingTo) {
    const target = tile(view.pendingTo);
    svg.append(svgEl('rect', { ...grow(tileRect(target), -2), rx: 5, class: 'selected' }));
    svg.append(image(`${view.viewer}.svg`, pieceRect(target), 'ghost'));
  }
}
