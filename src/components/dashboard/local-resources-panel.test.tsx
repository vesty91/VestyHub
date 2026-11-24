import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalResourcesPanel } from "./local-resources-panel";

afterEach(() => {
  vi.unstubAllGlobals();
});

const data = {
  sampledAt: "2026-11-15T21:00:00.000Z",
  cpu: { usagePercent: 25, logicalCores: 24 },
  memory: { totalBytes: 32 * 1024 ** 3, usedBytes: 16 * 1024 ** 3, usagePercent: 50 },
  disks: [
    {
      drive: "C:",
      totalBytes: 100 * 1024 ** 3,
      freeBytes: 40 * 1024 ** 3,
      usedPercent: 60,
    },
    {
      drive: "D:",
      totalBytes: 200 * 1024 ** 3,
      freeBytes: 100 * 1024 ** 3,
      usedPercent: 50,
    },
  ],
};

describe("LocalResourcesPanel", () => {
  it("renders real Windows metrics and live service status", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url === "/api/local/resources"
        ? { ok: true, json: async () => ({ version: 1, data }) }
        : { ok: true },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<LocalResourcesPanel />);

    expect(await screen.findByText("25 %")).toBeInTheDocument();
    expect(screen.getAllByText("50 %")).toHaveLength(2);
    expect(screen.getByText(/D: · 100 Gio libres/)).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/local/resources",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("shows an unavailable state instead of inventing metrics", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/local/resources" ? { ok: false } : { ok: false },
      ),
    );
    render(<LocalResourcesPanel />);

    await waitFor(() => {
      expect(
        screen.getByText(/Mesures Windows momentanément indisponibles/),
      ).toBeInTheDocument();
      expect(screen.getByText("0 / 2")).toBeInTheDocument();
    });
    expect(screen.getAllByText("—")).toHaveLength(3);
  });
});
