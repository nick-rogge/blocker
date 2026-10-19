// Sends a game link: the phone's share sheet if it has one, otherwise copy to the clipboard.

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'unavailable';

export async function shareLink(url: string, animalName: string): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Blocker', text: `Your move against the ${animalName} in Blocker!`, url });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Any other error: fall through and try the clipboard.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    // Clipboard and share sheet only work on https:// or localhost.
    return 'unavailable';
  }
}
