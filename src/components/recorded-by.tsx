import type { GroupSnapshot } from "@/domain";
import { cn } from "@/lib/utils";

/**
 * Who recorded an Expense or Settlement: its Recorder, or "you" when that is
 * the visitor. Nothing when the Recorder is unknown.
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
  // Former Members stay in the Group, so a known Recorder always resolves.
  const recorder = recorderId && group.members.find((m) => m.id === recorderId);
  if (!recorder) return null;
  return (
    <p className={cn("text-sm text-text-secondary", className)}>
      Recorded by{" "}
      <span className="font-semibold text-text-primary">
        {recorder.id === currentMemberId ? "you" : recorder.name}
      </span>
    </p>
  );
}
