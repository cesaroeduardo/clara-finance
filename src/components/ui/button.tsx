// Adapted from TUFFUI Action Button · MIT License · Copyright (c) 2026 TUFFUI contributors
"use client";
import type * as React from "react";
import { CircleNotch, type Icon } from "@phosphor-icons/react";
import { Button as ButtonPrimitive } from "@ui-sdk/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const primary =
  "border-(--button-edge) bg-(image:--button) bg-origin-border text-(--button-foreground) shadow-(--button-shadow) hover:bg-(image:--button-hover)";
const secondary =
  "bg-(image:--button-secondary) text-foreground hover:bg-(image:--button-secondary-hover)";
const quiet =
  "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground";
const danger = "bg-negative/15 text-negative hover:bg-negative/25";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full border border-transparent font-medium whitespace-nowrap transition-[background-color,color,scale,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none select-none active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:ring-2 aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: primary,
        primary,
        secondary,
        outline: secondary,
        ghost: quiet,
        quiet,
        destructive: danger,
        danger,
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-3.5 text-[0.8125rem]",
        sm: "h-8 gap-1.5 px-3.5 text-[0.8125rem]",
        md: "h-9 gap-2 px-4 text-sm",
        lg: "h-9 gap-2 px-4 text-sm",
        xs: "h-6 gap-1 px-2 text-xs",
        icon: "size-8 p-0",
        "icon-xs": "size-6 p-0 [&_svg]:size-3",
        "icon-sm": "size-7 p-0",
        "icon-lg": "size-9 p-0 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ComponentProps<typeof ButtonPrimitive> &
  VariantProps<typeof buttonVariants> & {
    icon?: Icon;
    iconWeight?: "fill" | "bold";
    loading?: boolean;
  };
function Button({
  className,
  variant = "default",
  size = "default",
  icon: IconComponent,
  iconWeight = "fill",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {(state) => (
        <>
          {loading ? (
            <CircleNotch
              weight="bold"
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : IconComponent ? (
            <IconComponent weight={iconWeight} aria-hidden="true" />
          ) : null}
          {typeof children === "function" ? children(state) : children}
        </>
      )}
    </ButtonPrimitive>
  );
}
export function IconButton({
  icon,
  label,
  size = "icon",
  variant = "quiet",
  ...props
}: Omit<ButtonProps, "children" | "icon"> & { icon: Icon; label: string }) {
  return (
    <Button
      icon={icon}
      aria-label={label}
      size={size}
      variant={variant}
      {...props}
    />
  );
}
export { Button, buttonVariants };
