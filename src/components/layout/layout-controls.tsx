"use client";

import { Lock, Pencil, RefreshCw, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export type LayoutSaveStatus = "idle" | "saving" | "saved" | "error";

export function LayoutControls({
  isEditing,
  saveStatus,
  onToggleEditing,
  onReset,
  onRetry,
}: {
  isEditing: boolean;
  saveStatus: LayoutSaveStatus;
  onToggleEditing: () => void;
  onReset: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-9 flex-wrap items-center justify-end gap-2">
      <div className="text-muted-foreground mr-auto text-xs" aria-live="polite">
        {saveStatus === "saving" ? "Enregistrement…" : null}
        {saveStatus === "saved" ? (
          <span className="text-success">Disposition enregistrée</span>
        ) : null}
        {saveStatus === "error" ? (
          <span className="text-destructive">
            Impossible d’enregistrer la disposition.
          </span>
        ) : null}
        {saveStatus === "idle" ? (
          <span>{isEditing ? "Mode édition actif" : "Disposition verrouillée"}</span>
        ) : null}
      </div>

      {saveStatus === "error" ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw />
          Réessayer
        </Button>
      ) : null}

      {isEditing ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={saveStatus === "saving"}
        >
          <RotateCcw />
          Réinitialiser
        </Button>
      ) : null}

      <Button
        type="button"
        variant={isEditing ? "default" : "outline"}
        size="sm"
        onClick={onToggleEditing}
        disabled={saveStatus === "saving"}
      >
        {isEditing ? <Lock /> : <Pencil />}
        {isEditing ? "Terminer" : "Modifier la disposition"}
      </Button>
    </div>
  );
}
