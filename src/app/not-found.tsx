import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
          404
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Page introuvable</h1>
        <p className="text-muted-foreground mt-3">
          La ressource demandée n&apos;existe pas ou a été déplacée.
        </p>
        <Link
          href="/"
          className="bg-primary text-primary-foreground mt-6 inline-flex rounded-lg px-4 py-2 text-sm font-medium"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
