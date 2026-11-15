# Changelog

## 1.11.1 (unreleased)

No tool or API changes. Same Node support.

### Security and dependencies
- `@modelcontextprotocol/sdk` 1.29.0 → 1.32.2, `zod` 4.3.6 → 4.6.7.
- `npm audit --omit=dev`: 0 critical, 0 high, 5 moderate, none reachable: 3 in the SDK's HTTP transport, which this stdio server never loads, and 2 in `uuid` 9.0.1 via `google-auth-library` (gaxios), whose affected v3/v5/v6 buffer API it does not call (gaxios only uses `v4()` without a buffer). Dev-only findings in the older vitest remain, fixed by the vitest 5 follow-up.
- Every dependency version is at least 14 days old (#1).

### Maintenance
- Dependabot with a 14-day cooldown (#1).
- npm publishing uses trusted publishing (OIDC). Workflow actions are pinned to commit SHAs (#2).

## Earlier versions

See the [GitHub releases](https://github.com/Eyalm321/vertex-ai-mcp/releases).
