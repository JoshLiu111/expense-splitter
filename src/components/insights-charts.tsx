"use client";

import { useId, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, type CategoryTotal, type CurrencyCode, type MinorUnits, type MonthTotal } from "@/domain";
import { chartColor } from "@/lib/chart";
import { describeBalance, formatMonth } from "@/lib/format";

// Colours are the theme's CSS variables, so the charts follow light and dark
// mode without re-rendering. Animation is off: the charts redraw on every
// filter change, and that motion would add nothing.

const axisTick = { fill: "var(--color-text-secondary)", fontSize: 12 };
const tooltipStyle = {
  contentStyle: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    color: "var(--color-text-primary)",
  },
  itemStyle: { color: "var(--color-text-primary)" },
  labelStyle: { color: "var(--color-text-secondary)" },
  cursor: { fill: "var(--color-bg-tertiary)" },
};

/**
 * Category share, spending over time and Balance per Member. Each chart is
 * drawn for sighted users and paired with a table for screen readers.
 */
export default function InsightsCharts({
  currency,
  breakdown,
  byMonth,
  balances,
}: {
  currency: CurrencyCode;
  breakdown: CategoryTotal[];
  byMonth: MonthTotal[];
  balances: { name: string; amount: MinorUnits }[];
}) {
  const money = (amount: number) => formatMoney(amount, currency);
  // Recharts works in numbers; keep minor units and format on the way out.
  const tooltipMoney = (value: unknown) => money(Number(value));
  const axisMoney = (value: number) => formatMoney(value, currency).replace(/\.\d+$/, "");

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <ChartFigure
        title="Category share"
        summary={`${breakdown[0].name} is the largest Category at ${breakdown[0].percentage}%.`}
        table={
          <DataTable
            headers={["Category", "Amount", "Share"]}
            rows={breakdown.map((c) => [c.name, money(c.amount), `${c.percentage}%`])}
          />
        }
      >
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={breakdown}
              dataKey="amount"
              nameKey="name"
              innerRadius="55%"
              outerRadius="85%"
              stroke="var(--color-surface)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {breakdown.map((c, i) => (
                <Cell key={c.category} fill={chartColor(i)} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} formatter={tooltipMoney} />
          </PieChart>
        </ResponsiveContainer>
      </ChartFigure>

      <ChartFigure
        title="Spending over time"
        summary={summariseMonths(byMonth, money)}
        table={
          <DataTable
            headers={["Month", "Spent"]}
            rows={byMonth.map((m) => [formatMonth(m.month), money(m.amount)])}
          />
        }
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byMonth} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="month"
              tickFormatter={(m: string) => formatMonth(m, { short: true })}
              tick={axisTick}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            />
            <YAxis tickFormatter={axisMoney} tick={axisTick} axisLine={false} tickLine={false} width={64} />
            <Tooltip
              {...tooltipStyle}
              formatter={tooltipMoney}
              labelFormatter={(m) => formatMonth(String(m))}
            />
            <Bar dataKey="amount" name="Spent" fill={chartColor(0)} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFigure>

      <ChartFigure
        className="md:col-span-2"
        title="Balance per Member"
        summary="Above zero, others owe them; below zero, they owe."
        table={
          <DataTable
            headers={["Member", "Balance"]}
            rows={balances.map((b) => [b.name, describeBalance(b.name, b.amount, currency)])}
          />
        }
      >
        <ResponsiveContainer width="100%" height={Math.max(120, balances.length * 36 + 40)}>
          <BarChart data={balances} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid horizontal={false} stroke="var(--color-border)" />
            <XAxis type="number" tickFormatter={axisMoney} tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={axisTick} width={96} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipStyle} formatter={tooltipMoney} />
            <Bar dataKey="amount" name="Balance" radius={4} isAnimationActive={false}>
              {balances.map((b) => (
                <Cell
                  key={b.name}
                  fill={b.amount < 0 ? "var(--color-owe)" : b.amount > 0 ? "var(--color-owed)" : "var(--color-border-input)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFigure>
    </div>
  );
}

function ChartFigure({
  title,
  summary,
  table,
  className,
  children,
}: {
  title: string;
  /** A sentence giving the chart's gist in words. */
  summary: string;
  /** The chart's data, for screen readers. */
  table: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <figure
      aria-labelledby={id}
      className={`flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-4 ${className ?? ""}`}
    >
      <figcaption id={id}>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-text-secondary">{summary}</span>
      </figcaption>
      <div aria-hidden className="min-w-0">
        {children}
      </div>
      {table}
    </figure>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table className="sr-only">
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            {row.map((cell, i) =>
              i === 0 ? (
                <th key={i} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={i}>{cell}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function summariseMonths(byMonth: MonthTotal[], money: (amount: number) => string): string {
  if (byMonth.length === 1) return `${money(byMonth[0].amount)} in ${formatMonth(byMonth[0].month)}.`;
  const top = byMonth.reduce((best, m) => (m.amount > best.amount ? m : best));
  return `Most was spent in ${formatMonth(top.month)}: ${money(top.amount)}.`;
}
