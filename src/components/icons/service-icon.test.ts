import { describe, expect, it } from "vitest";

import {
  serviceIconCategories,
  normalizeServiceIconName,
  serviceIconOptions,
  serviceIconRegistry,
} from "./service-icon";

describe("service icon catalog", () => {
  it("provides a broad categorized icon library", () => {
    expect(serviceIconCategories.length).toBeGreaterThanOrEqual(10);
    expect(serviceIconOptions.length).toBeGreaterThanOrEqual(70);
  });

  it("contains only unique and registered icon names", () => {
    const names = serviceIconOptions.map((icon) => icon.name);

    expect(new Set(names).size).toBe(names.length);
    expect(names.every((name) => name in serviceIconRegistry)).toBe(true);
  });

  it("normalizes legacy aliases without losing existing selections", () => {
    expect(normalizeServiceIconName("globe")).toBe("globe-2");
    expect(normalizeServiceIconName("key")).toBe("key-round");
    expect(normalizeServiceIconName("restore")).toBe("rotate-ccw");
  });

  it("contains the expected download and transfer icons", () => {
    const downloads = serviceIconCategories.find(
      (category) => category.id === "downloads",
    );
    const names = downloads?.icons.map((icon) => icon.name) ?? [];

    expect(names).toEqual(
      expect.arrayContaining([
        "download",
        "cloud-download",
        "file-down",
        "upload",
        "cloud-upload",
      ]),
    );
  });
});
