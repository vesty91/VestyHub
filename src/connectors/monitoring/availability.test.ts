import { describe, expect, it } from "vitest";

import {
  hasConfiguredMonitoringSource,
  monitoringAvailability,
  unavailableSourceWarning,
} from "./availability";
import type { MonitoringSourceStatus } from "./types";

const source = (
  overrides: Partial<MonitoringSourceStatus> = {},
): MonitoringSourceStatus => ({
  source: "prometheus",
  checkedAt: "2026-11-16T16:00:00.000Z",
  configured: false,
  available: false,
  errorCode: "NOT_CONFIGURED",
  ...overrides,
});

describe("monitoring source availability", () => {
  it("distinguishes unconfigured from unreachable and operational", () => {
    expect(monitoringAvailability(source())).toBe("not-configured");
    expect(
      monitoringAvailability(source({ configured: true, errorCode: "TIMEOUT" })),
    ).toBe("unreachable");
    expect(
      monitoringAvailability(
        source({ configured: true, available: true, errorCode: undefined }),
      ),
    ).toBe("available");
  });

  it("does not raise warnings for unconfigured sources", () => {
    expect(unavailableSourceWarning(source())).toBeNull();
    expect(
      unavailableSourceWarning(
        source({ configured: true, available: true, errorCode: undefined }),
      ),
    ).toBeNull();
  });

  it("raises one safe warning for a configured source that times out", () => {
    expect(
      unavailableSourceWarning(source({ configured: true, errorCode: "TIMEOUT" })),
    ).toEqual({
      source: "prometheus",
      code: "TIMEOUT",
      message: "Délai de réponse dépassé.",
    });
    expect(
      unavailableSourceWarning(source({ configured: true, errorCode: undefined })),
    ).toMatchObject({ code: "UNREACHABLE" });
  });

  it("detects when no source is configured without a network request", () => {
    expect(hasConfiguredMonitoringSource([source(), source({ source: "loki" })])).toBe(
      false,
    );
    expect(
      hasConfiguredMonitoringSource([
        source(),
        source({ source: "loki", configured: true }),
      ]),
    ).toBe(true);
  });
});
