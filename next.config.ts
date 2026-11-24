import type { NextConfig } from "next";

const browserOutageDistDir = process.env.VESTYHUB_OUTAGE_TEST_DIST_DIR;
if (
  browserOutageDistDir &&
  !/^\.next-outage-browser-[0-9]+-[0-9]+$/.test(browserOutageDistDir)
) {
  throw new Error("Invalid isolated browser outage build directory.");
}

const nextConfig: NextConfig = {
  // Required for the multi-stage Docker build (see Dockerfile).
  output: "standalone",
  // The browser outage drill must not touch an existing .next/dev instance.
  ...(browserOutageDistDir
    ? {
        distDir: browserOutageDistDir,
        typescript: {
          tsconfigPath:
            browserOutageDistDir.replace(
              ".next-outage-browser-",
              "tsconfig.outage-browser-",
            ) + ".json",
        },
      }
    : {}),

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
