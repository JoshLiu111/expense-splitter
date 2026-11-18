"use client";

import { useEffect, useId, useState } from "react";
import { Play } from "lucide-react";
import { formatMoney, type DebtEdge, type GroupSnapshot, type SettlementExplanation } from "@/domain";
import { initials, textColourOn } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/components/use-media-query";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

type Phase = "before" | "after";

const SIZE = 400;
const CENTER = SIZE / 2;
const RING = 120;
const NODE = 22;

/**
 * "Why these payments?": the Group's debts before Debt Simplification (who
 * owes whom, pair by pair) turning into the Suggested Settlements after it.
 * The graph animates from one to the other unless the visitor prefers
 * reduced motion; the lists beside it say the same in words.
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
  const money = (amount: number) => formatMoney(amount, group.currency);
  const before = explanation.before;
  // Small Change is never suggested, so the "after" graph leaves it out.
  const after = explanation.suggestions;
  const smallChange = explanation.smallChange;

  // Play the transition once on opening; with reduced motion, wait to be asked.
  useEffect(() => {
    if (reducedMotion) return;
    const timer = setTimeout(() => setPhase("after"), 700);
    return () => clearTimeout(timer);
  }, [reducedMotion]);

  function play() {
    setPhase("before");
    if (reducedMotion) return;
    // Two frames, so the "before" state paints before animating away from it.
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => setPhase("after"), 400)));
  }

  // Members on a ring: everyone with a debt either side, in Group order.
  const involved = new Set([...before, ...after, ...smallChange].flatMap((e) => [e.fromId, e.toId]));
  const nodes = group.members.filter((m) => involved.has(m.id));
  const position = new Map(
    nodes.map((m, i) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      return [m.id, { x: CENTER + RING * Math.cos(angle), y: CENTER + RING * Math.sin(angle) }];
    }),
  );
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? "Unknown member";
  const saved = before.length - after.length;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <p id={summaryId}>
        Before Debt Simplification, the Group&apos;s debts take{" "}
        <strong>{pluralize(before.length, "payment")}</strong> between the people who shared
        Expenses. Using only Balances, <strong>{pluralize(after.length, "Suggested Settlement")}</strong>{" "}
        {after.length === 1 ? "settles" : "settle"} everyone up
        {saved > 0 ? `, ${saved} fewer than before` : ""}
        {smallChange.length > 0 ? ", apart from Small Change" : ""}.
      </p>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Show the graph">
        {(["before", "after"] as const).map((p) => (
          <Button
            key={p}
            variant={phase === p ? "default" : "outline"}
            aria-pressed={phase === p}
            onClick={() => setPhase(p)}
          >
            {p === "before" ? "Before" : "After"}
          </Button>
        ))}
        <Button variant="ghost" onClick={play}>
          <Play aria-hidden /> Replay
        </Button>
      </div>

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-labelledby={summaryId}
        className="mx-auto w-full max-w-sm [--graph-duration:calc(var(--duration-slow)*3)]"
      >
        <defs>
          <Arrowhead id={`${summaryId}-before`} color="var(--color-text-secondary)" />
          <Arrowhead id={`${summaryId}-after`} color="var(--color-accent)" />
        </defs>
        {before.map((edge) => (
          <Edge
            key={`before-${edge.fromId}-${edge.toId}`}
            edge={edge}
            from={position.get(edge.fromId)!}
            to={position.get(edge.toId)!}
            label={money(edge.amount)}
            color="var(--color-text-secondary)"
            marker={`${summaryId}-before`}
            shown={phase === "before"}
            dashed
          />
        ))}
        {after.map((edge) => (
          <Edge
            key={`after-${edge.fromId}-${edge.toId}`}
            edge={edge}
            from={position.get(edge.fromId)!}
            to={position.get(edge.toId)!}
            label={money(edge.amount)}
            color="var(--color-accent)"
            marker={`${summaryId}-after`}
            shown={phase === "after"}
          />
        ))}
        {nodes.map((m) => {
          const { x, y } = position.get(m.id)!;
          const outward = { x: (x - CENTER) / RING, y: (y - CENTER) / RING };
          return (
            <g key={m.id}>
              <circle cx={x} cy={y} r={NODE} fill={m.avatarColor} />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fontWeight={700}
                fill={textColourOn(m.avatarColor)}
              >
                {initials(m.name)}
              </text>
              <text
                x={x + outward.x * (NODE + 14)}
                y={y + outward.y * (NODE + 14)}
                textAnchor={Math.abs(outward.x) < 0.3 ? "middle" : outward.x > 0 ? "start" : "end"}
                dominantBaseline="central"
                fontSize={13}
                fontWeight={600}
                fill="var(--color-text-primary)"
              >
                {m.name.split(/\s+/)[0]}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PaymentList
          title={`Before: ${pluralize(before.length, "payment")}`}
          current={phase === "before"}
          edges={before}
          nameOf={nameOf}
          money={money}
        />
        <PaymentList
          title={`After: ${pluralize(after.length, "payment")}`}
          note={smallChange.length > 0 ? "Plus Small Change, which is never suggested." : undefined}
          current={phase === "after"}
          edges={after}
          nameOf={nameOf}
          money={money}
        />
      </div>
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
  edge,
  from,
  to,
  label,
  color,
  marker,
  shown,
  dashed = false,
}: {
  edge: DebtEdge;
  from: { x: number; y: number };
  to: { x: number; y: number };
  label: string;
  color: string;
  marker: string;
  shown: boolean;
  dashed?: boolean;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const ux = dx / distance;
  const uy = dy / distance;
  const start = { x: from.x + ux * (NODE + 3), y: from.y + uy * (NODE + 3) };
  const end = { x: to.x - ux * (NODE + 6), y: to.y - uy * (NODE + 6) };
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  // Labels sit beside the line, on the payer's right, so opposite debts don't collide.
  const labelAt = { x: (start.x + end.x) / 2 - uy * 12, y: (start.y + end.y) / 2 + ux * 12 };
  const transition =
    "opacity var(--graph-duration) var(--ease-standard), stroke-dashoffset var(--graph-duration) var(--ease-standard)";

  return (
    <g data-edge={`${edge.fromId}-${edge.toId}`} style={{ opacity: shown ? 1 : 0, transition }}>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={color}
        strokeWidth={dashed ? 1.5 : 2.5}
        markerEnd={`url(#${marker})`}
        strokeDasharray={dashed ? "5 4" : length}
        strokeDashoffset={dashed || shown ? 0 : length}
        style={{ transition }}
      />
      <text
        x={labelAt.x}
        y={labelAt.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
        fill={color}
        stroke="var(--color-surface)"
        strokeWidth={4}
        paintOrder="stroke"
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
  nameOf,
  money,
  note,
}: {
  title: string;
  /** A line under the list, e.g. about Small Change. */
  note?: string;
  current: boolean;
  edges: DebtEdge[];
  nameOf: (id: string) => string;
  money: (amount: number) => string;
}) {
  return (
    <div className={cn("rounded-md border p-3", current ? "border-accent" : "border-border")}>
      <h4 className="text-sm font-semibold">
        {title}
        {current && <span className="font-normal text-text-secondary"> · shown in the graph</span>}
      </h4>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {edges.map((e) => (
          <li key={`${e.fromId}-${e.toId}`}>
            {nameOf(e.fromId)} pays {nameOf(e.toId)} <span className="amount">{money(e.amount)}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-2 text-sm text-text-secondary">{note}</p>}
    </div>
  );
}
