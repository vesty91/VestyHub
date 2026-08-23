import { NextResponse } from "next/server";

import { controlDockerContainer } from "@/connectors/docker/client";
import { dockerContainerActionSchema } from "@/connectors/docker/control";
import { getCurrentSession } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logging/logger";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const;
const actionLogger = logger.child("docker-control");

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Droits administrateur requis." },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }
  if (!getEnv().DOCKER_CONTROL_ENABLED) {
    return NextResponse.json(
      { error: "Le contrôle Docker est désactivé." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== new URL(getEnv().APP_URL).origin) {
    return NextResponse.json(
      { error: "Origine de la requête refusée." },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps JSON invalide." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
  const parsed = dockerContainerActionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Commande Docker invalide." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    await controlDockerContainer(parsed.data.containerId, parsed.data.action);
    actionLogger.info("Docker container action completed.", {
      userId: session.user.id,
      containerId: parsed.data.containerId,
      action: parsed.data.action,
    });
    return NextResponse.json(
      { ok: true, action: parsed.data.action },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    actionLogger.warn("Docker container action failed.", {
      userId: session.user.id,
      containerId: parsed.data.containerId,
      action: parsed.data.action,
      error,
    });
    if (message === "Docker container not found.") {
      return NextResponse.json(
        { error: "Conteneur introuvable." },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }
    if (message === "Protected VestyHub container.") {
      return NextResponse.json(
        { error: "Ce conteneur VestyHub est protégé pour éviter une perte d’accès." },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }
    return NextResponse.json(
      { error: "La commande Docker a échoué." },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }
}
