// Small helpers for building the page without a framework.

import type { Side } from '../game/types.ts';

export const ANIMAL: Record<Side, string> = { cow: 'Cow', pig: 'Pig' };

/** URL of a file in public/. Works locally and under the GitHub Pages /repo-name/ path. */
export function asset(name: string): string {
  return import.meta.env.BASE_URL + name;
}

type Child = Node | string | null | false;

/** Creates an HTML element: el('button', { class: 'big' }, 'Click me'). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) {
    if (child === null || child === false) continue;
    node.append(child);
  }
  return node;
}

/** The pixel-art face of an animal, for use next to text. */
export function animalIcon(side: Side, extraClass = ''): HTMLImageElement {
  return el('img', {
    class: `icon ${extraClass}`.trim(),
    src: asset(`${side}.svg`),
    alt: ANIMAL[side],
    width: '48',
    height: '48',
  });
}
