# FedOS Desktop Beta 0.1 — Installer, Signing, Distribution, and Update Policy V1 Specification Review

Review only. No production source, README, `package.json`,
`package-lock.json`, or `Cargo.toml` change is made anywhere in this
review. Every file this review adds lives under
`docs/reviews/fedos_beta_distribution_v1/` or
`test/reviews/fedos_beta_distribution_v1/`. No installer, auto-update,
code signing, release upload, or update service is implemented. `p2p/`
and `.tmp_gen/` are untouched.

## Base commit and branch

This review's own worktree (`review/fedos-beta-installer-signing-distribution-update-v1`)
is branched directly from `arc/fedos-beta-canonical-composition` @
`8548845` ("Add Secure Runtime Alpha 5161-5240: Canonical Desktop
Composition and FedOS Beta 0.1 Release-Blocker Closure Arc") — confirmed
HEAD at session start, no merge required. Every precondition this
review's own task names (canonical Beta Electron entry point, real
packaged/unpackaged Electron build, production Rust/WASM Master Seed
unlock, profile creation/unlock, canonical Desktop application assembly,
Navigation/Notification/Tray/Badge/Background/Device-Sync composition,
Settings persistence/application, Runtime restart, Beta release-blocker
closure) is verified as real source on this SAME base directly (`01`),
never inferred from the prior Arc's own completion declaration alone.

## The one finding every other document in this review is downstream of

**No installer target, no code signing, no update mechanism, no published
checksum, and no distribution host is configured anywhere in this
repository today.** `packages/fedos-desktop-electron-spike/electron_builder*.config.json`
both configure `win.target: ["dir"]` only (an unpacked directory build —
electron-builder's own "no installer" mode); no `win.sign`/`certificateFile`/
`CSC_LINK` config exists; no `electron-updater` (or any auto-update
package) is a dependency anywhere; no `git remote` is configured in this
repository; `autoUpdateEnabled: false` is already an accepted, frozen fact
in `src/desktop/beta/fedos_desktop_beta_release_configuration.ts` (`10`).
This review evaluates what SHOULD replace this "nothing configured" state
for a public Beta 0.1 release and implements none of it.

## How to navigate the 20 documents

| # | Document | Answers |
|---|---|---|
| 01 | `01_current_packaging_inventory.md` | Real inventory of the Electron package, both `electron_builder*.config.json`, scripts, targets, ASAR/extraResources layout, prior real-launch evidence |
| 02 | `02_beta_release_artifact_inventory.md` | The complete candidate Beta release artifact set, each marked required/optional/rejected/deferred |
| 03 | `03_windows_distribution_format_comparison.md` | A–F compared against actual electron-builder capability; chooses NSIS primary, portable ZIP secondary |
| 04 | `04_portable_vs_installed_policy.md` | Portable is developer/secondary-only for Beta 0.1; installed profile ownership is unambiguous |
| 05 | `05_code_signing_inventory.md` | Real current signing state (none); compares A–F; recommends deferred signing with explicit warning for Beta 0.1 |
| 06 | `06_windows_smartscreen_and_reputation.md` | Honest SmartScreen behavior; defines the acceptable Beta warning/install procedure |
| 07 | `07_release_artifact_integrity.md` | SHA-256 checksum publication policy, reusing the existing WASM artifact-manifest concept |
| 08 | `08_wasm_manifest_and_application_binding.md` | How the packaged app, WASM artifact, JS glue, and pinned manifest stay bound — reuses the existing verified mechanism, no second system |
| 09 | `09_release_channel_policy.md` | Closed channel vocabulary; Beta 0.1 is the sole active channel |
| 10 | `10_versioning_and_build_identity.md` | Product version vs. schema versions; dirty-tree public releases forbidden |
| 11 | `11_profile_and_schema_compatibility.md` | Inventory of every persisted format's own schema mechanism; confirms NO migration code exists anywhere |
| 12 | `12_upgrade_semantics.md` | The supported Beta 0.1 in-place upgrade flow; no migration is invented |
| 13 | `13_downgrade_and_rollback_policy.md` | Binary rollback only when schema versions are unchanged; otherwise restore from backup |
| 14 | `14_update_interruption_and_recovery.md` | Threat-models interruption at every stage; defines atomicity evidence the next Arc must prove |
| 15 | `15_automatic_update_decision.md` | Manual download + published checksums, no automatic update — consistent with the already-frozen `autoUpdateEnabled: false` |
| 16 | `16_distribution_host_and_mirror_policy.md` | Self-hosted HTTPS (project's own declared Cloudflare architecture) is canonical; GitHub Releases as an accepted alternative once a remote exists; Nostr for announcement only |
| 17 | `17_release_security_threat_model.md` | Covers all 16 required threat categories; states the exact boundary of signing/hashes/manifests |
| 18 | `18_beta_support_and_deprecation_policy.md` | Windows x64 only; no enterprise-grade support promise; emergency revocation procedure |
| 19 | `19_implementation_arc_packaging.md` | Recommends the exact, safely-scoped sequencing of implementation Arcs |
| 20 | `20_normative_recommendation.md` | The single, final, binding V1 policy — one primary format, one signing policy, one update policy, one next Arc |

## Distinguishing evidence from recommendation

Every document below marks each claim as one of: **proven current
source** (read directly, cited by file path), **prior execution
evidence** (a real, previously-observed launch/build/test result, cited
to the arc/session that produced it), **environment-specific observation**
(true in this sandbox, not necessarily true everywhere), or **recommendation**
(this review's own V1 policy decision, not yet implemented). Reviews 03,
05, 09, 15, 16, and 20 contain the review's own recommendations; every
other review is primarily factual inventory.
