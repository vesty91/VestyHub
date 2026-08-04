import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeProps = React.ComponentProps<"span"> & {
  variant?: "default" | "outline";
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        variant === "outline"
          ? "border-border bg-transparent text-foreground"
          : "border-border bg-secondary/70 text-secondary-foreground",
        className,
      )}
      {...props}
    />
  );
}
