# 18 — Beta Support and Deprecation Policy

## Decisions

- **Supported Windows versions**: Windows 10 and Windows 11, matching
  the already-frozen `minimumSupportedPlatform: "windows-x64"` (`10`).
  Windows 7/8/8.1 are not targeted (electron 43's own upstream Chromium
  requirements already exceed what those OS versions support — an
  external, not project-specific, constraint).
- **Architecture**: x64 only, matching the accepted
  `minimumSupportedPlatform` literal exactly. No ARM64 or x86 (32-bit)
  build is offered or implied. Extending to ARM64 is a distinct,
  unevaluated future decision (would need its own electron-builder
  target testing) — not silently assumed available.
- **Profile backup expectation**: explicitly the USER's own
  responsibility for Beta 0.1 (no automated backup tooling exists,
  `12`). Release notes and the existing, accepted Beta limitations model
  (`"local-data-loss"` entry, `src/desktop/beta/fedos_desktop_beta_limitations.ts`,
  unmodified, cited not duplicated) already state this; this policy
  confirms it applies to the upgrade/rollback flows specifically (`12`/`13`)
  as well as ordinary use.
- **Support duration per Beta build**: each published Beta build is
  supported only until superseded by the next published Beta build
  (`09`) — no long-term-support build is offered or implied for any
  specific `0.1.0-beta.N`.
- **Emergency revocation**: if a published build is found to be unsafe
  (e.g. a security defect, a corrupted artifact, a compromised
  distribution event), the canonical host's own release notes (`16`)
  must be updated to mark that specific version WITHDRAWN with a stated
  reason, and — if a safe replacement exists — point to it; if none
  exists yet, state plainly that no safe current release exists rather
  than leaving a silently-broken link.
- **Minimum upgrade notice**: any release that changes a persisted
  schema version (`11`) MUST state this explicitly and prominently in
  its own release notes, including the exact consequence (`12`/`13` — no
  in-place upgrade, backup-and-fresh-profile required) — never buried in
  a generic changelog line.
- **Breaking profile changes**: permitted between Beta releases WITH the
  notice above; never silent (`09`).
- **Old-version network compatibility**: not evaluated in this review —
  Device Sync/private delivery's own wire compatibility across Beta
  builds is a SEPARATE protocol-compatibility question this review's own
  scope (installer/signing/distribution/update policy) does not cover;
  flagged as out of scope, not asserted safe or unsafe.
- **Known-issues reporting**: release notes must include (or link to) a
  known-limitations section reusing the accepted
  `fedos_desktop_beta_limitations.ts` model verbatim (`09`) — never a
  second, drifting limitations list maintained separately in release
  notes prose.
- **Unsupported configurations**: running the installed and portable
  builds concurrently against the same profile (`04`); any Windows
  version/architecture outside the stated support matrix above; any
  attempt to open a profile whose schema version does not match the
  running binary's own expectations without following the documented
  backup/restore procedure (`12`/`13`).
- **Unsigned build support**: explicitly supported and expected for
  Beta 0.1 (`05`) — this is not a degraded/unsupported configuration, it
  is THE configuration for this release; users are not told signing
  issues are "their problem," they are told honestly that this Beta is
  unsigned (`06`).

## Explicit non-promise

This policy does **not** promise enterprise-grade support: no SLA, no
guaranteed response time to reported issues, no guaranteed patch
turnaround, and no commitment that any specific Beta build will remain
downloadable indefinitely once superseded (subject to the emergency-
revocation and mirror policies above, which govern REMOVAL, not
retention guarantees).
