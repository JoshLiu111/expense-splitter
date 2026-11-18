"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type FieldErrors = Partial<Record<string, string>>;

const controlClass =
  "w-full rounded-md border border-border-input bg-surface px-3 py-2 text-base text-text-primary outline-none transition-colors duration-(--duration-fast) focus-visible:ring-[3px] focus-visible:ring-ring aria-invalid:border-error";

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: (describedBy: string | undefined, className: string) => ReactNode;
}

/**
 * A labelled control with its hint and error wired up through
 * `aria-describedby`, so screen readers read them with the field.
 */
export function Field({ id, label, error, hint, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-text-secondary">
          {hint}
        </p>
      )}
      {children(describedBy, controlClass)}
      {error && (
        <p id={errorId} className="text-sm font-semibold text-error">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Lists every problem after a failed submit. It takes focus so keyboard and
 * screen-reader users land on it; each item links to its field.
 */
export function ErrorSummary({
  errors,
  fieldIds,
}: {
  errors: FieldErrors | undefined;
  /** Element id of each field, so summary items can link to them. */
  fieldIds: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const entries = Object.entries(errors ?? {}).filter(
    (entry): entry is [string, string] => Boolean(entry[1]),
  );

  useEffect(() => {
    if (entries.length > 0) ref.current?.focus();
  }, [errors, entries.length]);

  if (entries.length === 0) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby={headingId}
      className="rounded-md border border-error p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
    >
      <h2 id={headingId} className="font-bold text-error">
        {entries.length === 1 ? "There is a problem" : "There are problems"}
      </h2>
      <ul className="mt-2 list-disc pl-5 text-sm">
        {entries.map(([field, message]) => (
          <li key={field}>
            {fieldIds[field] ? (
              <a href={`#${fieldIds[field]}`} className="font-semibold text-error underline">
                {message}
              </a>
            ) : (
              <span className="font-semibold text-error">{message}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FormCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-surface p-6 shadow-sm", className)}
      {...props}
    />
  );
}
