"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Play } from "lucide-react";
import {
  computeLedger,
  formatMoney,
  type DebtEdge,
  type ExplainedSettlement,
  type GroupSnapshot,
  type SettlementExplanation,
} from "@/domain";
import { layoutDebtGraph, NODE, SIZE, type EdgeLayout } from "@/components/debt-graph-layout";
import { SIMPLIFY_TIMING, simplifyDurations, staggerFor } from "@/components/simplify-timing";
import { avatarFill, initials, textColourOn } from "@/components/member-avatar";
import { PaymentSources } from "@/components/payment-sources";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/components/use-media-query";
import { pluralize } from "@/lib/format";

type Phase = "before" | "after";

/** After's arrows: neutral ink, since cobalt is only for what can be acted on. */
const AFTER_INK = "var(--color-text-primary)";
const BEFORE_INK = "var(--color-text-secondary)";

/** What the graph shows: one side, or nothing while Simplify starts over. */
type GraphPhase = Phase | "none";

/**
 * How the arrows move: not at all (reduced motion, or resetting before a
 * run), a plain crossfade (the Before/After toggle), or Simplify's stages.
 */
type Motion = "instant" | "toggle" | "staged";

/** How one arrow gets to its state: when it starts drawing, in a staged run. */
interface EdgeMotion {
  motion: Motion;
  delayMs: number;
}

/** A selectable pill, as in the Expense form's chips. */
const toggleClass =
  "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-border-input bg-surface px-4 text-sm font-semibold transition-colors duration-(--duration-fast) hover:bg-bg-tertiary aria-pressed:border-accent aria-pressed:bg-accent-subtle focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none";

/**
 * "Why these payments?": the Group's debts before Debt Simplification (who
 * owes whom, pair by pair) turning into the Suggested Settlements after it.
 * It opens on Before; "Simplify" brings the graph into view, draws Before
 * arrow by arrow, holds it, fades it out and draws After the same way (or
 * switches at once under reduced motion). The lists below say the same in words.
 */
