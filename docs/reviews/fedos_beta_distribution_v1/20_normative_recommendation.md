# 20 — Normative Recommendation

This is the single, final, binding V1 policy for FedOS Desktop Beta 0.1
distribution. Every other document in this review is either the evidence
this recommendation is built on, or a more detailed elaboration of one
of the points below — none of them contradicts this document; where a
detail is needed, the cross-reference is given.

1. **Primary Windows format**: NSIS installer, via electron-builder's
   built-in `nsis` target (`03`).
2. **Secondary format**: ZIP archive of the unpacked `dir` build,
   officially supported as a portable/no-install option, sharing the
   SAME profile location as the installed build (`03`/`04`).
3. **Signing requirement**: none for Beta 0.1 — **unsigned Beta is
   explicitly allowed** (`05`). Standard organization code signing is the
   named target for a post-Beta-0.1 milestone, contingent on the project
   acquiring a real certificate — not committed to a date here.
4. **SmartScreen disclosure**: every release's notes must state plainly
   that Windows SmartScreen may warn on first run, that this is expected
   for unsigned software, and must never instruct bypassing OS
   protections beyond Windows's own standard "More info → Run anyway"
   flow (`06`).
5. **Artifact checksum policy**: SHA-256, published as a per-release
   `SHA256SUMS` text file, generated from the exact uploaded bytes, bound
   to that release's own version string in the release notes (`07`).
6. **Canonical distribution host**: a self-hosted HTTPS distribution
   page, consistent with this project's own already-declared Cloudflare-
   based architecture (README) — no GitHub remote is currently
   configured (`16`), so GitHub Releases is not assumed; it becomes an
   acceptable alternative primary IF a GitHub remote is later adopted,
   re-evaluated at that time.
7. **Mirror policy**: none for V1 — a single canonical host only;
   revisit once real usage data justifies mirrors (`16`).
8. **Update policy**: no automatic update. Manual download with
   published checksums is the sole update mechanism for Beta 0.1,
   consistent with the already-frozen, accepted
   `autoUpdateEnabled: false` fact (`15`).
9. **Rollback policy**: binary downgrade is supported ONLY when every
   relevant persisted schema version is confirmed unchanged between the
   two versions being compared; otherwise, the only accepted recovery is
   restoring the profile from a pre-upgrade backup (`13`).
10. **Profile backup requirement**: explicitly the user's own
    responsibility for Beta 0.1 — required as an explicit step before
    every upgrade (`12`), and already disclosed generally via the
    accepted Beta limitations model (`18`).
11. **Supported Windows/architecture**: Windows 10 and 11, x64 only,
    matching the already-frozen `minimumSupportedPlatform: "windows-x64"`
    (`10`/`18`).
12. **Release naming/versioning**: SemVer with a `-beta.N` pre-release
    suffix (`0.1.0-beta.1`, `0.1.0-beta.2`, ...); product version is
    always distinct from every persisted-format schema version;
    **dirty-tree public release artifacts are forbidden** (`10`).
13. **Public-Beta release gates** (every one of the following must be
    true before a Beta 0.1 artifact is published):
    - a clean (`git status --porcelain` empty) commit is the build source (`10`);
    - the NSIS installer and ZIP both build successfully from that commit (`02`/`03`);
    - a `SHA256SUMS` file is generated from the exact uploaded bytes (`07`);
    - release notes state the exact version, channel (`beta`), the
      SmartScreen disclosure (`06`), a link/reference to the accepted
      Beta limitations model (`09`/`18`), and — if applicable — an
      explicit schema-change/no-in-place-upgrade notice (`12`/`13`/`18`);
    - the WASM artifact manifest verification passes for the bundled
      artifact (`08`, already an existing, tested gate — not new);
    - no known release-blocking issue remains open (matching this
      project's own established Alpha-arc severity vocabulary).
14. **Exact next implementation Arc** (exactly one, per this review's own
    instruction):

## FedOS Desktop Beta 0.1 Packaging: NSIS Installer, Portable ZIP, and Checksum Publication Arc

Scope: add the `nsis` (and, alongside it, a `zip`/portable) target to
`electron_builder.beta.config.json`, produce a real, tested NSIS
installer and a real ZIP artifact from the canonical Beta entry point,
and add a small, additive checksum-generation script (mirroring
`scripts/generate_wasm_artifact_manifest.mjs`'s own `node:crypto`
pattern, `07`) that emits a `SHA256SUMS` file for both artifacts. No
signing, no distribution hosting, no update mechanism, no CI/release
automation — those remain separate, later Arcs (`19`, Phases 2-4),
not bundled into this one.

This is the ONE recommended next Arc. No competing alternative is
offered.
