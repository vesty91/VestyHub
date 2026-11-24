import { z } from "zod";

export const dockerContainerActionSchema = z.object({
  containerId: z.string().regex(/^[a-f0-9]{12,64}$/i),
  action: z.enum(["start", "stop", "restart"]),
});

export type DockerContainerAction = z.infer<typeof dockerContainerActionSchema>["action"];

export function isProtectedVestyHubContainer(
  labels: Record<string, string> | null | undefined,
  names: readonly string[] = [],
): boolean {
  // Protect every VestyHub Compose project, not only a short list of services.
  const project = labels?.["com.docker.compose.project"] ?? "";
  if (/^vestyhub(?:[-_][a-z0-9_-]+)?$/i.test(project)) return true;
  if (labels?.["vestyhub.protected"] === "true") return true;
  // Fail closed for manually named control-plane containers without labels.
  return names.some((name) => /^\/?vestyhub(?:$|[-_])/i.test(name));
}

export function dockerActionPath(
  containerId: string,
  action: DockerContainerAction,
): string {
  const suffix = action === "start" ? "" : "?t=10";
  return `containers/${encodeURIComponent(containerId)}/${action}${suffix}`;
}
