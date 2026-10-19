# CLAUDE.md — Blocker Game

## What this project is

Blocker Game is a two-player, **serverless** take on Quoridor. There is no backend, no database, and no accounts. The entire game state lives in the URL. Players take turns by texting each other a link: open the link, make one move, and the game produces a new link with all moves so far encoded in it. Send that new link back to the other player.

The project is open source (MIT) and hosted on **GitHub Pages**.

## Core flow (the URL is the game)

1. **Player A starts a game.** The start screen has two buttons: **"Start New Game as Cow"** and **"Start New Game as Pig."** The app makes a link that records which animal Player A chose, and Player A texts it to Player B.
2. **Player B opens the link.** They are automatically the other animal. Player B makes the first move, and the app produces a new link for B to text back to A.
3. **Player A opens the new link,** sees B's move, makes their own move, and sends the next link.
4. Play continues back and forth until one piece reaches its goal edge. The game then shows the winner and a **"New Game"** button that returns to the start screen.

Whoever opens a link plays the side whose turn it is. Reopening a link you already sent shows the board with input disabled and the message "Waiting for the [Cow/Pig]."

Every screen must make clear: whose turn it is, which animal the viewer is, and a single obvious "Send to opponent" action after a move. Use the Web Share API (`navigator.share({ url })`) on mobile when available, and fall back to copying to the clipboard.

## Game rules

- **Board:** 9×9 grid of tiles.
- **Pieces:** One Cow and one Pig, each starting in the middle column of its own home edge. In canonical coordinates (rows and columns count from 0):
  - **Cow** starts at row 8, column 4 and wins by reaching **any tile in row 0**.
  - **Pig** starts at row 0, column 4 and wins by reaching **any tile in row 8**.
- **On your turn, do exactly one of:**
  - **Move** your piece one tile up, down, left, or right (orthogonal only), or
  - **Place a wall.**
