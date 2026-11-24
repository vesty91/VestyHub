import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocalResourceHistory } from "./local-resource-history";

describe("LocalResourceHistory", () => {
  it("shows an honest empty state without a fabricated graph", () => {
    render(<LocalResourceHistory points={[]} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /en attente des premiers relevés/,
    );
    expect(screen.queryByTestId("history-cpu")).not.toBeInTheDocument();
  });

  it("plots distinct CPU and RAM readings using separate paths", () => {
    render(
      <LocalResourceHistory
        points={[
          { sampledAt: "2026-11-16T12:00:00.000Z", cpu: 20, memory: 60 },
          { sampledAt: "2026-11-16T12:00:15.000Z", cpu: 40, memory: 70 },
        ]}
      />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(/Dernier CPU : 40 pour cent/);
    expect(screen.getByTestId("history-cpu")).toHaveAttribute(
      "d",
      expect.stringContaining("L"),
    );
    expect(screen.getByTestId("history-memory")).toHaveAttribute(
      "d",
      expect.stringContaining("L"),
    );
    expect(screen.getByText(/2 relevés/)).toBeInTheDocument();
  });
});
