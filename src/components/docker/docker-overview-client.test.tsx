import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DockerOverview } from "@/connectors/docker/types";

import { DockerOverviewClient } from "./docker-overview-client";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const disabled: DockerOverview = {
  configured: false,
  available: false,
  partial: false,
  fetchedAt: "2026-11-16T17:00:00.000Z",
  counters: { total: 0, running: 0, paused: 0, stopped: 0, unhealthy: 0 },
  containers: [],
  warnings: [],
  error: "Source Docker NAS non configurée.",
};

describe("DockerOverviewClient without configured NAS proxy", () => {
  it("shows a neutral configuration message without retry polling", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    render(<DockerOverviewClient initial={disabled} canControl={false} />);

    expect(screen.getByRole("status")).toHaveTextContent("Docker du NAS non configuré");
    expect(screen.getByText(/Cette source est facultative/)).toBeInTheDocument();
    expect(screen.queryByText("Docker du NAS indisponible")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actualiser" })).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(60_000));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
