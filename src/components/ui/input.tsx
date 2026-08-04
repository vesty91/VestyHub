import * as React from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "text-foreground placeholder:text-muted-foreground h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm transition outline-none focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
