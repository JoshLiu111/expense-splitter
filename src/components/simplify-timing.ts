/**
 * Simplify's timing, in milliseconds. Before and After play alike: their
 * arrows draw in one at a time, each amount appearing as its arrow lands.
 * Before then holds, fades out, and After draws in the same way.
 */
export const SIMPLIFY_TIMING = {
  /** Each arrow starts this long after the previous one… */
  staggerMs: 300,
  /** …and takes this long to draw. */
  drawMs: 900,
  /** The stagger shrinks for long lists so drawing one side never exceeds this. */
  maxDrawStageMs: 2400,
  /** Once drawn, Before stays this long before fading. */
  holdMs: 1000,
  /** Before's arrows fade out over this, then After starts drawing. */
  fadeMs: 600,
  /** An amount fades in over this as its arrow lands. */
  labelMs: 200,
  /** Start anyway if the browser never reports that scrolling ended. */
  scrollWaitMs: 1000,
  /** Fades front-load, like the rest of the app. */
  fadeEase: "var(--ease-standard)",
  /** Drawing is even-paced, so the line visibly travels from payer to recipient. */
  drawEase: "cubic-bezier(0.45, 0, 0.35, 1)",
};

/** The gap between arrows starting, for a side with `count` arrows. */
export function staggerFor(count: number): number {
  const { staggerMs, drawMs, maxDrawStageMs } = SIMPLIFY_TIMING;
  return count > 1 ? Math.min(staggerMs, Math.max(0, maxDrawStageMs - drawMs) / (count - 1)) : 0;
}

/** How long a side with `count` arrows takes to draw. */
export function stageMs(count: number): number {
  return staggerFor(count) * Math.max(0, count - 1) + SIMPLIFY_TIMING.drawMs;
}

/**
 * How long Simplify runs once the graph is in view (scrolling, at most
 * `scrollWaitMs`, comes first): until it switches to After, and until
 * After's last arrow and amount are in.
 */
export function simplifyDurations(beforeCount: number, afterCount: number): { toAfterMs: number; totalMs: number } {
  const { holdMs, fadeMs, labelMs } = SIMPLIFY_TIMING;
  const toAfterMs = stageMs(beforeCount) + holdMs;
  return { toAfterMs, totalMs: toAfterMs + fadeMs + stageMs(afterCount) + labelMs };
}
