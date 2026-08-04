"use client";

import { useSyncExternalStore } from "react";
import { Check, Palette } from "lucide-react";
import { useTheme } from "next-themes";

import { Panel, PanelHeader } from "@/components/vestyhub/primitives";
import { DEFAULT_THEME, isThemeId, THEMES, type ThemeId } from "@/lib/theme";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => undefined;

export function ThemeSelector() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const { theme, setTheme } = useTheme();
  const selectedTheme = mounted && isThemeId(theme) ? theme : DEFAULT_THEME;

  function selectTheme(themeId: ThemeId) {
    setTheme(themeId);
  }

  return (
    <Panel>
      <PanelHeader
        title="Apparence"
        subtitle="Le thème est enregistré immédiatement dans ce navigateur."
        icon={<Palette className="size-4" />}
      />

      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Thème VestyHub">
        {THEMES.map((item) => {
          const active = selectedTheme === item.id;

          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => selectTheme(item.id)}
              className={cn(
                "focus-visible:ring-ring group rounded-xl border p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "border-primary/55 bg-primary/[0.08] shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_18%,transparent)]"
                  : "border-border/70 bg-card/45 hover:border-primary/30 hover:bg-card/75",
              )}
            >
              <div
                data-theme={item.id}
                className="border-border/80 bg-background relative h-20 overflow-hidden rounded-lg border"
                aria-hidden="true"
              >
                <div className="bg-sidebar absolute inset-y-0 left-0 w-5 border-r border-border" />
                <div className="bg-card absolute top-3 right-3 left-8 h-5 rounded border border-border" />
                <div className="bg-card absolute right-3 bottom-3 left-8 h-7 rounded border border-border" />
                <span className="bg-primary absolute top-5 right-5 size-2 rounded-full" />
                <span className="bg-success absolute right-5 bottom-5 h-1.5 w-8 rounded-full" />
              </div>

              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <span className="text-sm font-medium">{item.label}</span>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">{item.description}</p>
                </div>
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full border",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-transparent",
                  )}
                  aria-hidden="true"
                >
                  <Check className="size-3" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
