// Remembers which game links this phone has sent, and as which animal.
//
// Without accounts, a link can't say who is opening it. So when you reopen a link you
// already sent, this is how the app knows to show "Waiting for the Pig" instead of
// letting you play your opponent's move. It's kept in this browser only. If it's
// missing (private browsing, cleared data), the app falls back to "whoever opens the
// link plays the side whose turn it is", which is still correct for your opponent.

import type { Side } from '../game/types.ts';

const KEY = 'blocker.sent.v1';
const MAX_ENTRIES = 200;

function load(): [string, Side][] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as [string, Side][]) : [];
  } catch {
    return [];
  }
}

export function rememberSent(code: string, side: Side): void {
  try {
    const entries = load().filter(([c]) => c !== code);
    entries.push([code, side]);
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Storage unavailable: nothing to do, the fallback still works.
  }
}

/** The animal this phone played when it sent `code`, or null if it didn't send it. */
export function sentBy(code: string): Side | null {
  const found = load().find(([c]) => c === code);
  return found ? found[1] : null;
}