export default function WhyThesePayments({
  group,
  explanation,
}: {
  group: GroupSnapshot;
  explanation: SettlementExplanation;
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [phase, setPhase] = useState<GraphPhase>("before");
  const [motion, setMotion] = useState<Motion>("instant");
  // Read out once Simplify has finished, since the graph itself says nothing.
  const [announcement, setAnnouncement] = useState("");
  // Once Simplify has played through, its button offers to play it again.
  const [played, setPlayed] = useState(false);
  // What a Simplify run still has waiting (timers, frames, scroll listeners),
  // undone by the next Simplify or toggle, or when the panel closes.
  const pending = useRef<(() => void)[]>([]);
  function cancelPending() {
    pending.current.splice(0).forEach((cancel) => cancel());
  }
  useEffect(() => cancelPending, []);
  function later(then: () => void, ms: number) {
    const timer = window.setTimeout(then, ms);
    pending.current.push(() => window.clearTimeout(timer));
  }
  function nextFrame(then: () => void) {
    const frame = requestAnimationFrame(then);
    pending.current.push(() => cancelAnimationFrame(frame));
  }
  function listen(type: "scroll" | "scrollend", then: () => void) {
    window.addEventListener(type, then, { once: true });
    pending.current.push(() => window.removeEventListener(type, then));
  }
  const summaryId = useId();
  const graph = useRef<SVGSVGElement>(null);
  // Rendered width over viewBox width, so the graph's text keeps its size on screen.
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const svg = graph.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setScale(entry.contentRect.width / SIZE);
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const money = (amount: number) => formatMoney(amount, group.currency);
  const before = explanation.before;
  // Small Change is never suggested, so the "after" graph leaves it out.
  const after = explanation.suggestions;
  const smallChange = explanation.smallChange;

  function show(p: Phase) {
    cancelPending();
    setAnnouncement("");
    setMotion(reducedMotion ? "instant" : "toggle");
    setPhase(p);
  }

  // Plays Before → After only when asked, once the graph is on screen to see it.
  function simplify() {
    cancelPending();
    const finish = () => {
      setAnnouncement(`Simplified. Showing After: ${pluralize(after.length, "Suggested Settlement")}.`);
      setPlayed(true);
    };
    // Cleared first, so the same words are read out again on the next run.
    setAnnouncement("");
    if (reducedMotion) {
      graph.current?.scrollIntoView({ block: "nearest" });
      setMotion("instant");
      setPhase("after");
      // A frame later, so the cleared status renders before the words come back.
      nextFrame(finish);
      return;
    }
    // Clear the graph at once, then draw Before, hold, and move on to After.
    setMotion("instant");
    setPhase("none");
    whenGraphInView(() => {
      // Two frames, so the cleared graph paints before drawing starts.
      nextFrame(() =>
        nextFrame(() => {
          const { toAfterMs, totalMs } = simplifyDurations(before.length, after.length);
          setMotion("staged");
          setPhase("before");
          later(() => setPhase("after"), toAfterMs);
          later(finish, totalMs);
        }),
      );
    });
  }

  function whenGraphInView(then: () => void) {
    const svg = graph.current;
    if (!svg) return then();
    const { top, bottom } = svg.getBoundingClientRect();
    const clearance = parseFloat(getComputedStyle(svg).scrollMarginBottom) || 0;
    if (top >= 0 && bottom <= window.innerHeight - clearance) return then();
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      then();
    };
    let scrolled = false;
    listen("scroll", () => (scrolled = true));
    listen("scrollend", start);
    later(start, SIMPLIFY_TIMING.scrollWaitMs);
    svg.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // The browser may find nothing to scroll after all; then no scrollend comes.
    later(() => {
      if (!scrolled) start();
    }, 100);
  }

  function motionFor(kind: Phase, index: number): EdgeMotion {
    // After waits for Before to fade; Before starts drawing straight away.
    const start = kind === "after" ? SIMPLIFY_TIMING.fadeMs : 0;
    const count = kind === "after" ? after.length : before.length;
    return { motion, delayMs: start + staggerFor(count) * index };
  }

  // Everyone with a debt either side, placed by Balance.
  const involved = new Set([...before, ...after, ...smallChange].flatMap((e) => [e.fromId, e.toId]));
  const balances = new Map(computeLedger(group).balances.map((b) => [b.memberId, b.amount]));
  const layout = layoutDebtGraph({
    members: group.members.filter((m) => involved.has(m.id)),
    balanceOf: (id) => balances.get(id) ?? 0,
    before,
    after,
    label: (edge) => money(edge.amount),
    scale,
  });
  const memberOf = new Map(group.members.map((m) => [m.id, m]));
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? "Unknown member";
  const saved = before.length - after.length;
  // E.g. every Expense paid by one Member: the debts are the Suggested Settlements already.
  const edgeKeys = (edges: DebtEdge[]) => edges.map((e) => `${e.fromId}-${e.toId}-${e.amount}`).sort().join();
  const alreadySimplest = edgeKeys(before) === edgeKeys(after);
  // Nothing to compare then: one graph of the Suggested Settlements.
  const shown: GraphPhase = alreadySimplest ? "after" : phase;
  // Under each Suggested Settlement: why it pairs these two, and what it adds up from.
  const explain = (s: ExplainedSettlement) => (
    <>
      {!s.sharedAnExpense && (
        <p className="text-text-secondary">
          {nameOf(s.fromId)} and {nameOf(s.toId)} never shared an Expense; settling directly saves the Group a
          Settlement.
        </p>
      )}
      <PaymentSources
        group={group}
        payerName={nameOf(s.fromId)}
        amount={s.amount}
        sources={s.sources}
        nameOf={nameOf}
        money={money}
      />
    </>
  );

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <p id={summaryId}>
        Before Debt Simplification, the people who shared Expenses owe each other in{" "}
        <strong>{pluralize(before.length, "debt")}</strong>.{" "}
        {alreadySimplest ? (
          <>
            These are already in their simplest form: each one is a Suggested Settlement as it
            stands, so there is nothing to simplify.
          </>
        ) : (
          <>
            Using only Balances, <strong>{pluralize(after.length, "Suggested Settlement")}</strong>{" "}
            {after.length === 1 ? "settles" : "settle"} everyone up
            {smallChange.length > 0 ? " apart from Small Change" : ""}
            {saved > 0 ? `, ${saved} fewer than before` : ""}. Every Balance is the same either way.
          </>
        )}
      </p>

      {!alreadySimplest && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Show the graph">
            {(["before", "after"] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={toggleClass}
                aria-pressed={phase === p}
                onClick={() => show(p)}
              >
                {p === "before" ? "Before" : "After"}
              </button>
            ))}
          </div>
          <Button onClick={simplify}>
            <Play aria-hidden /> {played ? "Replay" : "Simplify"}
          </Button>
        </div>
      )}

      <svg
        ref={graph}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-labelledby={summaryId}
        // scroll-mb clears the fixed Add Expense bar when Simplify scrolls the graph into view.
        className="mx-auto w-full max-w-sm scroll-mb-24"
      >
        <defs>
          <Arrowhead id={`${summaryId}-before`} color={BEFORE_INK} />
          <Arrowhead id={`${summaryId}-after`} color={AFTER_INK} />
        </defs>
        {!alreadySimplest &&
          layout.before.map((edge, i) => (
            <Edge
              motion={motionFor("before", i)}
              maskId={`${summaryId}-mask-before-${i}`}
              key={`before-${edge.edge.fromId}-${edge.edge.toId}`}
              layout={edge}
              label={money(edge.edge.amount)}
              fontSize={layout.fontSize.label}
              color={BEFORE_INK}
              marker={`${summaryId}-before`}
              shown={shown === "before"}
              dashed
            />
          ))}
        {layout.after.map((edge, i) => (
          <Edge
            motion={motionFor("after", i)}
            maskId={`${summaryId}-mask-after-${i}`}
            key={`after-${edge.edge.fromId}-${edge.edge.toId}`}
            layout={edge}
            label={money(edge.edge.amount)}
            fontSize={layout.fontSize.label}
            color={AFTER_INK}
            marker={`${summaryId}-after`}
            shown={shown === "after"}
          />
        ))}
        {layout.nodes.map((node) => {
          const fill = avatarFill(memberOf.get(node.id)!.avatarColor);
          return (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r={NODE} fill={fill} />
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={layout.fontSize.initials}
                fontWeight={700}
                fill={textColourOn(fill)}
              >
                {initials(memberOf.get(node.id)!.name)}
              </text>
              <text
                x={node.nameAt.x}
                y={node.nameAt.y}
                textAnchor={node.nameAnchor}
                dominantBaseline="central"
                fontSize={layout.fontSize.name}
                fontWeight={600}
                fill="var(--color-text-primary)"
              >
                {node.name}
              </text>
            </g>
          );
        })}
      </svg>
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {alreadySimplest ? (
        <PaymentList
          title={pluralize(after.length, "Suggested Settlement")}
          verb="pays"
          current={false}
          edges={after}
          nameOf={nameOf}
          money={money}
          detail={explain}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PaymentList
            title={`Before: ${pluralize(before.length, "debt")}`}
            verb="owes"
            current={phase === "before"}
            edges={before}
            nameOf={nameOf}
            money={money}
          />
          <PaymentList
            title={`After: ${pluralize(after.length, "Suggested Settlement")}`}
            verb="pays"
            note={smallChange.length > 0 ? "Plus Small Change, which is never suggested." : undefined}
            current={phase === "after"}
            edges={after}
            nameOf={nameOf}
            money={money}
            detail={explain}
          />
        </div>
      )}
    </div>
  );
}

