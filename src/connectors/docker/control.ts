import { z } from "zod";

export const dockerContainerActionSchema = z.object({
  containerId: z.string().regex(/^[a-f0-9]{12,64}$/i),
  action: z.enum(["start", "stop", "restart"]),
});

export type DockerContainerAction = z.infer<typeof dockerContainerActionSchema>["action"];

export function isProtectedVestyHubContainer(
  labels: Record<string, string> | null | undefined,
): boolean {
  if (labels?.["com.docker.compose.project"] !== "vestyhub") return false;
  return ["app", "postgres", "docker-socket-proxy", "docker-control-proxy"].includes(
    labels["com.docker.compose.service"] ?? "",
  );
}

export function dockerActionPath(
  containerId: string,
  action: DockerContainerAction,
): string {
  const suffix = action === "start" ? "" : "?t=10";
  return `containers/${encodeURIComponent(containerId)}/${action}${suffix}`;
}
