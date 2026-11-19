import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

// Adapted from shadcn/ui: theme switching swaps CSS variables only (no
// `dark:` classes), and every size meets the 44×44px touch target.
//
// Every button shares the 10px radius. Cobalt marks every action in three
// roles: `default` (filled) for the one primary action in a block, `outline`
// for a secondary one, `quiet` (cobalt text, usually with an icon) for the
// rest. `ghost` stays neutral for chrome: the header, icon-only buttons.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors duration-(--duration-fast) outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-accent-hover",
        outline: "border border-input bg-surface text-accent hover:bg-accent-subtle",
        quiet: "text-accent hover:bg-accent-subtle",
        ghost: "text-text-primary hover:bg-bg-tertiary",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-4 py-2",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
