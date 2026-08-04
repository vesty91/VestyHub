import { HardDrive, LockKeyhole, Server } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getEnv } from "@/lib/env";

export default function NasPage() {
  const env = getEnv();

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header>
        <Badge className={env.SYNOLOGY_ENABLED ? "text-emerald-300" : "text-amber-200"}>
          {env.SYNOLOGY_ENABLED ? "Connecteur activé" : "À configurer"}
        </Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">NAS Synology</h1>
        <p className="mt-2 text-sm text-zinc-500">
          La page de données DSM détaillées sera branchée sur le connecteur sécurisé.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: Server, label: "Mode", value: env.SYNOLOGY_MODE },
          {
            icon: HardDrive,
            label: "Endpoint",
            value: env.SYNOLOGY_BASE_URL || "Non configuré",
          },
          {
            icon: LockKeyhole,
            label: "TLS",
            value: env.SYNOLOGY_VERIFY_TLS ? "Vérifié" : "Désactivé",
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent>
              <item.icon className="size-4 text-cyan-300" />
              <p className="mt-4 text-xs tracking-[0.14em] text-zinc-600 uppercase">
                {item.label}
              </p>
              <p className="mt-2 text-sm font-medium break-all">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <HardDrive className="mx-auto mb-3 size-8 text-zinc-600" />
          <p className="font-medium">Connecteur NAS prêt à recevoir les données</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">
            Active le connecteur dans le fichier d’environnement avec un compte DSM dédié
            en lecture seule. Aucune opération destructive n’est exposée.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
