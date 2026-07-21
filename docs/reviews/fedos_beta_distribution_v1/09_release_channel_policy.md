# 09 — Release Channel Policy

## Comparison

| Channel | Stability expectation | Audience | Update frequency | Beta 0.1 relevance |
|---|---|---|---|---|
| nightly | unstable, may not build/run | contributors only | every commit/day | not offered publicly for V1 — no CI/build automation exists to produce one (`01`, Absolute Prohibition: no CI added here) |
| alpha | experimental, breaking changes expected frequently | early internal testers | irregular | superseded — this project's own accepted source already frames its work as "Beta" (`fedos_desktop_beta_release_configuration.ts`'s own `channel: "beta"`), not "alpha" |
| **beta** | **functional but incomplete; breaking changes possible with notice; known limitations disclosed (`src/desktop/beta/fedos_desktop_beta_limitations.ts`)** | **public Beta testers** | **per manually-cut release, no fixed cadence** | **the exact, sole channel for this release — already frozen in accepted source** |
| release candidate (RC) | feature-complete for a target version, bug-fixing only | pre-release testers | short-lived, ahead of a stable cut | not applicable until a "stable" target exists |
| stable | production-grade, supported | general public | regular, predictable | explicitly NOT claimed — `stability: "beta-release-candidate"` in accepted source is itself an honest internal assessment label, not a channel name, and must never be read as "stable" |

## Decision

**The exact initial channel is `beta`**, matching
`fedosDesktopBetaReleaseConfigurationV1().channel === "beta"` verbatim
(`10`) — this is not a new decision, it is a confirmation that already-
accepted, frozen source and this review's own release-channel policy
agree.

**Closed channel vocabulary for this project, going forward:**
`"nightly" | "alpha" | "beta" | "rc" | "stable"` — a fixed, five-value
set; no channel name is invented ad hoc per release.

- **Channel naming**: release artifacts and their own `SHA256SUMS`
  filenames include the channel implicitly via the version string itself
  (e.g. `0.1.0-beta.1` already encodes "beta" per SemVer pre-release
  convention) — no separate channel suffix is needed in the filename.
- **Artifact naming**: unchanged from `07` — channel is implied by the
  version string, not a separate artifact-name field.
- **Profile compatibility expectations**: all Beta 0.1.x builds (same
  major.minor.patch-beta line) are expected to share one profile, since
  none is expected to bump any persisted schema version (`10`/`11`)
  within the `0.1.0-beta.*` line — a schema bump would itself require a
  version discussion, not a silent same-channel assumption.
- **Support expectations**: Beta channel carries NO stability guarantee
  and NO long-term support commitment (`18`) — each Beta build is
  supported only until superseded by the next Beta build.
- **Breaking-change expectations**: allowed WITH NOTICE in release notes;
  never silent.
- **Update eligibility**: manual only for V1 (`15`) — there is no
  automatic channel-to-channel or build-to-build update path.
- **Whether channels may share one profile**: within `beta`, yes (see
  above); ACROSS channels (e.g. a future `alpha` and `beta` build) —
  NOT assumed compatible by default; any future channel transition must
  be evaluated against `11` (schema compatibility) at that time, not
  pre-approved here.

**Beta is never marked, labeled, or advertised as stable** — every
release-notes/status-surface reference to this release must carry the
word "Beta" and reuse the accepted, non-secret Beta limitations model
(`src/desktop/beta/fedos_desktop_beta_limitations.ts`), never a
second, competing limitations list.
