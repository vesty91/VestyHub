// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH as patchFavorites } from "@/app/api/favorites/layout/route";
import { getCurrentSession } from "@/lib/auth/session";
import type { UserRole } from "@/lib/auth/types";

import { PATCH as patchLayout } from "./layout/route";
import { PATCH as patchSettings } from "./widgets/settings/route";
import { PATCH as patchWidgets, POST as postWidgets } from "./widgets/route";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: vi.fn() }));

const handlers = [
  { name: "layout", method: "PATCH", handler: patchLayout },
  { name: "widget settings", method: "PATCH", handler: patchSettings },
  { name: "widget visibility", method: "PATCH", handler: patchWidgets },
  { name: "widget creation", method: "POST", handler: postWidgets },
  { name: "favorites layout", method: "PATCH", handler: patchFavorites },
] as const;

function sessionAs(role: UserRole) {
  vi.mocked(getCurrentSession).mockResolvedValue({
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Test User",
      email: "test@example.local",
      role,
      image: null,
    },
    expiresAt: new Date("2030-01-01T00:00:00Z"),
  });
}

function requestFor(method: string) {
  return new Request("http://localhost:3000/api/dashboard", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}), // Invalid payload, reaches validation for USER/ADMIN
  });
}

describe("dashboard HTTP mutation permission boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const { name, method, handler } of handlers) {
    it(`${name}: unauthenticated -> 401`, async () => {
      vi.mocked(getCurrentSession).mockResolvedValue(null);
      expect((await handler(requestFor(method))).status).toBe(401);
    });

    it(`${name}: VIEWER -> 403`, async () => {
      sessionAs("VIEWER");
      expect((await handler(requestFor(method))).status).toBe(403);
    });

    it(`${name}: USER reaches payload validation`, async () => {
      sessionAs("USER");
      expect((await handler(requestFor(method))).status).toBe(400);
    });
  }
});
