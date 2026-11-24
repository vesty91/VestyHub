# VestyHub v0.4.0 release candidate — dependency security

Date: 2026-11-24. This document supersedes the release-blocker status in the historical 2026-11-20 audit snapshot, not its evidence.

## Production dependency audit

After the targeted dependency updates and lockfile resolution, `pnpm audit --prod --json` reported:

| Severity | Original snapshot | Current candidate |
| -------- | ----------------: | ----------------: |
| Critical |                 6 |                 0 |
| High     |                30 |                 0 |
| Moderate |                47 |                 1 |
| Low      |                 9 |                 0 |
| Total    |                92 |                 1 |

The remaining advisory is minimatch 10.2.6 (globparts amplification denial of service; patched in >=11.0.1), reached through shadcn > ts-morph > @ts-morph/common. The current parent declares a 10.x range. Do not force an unsupported major override solely to obtain a zero count. Track an upstream compatible update and assess actual exposure before production approval. Shadcn is used by the build for its Tailwind stylesheet; no direct application import of minimatch was found in the reviewed dependency chain. This is not proof of non-reachability.

Scoped overrides for AJV/fast-uri, minimatch 10/brace-expansion, and socks/ip-address stay within the respective dependency major lines. Reassess and remove these overrides when upstream lockfile resolutions are safe.

## Release gates

- Fresh security audit on the exact candidate commit.
- All quality, desktop/mobile Playwright, disposable PostgreSQL backup/restore and NAS manifest checks green on GitHub Actions.
- Confirm the remaining moderate advisory disposition, verify NAS staging and backup/restore before production deployment.
- Bump the release version and publish only after review. Do not deploy this draft automatically.

The scheduled PostgreSQL recovery unit test uses fake timers and React act to avoid mocking unrelated Testing Library intervals. The application recovery behavior is unchanged.
