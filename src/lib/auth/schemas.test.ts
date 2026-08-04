import { describe, expect, it } from "vitest";

import { loginSchema } from "./schemas";

describe("loginSchema", () => {
  it("normalizes the email address", () => {
    const result = loginSchema.parse({
      email: "  ADMIN@VESTYHUB.LOCAL ",
      password: "correct horse battery staple",
    });

    expect(result.email).toBe("admin@vestyhub.local");
  });

  it("rejects malformed credentials", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "" }).success).toBe(
      false,
    );
  });
});
