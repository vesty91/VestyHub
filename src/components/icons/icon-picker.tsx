"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  getServiceIconOption,
  ServiceIcon,
  serviceIconCategories,
  type ServiceIconName,
} from "./service-icon";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR");
}

export function IconPicker({
  name,
  defaultValue = "globe-2",
  labelId,
}: {
  name: string;
  defaultValue?: string | null;
  labelId?: string;
}) {
  const initialValue = getServiceIconOption(defaultValue)?.name ?? "globe-2";
  const [selectedName, setSelectedName] = useState<ServiceIconName>(initialValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = `${name}-icon-listbox`;
  const selectedOption = getServiceIconOption(selectedName);

  const visibleCategories = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());

    if (!normalizedQuery) return serviceIconCategories;

    return serviceIconCategories
      .map((category) => ({
        ...category,
        icons: category.icons.filter((icon) => {
          const searchable = normalizeSearch(
            [icon.name, icon.label, category.label, ...(icon.keywords ?? [])].join(" "),
          );
          return searchable.includes(normalizedQuery);
        }),
      }))
      .filter((category) => category.icons.length > 0);
  }, [query]);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const openPicker = () => {
    setOpen(true);
    window.requestAnimationFrame(() => searchRef.current?.focus());
  };

  const closePicker = () => {
    setOpen(false);
    setQuery("");
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const selectIcon = (iconName: ServiceIconName) => {
    setSelectedName(iconName);
    closePicker();
  };

  const moveOptionFocus = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) {
      return;
    }

    const options = Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>("[data-icon-option]") ?? [],
    );
    const currentIndex = options.indexOf(event.currentTarget);
    if (currentIndex < 0 || options.length === 0) return;

    event.preventDefault();
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (currentIndex + direction + options.length) % options.length;
    options[nextIndex]?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={selectedName} />

      <button
        ref={triggerRef}
        id={`${name}-trigger`}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-labelledby={labelId}
        onClick={() => (open ? closePicker() : openPicker())}
        className="flex h-12 w-full items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 text-left text-sm transition outline-none hover:border-cyan-300/25 hover:bg-cyan-300/[0.025] focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-cyan-300/10 text-cyan-300 ring-1 ring-cyan-300/15">
          <ServiceIcon name={selectedName} className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {selectedOption?.label ?? "Icône personnalisée"}
          </span>
          <span className="block truncate font-mono text-[10px] text-zinc-500">
            {selectedName}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-zinc-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Choisir une icône"
          className="bg-popover text-popover-foreground absolute right-0 z-50 mt-2 w-full min-w-72 overflow-hidden rounded-2xl border border-white/10 shadow-2xl ring-1 shadow-black/40 ring-black/10 md:w-[42rem]"
        >
          <div className="flex items-center gap-3 border-b border-white/[0.07] p-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
              <Input
                ref={searchRef}
                value={query}
                aria-label="Rechercher une icône"
                onChange={(event: ReactChangeEvent<HTMLInputElement>) =>
                  setQuery(event.target.value)
                }
                placeholder="Rechercher : téléchargement, NAS, Docker, sécurité…"
                className="h-11 bg-black/20 pr-9 pl-9"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Effacer la recherche"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                  className="hover:text-foreground absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 hover:bg-white/[0.06]"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Fermer le sélecteur"
              onClick={closePicker}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div
            id={listboxId}
            role="listbox"
            aria-label="Bibliothèque d’icônes"
            className="max-h-[min(34rem,65vh)] overflow-y-auto p-3"
          >
            {visibleCategories.length === 0 ? (
              <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-white/10 text-center">
                <div>
                  <Search className="mx-auto mb-3 size-6 text-zinc-600" />
                  <p className="text-sm font-medium">Aucune icône trouvée</p>
                  <p className="mt-1 text-xs text-zinc-500">Essaie un autre mot-clé.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {visibleCategories.map((category) => (
                  <section key={category.id} aria-labelledby={`${category.id}-title`}>
                    <div className="mb-2 flex items-center justify-between gap-3 px-1">
                      <h3
                        id={`${category.id}-title`}
                        className="text-xs font-semibold tracking-wide text-zinc-400 uppercase"
                      >
                        {category.label}
                      </h3>
                      <span className="text-[10px] text-zinc-600">
                        {category.icons.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {category.icons.map((icon) => {
                        const selected = selectedName === icon.name;

                        return (
                          <button
                            key={icon.name}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            data-icon-option
                            onKeyDown={moveOptionFocus}
                            onClick={() => selectIcon(icon.name)}
                            className={cn(
                              "group flex min-w-0 items-center gap-2.5 rounded-xl border p-2.5 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50",
                              selected
                                ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"
                                : "border-white/[0.07] bg-black/10 hover:border-cyan-300/20 hover:bg-cyan-300/[0.04]",
                            )}
                          >
                            <span
                              className={cn(
                                "grid size-8 shrink-0 place-items-center rounded-lg transition",
                                selected
                                  ? "bg-cyan-300/15 text-cyan-300"
                                  : "bg-white/[0.045] text-zinc-400 group-hover:text-cyan-300",
                              )}
                            >
                              <ServiceIcon name={icon.name} className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs font-medium">
                              {icon.label}
                            </span>
                            {selected ? (
                              <Check className="size-3.5 shrink-0 text-cyan-300" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] bg-black/10 px-4 py-2.5 text-[11px] text-zinc-500">
            <span>Entrée pour sélectionner · Échap pour fermer</span>
            <span>
              {serviceIconCategories.reduce(
                (total, category) => total + category.icons.length,
                0,
              )}{" "}
              icônes
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
