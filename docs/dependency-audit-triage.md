# Production dependency audit: operator runbook

This runbook applies to the report-only GitHub Actions workflow at `.github/workflows/dependency-audit.yml`. It is intentionally **non-blocking**: a green job does **not** mean that the dependency graph is free of vulnerabilities.

## Where to find evidence

1. Open the latest **Dependency security audit** workflow run for the PR head commit.
2. Check the **Runtime dependency audit (report only)** job summary and the `Audit production dependency graph` step.
3. Download the `production-dependency-audit` artifact and read `dependency-audit.txt`. The artifact expires after 14 days.
4. Record the commit SHA, run URL, date, audit exit status, affected package, advisory identifier, severity, and whether the vulnerable version is present in the **production** dependency graph.

An exit status other than zero can indicate vulnerabilities **or** an audit registry/network failure. Inspect the report; never classify a failed registry request as "no vulnerabilities". The workflow is informational and its successful conclusion is not a security sign-off.

## Reproduce safely

Use a clean checkout of the **same PR head commit**, with Node.js 24 and pnpm 11.18.0. Do not change the lockfile:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm audit --prod --audit-level high
```

These commands install dependencies in the isolated checkout and query the audit service. They do not deploy the application or modify production data. Avoid running them in a live NAS application directory.

## Triage and remediation

- **Audit service unavailable:** retry from a clean CI runner; preserve the original failure as inconclusive. Do not mark it as a pass.
- **High or critical advisory:** confirm the affected version and runtime reachability, inspect the upstream advisory, and prioritize a minimal supported patch.
- **Transitive dependency:** identify the direct parent before considering an override. Do not introduce untested blanket overrides.
- **No fix available:** document exposure, mitigations, owner, and recheck date. Do not silently suppress the finding.
- **Proposed patch:** use a separate draft PR, keep the lockfile diff reviewable, run format/lint/typecheck/unit/build and browser/isolated database checks where affected, and wait for CI before requesting review.

Never paste registry credentials, authentication tokens, private environment values, or full CI environment dumps into issue comments or reports. Redact sensitive content before sharing an artifact outside the private repository.

## Release gate

Before treating a build as release-ready, require a fresh audit for the exact candidate commit, a reviewed disposition for every high/critical production finding, successful quality/E2E checks, and a separate deployment/staging approval. The audit workflow alone does not certify production readiness.
