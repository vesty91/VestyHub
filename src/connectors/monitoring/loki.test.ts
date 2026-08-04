import { buildLokiLogQuery } from "./loki";

describe("Loki query builder", () => {
  it("uses only the fixed Docker selector", () => {
    expect(buildLokiLogQuery("all")).toBe('{job="docker"}');
    expect(buildLokiLogQuery("stderr")).toBe('{job="docker",stream="stderr"}');
  });

  it("escapes user text as a LogQL string literal", () => {
    expect(buildLokiLogQuery("stdout", 'error"} | json')).toBe(
      '{job="docker",stream="stdout"} |= "error\\\"} | json"',
    );
  });

  it("bounds text filters to 200 characters", () => {
    const query = buildLokiLogQuery("all", "x".repeat(500));
    expect(query).toContain(`"${"x".repeat(200)}"`);
    expect(query).not.toContain("x".repeat(201));
  });
});
