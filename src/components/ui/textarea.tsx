import * as React from "react";

import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "text-foreground placeholder:text-muted-foreground min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm transition outline-none focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
