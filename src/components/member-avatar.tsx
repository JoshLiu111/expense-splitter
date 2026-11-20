import { ArrowRight } from "lucide-react";
import type { Member } from "@/domain";
import { cn } from "@/lib/utils";
import { MemberAvatarImage } from "./member-avatar-image";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const DARK_TEXT = "#0a0d13";
/** WCAG AA for normal text; initials are small, so they get no large-text allowance. */
const AA = 4.5;

function channels(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Picks whichever of near-black or white has more contrast on the colour. */
export function textColourOn(hex: string): string {
  return contrastRatio(hex, "#ffffff") >= contrastRatio(hex, DARK_TEXT) ? "#ffffff" : DARK_TEXT;
}

/**
 * The colour to paint a Member's avatar: their own colour, or, when neither
 * white nor near-black initials reach AA on it (e.g. #6366F1), that colour
 * darkened just enough for white initials to. Avatar colours are stored per
 * Member, so this applies to existing Members and sample data alike.
 */
export function avatarFill(hex: string): string {
  let rgb = channels(hex);
  let fill = hex;
  while (contrastRatio(fill, textColourOn(fill)) < AA) {
    rgb = rgb.map((c) => Math.floor(c * 0.97));
    fill = `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  }
  return fill;
}

const AVATAR_SIZES = {
  xs: "size-6 text-[0.625rem]",
  sm: "size-8 text-xs",
  md: "size-9 text-sm",
  lg: "size-12 text-base",
} as const;

export type AvatarSize = keyof typeof AVATAR_SIZES;

export function MemberAvatar({
  member,
  size = "md",
  className,
}: {
  member: Pick<Member, "name" | "avatarColor" | "avatarUrl">;
  size?: AvatarSize;
  className?: string;
}) {
  const fill = avatarFill(member.avatarColor);
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        AVATAR_SIZES[size],
        className,
      )}
      style={{ backgroundColor: fill, color: textColourOn(fill) }}
    >
      {initials(member.name)}
      {member.avatarUrl && <MemberAvatarImage key={member.avatarUrl} src={member.avatarUrl} name={member.name} />}
    </span>
  );
}

/** Overlapping avatars, each cut out of what's behind it by a ring. */
export function AvatarStack({
  members,
  size = "sm",
  ring = "ring-surface",
}: {
  members: Pick<Member, "id" | "name" | "avatarColor" | "avatarUrl">[];
  size?: AvatarSize;
  /** The colour behind the stack: a white panel, or the page itself. */
  ring?: "ring-surface" | "ring-bg-primary";
}) {
  return (
    <span aria-hidden className="flex -space-x-1.5">
      {members.map((m) => (
        <MemberAvatar
          key={m.id}
          member={m}
          size={size}
          className={cn("ring-2", ring)}
        />
      ))}
    </span>
  );
}

/** Payer, arrow, payee: the shape of one payment. Decorative; the words say it. */
export function TransferPair({
  from,
  to,
  size = "sm",
}: {
  from: Pick<Member, "name" | "avatarColor" | "avatarUrl">;
  to: Pick<Member, "name" | "avatarColor" | "avatarUrl">;
  size?: AvatarSize;
}) {
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center gap-1">
      <MemberAvatar member={from} size={size} />
      <ArrowRight
        className={cn(
          "text-text-secondary",
          size === "lg" ? "size-5" : "size-4",
        )}
      />
      <MemberAvatar member={to} size={size} />
    </span>
  );
}
