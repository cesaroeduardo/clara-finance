// TUFFUI (https://tuffui.com) · MIT License · Copyright (c) 2026 TUFFUI contributors
"use client";
import { renderElement, type PartProps } from "@ui-sdk/react/primitive";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type DivProps = React.ComponentProps<"div">;

export function Shell({ className, ...props }: PartProps<"div">) {
  return renderElement("div", {
    ...props,
    "data-slot": "surface-shell",
    className: cn(
      "@container w-full rounded-[1.375rem] bg-surface p-1.5",
      className,
    ),
  });
}

export function Panel({ className, ...props }: PartProps<"div">) {
  return renderElement("div", {
    ...props,
    "data-slot": "surface-panel",
    className: cn("rounded-2xl bg-surface-inset", className),
  });
}

export function Inset({ className, ...props }: DivProps) {
  return (
    <div
      className={cn("rounded-xl bg-foreground/[0.04]", className)}
      {...props}
    />
  );
}

export function IconTile({
  icon: IconComponent,
  className,
  children,
  ...props
}: DivProps & { icon?: Icon }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.06] text-muted-foreground",
        className,
      )}
      {...props}
    >
      {IconComponent ? (
        <IconComponent weight="fill" className="size-4" />
      ) : (
        children
      )}
    </div>
  );
}

export type ShellHeaderProps = Omit<DivProps, "title"> & {
  icon?: Icon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  aside?: React.ReactNode;
  as?: "h2" | "h3" | "h4";
};

export function ShellHeader({
  icon,
  title,
  subtitle,
  aside,
  as: Heading = "h3",
  className,
  ...props
}: ShellHeaderProps) {
  return (
    <div
      data-slot="surface-header"
      className={cn(
        "flex items-center gap-3 pt-1.5 pr-3.5 pb-3 pl-1.5",
        className,
      )}
      {...props}
    >
      {icon && <IconTile icon={icon} />}
      <div className={cn("min-w-0 flex-1", !icon && "pl-2")}>
        <Heading className="truncate text-[0.9375rem] font-medium">
          {title}
        </Heading>
        {subtitle && (
          <p className="truncate text-[0.8125rem] text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
    </div>
  );
}
