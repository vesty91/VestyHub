import { KeyRound, ShieldCheck, UserCircle } from "lucide-react";

import { ThemeSelector } from "@/components/settings/theme-selector";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel, PanelHeader } from "@/components/vestyhub/primitives";
import { requireUser } from "@/lib/auth/dal";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <PageHeader
        title="Paramètres"
        description="Personnalise l’interface et consulte les protections actives de ta session locale."
      />

      <ThemeSelector />

      <Panel>
        <PanelHeader
          title="Compte"
          subtitle="Identité et rôle de la session en cours"
          icon={<UserCircle className="size-4" />}
        />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="bg-primary/10 text-primary grid size-16 place-items-center rounded-2xl">
            <UserCircle className="size-8" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold">{user.name}</p>
            <p className="text-muted-foreground mt-1 text-sm">{user.email}</p>
          </div>
          <Badge className="border-primary/20 bg-primary/10 text-primary">
            {user.role}
          </Badge>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Session sécurisée"
            subtitle="Protection du jeton de session"
            icon={<ShieldCheck className="size-4" />}
          />
          <p className="text-muted-foreground text-sm leading-6">
            Jeton opaque aléatoire, empreinte SHA-256 en base et cookie HttpOnly.
          </p>
        </Panel>
        <Panel>
          <PanelHeader
            title="Authentification locale"
            subtitle="Protection du mot de passe et des connexions"
            icon={<KeyRound className="size-4" />}
          />
          <p className="text-muted-foreground text-sm leading-6">
            Mots de passe Argon2id et limitation des tentatives de connexion.
          </p>
        </Panel>
      </div>
    </div>
  );
}
