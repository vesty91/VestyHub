import { KeyRound, ShieldCheck, UserCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Compte et sécurité de la session locale.
        </p>
      </header>

      <Card>
        <CardContent>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid size-16 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-300">
              <UserCircle className="size-8" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-semibold">{user.name}</p>
              <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
            </div>
            <Badge className="border-cyan-300/15 bg-cyan-300/10 text-cyan-200">
              {user.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent>
            <ShieldCheck className="size-5 text-emerald-300" />
            <p className="mt-4 font-medium">Session sécurisée</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Jeton opaque aléatoire, empreinte SHA-256 en base et cookie HttpOnly.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <KeyRound className="size-5 text-cyan-300" />
            <p className="mt-4 font-medium">Authentification locale</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Mots de passe Argon2id et limitation des tentatives de connexion.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
