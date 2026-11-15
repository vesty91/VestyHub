"use client";

import { AlertTriangle, Database, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

type FailureKind = "checking" | "database" | "other";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [failureKind, setFailureKind] = useState<FailureKind>("checking");

  useEffect(() => {
    // Do not log query parameters, tokens, or database connection details.
    console.error("VestyHub render error", { digest: error.digest });

    const controller = new AbortController();
    void fetch("/api/health/ready", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => setFailureKind(response.status === 503 ? "database" : "other"))
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailureKind("other");
        }
      });

    return () => controller.abort();
  }, [error.digest]);

  const databaseUnavailable = failureKind === "database";

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="border-border/70 bg-surface-elevated/45 w-full max-w-lg rounded-2xl border p-8 text-center shadow-xl">
        <div className="bg-warning/10 text-warning mx-auto grid size-14 place-items-center rounded-xl">
          {databaseUnavailable ? (
            <Database className="size-7" aria-hidden="true" />
          ) : (
            <AlertTriangle className="size-7" aria-hidden="true" />
          )}
        </div>
        <p className="text-warning mt-6 text-xs font-medium tracking-widest uppercase">
          Diagnostic VestyHub
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          {databaseUnavailable
            ? "PostgreSQL est indisponible"
            : "VestyHub a rencontré une erreur"}
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-6" role="status">
          {databaseUnavailable
            ? "La connexion à la base de données est interrompue. Vérifie le service PostgreSQL, puis réessaie. Cette erreur ne signifie pas que les données sont perdues."
            : failureKind === "checking"
              ? "Vérification des services en cours…"
              : "Une erreur inattendue est survenue. Consulte les journaux du serveur si elle persiste."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary mt-6 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition focus-visible:ring-2"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Réessayer
        </button>
      </div>
    </main>
  );
}
