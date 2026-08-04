import { DEFAULT_THEME, getThemeDefinition, isThemeId, THEMES, THEME_IDS } from "./theme";

describe("theme catalog", () => {
  it("exposes the five supported themes in a stable order", () => {
    expect(THEME_IDS).toEqual([
      "obsidian",
      "midnight",
      "graphite",
      "carbon-gold",
      "light",
    ]);
    expect(THEMES).toHaveLength(5);
    expect(DEFAULT_THEME).toBe("obsidian");
  });

  it("validates supported theme identifiers", () => {
    expect(isThemeId("obsidian")).toBe(true);
    expect(isThemeId("carbon-gold")).toBe(true);
    expect(isThemeId("dark")).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
  });

  it("falls back to the default definition for an unknown value", () => {
    expect(getThemeDefinition("midnight").id).toBe("midnight");
    expect(getThemeDefinition("unknown").id).toBe(DEFAULT_THEME);
  });
});
