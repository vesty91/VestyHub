import { summarizeAlerts } from "./alertmanager";
import type { MonitoringAlert } from "./types";

const alerts: MonitoringAlert[] = [
  {
    id: "1",
    state: "firing",
    severity: "critical",
    name: "DiskFull",
    labels: {},
  },
  {
    id: "2",
    state: "firing",
    severity: "warning",
    name: "HighCpu",
    labels: {},
  },
  {
    id: "3",
    state: "pending",
    severity: "warning",
    name: "MemoryPressure",
    labels: {},
  },
];

describe("Alertmanager summaries", () => {
  it("counts states and severities", () => {
    expect(summarizeAlerts(alerts)).toEqual({
      firing: 2,
      pending: 1,
      bySeverity: { critical: 1, warning: 2 },
    });
  });

  it("returns empty counters without alerts", () => {
    expect(summarizeAlerts([])).toEqual({ firing: 0, pending: 0, bySeverity: {} });
  });
});
