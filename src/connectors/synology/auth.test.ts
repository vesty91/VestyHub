// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  buildSynologyLoginParams,
  buildSynologyLogoutParams,
  buildSynologySessionHeaders,
} from "./auth";

describe("Synology DSM authentication parameters", () => {
  it("does not bind login to a DSM application session", () => {
    const params = buildSynologyLoginParams("vestyhub", "secret", 6);

    expect(params).toEqual({
      account: "vestyhub",
      passwd: "secret",
      format: "sid",
      enable_syno_token: "yes",
    });
    expect(params).not.toHaveProperty("session");
  });

  it("omits SynoToken negotiation for older auth versions", () => {
    expect(buildSynologyLoginParams("vestyhub", "secret", 3)).toEqual({
      account: "vestyhub",
      passwd: "secret",
      format: "sid",
    });
  });

  it("sends the SynoToken only through the DSM request header", () => {
    expect(buildSynologySessionHeaders("token-value")).toEqual({
      "X-SYNO-TOKEN": "token-value",
    });
    expect(buildSynologySessionHeaders()).toEqual({});
  });

  it("logs out the generic SID session without an application name", () => {
    expect(buildSynologyLogoutParams()).toEqual({});
  });
});
