import type { GroupSnapshot } from "@/domain";
import { cn } from "@/lib/utils";

/**
 * How a record's Recorder is named: their name, or "you" when that is the
 * visitor. Undefined when the Recorder is unknown.
 */
export function recorderName(
  group: GroupSnapshot,
  recorderId: string | undefined,
  currentMemberId: string | undefined,
): string | undefined {
  // Former Members stay in the Group, so a known Recorder always resolves.
  const recorder = recorderId && group.members.find((m) => m.id === recorderId);
  if (!recorder) return undefined;
  return recorder.id === currentMemberId ? "you" : recorder.name;
}

/**
 * Who recorded an Expense or Settlement, as a line of its own: "Recorded by
 * Sam Rivera". Nothing when the Recorder is unknown.
 */
export function RecordedBy({
  group,
  recorderId,
  currentMemberId,
  className,
}: {
  group: GroupSnapshot;
  recorderId: string | undefined;
  currentMemberId: string | undefined;
  className?: string;
}) {
  const name = recorderName(group, recorderId, currentMemberId);
  if (!name) return null;
  return (
    <p className={cn("text-sm text-text-secondary", className)}>
      Recorded by <span className="font-semibold text-text-primary">{name}</span>
    </p>
  );
}
