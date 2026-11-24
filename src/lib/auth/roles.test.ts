// @vitest-environment node

import { describe, expect, it } from "vitest";

import { canMutateDashboard } from "./roles";

describe("dashboard role permissions", () => {
  it("rejects VIEWER mutations", () => {
    expect(canMutateDashboard("VIEWER")).toBe(false);
  });

  it("allows USER and ADMIN mutations", () => {
    expect(canMutateDashboard("USER")).toBe(true);
    expect(canMutateDashboard("ADMIN")).toBe(true);
  });
});
