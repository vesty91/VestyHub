import { Activity, Database, ShieldCheck } from "lucide-react";
import { count } from "drizzle-orm";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth/session";
import { withDatabaseReadDeadline } from "@/lib/database-read-deadline";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/dashboard");
  }

  const [{ totalUsers }] = await withDatabaseReadDeadline(
    db.select({ totalUsers: count() }).from(users),
  );
  const hasAccount = Number(totalUsers) > 0;

  return (
    <div className="relative grid min-h-screen overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.12),transparent_32%),radial-gradient(circle_at_80%_80%,rgba(59,130,246,0.10),transparent_30%)]" />

      <section className="relative hidden border-r border-white/10 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
            <Activity className="size-5 text-cyan-300" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[0.28em] text-cyan-300">
              VESTYHUB
            </p>
            <p className="text-xs text-zinc-500">Homelab control center</p>
          </div>
        </div>

        <div className="max-w-xl space-y-7">
          <p className="text-sm tracking-[0.3em] text-zinc-500 uppercase">
            Phase 2 opérationnelle
          </p>
          <h1 className="text-5xl leading-[1.05] font-semibold tracking-tight text-white xl:text-6xl">
            Ton infrastructure,
            <span className="block text-cyan-300">dans une seule interface.</span>
          </h1>
          <p className="max-w-lg text-lg leading-8 text-zinc-400">
            Accès sécurisé, favoris persistants, widgets et supervision Docker en lecture
            seule.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: ShieldCheck, label: "Session sécurisée" },
            { icon: Database, label: "PostgreSQL" },
            { icon: Activity, label: "Healthchecks" },
          ].map((feature) => (
            <div
              key={feature.label}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <feature.icon className="mb-3 size-4 text-cyan-300" />
              <p className="text-xs text-zinc-400">{feature.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-9 lg:hidden">
            <p className="text-sm font-semibold tracking-[0.28em] text-cyan-300">
              VESTYHUB
            </p>
            <p className="mt-1 text-sm text-zinc-500">Homelab control center</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/30 p-7 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-9">
            <div className="mb-7">
              <p className="text-sm text-cyan-300">Accès administrateur</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Connexion</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Utilise le compte créé avec le profil Docker de seed.
              </p>
            </div>

            {hasAccount ? (
              <LoginForm />
            ) : (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
                Aucun compte n’existe encore. Renseigne
                <code className="mx-1 rounded bg-black/30 px-1.5 py-0.5">
                  SEED_ADMIN_PASSWORD
                </code>
                puis lance le profil Docker
                <code className="ml-1 rounded bg-black/30 px-1.5 py-0.5">seed</code>.
              </div>
            )}
          </div>

          <p className="mt-5 text-center text-xs text-zinc-600">
            Les identifiants ne sont jamais enregistrés dans les logs.
          </p>
        </div>
      </section>
    </div>
  );
}
