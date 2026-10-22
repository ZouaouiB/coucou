// T24 fork — whether the Coucou window is hidden or still opening. The opening
// itself is Windows' own: the window rises out of its taskbar button
// (src-tauri/src/t24_hub_motion.rs). The page draws no motion of its own for
// it; it only keeps still meanwhile.
//
// Loaded with pageTransition.ts, which asks opening() so a page picked as the
// window opens (Réglages in the island) swaps in place under it.

import { onEvent } from "../core/bridge";
import { FlowBridge } from "../core/flow";

/** The 60 ms the taskbar button takes to appear, then Windows' restore motion. */
const OPEN_MS = 360;

/** In the browser (no Tauri) the window is simply on screen. */
let shown = true;
let openedAt = -Infinity;

/** Whether the window is hidden or still opening: no page slides then. */
export function opening(): boolean {
  return !shown || performance.now() - openedAt < OPEN_MS;
}

function setShown(on: boolean) {
  if (on === shown) return;
  shown = on;
  if (on) openedAt = performance.now();
}

void onEvent<boolean>("hub-visible", setShown);
// The window is created hidden at launch: the first opening starts from there.
void FlowBridge.hubShown().then((on) => {
  if (on !== null) setShown(on);
});
