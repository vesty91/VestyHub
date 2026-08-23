import { describe, expect, it } from "vitest";

import { classifyFavoriteHealthStatus, getFavoriteHealthLabel } from "./health";

describe("favorite health", () => {
  it.each([200, 204, 301, 399])("classifies HTTP %s as online", (statusCode) => {
    expect(classifyFavoriteHealthStatus(statusCode)).toBe("online");
  });

  it.each([400, 401, 403, 404, 429])(
    "classifies reachable HTTP %s responses as degraded",
    (statusCode) => {
      expect(classifyFavoriteHealthStatus(statusCode)).toBe("degraded");
    },
  );

  it.each([500, 502, 503])("classifies HTTP %s as offline", (statusCode) => {
    expect(classifyFavoriteHealthStatus(statusCode)).toBe("offline");
  });

  it("provides a readable checking label", () => {
    expect(getFavoriteHealthLabel("checking")).toBe("Vérification…");
  });
});
