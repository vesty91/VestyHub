# Production dependency audit findings — 2026-11-20

**Status: OPEN — release security gate NOT satisfied.** This is an evidence snapshot, not a remediation or production approval.

## Reproducible evidence

- Repository commit: `aa33dc1a5e168076e0945fc0ac65004f95bc429f` (PR #41, based on PR #40).
- GitHub Actions audit: https://github.com/vesty91/VestyHub/actions/runs/44479372701
- Artifact: `production-dependency-audit`, ID `14508265190`, file `dependency-audit.txt`, expires 2026-12-03.
- Command: `pnpm audit --prod --audit-level high`, with frozen lockfile, Node 24, pnpm 11.18.0.
- Report totals: **92 advisories: 6 critical, 30 high, 47 moderate, 9 low**.
- Previous audit (2026-11-18): **93 advisories: 6 critical, 31 high, 47 moderate, 9 low**. Counts alone do not establish remediation.

## Critical findings requiring triage

| Package | Finding | Patched version reported | Advisory |
| --- | --- | --- | --- |
| next | Windows-hosted unauthenticated RCE | >=16.3.3 | [GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36) |
| next | AVIF image optimization RCE | >=16.3.3 | [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) |
| next | `next/og` ImageResponse RCE | >=16.3.6 | [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) |
| proxy-addr | IPv4-mapped IPv6 trust subnet spoofing (via `shadcn` > MCP SDK > Express) | >=2.0.8 | [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) |
| next | SVG image optimization RCE | >=16.4.1 | [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) |
| next | `use cache` typed-array RCE | >=16.4.1 | [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr) |

The audited `package.json` pins `next: 16.2.12` and `eslint-config-next: 16.2.12`. The advisories and versions above are **reported by the audit**, not independently verified against a newer registry state. Whether each affected feature is reachable in this deployment has **not** been established. Do not interpret this as proof of exploitation.

The audit also reports high-severity `sharp`/libvips findings (patched version reported >=0.35.0). Investigate image processing paths during the Next.js remediation.

## Recommended bounded remediation PR

1. From this branch, in an **isolated development checkout**, confirm latest compatible fixed Next.js and matching `eslint-config-next` versions and verify advisory status. Do not change dependencies in the live NAS directory.
2. Update only the necessary direct dependencies and lockfile; review `pnpm why next sharp proxy-addr` and transitive chains. Avoid blanket overrides and automatic major upgrades.
3. Run `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build`, Playwright E2E and isolated PostgreSQL recovery checks.
4. Re-run the production audit on the exact new commit; document remaining critical/high findings, their exposure and disposition. Audit exit status must not be hidden by the report-only workflow.
5. Keep the PR in draft until CI and review; no merge to main, no NAS deployment, no Docker third-party service interruption, and no persistent volume changes.

**Release decision:** BLOCKED pending dependency remediation and fresh verification. A successful audit workflow job means only that the report was collected.
