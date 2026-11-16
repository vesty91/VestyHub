import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MonitoringWidget } from "./monitoring-widget";

afterEach(() => {
  vi.unstubAllGlobals();
});

const at = "2026-11-16T16:00:00.000Z";

describe("MonitoringWidget when sources are not configured", () => {
  it("shows a neutral disabled state, not a fake outage or empty alert totals", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        version: 1,
        data: {
          generatedAt: at,
          range: "1h",
          sources: ["prometheus", "loki", "alertmanager"].map((source) => ({
            source,
            configured: false,
            available: false,
            checkedAt: at,
            errorCode: "NOT_CONFIGURED",
          })),
          summary: {},
          metrics: {},
          alerts: null,
          warnings: [],
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MonitoringWidget
        configuration={{ range: "1h", showSources: true, showAlerts: true }}
      />,
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Monitoring non configuré",
    );
    expect(screen.queryByText("Monitoring indisponible")).not.toBeInTheDocument();
    expect(screen.queryByText("Alertes actives")).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("shows unavailable counts as unknown, not zero, when Alertmanager has no data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          version: 1,
          data: {
            generatedAt: at,
            range: "1h",
            sources: [
              { source: "prometheus", configured: true, available: true, checkedAt: at },
              { source: "loki", configured: false, available: false, checkedAt: at },
              {
                source: "alertmanager",
                configured: true,
                available: false,
                checkedAt: at,
              },
            ],
            summary: {},
            metrics: {},
            alerts: null,
            warnings: [],
          },
        }),
      })),
    );
    render(
      <MonitoringWidget
        configuration={{ range: "1h", showSources: true, showAlerts: true }}
      />,
    );
    expect(await screen.findByText("Alertes actives")).toBeInTheDocument();
    expect(screen.getByText("En attente")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(6);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
