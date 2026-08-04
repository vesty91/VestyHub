import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeSelector } from "./theme-selector";

const { setTheme } = vi.hoisted(() => ({ setTheme: vi.fn() }));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "midnight",
    setTheme,
  }),
}));

describe("ThemeSelector", () => {
  beforeEach(() => {
    setTheme.mockClear();
  });

  it("renders the five themes as an accessible radio group", () => {
    render(<ThemeSelector />);

    expect(
      screen.getByRole("radiogroup", { name: "Thème VestyHub" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: /Midnight/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("applies a selected theme immediately", async () => {
    const user = userEvent.setup();
    render(<ThemeSelector />);

    await user.click(screen.getByRole("radio", { name: /Carbon Gold/ }));

    expect(setTheme).toHaveBeenCalledWith("carbon-gold");
  });
});
