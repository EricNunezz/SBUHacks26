import * as React from "react"
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border-2 border-[var(--iron)] text-sm font-semibold whitespace-nowrap shadow-[3px_3px_0_var(--iron)] transition-[transform,background-color,color,opacity] outline-none hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_var(--iron)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--iron)] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary",
        destructive:
          "bg-destructive text-[var(--cream)] hover:bg-destructive focus-visible:ring-destructive/20",
        outline:
          "bg-[var(--cream)] text-[var(--iron)] hover:bg-[var(--brass-tint)]",
        secondary:
          "bg-[var(--cream)] text-[var(--iron)] hover:bg-[var(--brass-tint)]",
        ghost:
          "border-transparent shadow-none hover:translate-x-0 hover:translate-y-0 hover:bg-accent hover:text-accent-foreground hover:shadow-none active:translate-x-0 active:translate-y-0 active:shadow-none",
        link: "border-transparent text-primary shadow-none underline-offset-4 hover:translate-x-0 hover:translate-y-0 hover:underline hover:shadow-none active:translate-x-0 active:translate-y-0 active:shadow-none",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
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
}) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props} />
  );
}

export { Button, buttonVariants }
