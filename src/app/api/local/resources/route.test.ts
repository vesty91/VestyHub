// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";
import { getCurrentSession } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { getLocalResources } from "@/lib/local-system/metrics";

vi.mock("@/lib/auth/session", () => ({ getCurrentSession: vi.fn() }));
vi.mock("@/lib/env", () => ({ getEnv: vi.fn() }));
vi.mock("@/lib/local-system/metrics", () => ({ getLocalResources: vi.fn() }));

const session = {
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Test User",
    email: "test@example.local",
    role: "ADMIN" as const,
    image: null,
  },
  expiresAt: new Date("2030-01-01T00:00:00Z"),
};

describe("Windows local resources endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentSession).mockResolvedValue(session);
    vi.mocked(getEnv).mockReturnValue({
      NODE_ENV: "production",
      SYNOLOGY_ENABLED: false,
    } as ReturnType<typeof getEnv>);
  });

  it("requires an authenticated session and does not sample the host", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getLocalResources).not.toHaveBeenCalled();
  });

  it("does not collect host resources in production", async () => {
    const response = await GET();
    expect(response.status).toBe(404);
    expect(getLocalResources).not.toHaveBeenCalled();
  });

  it("does not collect host resources when Synology is enabled", async () => {
    vi.mocked(getEnv).mockReturnValue({
      NODE_ENV: "development",
      SYNOLOGY_ENABLED: true,
    } as ReturnType<typeof getEnv>);
    const response = await GET();
    expect(response.status).toBe(404);
    expect(getLocalResources).not.toHaveBeenCalled();
  });
});
