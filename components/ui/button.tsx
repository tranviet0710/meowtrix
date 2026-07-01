import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — Meowtrix soft, warm button primitive.
 *
 * Variants:
 * - default / brutal: solid coral primary
 * - destructive: solid danger red
 * - outline: transparent with primary border
 * - secondary: soft muted background
 * - ghost / link: text-only variants
 *
 * Rounded corners, soft shadows, subtle hover lift. `brutal` is kept as an
 * alias for `default` so any legacy callers keep working.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 rounded-lg",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[var(--shadow-primary)] hover:brightness-105 hover:-translate-y-[1px] active:translate-y-0",
        brutal:
          "bg-primary text-primary-foreground shadow-[var(--shadow-primary)] hover:brightness-105 hover:-translate-y-[1px] active:translate-y-0",
        destructive:
          "bg-danger text-destructive-foreground shadow-[0_6px_20px_rgba(255,125,125,0.28)] hover:brightness-105 hover:-translate-y-[1px] active:translate-y-0",
        outline:
          "border border-primary/70 bg-transparent text-primary hover:bg-primary/10 hover:-translate-y-[1px] active:translate-y-0",
        secondary:
          "bg-muted text-secondary-foreground border border-border hover:bg-muted/70 hover:-translate-y-[1px] active:translate-y-0",
        ghost: "hover:bg-muted hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
export { Button, buttonVariants };
