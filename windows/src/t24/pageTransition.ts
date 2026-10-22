// T24 fork — the Coucou window's page switches. A new page rises into the
// panel from the side of the sidebar it was picked on (lower in the list:
// from below, higher: from above) while the page being left drifts the other
// way and fades. Redrawing the page on screen (a toggle, a language change)
// swaps it in place, where it was scrolled to.
//
// Kept out of hub/shell.ts so upstream syncs merge cleanly: the shell only
// calls swapPage().

import "./hub-polish.css";
import { clear } from "../views/dom";
import { opening } from "./windowOpen";

const ENTER_MS = 420;
const ENTER_DELAY_MS = 60;
const LEAVE_MS = 170;
const ENTER_SHIFT = 18;
const LEAVE_SHIFT = 10;
/** Decelerates hard and settles softly: no visible end to the motion. */
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_IN = "cubic-bezier(0.4, 0, 1, 1)";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

let entering: Animation | null = null;
let leaving: HTMLElement | null = null;

/**
 * Puts `next` in the panel's scroll view. `direction` is where the new page
 * sits in the sidebar against the old one: 1 below, -1 above, 0 the same page,
 * which is redrawn in place without moving.
 */
export function swapPage(scroll: HTMLElement, next: HTMLElement, direction: number) {
  settle();
  // The window opening is the motion then: the page is simply there.
  const still = reducedMotion.matches || opening();
  if (direction === 0) {
    const top = scroll.scrollTop;
    clear(scroll);
    scroll.append(next);
    scroll.scrollTop = top;
    return;
  }
  const old = scroll.firstElementChild as HTMLElement | null;
  if (old && !still) leave(scroll, old, direction);
  clear(scroll);
  scroll.append(next);
  scroll.scrollTop = 0;
  if (still) return;
  // No fill once finished: a transform left on the page would become the
  // containing block of the fixed popups inside it.
  entering = next.animate(
    [
      { opacity: 0, transform: `translateY(${direction * ENTER_SHIFT}px)` },
      { opacity: 1, transform: "none" },
    ],
    { duration: ENTER_MS, delay: ENTER_DELAY_MS, easing: EASE_OUT, fill: "backwards" },
  );
}

/** Lays the old page over the panel, scrolled as it was, and fades it out. */
function leave(scroll: HTMLElement, old: HTMLElement, direction: number) {
  const box = scroll.getBoundingClientRect();
  const top = scroll.scrollTop;
  const layer = document.createElement("div");
  layer.className = `${scroll.className} t24-leaving`;
  layer.setAttribute("aria-hidden", "true");
  layer.inert = true;
  Object.assign(layer.style, {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  });
  layer.append(old);
  document.body.append(layer);
  layer.scrollTop = top;
  leaving = layer;
  old
    .animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: `translateY(${-direction * LEAVE_SHIFT}px)` },
      ],
      { duration: LEAVE_MS, easing: EASE_IN, fill: "forwards" },
    )
    .finished.then(() => layer.remove(), () => layer.remove());
}

/** Ends the switch still running, for a click that comes before it's over. */
function settle() {
  entering?.finish();
  entering = null;
  leaving?.remove();
  leaving = null;
}