- **Walls:**
  - A wall is 2 tiles long and sits in the grooves between tiles, blocking movement across it.
  - It can be placed horizontally or vertically.
  - It must stay fully inside the 9×9 board (anchors 0–7 in each direction; no out-of-bounds placement).
  - It cannot overlap another wall, and cannot cross another wall at the same midpoint (a horizontal and a vertical wall can't form an X).
  - Placed walls are permanent.
- **No shared tiles (classic jump rule):** Two pieces can never be on the same tile. A piece is never blocked by the other piece, only by walls and the board edge. When your piece is next to the opponent's and you move toward it, you **jump straight over** to the tile directly behind the opponent.
- **Win:** The first piece to reach its goal edge wins. The game ends immediately, and the link shows a final/won state that can't be played further.

### Classic Quoridor defaults (assumed — confirm or change)

Your rules don't cover these, so the standard Quoridor rules apply unless told otherwise:

- Each player has **10 walls**. Show the remaining count for both players.
- A wall **may not completely cut off** either piece from its goal edge. Validate every wall placement with a path search (BFS) for both pieces and reject it if either has no path. Pieces are ignored in this check; only walls and edges count.
- **Blocked jump → diagonal:** If the tile behind the opponent is blocked by a wall or the board edge, you may instead move diagonally to the tile on the opponent's left or right side, unless a wall blocks that side.

## Board orientation (flipped view)

- Each viewer always sees **their own animal at the bottom, moving up.**
- The Cow's viewer sees the canonical board. The Pig's viewer sees it **rotated 180°**.
- The flip is display-only. The rules engine and the link format always use canonical coordinates. The UI converts taps to canonical coordinates before calling the engine, and converts back for drawing.

## URL / state design

- Store state in the **URL fragment** (`#...`), not the query string, so it is never sent to a server or logged by the host.
- **Encode the full move history**, not a board snapshot. The app replays the history from the start and validates every move on load. This catches tampered or broken links and makes "highlight the last move" trivial.
- Format: `#v1.<creator>.<moves>`
  - `v1` — format version, so the format can change later without breaking old links
  - `<creator>` — `c` if Player A started as Cow, `p` if as Pig
  - `<moves>` — one token per move, in order:
    - Piece move: `U` `D` `L` `R` (canonical directions; `U` is toward row 0). A jump is the same letter: moving toward an adjacent opponent jumps over it.
    - Diagonal move (only after a blocked jump): `Q` up-left, `E` up-right, `Z` down-left, `X` down-right
    - Wall: `h` or `v`, then one base-64 character for the anchor index `row * 8 + col` (0–63)
  - Example: `#v1.c.UUhAvFLR`
- Player B (the non-creator) always moves first, so the side to move is derived from the creator and the move count. Positions, wall counts, and whose turn it is are all derived by replay.
- If a link fails to decode or replay, show a friendly **"This game link is broken or was edited. Whomp Whomp"** screen — never a blank page or crash.
- Older links from the same game show that earlier position. The player who opens one can only move if it's actually their turn in that state. There is no server to know a newer link exists, so don't try to detect that.

## Tech stack

- **Vite + TypeScript, no UI framework.** Builds to static files.
- **Vitest** for unit tests.
- **Hosting: GitHub Pages**, deployed by a GitHub Actions workflow on every push to `main`. Set `base: '/<repo-name>/'` in `vite.config.ts` so asset paths work under the project URL.
- No backend, no database, no analytics, no accounts, no third-party calls at runtime.
- Mobile-first: players open these links from a text message on their phones. Large tap targets, one-handed use, no hover-only interactions.
- **License:** MIT (add `LICENSE` at the repo root).

## Assets

All in-game art is **SVG** (smaller files, crisp on every screen). The only PNG is the link preview, because text-message apps don't show SVG previews.

| File | Size (SVG units) | Notes |
| --- | --- | --- |
| `Blocker/Assets/SVGs/blocker-board.svg` | 708 × 708 | Grass tiles, cobblestone grooves |
| `Blocker/Assets/SVGs/cow.svg` | 48 × 48 | Square pixel-art cow face (original art) |
| `Blocker/Assets/SVGs/pig.svg` | 48 × 48 | Square pixel-art pig face (original art) |
| `Blocker/Assets/SVGs/wall-horizontal.svg` | 140 × 12 | Wooden plank wall |
| `Blocker/Assets/SVGs/wall-vertical.svg` | 12 × 140 | Wooden plank wall |
| `Blocker/Assets/blocker-preview.png` | 1200 × 630 px | Link-preview image (must stay PNG) |

When scaffolding the Vite project, copy these into `public/` so they're served as static files.

Draw the board as one `<svg viewBox="0 0 708 708">` and place everything in the same units. Layout math: tile 64, groove 12, step 76.

- Tile top-left: `x = 12 + 76·c`, `y = 12 + 76·r`
- Piece (48) top-left: `x = 20 + 76·c`, `y = 20 + 76·r`
- Horizontal wall below row `r`, covering columns `c` and `c+1`: `x = 12 + 76·c`, `y = 76 + 76·r`
- Vertical wall right of column `c`, covering rows `r` and `r+1`: `x = 76 + 76·c`, `y = 12 + 76·r`

Link preview: set Open Graph title/description/image in `index.html` so the text thread shows "Blocker Game — your move!" rather than a raw URL. Use the **absolute** `https://` URL of `blocker-preview.png`, plus `og:image:width` 1200, `og:image:height` 630, and `twitter:card` `summary_large_image`.

## Code organization

Keep game logic pure and separate from the UI:

- `src/game/` — rules engine with no DOM access: state type, `applyMove`, `isLegalMove`, `legalMoves` (including jumps and diagonals), wall overlap/crossing checks, BFS path check, win detection.
- `src/codec/` — encode/decode move history ⇄ URL fragment, with versioning.
- `src/ui/` — SVG board rendering, board flip, input handling, share flow, start screen, winner screen.

## UX details

- **Start screen:** "Start New Game as Cow" / "Start New Game as Pig."
- **Winner screen:** announce the winner and show a "New Game" button.
- Pig and Cow icons must be clearly distinguishable at small sizes; don't rely on color alone.
- A **Move / Wall** mode toggle, so a tap is never ambiguous on a phone.
- Move mode: highlight only the legal destination tiles, including jump and diagonal tiles.
- Wall mode: a tap snaps to the nearest groove intersection and shows a see-through ghost wall, with a ↻ button to rotate. Illegal spots show red with the reason (overlap, out of bounds, blocks a path, no walls left).
- A **Confirm** step before generating the next link, so a mis-tap doesn't commit a move.
- Highlight the opponent's last move when a link is opened.

## Testing

- Unit-test the rules engine: wall overlap/crossing, board bounds, path-blocking rejection, straight jumps, diagonal moves when a jump is blocked, pieces never sharing a tile, wall counts, win detection.
- Round-trip test the codec: `decode(encode(history))` equals `history` for random legal games.
- Test that tampered links (illegal move inserted, truncated string, wrong version) are rejected cleanly.
- Test the board flip: a tap on the Pig's rotated view maps to the correct canonical tile.

## Working conventions

- Before changing rules or the URL format, check this file; if a change is needed, update this file in the same change.
- Never break existing links silently — bump the format version and keep a decoder for older versions.
