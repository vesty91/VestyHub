"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("VestyHub render error", { digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-destructive text-sm font-medium tracking-widest uppercase">
          Erreur
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          Une erreur inattendue est survenue
        </h1>
        <p className="text-muted-foreground mt-3">
          Aucun détail interne n&apos;est affiché. Réessayez ou consultez les journaux
          serveur.
        </p>
        <button
          type="button"
          onClick={reset}
          className="bg-primary text-primary-foreground mt-6 rounded-lg px-4 py-2 text-sm font-medium"
        >
          Réessayer
        </button>
      </div>
    </main>
  );
}
