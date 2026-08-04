import { describe, expect, it } from "vitest";

import { sanitizeServiceUrl } from "./client";

describe("sanitizeServiceUrl", () => {
  it("accepts HTTP and HTTPS URLs", () => {
    expect(sanitizeServiceUrl("http://nas.local:3000")).toBe(
      "http://nas.local:3000/",
    );
    expect(sanitizeServiceUrl("https://service.example.test/path")).toBe(
      "https://service.example.test/path",
    );
  });

  it("rejects dangerous or invalid protocols", () => {
    expect(sanitizeServiceUrl("javascript:alert(1)")).toBeUndefined();
    expect(sanitizeServiceUrl("data:text/html,test")).toBeUndefined();
    expect(sanitizeServiceUrl("file:///etc/passwd")).toBeUndefined();
    expect(sanitizeServiceUrl("not a url")).toBeUndefined();
  });
});
