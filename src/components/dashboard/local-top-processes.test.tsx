import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalTopProcesses } from "./local-top-processes";

afterEach(() => {
  vi.unstubAllGlobals();
});

const processes = [
  { pid: 36588, name: "vmmemWSL", memoryBytes: 3 * 1024 ** 3 },
  { pid: 38928, name: "node.exe", memoryBytes: 2 * 1024 ** 3 },
];

describe("LocalTopProcesses", () => {
  it("renders measured working-set memory, names and PIDs", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        version: 1,
        data: { sampledAt: "2026-11-15T21:00:00Z", processes },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<LocalTopProcesses />);
    expect(await screen.findByText("vmmemWSL")).toBeInTheDocument();
    expect(screen.getByText("node.exe")).toBeInTheDocument();
    expect(screen.getByText("PID 36588")).toBeInTheDocument();
    expect(screen.getByText("3 072 Mio")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Actualiser les processus Windows" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("does not show invented process values when collection fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    render(<LocalTopProcesses />);
    expect(
      await screen.findByText("Impossible de lire les processus Windows."),
    ).toBeInTheDocument();
    expect(screen.queryByText("vmmemWSL")).not.toBeInTheDocument();
  });
});