function Arrowhead({ id, color }: { id: string; color: string }) {
  return (
    <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
    </marker>
  );
}

/**
 * One debt as an arrow from payer to recipient. A mask along the path
 * reveals it, dashes and arrowhead included, so an arrow can draw itself
 * from payer to recipient; its amount appears as it lands. Hidden arrows
 * fade out, then reset to undrawn.
 */
function Edge({
  motion: { motion, delayMs },
  maskId,
  layout,
  label,
  fontSize,
  color,
  marker,
  shown,
  dashed = false,
}: {
  motion: EdgeMotion;
  maskId: string;
  layout: EdgeLayout;
  label: string;
  fontSize: number;
  color: string;
  marker: string;
  shown: boolean;
  dashed?: boolean;
}) {
  const { edge, path, length, labelBox } = layout;
  const { drawMs, fadeMs, labelMs, fadeEase, drawEase } = SIMPLIFY_TIMING;
  const transitions = {
    instant: { group: "none", draw: "none", label: "none" },
    // A plain crossfade: arrows arrive whole.
    toggle: shown
      ? { group: `opacity ${fadeMs}ms ${fadeEase}`, draw: "none", label: "none" }
      : {
          group: `opacity ${fadeMs}ms ${fadeEase}`,
          draw: `stroke-dashoffset 0s linear ${fadeMs}ms`,
          label: `opacity 0s linear ${fadeMs}ms`,
        },
    staged: shown
      ? {
          group: "none",
          draw: `stroke-dashoffset ${drawMs}ms ${drawEase} ${delayMs}ms`,
          label: `opacity ${labelMs}ms ${fadeEase} ${delayMs + drawMs * 0.8}ms`,
        }
      : {
          group: `opacity ${fadeMs}ms ${fadeEase}`,
          draw: `stroke-dashoffset 0s linear ${fadeMs}ms`,
          label: `opacity 0s linear ${fadeMs}ms`,
        },
  }[motion];

  return (
    <g
      data-edge={`${edge.fromId}-${edge.toId}`}
      data-side={dashed ? "before" : "after"}
      style={{ opacity: shown ? 1 : 0, transition: transitions.group }}
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={SIZE} height={SIZE}>
        {/* Wide enough to uncover the arrowhead; the round cap runs just ahead of the line. */}
        <path
          d={path}
          fill="none"
          stroke="white"
          strokeWidth={24}
          strokeLinecap="round"
          strokeDasharray={length + 24}
          strokeDashoffset={shown ? 0 : length + 24}
          style={{ transition: transitions.draw }}
        />
      </mask>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={dashed ? 1.5 : 2.5}
        markerEnd={`url(#${marker})`}
        strokeDasharray={dashed ? "5 4" : undefined}
        mask={`url(#${maskId})`}
      />
      {/* On the arrow itself, over a patch of sheet, so each amount reads as its own arrow's. */}
      <g style={{ opacity: shown ? 1 : 0, transition: transitions.label }}>
        <rect
          x={labelBox.cx - labelBox.w / 2}
          y={labelBox.cy - labelBox.h / 2}
          width={labelBox.w}
          height={labelBox.h}
          rx={3}
          fill="var(--color-surface)"
        />
        <text
          x={labelBox.cx}
          y={labelBox.cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontWeight={600}
          fill={color}
          className="font-mono"
        >
          {label}
        </text>
      </g>
    </g>
  );
}

function PaymentList<E extends DebtEdge>({
  title,
  current,
  edges,
  verb,
  nameOf,
  money,
  note,
  detail,
}: {
  title: string;
  /** "owes" for debts, "pays" for Suggested Settlements. */
  verb: "owes" | "pays";
  /** A line under the list, e.g. about Small Change. */
  note?: string;
  current: boolean;
  edges: E[];
  nameOf: (id: string) => string;
  money: (amount: number) => string;
  /** More about one entry, under its line. */
  detail?: (edge: E) => ReactNode;
}) {
  const titleId = useId();
  return (
    // The pressed Before/After chip shows which list the graph draws.
    <div aria-current={current || undefined}>
      <h4 id={titleId} className="text-sm font-semibold">
        {title}
      </h4>
      {/* Entries with details need more room between them, or one's sources run into the next. */}
      <ul aria-labelledby={titleId} className={`mt-2 flex flex-col text-sm ${detail ? "gap-3" : "gap-1"}`}>
        {edges.map((e) => (
          <li key={`${e.fromId}-${e.toId}`}>
            {nameOf(e.fromId)} {verb} {nameOf(e.toId)} <span className="amount">{money(e.amount)}</span>
            {detail?.(e)}
          </li>
        ))}
      </ul>
      {note && <p className="mt-2 text-sm text-text-secondary">{note}</p>}
    </div>
  );
}
