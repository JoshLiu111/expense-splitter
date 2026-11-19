"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  computeLedger,
  formatMoney,
  type DebtEdge,
  type GroupSnapshot,
  type SettlementExplanation,
} from "@/domain";
import { layoutDebtGraph, NODE, SIZE, type EdgeLayout } from "@/components/debt-graph-layout";
import { avatarFill, initials, textColourOn } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/components/use-media-query";
import { pluralize } from "@/lib/format";

type Phase = "before" | "after";

/** After's arrows: neutral ink, since cobalt is only for what can be acted on. */
const AFTER_INK = "var(--color-text-primary)";
const BEFORE_INK = "var(--color-text-secondary)";

/** A selectable pill, as in the Expense form's chips. */
const toggleClass =
  "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-border-input bg-surface px-4 text-sm font-semibold transition-colors duration-(--duration-fast) hover:bg-bg-tertiary aria-pressed:border-accent aria-pressed:bg-accent-subtle focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none";

/**
 * "Why these payments?": the Group's debts before Debt Simplification (who
 * owes whom, pair by pair) turning into the Suggested Settlements after it.
 * It opens on Before; "Simplify" animates it to After (instantly under
 * reduced motion). The lists below say the same in words.
 */
export default function WhyThesePayments({
  group,
  explanation,
}: {
  group: GroupSnapshot;
  explanation: SettlementExplanation;
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [phase, setPhase] = useState<Phase>("before");
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

  // Plays Before → After only when asked, with the graph on screen to see it.
  function simplify() {
    graph.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
    if (reducedMotion) {
      setPhase("after");
      return;
    }
    setPhase("before");
    // Two frames, so the "before" state paints before animating away from it.
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => setPhase("after"), 400)));
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
  const shown: Phase = alreadySimplest ? "after" : phase;

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
                onClick={() => setPhase(p)}
              >
                {p === "before" ? "Before" : "After"}
              </button>
            ))}
          </div>
          <Button onClick={simplify}>
            <Sparkles aria-hidden /> Simplify
          </Button>
        </div>
      )}

      <svg
        ref={graph}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-labelledby={summaryId}
        // scroll-mb clears the fixed Add Expense bar when Simplify scrolls the graph into view.
        className="mx-auto w-full max-w-sm scroll-mb-24 [--graph-duration:calc(var(--duration-slow)*3)]"
      >
        <defs>
          <Arrowhead id={`${summaryId}-before`} color={BEFORE_INK} />
          <Arrowhead id={`${summaryId}-after`} color={AFTER_INK} />
        </defs>
        {!alreadySimplest &&
          layout.before.map((edge) => (
            <Edge
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
        {layout.after.map((edge) => (
          <Edge
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

      {alreadySimplest ? (
        <PaymentList
          title={pluralize(after.length, "Suggested Settlement")}
          verb="pays"
          current={false}
          edges={after}
          nameOf={nameOf}
          money={money}
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
 * One debt as an arrow from payer to recipient. Hidden arrows fade out;
 * shown ones draw themselves in, over `--graph-duration` (zero under
 * reduced motion).
 */
function Edge({
  layout,
  label,
  fontSize,
  color,
  marker,
  shown,
  dashed = false,
}: {
  layout: EdgeLayout;
  label: string;
  fontSize: number;
  color: string;
  marker: string;
  shown: boolean;
  dashed?: boolean;
}) {
  const { edge, path, length, labelBox } = layout;
  const transition =
    "opacity var(--graph-duration) var(--ease-standard), stroke-dashoffset var(--graph-duration) var(--ease-standard)";

  return (
    <g data-edge={`${edge.fromId}-${edge.toId}`} style={{ opacity: shown ? 1 : 0, transition }}>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={dashed ? 1.5 : 2.5}
        markerEnd={`url(#${marker})`}
        strokeDasharray={dashed ? "5 4" : length}
        strokeDashoffset={dashed || shown ? 0 : length}
        style={{ transition }}
      />
      {/* On the arrow itself, over a patch of sheet, so each amount reads as its own arrow's. */}
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
  );
}

function PaymentList({
  title,
  current,
  edges,
  verb,
  nameOf,
  money,
  note,
}: {
  title: string;
  /** "owes" for debts, "pays" for Suggested Settlements. */
  verb: "owes" | "pays";
  /** A line under the list, e.g. about Small Change. */
  note?: string;
  current: boolean;
  edges: DebtEdge[];
  nameOf: (id: string) => string;
  money: (amount: number) => string;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold">
        {title}
        {current && <span className="font-normal text-text-secondary"> · shown in the graph</span>}
      </h4>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {edges.map((e) => (
          <li key={`${e.fromId}-${e.toId}`}>
            {nameOf(e.fromId)} {verb} {nameOf(e.toId)} <span className="amount">{money(e.amount)}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-2 text-sm text-text-secondary">{note}</p>}
    </div>
  );
}
