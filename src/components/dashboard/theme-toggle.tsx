"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Changer le thème"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      disabled={!resolvedTheme}
      className="hover:text-foreground rounded-xl text-zinc-400"
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </Button>
  );
}
