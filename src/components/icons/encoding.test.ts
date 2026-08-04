import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sourceFiles = [
  "src/components/icons/service-icon.tsx",
  "src/components/icons/icon-picker.tsx",
] as const;

const mojibakePattern = /Ã|Â|�|â€™|â€œ|â€|â€“|â€”|â€¦/u;

describe("icon catalogue encoding", () => {
  it.each(sourceFiles)("%s contains no corrupted UTF-8 sequences", (file) => {
    const absolutePath = resolve(process.cwd(), file);
    const content = readFileSync(absolutePath, "utf8");

    expect(content).not.toMatch(mojibakePattern);
  });
});
