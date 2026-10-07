import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

// shadcn/ui Button recipe, styled exclusively through the shared token roles.
const buttonVariants = cva("ui-button inline-flex items-center justify-center disabled:pointer-events-none", {
  variants: {
    variant: { default: "ui-button--primary", ghost: "ui-button--ghost", outline: "ui-button--outline" },
    size: { default: "ui-button--default", icon: "ui-button--icon", small: "ui-button--small" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export function Button({ className, variant, size, asChild = false, ...props }:
  ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
