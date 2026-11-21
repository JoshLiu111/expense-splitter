"use client";

import type { Ref } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A section's Show/Hide disclosure: a quiet button whose chevron turns over
 * when open, read out with the section it opens ("Show Expenses").
 */
export function SectionToggle({
  ref,
  section,
  open,
  controls,
  onToggle,
  className,
}: {
  ref?: Ref<HTMLButtonElement>;
  /** The section's name, read out after "Show" or "Hide". */
  section: string;
  open: boolean;
  /** The id of the region it shows and hides. */
  controls: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <Button
      ref={ref}
      variant="quiet"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className={className}
    >
      {open ? "Hide" : "Show"}
      <ChevronDown
        aria-hidden
        className={cn("transition-transform duration-(--duration-fast)", open && "rotate-180")}
      />
      <span className="sr-only"> {section}</span>
    </Button>
  );
}
