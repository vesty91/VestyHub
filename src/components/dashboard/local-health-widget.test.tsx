import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalHealthWidget } from "./local-health-widget";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LocalHealthWidget", () => {
  it("shows real HTTP health for both local services", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<LocalHealthWidget configuration={{ refreshSeconds: 15 }} />);

    await waitFor(() => {
      expect(screen.getAllByText("En ligne")).toHaveLength(2);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health/live",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health/ready",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("warns without altering containers when PostgreSQL fails", async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: url === "/api/health/live",
      status: url === "/api/health/live" ? 200 : 503,
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<LocalHealthWidget configuration={{ refreshSeconds: 30 }} />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Base non disponible");
    });
    expect(screen.getByText("Hors ligne")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
