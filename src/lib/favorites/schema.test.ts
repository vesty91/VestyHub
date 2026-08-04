import { describe, expect, it } from "vitest";

import { favoriteFormSchema } from "./schema";

const validFavorite = {
  name: "Grafana",
  description: "Monitoring",
  internalUrl: "https://grafana.local",
  externalUrl: "",
  groupId: "",
  iconValue: "chart-no-axes-combined",
  openMode: "new_tab" as const,
  tags: "monitoring, docker, monitoring",
  healthCheckEnabled: false,
  healthCheckUrl: "",
  isFavorite: true,
};

describe("favoriteFormSchema", () => {
  it("normalizes optional fields and tags", () => {
    const result = favoriteFormSchema.parse(validFavorite);
    expect(result.tags).toEqual(["monitoring", "docker"]);
    expect(result.externalUrl).toBeUndefined();
  });

  it("requires at least one service URL", () => {
    const result = favoriteFormSchema.safeParse({
      ...validFavorite,
      internalUrl: "",
      externalUrl: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-http protocols", () => {
    const result = favoriteFormSchema.safeParse({
      ...validFavorite,
      internalUrl: "file:///etc/passwd",
    });
    expect(result.success).toBe(false);
  });

  it("rejects credentials embedded in service URLs", () => {
    const result = favoriteFormSchema.safeParse({
      ...validFavorite,
      internalUrl: "https://admin:secret@grafana.local",
    });
    expect(result.success).toBe(false);
  });
});
