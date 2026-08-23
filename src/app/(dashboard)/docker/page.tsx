import { Badge } from "@/components/ui/badge";
import { DockerOverviewClient } from "@/components/docker/docker-overview-client";
import { getDockerOverview } from "@/connectors/docker/client";
import { requireUser } from "@/lib/auth/dal";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function DockerPage() {
  const [docker, user] = await Promise.all([getDockerOverview(), requireUser()]);
  const canControl = user.role === "ADMIN" && getEnv().DOCKER_CONTROL_ENABLED;

  return (
    <div className="mx-auto max-w-[1500px] space-y-7">
      <header>
        <div className="mb-2 flex items-center gap-2">
          <Badge className="border-emerald-300/15 bg-emerald-300/10 text-emerald-200">
            {canControl ? "Contrôle administrateur" : "Lecture seule"}
          </Badge>
          <Badge>Source NAS Synology</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Docker</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Supervise et pilote les services de ton NAS depuis une interface claire et
          sécurisée.
        </p>
      </header>

      <DockerOverviewClient initial={docker} canControl={canControl} />
    </div>
  );
}
