import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ErrorPage from "./error";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("application error page", () => {
  it("does not retry a failed render while PostgreSQL is still unavailable", async () => {
    const reset = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () => ({ status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ErrorPage
        error={new Error("hidden database connection string: secret")}
        reset={reset}
      />,
    );

    expect(await screen.findByText("PostgreSQL est indisponible")).toBeInTheDocument();
    expect(
      screen.queryByText(/hidden database connection string/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Vérifier PostgreSQL" })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: "Vérifier PostgreSQL" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeDisabled();
    expect(reset).not.toHaveBeenCalled();
  });

  it("enables explicit dashboard recovery only after readiness returns HTTP 200", async () => {
    const reset = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    render(<ErrorPage error={new Error("database failure")} reset={reset} />);
    expect(await screen.findByText("PostgreSQL est indisponible")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Vérifier PostgreSQL" }));

    expect(await screen.findByText("PostgreSQL répond de nouveau")).toBeInTheDocument();
    expect(screen.getByText(/ta session sera vérifiée/)).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Reprendre VestyHub" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health/ready",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("detects recovery during scheduled checks without resetting the page", async () => {
    let onTick: (() => void) | undefined;
    const reset = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.spyOn(window, "setInterval").mockImplementation((handler, timeout) => {
      if (timeout === 15_000 && typeof handler === "function") {
        onTick = handler as () => void;
      }
      return 1 as unknown as ReturnType<typeof setInterval>;
    });
    vi.spyOn(window, "clearInterval").mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    render(<ErrorPage error={new Error("database failure")} reset={reset} />);
    expect(await screen.findByText("PostgreSQL est indisponible")).toBeInTheDocument();
    await waitFor(() => expect(onTick).toBeDefined());

    onTick?.();
    expect(await screen.findByText("PostgreSQL répond de nouveau")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(reset).not.toHaveBeenCalled();
  });

  it("does not misdiagnose non-database errors as PostgreSQL failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ status: 200 })),
    );
    render(<ErrorPage error={new Error("unknown")} reset={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("VestyHub a rencontré une erreur")).toBeInTheDocument();
      expect(screen.getByText(/Une erreur inattendue/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Vérifier PostgreSQL" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the known outage state when a later readiness request loses connectivity", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ status: 503 })
        .mockRejectedValueOnce(new Error("private endpoint details")),
    );
    render(<ErrorPage error={new Error("unexpected secret")} reset={vi.fn()} />);
    expect(await screen.findByText("PostgreSQL est indisponible")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Vérifier PostgreSQL" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Vérifier PostgreSQL" })).toBeEnabled(),
    );
    expect(screen.getByText("PostgreSQL est indisponible")).toBeInTheDocument();
    expect(screen.queryByText("private endpoint details")).not.toBeInTheDocument();
  });
});
