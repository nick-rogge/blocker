// Entry point: reads the link and shows the right screen.
//   no game in the link   → start screen
//   broken or edited link → "Whomp Whomp" screen
//   a valid game          → the board

import './style.css';
import { decodeLink, encodeLink, type GameLink } from './codec/codec.ts';
import { other } from './game/rules.ts';
import type { GameState, Move, Side } from './game/types.ts';
import { createBoardSvg, drawBoard } from './ui/board.ts';
import { ANIMAL, animalIcon, el } from './ui/dom.ts';
import { rememberSent, sentBy } from './ui/sent.ts';
import { shareLink } from './ui/share.ts';
import { createTurnControls } from './ui/turn.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;

function goToStart(): void {
  history.pushState(null, '', location.pathname + location.search);
  route();
}

function newGameButton(): HTMLButtonElement {
  const button = el('button', { class: 'btn' }, 'New Game');
  button.addEventListener('click', goToStart);
  return button;
}

// ---------- start screen ----------

function showStart(): void {
  const startAs = (side: Side) => {
    const button = el('button', { class: 'btn btn-big' }, animalIcon(side), `Start New Game as ${ANIMAL[side]}`);
    button.addEventListener('click', () => {
      const code = encodeLink({ creator: side, moves: [] });
      rememberSent(code, side);
      location.hash = code;
    });
    return button;
  };

  app.replaceChildren(
    el(
      'main',
      { class: 'screen start' },
      el('h1', { class: 'title' }, 'Blocker'),
      el('div', { class: 'faceoff' }, animalIcon('cow', 'icon-xl'), el('span', { class: 'vs' }, 'VS'), animalIcon('pig', 'icon-xl')),
      el('p', { class: 'tagline' }, 'Race your animal across the board. Drop walls to slow your opponent down.'),
      el('div', { class: 'stack' }, startAs('cow'), startAs('pig')),
      el('p', { class: 'fine' }, 'Each move makes a new link. Text it to your opponent and wait for theirs.'),
    ),
  );
}

// ---------- broken link ----------

function showBroken(): void {
  app.replaceChildren(
    el(
      'main',
      { class: 'screen broken' },
      el('h1', { class: 'title title-small' }, 'Blocker'),
      el('p', { class: 'message' }, 'This game link is broken or was edited. Whomp Whomp'),
      newGameButton(),
    ),
  );
}

// ---------- the game ----------

function wallCount(label: string, count: number): HTMLElement {
  return el('span', { class: 'walls' }, `${label} `, el('strong', {}, String(count)));
}

function sendSection(url: string, opponent: Side): HTMLElement {
  const button = el('button', { class: 'btn btn-big btn-send' }, 'Send to opponent');
  const note = el('p', { class: 'fine' });
  const section = el('div', { class: 'stack' }, button, note);

  button.addEventListener('click', async () => {
    const result = await shareLink(url, ANIMAL[opponent]);
    if (result === 'copied') note.textContent = 'Link copied. Paste it in your text to your opponent.';
    if (result === 'shared') note.textContent = 'Sent! Wait for their link to come back.';
    if (result === 'unavailable') {
      // No share sheet or clipboard (e.g. testing over plain http): let them copy it by hand.
      const box = el('input', { class: 'link-box', readonly: '', value: url });
      note.replaceChildren('Copy this link and text it to your opponent:', box);
      box.focus();
      box.select();
    }
  });
  return section;
}

/** Commits a move: makes the new link, remembers this phone sent it, and opens the share sheet. */
function confirmMove(link: GameLink, move: Move, viewer: Side): void {
  const next: GameLink = { creator: link.creator, moves: [...link.moves, move] };
  const code = encodeLink(next);
  rememberSent(code, viewer);
  history.pushState(null, '', '#' + code);
  route();
  // Still inside the Confirm tap, so the phone allows the share sheet to open right away.
  document.querySelector<HTMLButtonElement>('.btn-send')?.click();
}

function showGame(link: GameLink, state: GameState, previous: GameState | null): void {
  // Who is looking? If this phone sent this exact link, it's the sender (waiting).
  // Otherwise whoever opens a link plays the side whose turn it is.
  const sender = sentBy(encodeLink(link));
  const viewer: Side = sender ?? state.turn;
  const opponent = other(viewer);
  const myTurn = !state.winner && sender === null;
  const svg = createBoardSvg();

  let status: HTMLElement;
  if (state.winner) {
    status = el(
      'div',
      { class: 'status status-win' },
      el('p', { class: 'message' }, state.winner === viewer ? 'You win!' : `The ${ANIMAL[state.winner]} wins!`),
      // The winner still has to send the final link so the other player sees the result.
      sender !== null && sendSection(location.href, opponent),
      newGameButton(),
    );
    drawBoard(svg, { state, previous, viewer });
  } else if (myTurn) {
    status = createTurnControls({ svg, state, previous, viewer, onConfirm: (move) => confirmMove(link, move, viewer) });
  } else {
    status = el(
      'div',
      { class: 'status status-wait' },
      el('p', { class: 'message' }, link.moves.length === 0 ? 'Send this link to start the game' : `Waiting for the ${ANIMAL[opponent]}`),
      sendSection(location.href, opponent),
    );
    drawBoard(svg, { state, previous, viewer });
  }

  app.replaceChildren(
    el(
      'main',
      { class: 'screen game' },
      el(
        'header',
        { class: 'bar' },
        el('div', { class: 'me' }, animalIcon(viewer), el('span', {}, 'You are the ', el('strong', {}, ANIMAL[viewer]))),
        el('div', { class: 'counts' }, wallCount('Your walls', state.wallsLeft[viewer]), wallCount(`${ANIMAL[opponent]}'s`, state.wallsLeft[opponent])),
      ),
      el('div', { class: 'board-wrap' }, svg),
      status,
    ),
  );
}

// ---------- routing ----------

function route(): void {
  const hash = location.hash.replace(/^#/, '');
  if (!hash) return showStart();
  const result = decodeLink(hash);
  if (!result.ok) return showBroken();
  showGame(result.link, result.state, result.previous);
}

window.addEventListener('hashchange', route);
window.addEventListener('popstate', route);
route();
