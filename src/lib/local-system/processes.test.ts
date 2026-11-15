// @vitest-environment node

import { describe, expect, it } from "vitest";

import { parseTasklist } from "./processes";

const sample = [
  '"node.exe","38928","Console","1","2 311 420 Ko"',
  '"vmmemWSL","36588","Services","0","3 032 324 Ko"',
  '"chrome.exe","16112","Console","1","333 820 Ko"',
  '"postgres.exe","421","Services","0","22 672 Ko"',
  '"Secure, browser.exe","567","Console","1","1 999 999 Ko"',
  '"tiny.exe","812","Services","0","40 Ko"',
];

describe("tasklist memory process parser", () => {
  it("returns the five heaviest processes in descending working-set usage", () => {
    const result = parseTasklist(sample.join("\r\n"));
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({
      pid: 36588,
      name: "vmmemWSL",
      memoryBytes: 3_032_324 * 1024,
    });
    expect(result[1].name).toBe("node.exe");
    expect(result[2].name).toBe("Secure, browser.exe");
    expect(result.at(-1)?.name).toBe("postgres.exe");
  });

  it("rejects invalid or unavailable memory readings", () => {
    const rows = [
      '"System Idle Process","0","Services","0","N/A"',
      '"bad.exe","-4","Services","0","7 Ko"',
      '"bad.exe","NaN","Services","0","9 Ko"',
      '"bad.exe","4","Services","0","N/A"',
      '"ok.exe","72","Services","0","14 444 Ko"',
    ].join("\n");

    expect(parseTasklist(rows)).toEqual([
      { pid: 72, name: "ok.exe", memoryBytes: 14_444 * 1024 },
    ]);
  });

  it("is stable when two processes have identical memory", () => {
    expect(
      parseTasklist(
        [
          '"b.exe","99","Console","1","1024 Ko"',
          '"a.exe","21","Console","1","1024 Ko"',
        ].join("\n"),
      ).map((entry) => entry.pid),
    ).toEqual([21, 99]);
  });

  it("ignores command injection text and never interprets it", () => {
    const output = '"test.exe & del C:\\*","123","Console","1","999 Ko"';
    expect(parseTasklist(output)[0]?.name).toBe("test.exe & del C:\\*");
  });
});
