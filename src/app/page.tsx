import Link from "next/link";
import { ArrowRight, Globe, PieChart, Route, SlidersHorizontal } from "lucide-react";
import { BalanceStatus } from "@/components/balance-status";
import { Button } from "@/components/ui/button";
import sampleData from "../../data/sample-groups.json";
import { computeLedger, formatMoney, importSampleGroups } from "@/domain";

const FEATURES = [
  {
    icon: SlidersHorizontal,
    title: "Split it any way",
    body: "Equally, by exact amounts, percentages or shares. Leftover cents land on someone, so every Split adds up to the penny.",
  },
  {
    icon: Globe,
    title: "Travel in any currency",
    body: "Pay in yen, think in dollars. Each Expense keeps the rate it was recorded at, so Balances never drift with the market.",
  },
  {
    icon: Route,
    title: "Settle up in as few steps as possible",
    body: "Debt Simplification reduces who-owes-whom to the fewest Suggested Settlements, and “Why these payments?” shows how it got there.",
  },
  {
    icon: PieChart,
    title: "See where the money went",
    body: "Categories, filters and Insights show spending by category, by Member and over time.",
  },
] as const;

// The hero previews the "Trip to Japan" sample Group a Guest opens at /guest,
// derived by the same domain core so it can never drift from the seed data.
const PREVIEW_GROUP = importSampleGroups(sampleData).find((g) => g.id === "grp_japan_2024")!;
const PREVIEW_LEDGER = computeLedger(PREVIEW_GROUP);
const currency = PREVIEW_GROUP.currency;
const memberName = (memberId: string) =>
  PREVIEW_GROUP.members.find((m) => m.id === memberId)!.name;

export default function Home() {
  return (
    <div className="flex flex-col gap-16 py-4 sm:py-10">
      <section
        aria-labelledby="hero-heading"
        className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]"
      >
        <div className="flex flex-col items-start gap-6">
          <p className="rounded-full bg-accent-subtle px-3 py-1 text-sm font-semibold text-accent">
            Shared costs, minus the spreadsheet
          </p>
          <h1 id="hero-heading" className="text-3xl font-extrabold">
            Split expenses. Settle up. Stay friends.
          </h1>
          <p className="max-w-xl text-lg text-text-secondary">
            Record who paid for what, split it any way you like, in any currency, and see the
            fewest Settlements that get everyone Settled Up.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/sign-up">Sign Up</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/guest">
                Try as Guest <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          <p className="text-sm text-text-secondary">
            No account needed: the Guest demo opens five sample Groups right away.
          </p>
        </div>

        <figure
          aria-label={`Preview of the ${PREVIEW_GROUP.name} sample Group`}
          className="w-full rounded-xl border border-border bg-surface p-5"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-bold">{PREVIEW_GROUP.name}</p>
            <p className="text-sm text-text-secondary">
              {PREVIEW_GROUP.members.length} Members · {currency}
            </p>
          </div>
          <ul className="mt-4 flex flex-col divide-y divide-border-subtle">
            {PREVIEW_LEDGER.balances.map((b) => (
              <li key={b.memberId} className="flex items-center justify-between gap-3 py-2">
                <span className="font-medium">{memberName(b.memberId)}</span>
                <BalanceStatus amount={b.amount} currency={currency} />
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm font-semibold text-text-secondary">
            Settled Up in {PREVIEW_LEDGER.suggestions.length} Suggested Settlements
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {PREVIEW_LEDGER.suggestions.map((p) => (
              <li
                key={`${p.fromId}-${p.toId}`}
                className="flex items-center justify-between gap-3 rounded-md bg-bg-secondary px-3 py-2 text-sm"
              >
                <span>
                  {memberName(p.fromId)} <ArrowRight aria-hidden className="inline size-4" />
                  <span className="sr-only">pays</span> {memberName(p.toId)}
                </span>
                <span className="amount font-semibold">{formatMoney(p.amount, currency)}</span>
              </li>
            ))}
          </ul>
        </figure>
      </section>

      <section aria-labelledby="features-heading">
        <h2 id="features-heading" className="text-2xl font-extrabold">
          Everything a shared tab needs
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-lg border border-border bg-surface p-5">
              <Icon aria-hidden className="size-6 text-accent" />
              <h3 className="mt-3 font-bold">{title}</h3>
              <p className="mt-1 text-sm text-text-secondary">{body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
