import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ErrorPage from "./error";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("application error page", () => {
  it("identifies PostgreSQL readiness failures and allows retry", async () => {
    const reset = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ status: 503 })),
    );
    render(<ErrorPage error={new Error("hidden database details")} reset={reset} />);

    expect(await screen.findByText("PostgreSQL est indisponible")).toBeInTheDocument();
    expect(screen.queryByText(/hidden database details/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(reset).toHaveBeenCalledTimes(1);
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
  });
});
