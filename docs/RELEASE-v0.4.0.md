# VestyHub v0.4.0 — Release

Status: published on 2026-11-24. Tag v0.4.0 points to merged commit 61f21b4. NAS deployment is not approved.

## Changes since v0.3.0

- Consolidated development from draft PRs #20–44 into PR #45.
- Windows local development, dashboard resource history, top processes and configurable alerts.
- Hardened NAS and Docker connectors, dashboard permissions, favorite URL checks and database recovery.
- Added desktop/mobile browser tests, disposable PostgreSQL outage and backup/restore drills.
- Updated Next.js, shadcn, Zod and scoped transitive dependencies; latest audit before the version-only changes: zero critical, high or low and one moderate advisory (see [security report](release-v0.4.0-security.md)).
- Aligned package version, dashboard version label and application/tool image tags. Existing live environment files and volumes are not modified.

## Release validation and remaining gates

- [x] Candidate CI and dependency audit passed on 4fa2eb1.
- Review the remaining minimatch advisory; local standalone build inspection found no matching ordinary directories, but did not inspect all image layers or symlink targets. Build and tools image exposure remains to be assessed.
- [x] PR #45 merged into main.
- [x] Tag v0.4.0 and GitHub Release published; v0.3.0 preserved.
- Before NAS deployment, verify architecture, free space, actual Compose project and volume names, current image tags, backup and isolated restore, migration compatibility, bind address and reverse proxy connectivity. Keep previous images and a tested rollback procedure. Never delete PostgreSQL volumes.

No production deployment was performed.
