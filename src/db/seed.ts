import { randomBytes } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import {
  connectors,
  dashboardWidgets,
  dashboards,
  favoriteGroups,
  favorites,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logging/logger";

const seedLogger = logger.child("seed");

function requireId<T extends { id: string } | undefined>(
  value: T,
  resource: string,
): string {
  if (!value) {
    throw new Error(`Database did not return the created ${resource} ID.`);
  }
  return value.id;
}

async function main(): Promise<void> {
  const env = getEnv();
  const adminEmail = env.SEED_ADMIN_EMAIL.trim().toLowerCase();
  const configuredPassword = env.SEED_ADMIN_PASSWORD?.trim() ?? "";

  if (!configuredPassword && (env.NODE_ENV === "production" || !env.DEMO_MODE)) {
    throw new Error("SEED_ADMIN_PASSWORD is required outside non-production demo mode.");
  }
  if (configuredPassword && configuredPassword.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must contain at least 12 characters.");
  }

  const generatedPassword = configuredPassword
    ? undefined
    : randomBytes(18).toString("base64url");
  const plainPassword = configuredPassword || generatedPassword;

  if (!plainPassword) {
    throw new Error("Unable to resolve an administrator password.");
  }

  seedLogger.info("Starting database seed.");

  await db.transaction(async (tx) => {
    const [existingAdmin] = await tx
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${adminEmail}`)
      .limit(1);

    let adminId = existingAdmin?.id;
    if (!adminId) {
      const passwordHash = await hashPassword(plainPassword);
      const [created] = await tx
        .insert(users)
        .values({
          name: "Administrateur VestyHub",
          email: adminEmail,
          passwordHash,
          role: "ADMIN",
          isActive: true,
        })
        .returning({ id: users.id });
      if (!created) {
        throw new Error("Database did not return the created administrator ID.");
      }
      adminId = created.id;
      seedLogger.info("Administrator account created.", { email: adminEmail });
    } else {
      seedLogger.info("Administrator account already exists; account creation skipped.", {
        email: adminEmail,
      });
    }

    const [existingGroup] = await tx
      .select({ id: favoriteGroups.id })
      .from(favoriteGroups)
      .where(eq(favoriteGroups.userId, adminId))
      .limit(1);

    if (!existingGroup) {
      const [infraGroup] = await tx
        .insert(favoriteGroups)
        .values({
          userId: adminId,
          name: "Infrastructure",
          description: "Services coeur de l'homelab",
          icon: "server",
          color: "#38bdf8",
          sortOrder: 0,
        })
        .returning({ id: favoriteGroups.id });

      await tx.insert(favorites).values([
        {
          userId: adminId,
          groupId: requireId(infraGroup, "favorite group"),
          name: "Grafana",
          description: "Supervision de l'infrastructure",
          iconType: "lucide",
          iconValue: "chart-no-axes-combined",
          openMode: "new_tab",
          sortOrder: 0,
        },
        {
          userId: adminId,
          groupId: requireId(infraGroup, "favorite group"),
          name: "Portainer",
          description: "Gestion Docker",
          iconType: "lucide",
          iconValue: "container",
          openMode: "new_tab",
          sortOrder: 1,
        },
        {
          userId: adminId,
          groupId: requireId(infraGroup, "favorite group"),
          name: "Uptime Kuma",
          description: "Disponibilité des services",
          iconType: "lucide",
          iconValue: "activity",
          openMode: "new_tab",
          sortOrder: 2,
        },
        {
          userId: adminId,
          groupId: requireId(infraGroup, "favorite group"),
          name: "Vaultwarden",
          description: "Gestionnaire de mots de passe",
          iconType: "lucide",
          iconValue: "shield-check",
          openMode: "new_tab",
          sortOrder: 3,
        },
        {
          userId: adminId,
          groupId: requireId(infraGroup, "favorite group"),
          name: "Synology DSM",
          description: "Interface d'administration du NAS",
          iconType: "lucide",
          iconValue: "hard-drive",
          openMode: "new_tab",
          sortOrder: 4,
        },
      ]);
    }

    const [existingDashboard] = await tx
      .select({ id: dashboards.id })
      .from(dashboards)
      .where(eq(dashboards.userId, adminId))
      .limit(1);

    if (!existingDashboard) {
      const [dashboard] = await tx
        .insert(dashboards)
        .values({
          userId: adminId,
          name: "Vue d'ensemble",
          slug: "overview",
          description: "Tableau de bord principal de l'infrastructure",
          icon: "layout-dashboard",
          isDefault: true,
        })
        .returning({ id: dashboards.id });

      await tx.insert(dashboardWidgets).values([
        {
          dashboardId: requireId(dashboard, "dashboard"),
          widgetType: "clock",
          title: "Horloge",
          configuration: {},
          positionX: 0,
          positionY: 0,
          width: 2,
          height: 1,
        },
        {
          dashboardId: requireId(dashboard, "dashboard"),
          widgetType: "favorites",
          title: "Favoris",
          configuration: {},
          positionX: 2,
          positionY: 0,
          width: 4,
          height: 2,
        },
        {
          dashboardId: requireId(dashboard, "dashboard"),
          widgetType: "system-status",
          title: "Statut général",
          configuration: {},
          positionX: 0,
          positionY: 1,
          width: 2,
          height: 2,
        },
      ]);
    }

    const connectorCandidates = [
      { name: "Prometheus", type: "prometheus", baseUrl: env.PROMETHEUS_URL },
      { name: "Loki", type: "loki", baseUrl: env.LOKI_URL },
      {
        name: "Alertmanager",
        type: "alertmanager",
        baseUrl: env.ALERTMANAGER_URL,
      },
      { name: "Docker (proxy)", type: "docker", baseUrl: env.DOCKER_PROXY_URL },
      { name: "Synology DSM", type: "synology", baseUrl: env.SYNOLOGY_BASE_URL },
    ].filter(
      (candidate): candidate is { name: string; type: string; baseUrl: string } =>
        typeof candidate.baseUrl === "string" && candidate.baseUrl.length > 0,
    );

    for (const candidate of connectorCandidates) {
      const [existing] = await tx
        .select({ id: connectors.id })
        .from(connectors)
        .where(eq(connectors.type, candidate.type))
        .limit(1);

      if (!existing) {
        await tx.insert(connectors).values({
          name: candidate.name,
          type: candidate.type,
          baseUrl: candidate.baseUrl,
          enabled: false,
          verifyTls: true,
        });
      }
    }
  });

  if (generatedPassword) {
    console.log(
      `\nMode démo local uniquement — compte créé :\n  Email : ${adminEmail}\n  Mot de passe temporaire : ${generatedPassword}\n`,
    );
  }

  seedLogger.info("Database seed completed.");
}

main()
  .catch((error) => {
    seedLogger.error("Database seed failed.", {
      error: error instanceof Error ? error : String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closeDatabase();
    } catch (error) {
      seedLogger.error("Failed to close database connection.", {
        error: error instanceof Error ? error : String(error),
      });
      process.exitCode = 1;
    }
  });
