// Your turn: the Move / Wall toggle, tapping the board, the ghost preview, and Confirm.
// Nothing is committed until Confirm, so a mis-tap never costs you a move.

import { checkMove, legalSteps } from '../game/rules.ts';
import type { GameState, IllegalReason, Move, Side } from '../game/types.ts';
import { drawBoard } from './board.ts';
import { el } from './dom.ts';
import { BOARD, flipTile, flipWall, isFlipped, tileAt, wallFromTap } from './layout.ts';

type Mode = 'move' | 'wall';

const WALL_PROBLEM: Partial<Record<IllegalReason, string>> = {
  overlap: 'That spot overlaps another wall.',
  crosses: 'That wall would cross another wall.',
  'blocks-path': "Walls can't completely block a path to the goal.",
  'no-walls-left': "You're out of walls.",
  'out-of-bounds': "That wall doesn't fit on the board.",
};

export interface TurnOptions {
  svg: SVGSVGElement;
  state: GameState;
  previous: GameState | null;
  viewer: Side;
  /** Called with the confirmed move. */
  onConfirm: (move: Move) => void;
}

export function createTurnControls(opts: TurnOptions): HTMLElement {
  const { svg, state, previous, viewer } = opts;
  const flipped = isFlipped(viewer);
  const steps = legalSteps(state);
  const wallsLeft = state.wallsLeft[viewer];

  let mode: Mode = 'move';
  let orientation: 'h' | 'v' = 'h';
  let pending: Move | null = null;

  // ---------- controls ----------
  const moveBtn = el('button', { class: 'btn seg', type: 'button' }, 'Move');
  const wallBtn = el(
    'button',
    { class: 'btn seg', type: 'button', 'aria-label': `Wall, ${wallsLeft} left` },
    'Wall ',
    el('span', { class: 'seg-count' }, `×${wallsLeft}`),
  );
  const rotateBtn = el('button', { class: 'btn seg seg-rotate', type: 'button', 'aria-label': 'Rotate wall' }, '↻');
  const hint = el('p', { class: 'hint' });
  const confirmBtn = el('button', { class: 'btn btn-big btn-send', type: 'button' }, 'Confirm & Send');

  if (wallsLeft === 0) wallBtn.setAttribute('disabled', '');

  const pendingCheck = () => (pending ? checkMove(state, pending) : null);

  function render(): void {
    const check = pendingCheck();
    const pendingStep = pending?.kind === 'step' ? pending : null;
    const pendingTo = pendingStep ? steps.find((s) => s.dir === pendingStep.dir)?.to : undefined;

    drawBoard(svg, {
      state,
      previous,
      viewer,
      highlights: mode === 'move' ? steps.map((s) => s.to) : [],
      pendingTo,
      ghostWall: pending?.kind === 'wall' ? { wall: pending.wall, legal: check?.ok ?? false } : undefined,
    });

    moveBtn.setAttribute('aria-pressed', String(mode === 'move'));
    wallBtn.setAttribute('aria-pressed', String(mode === 'wall'));
    rotateBtn.hidden = mode !== 'wall';

    hint.classList.remove('hint-bad');
    if (!pending) {
      hint.textContent = mode === 'move' ? 'Tap a glowing tile to move there.' : 'Tap a groove between tiles to place a wall.';
    } else if (check?.ok) {
      hint.textContent = pending.kind === 'step' ? 'Moving here. Tap Confirm to send it.' : 'Wall goes here. Tap Confirm to send it.';
    } else {
      hint.textContent = (check && !check.ok && WALL_PROBLEM[check.reason]) || "You can't go there.";
      hint.classList.add('hint-bad');
    }

    confirmBtn.toggleAttribute('disabled', !check?.ok);
  }

  // ---------- input ----------
  function setMode(next: Mode): void {
    if (mode === next) return;
    mode = next;
    pending = null;
    render();
  }

  moveBtn.addEventListener('click', () => setMode('move'));
  wallBtn.addEventListener('click', () => setMode('wall'));

  rotateBtn.addEventListener('click', () => {
    orientation = orientation === 'h' ? 'v' : 'h';
    if (pending?.kind === 'wall') pending = { kind: 'wall', wall: { ...pending.wall, o: orientation } };
    render();
  });

  svg.addEventListener('click', (event) => {
    // Convert the tap from screen pixels to board units (the board is 708 units wide at any size).
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * BOARD;
    const y = ((event.clientY - box.top) / box.height) * BOARD;

    if (mode === 'move') {
      const viewTile = tileAt(x, y);
      const target = viewTile && flipTile(viewTile, flipped);
      const step = target && steps.find((s) => s.to.r === target.r && s.to.c === target.c);
      pending = step ? { kind: 'step', dir: step.dir } : null;
    } else {
      const viewWall = wallFromTap(x, y, orientation);
      orientation = viewWall.o;
      pending = { kind: 'wall', wall: flipWall(viewWall, flipped) };
    }
    render();
  });

  confirmBtn.addEventListener('click', () => {
    if (pending && checkMove(state, pending).ok) opts.onConfirm(pending);
  });

  render();

  return el(
    'div',
    { class: 'status status-turn' },
    el('p', { class: 'message' }, 'Your move'),
    el('div', { class: 'segmented', role: 'group', 'aria-label': 'Move or place a wall' }, moveBtn, wallBtn, rotateBtn),
    hint,
    confirmBtn,
  );
}
