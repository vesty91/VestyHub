import { Badge } from "@/components/ui/badge";
import { DockerOverviewClient } from "@/components/docker/docker-overview-client";
import { getDockerOverview } from "@/connectors/docker/client";

export const dynamic = "force-dynamic";

export default async function DockerPage() {
  const docker = await getDockerOverview();

  return (
    <div className="mx-auto max-w-[1500px] space-y-7">
      <header>
        <div className="mb-2 flex items-center gap-2">
          <Badge className="border-emerald-300/15 bg-emerald-300/10 text-emerald-200">
            Lecture seule
          </Badge>
          <Badge>Source NAS Synology</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Docker</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Inventaire du moteur Docker du NAS via un proxy sécurisé, sans contrôle des conteneurs.
        </p>
      </header>

      <DockerOverviewClient initial={docker} />
    </div>
  );
}
