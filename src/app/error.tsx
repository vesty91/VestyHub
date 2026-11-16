"use client";

import { AlertTriangle, CheckCircle2, Database, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type FailureKind = "checking" | "database" | "recovered" | "other";

const DATABASE_RETRY_INTERVAL_MS = 15_000;

/**
 * This error boundary is independent of authenticated routes. It can still
 * call /api/health/ready while session queries fail, without reading secrets
 * or modifying PostgreSQL state.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [failureKind, setFailureKind] = useState<FailureKind>("checking");
  const [checking, setChecking] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  const checkReadiness = useCallback(async () => {
    if (requestRef.current) return;

    const controller = new AbortController();
    requestRef.current = controller;
    setChecking(true);

    try {
      const response = await fetch("/api/health/ready", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setFailureKind((previous) => {
          if (response.status === 503) return "database";
          if (response.status === 200) {
            return previous === "database" || previous === "recovered"
              ? "recovered"
              : "other";
          }
          return previous === "database" ? "database" : "other";
        });
      }
    } catch {
      if (!controller.signal.aborted) {
        // A browser/network failure does not prove PostgreSQL is down or back.
        setFailureKind((previous) => (previous === "database" ? "database" : "other"));
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    // Never log the underlying database error: SQL arguments, connection
    // strings and session tokens may be present in server-side exceptions.
    console.error("VestyHub render error", { digest: error.digest });
    // Schedule the first probe after the effect has been installed; avoid a
    // synchronous React state update from an effect body.
    const initialProbe = window.setTimeout(() => void checkReadiness(), 0);

    return () => {
      window.clearTimeout(initialProbe);
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [error.digest, checkReadiness]);

  useEffect(() => {
    if (failureKind !== "database") return;

    // Poll only while PostgreSQL is known to be unavailable. Never refresh
    // the page or restart services automatically; a human resumes navigation.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkReadiness();
    }, DATABASE_RETRY_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkReadiness();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [failureKind, checkReadiness]);

  const databaseUnavailable = failureKind === "database";
  const recovered = failureKind === "recovered";

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="border-border/70 bg-surface-elevated/45 w-full max-w-lg rounded-2xl border p-8 text-center shadow-xl">
        <div
          className={
            recovered
              ? "bg-success/10 text-success mx-auto grid size-14 place-items-center rounded-xl"
              : "bg-warning/10 text-warning mx-auto grid size-14 place-items-center rounded-xl"
          }
        >
          {recovered ? (
            <CheckCircle2 className="size-7" aria-hidden="true" />
          ) : databaseUnavailable ? (
            <Database className="size-7" aria-hidden="true" />
          ) : (
            <AlertTriangle className="size-7" aria-hidden="true" />
          )}
        </div>
        <p className="text-warning mt-6 text-xs font-medium tracking-widest uppercase">
          Diagnostic VestyHub
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          {recovered
            ? "PostgreSQL répond de nouveau"
            : databaseUnavailable
              ? "PostgreSQL est indisponible"
              : "VestyHub a rencontré une erreur"}
        </h1>
        <p
          className="text-muted-foreground mt-3 text-sm leading-6"
          role="status"
          aria-live="polite"
        >
          {recovered
            ? "La connexion à PostgreSQL est rétablie. Tu peux relancer le dashboard ; ta session sera vérifiée lors de la reprise."
            : databaseUnavailable
              ? "La base ne répond pas. Vérifie PostgreSQL : VestyHub contrôle son retour toutes les 15 secondes lorsque cet onglet est visible. Aucune donnée n’est supprimée."
              : failureKind === "checking"
                ? "Vérification des services en cours…"
                : "Une erreur inattendue est survenue. Consulte les journaux du serveur si elle persiste."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {databaseUnavailable ? (
            <button
              type="button"
              onClick={() => void checkReadiness()}
              disabled={checking}
              className="border-border text-foreground hover:bg-surface-elevated focus-visible:ring-primary inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Database className="size-4" aria-hidden="true" />
              {checking ? "Vérification…" : "Vérifier PostgreSQL"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={reset}
            disabled={databaseUnavailable || failureKind === "checking"}
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {recovered ? "Reprendre VestyHub" : "Réessayer"}
          </button>
        </div>
      </div>
    </main>
  );
}
