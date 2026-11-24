import { describe, expect, it } from "vitest";

import {
  isAuthorizedHealthAddress,
  isIPv4InCidr,
  parseHealthProbeUrl,
  probeFavoriteHead,
} from "./probe";

describe("favorite health probe SSRF guard", () => {
  it("matches IPv4 CIDRs using exact network boundaries", () => {
    expect(isIPv4InCidr("192.168.1.20", "192.168.1.0/24")).toBe(true);
    expect(isIPv4InCidr("192.168.2.20", "192.168.1.0/24")).toBe(false);
    expect(isIPv4InCidr("10.255.255.254", "10.0.0.0/8")).toBe(true);
    expect(isIPv4InCidr("100.104.180.67", "100.64.0.0/10")).toBe(true);
    expect(isIPv4InCidr("127.0.0.1", "0.0.0.0/0")).toBe(true);
    expect(isIPv4InCidr("192.168.1.20", "192.168.1.0/33")).toBe(false);
    expect(isIPv4InCidr("192.168.1.20", "192.168.1.0/-1")).toBe(false);
    expect(isIPv4InCidr("::1", "0.0.0.0/0")).toBe(false);
  });

  it("rejects unsafe URL schemes, embedded credentials and fragments", () => {
    for (const raw of [
      "file:///etc/passwd",
      "ftp://example.com",
      "http://alice:secret@example.com/",
      "https://example.com/#fragment",
      "http://",
      "",
    ]) {
      expect(parseHealthProbeUrl(raw)).toBeNull();
    }
    expect(parseHealthProbeUrl("https://example.com:443/status")?.hostname).toBe(
      "example.com",
    );
  });

  it("blocks metadata, loopback, unspecified and multicast destinations even if explicitly allowed", () => {
    const wideOpen = {
      allowedHosts: ["127.0.0.1", "169.254.169.254", "example.com"],
      allowedCidrs: ["0.0.0.0/0"],
    };
    for (const address of [
      "127.0.0.1",
      "0.0.0.0",
      "169.254.169.254",
      "224.0.0.1",
      "255.255.255.255",
      "::ffff:127.0.0.1",
    ]) {
      expect(isAuthorizedHealthAddress("example.com", address, wideOpen)).toBe(false);
    }
  });

  it("allows only configured LAN CIDRs or exact public hostnames", () => {
    const policy = {
      allowedHosts: ["public.example.net"],
      allowedCidrs: ["192.168.0.0/16", "10.0.0.0/8"],
    };
    expect(isAuthorizedHealthAddress("nas.local", "192.168.1.5", policy)).toBe(true);
    expect(isAuthorizedHealthAddress("nas.local", "172.20.1.5", policy)).toBe(false);
    expect(isAuthorizedHealthAddress("public.example.net", "93.184.215.14", policy)).toBe(
      true,
    );
    expect(isAuthorizedHealthAddress("other.example.net", "93.184.215.14", policy)).toBe(
      false,
    );
    expect(
      isAuthorizedHealthAddress("sub.public.example.net", "93.184.215.14", policy),
    ).toBe(false);
    expect(isAuthorizedHealthAddress("public.example.net", "172.20.1.5", policy)).toBe(
      false,
    );
    expect(
      isAuthorizedHealthAddress("public.example.net", "169.254.169.254", policy),
    ).toBe(false);
  });

  it("normalizes alternative loopback URL forms and fails closed without network calls", async () => {
    await expect(
      probeFavoriteHead("http://2130706433/admin", {
        allowedHosts: ["127.0.0.1"],
        allowedCidrs: ["127.0.0.0/8"],
      }),
    ).rejects.toThrow("not approved");

    await expect(
      probeFavoriteHead("http://192.168.1.5:5000/health", {
        allowedHosts: [],
        allowedCidrs: [],
      }),
    ).rejects.toThrow("not approved");
  });
});
