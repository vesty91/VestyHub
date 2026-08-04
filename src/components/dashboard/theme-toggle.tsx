"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { DEFAULT_THEME } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const lightThemeActive = theme === "light";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={lightThemeActive ? "Activer le thème sombre" : "Activer le thème clair"}
      onClick={() => setTheme(lightThemeActive ? DEFAULT_THEME : "light")}
      disabled={!theme}
      className="text-muted-foreground hover:text-foreground rounded-xl"
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </Button>
  );
}
