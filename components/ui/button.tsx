import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-bold uppercase tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 rounded-none",
  {
    variants: {
      variant: {
        default:
          "border-3 border-accent bg-accent text-primary-foreground shadow-[4px_4px_0px_0px] shadow-accent/60 hover:brightness-110 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        brutal:
          "border-3 border-accent bg-accent text-primary-foreground shadow-[4px_4px_0px_0px] shadow-accent/60 hover:brightness-110 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        destructive:
          "border-3 border-danger bg-danger text-destructive-foreground shadow-[4px_4px_0px_0px] shadow-danger/60 hover:brightness-110 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        outline:
          "border-3 border-accent bg-transparent text-text-primary shadow-[4px_4px_0px_0px] shadow-accent/40 hover:bg-accent/10 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        secondary:
          "border-3 border-border bg-card text-secondary-foreground shadow-[4px_4px_0px_0px] shadow-border hover:bg-card/80 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        ghost: "hover:bg-card hover:text-accent",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
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
