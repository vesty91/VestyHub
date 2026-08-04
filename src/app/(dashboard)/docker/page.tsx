import { Box, Container, Cpu, HardDrive, MemoryStick, Server } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getDockerOverview } from "@/connectors/docker/client";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "unit",
    unit: "gigabyte",
    maximumFractionDigits: 1,
  }).format(bytes / 1024 ** 3);
}

export default async function DockerPage() {
  const docker = await getDockerOverview();

  return (
    <div className="mx-auto max-w-[1500px] space-y-7">
      <header>
        <div className="mb-2 flex items-center gap-2">
          <Badge className="border-emerald-300/15 bg-emerald-300/10 text-emerald-200">
            Lecture seule
          </Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Docker</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Inventaire du moteur et des conteneurs via le socket proxy sécurisé.
        </p>
      </header>

      {!docker.available || !docker.engine ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Container className="mx-auto mb-3 size-8 text-zinc-600" />
            <p className="font-medium">Docker n’est pas joignable</p>
            <p className="mt-2 text-sm text-zinc-500">{docker.error}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Conteneurs", value: docker.engine.containers, icon: Container },
              { label: "En cours", value: docker.engine.running, icon: Box },
              { label: "Images", value: docker.engine.images, icon: HardDrive },
              { label: "CPU", value: docker.engine.cpus, icon: Cpu },
              {
                label: "Mémoire",
                value: formatBytes(docker.engine.memoryBytes),
                icon: MemoryStick,
              },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent>
                  <stat.icon className="size-4 text-cyan-300" />
                  <p className="mt-4 text-xs tracking-[0.14em] text-zinc-600 uppercase">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <Card>
            <CardContent>
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Moteur Docker</p>
                  <p className="text-xs text-zinc-500">
                    {docker.engine.name} · {docker.engine.operatingSystem}
                  </p>
                </div>
                <Badge>
                  <Server className="size-3" />
                  {docker.engine.version} / API {docker.engine.apiVersion}
                </Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.07] text-xs tracking-[0.12em] text-zinc-600 uppercase">
                      <th className="px-3 py-3 font-medium">Conteneur</th>
                      <th className="px-3 py-3 font-medium">Image</th>
                      <th className="px-3 py-3 font-medium">État</th>
                      <th className="px-3 py-3 font-medium">Statut</th>
                      <th className="px-3 py-3 font-medium">Ports</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docker.containers.map((container) => (
                      <tr
                        key={container.Id}
                        className="border-b border-white/[0.045] last:border-0"
                      >
                        <td className="px-3 py-4 font-medium">
                          {container.Names[0]?.replace(/^\//, "") ||
                            container.Id.slice(0, 12)}
                        </td>
                        <td className="max-w-64 truncate px-3 py-4 text-zinc-400">
                          {container.Image}
                        </td>
                        <td className="px-3 py-4">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={`size-2 rounded-full ${
                                container.State === "running"
                                  ? "bg-emerald-400"
                                  : "bg-zinc-600"
                              }`}
                            />
                            {container.State}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-zinc-500">{container.Status}</td>
                        <td className="px-3 py-4 text-zinc-500">
                          {container.Ports.filter((port) => port.PublicPort)
                            .map((port) => `${port.PublicPort}:${port.PrivatePort}`)
                            .join(", ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
