"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { ArrowLeft } from "lucide-react";
import type { ActivityChange, ActivityEntry, GroupSnapshot } from "@/domain";
import { activityItems, type ActivityItem } from "@/components/activity-view";
import { MemberAvatar } from "@/components/member-avatar";
import { formatCalendarDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** What each kind of change reads as, between the actor and the title. */
const ACTIONS: Record<ActivityChange["kind"], string> = {
  "expense-added": "added the Expense",
  "expense-edited": "edited the Expense",
  "expense-deleted": "deleted the Expense",
  "settlement-added": "recorded a Settlement:",
  "settlement-deleted": "deleted a Settlement:",
};

/**
 * A Group's Activity: every change to its Expenses and Settlements, newest
 * first and unfiltered. Read-only: entries can't be edited, deleted or
 * restored. With `focusExpenseId` (from "View changes"), that Expense's
 * entries are marked and the newest is scrolled to.
 */
export function GroupActivity({
  group,
  entries,
  groupHref,
  focusExpenseId,
}: {
  group: GroupSnapshot;
  entries: readonly ActivityEntry[];
  /** The Group page, for the back link. */
  groupHref: string;
  focusExpenseId?: string;
}) {
  const items = activityItems(entries, group);
  const focused = (item: ActivityItem) => item.subject.kind === "expense" && item.subject.id === focusExpenseId;
  const firstFocused = useRef<HTMLLIElement>(null);
  const focusedExpense = group.expenses.find((e) => e.id === focusExpenseId);
  const firstFocusedIndex = items.findIndex(focused);

  useEffect(() => {
    if (!firstFocused.current) return;
    firstFocused.current.scrollIntoView({ block: "start" });
    firstFocused.current.focus({ preventScroll: true });
  }, [focusExpenseId]);

  const launchNote = group.activityStartedOn && (
    <>
      Activity starts on {formatCalendarDate(group.activityStartedOn)}. Earlier Expenses and Settlements aren’t
      listed here.
    </>
  );

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8">
      <div>
        <Link
          href={groupHref}
          className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-semibold break-words text-accent"
        >
          <ArrowLeft aria-hidden className="size-4 shrink-0" /> Back to {group.name}
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold">Activity</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Every addition, edit and deletion of this Group’s Expenses and Settlements, newest first.
        </p>
      </div>

      {focusExpenseId && firstFocusedIndex === -1 && (
        <p className="rounded-md bg-bg-secondary px-4 py-3 text-sm">
          {focusedExpense && (
            <>
              <span className="font-semibold">“{focusedExpense.description}”</span> has no changes listed.{" "}
            </>
          )}
          {launchNote ?? "There are no changes to list for this Expense."}
        </p>
      )}

      {items.length === 0 ? (
        !group.activityStartedOn && <p className="text-text-secondary">No changes yet.</p>
      ) : (
        <ol className="border-b border-border">
          {items.map((item, index) => (
            <ActivityRow
              key={item.id}
              item={item}
              focused={focused(item)}
              ref={index === firstFocusedIndex ? firstFocused : undefined}
            />
          ))}
        </ol>
      )}

      {launchNote && <p className="text-sm text-text-secondary">{launchNote}</p>}
    </div>
  );
}

function ActivityRow({
  item,
  focused,
  ref,
}: {
  item: ActivityItem;
  focused: boolean;
  ref?: React.Ref<HTMLLIElement>;
}) {
  const id = useId();
  return (
    <li
      ref={ref}
      tabIndex={ref ? -1 : undefined}
      aria-labelledby={`${id}-summary`}
      className={cn(
        "scroll-mt-4 border-t border-border py-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
        focused && "-mx-3 rounded-md border-l-4 border-l-accent bg-accent-subtle/50 px-3",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Decorative: the actor's name is the first words beside it. */}
        {item.actorMember && <MemberAvatar member={item.actorMember} size="sm" />}
        <div className="min-w-0 flex-1">
          <p id={`${id}-summary`} className="break-words">
            <span className="font-semibold">{item.actor}</span> {ACTIONS[item.kind]}{" "}
            <span className="font-semibold">{item.title}</span>
            {focused && <span className="sr-only"> (the Expense you opened)</span>}
          </p>
          <p className="mt-0.5 text-sm text-text-secondary">
            <LocalTime iso={item.at} />
          </p>

          {item.changes.length > 0 && (
            <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
              {item.changes.map((change) => (
                <div key={`${change.memberId ?? ""} ${change.label}`} className="contents">
                  <dt className="font-semibold break-words text-text-secondary">{change.label}</dt>
                  <dd className="mb-1.5 break-words sm:mb-0">
                    <span className="sr-only">changed from </span>
                    <span className={cn("text-text-secondary line-through", change.money && "amount")}>
                      {change.before}
                    </span>
                    <span aria-hidden className="px-1.5 text-text-tertiary">
                      →
                    </span>
                    <span className="sr-only"> to </span>
                    <span className={cn("font-semibold", change.money && "amount")}>{change.after}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {item.details.length > 0 && (
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
              {item.details.map((detail) => (
                <div key={detail.label} className="contents">
                  <dt className="font-semibold text-text-secondary">{detail.label}</dt>
                  <dd className={cn("break-words", detail.money && "amount")}>{detail.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </li>
  );
}

const utcFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
const localFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
const noSubscription = () => () => {};

/**
 * A moment in the visitor's own time zone. The server doesn't know it, so
 * it renders UTC (labelled) until the page hydrates.
 */
function LocalTime({ iso }: { iso: string }) {
  const local = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const date = new Date(iso);
  return (
    <time dateTime={iso}>{local ? localFormatter.format(date) : `${utcFormatter.format(date)} UTC`}</time>
  );
}
