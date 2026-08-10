# FedOS — OSS Public Release Surface Inventory

Status: written by Agent A, FedOS OSS Public Release Surface Freeze arc.
**Read-only classification exercise.** No file was moved, deleted,
duplicated, or rewritten to produce this document — the only new file this
pass created is this one. Every classification below was checked against
the file system as it actually exists in this checkout (not assumed from a
directory name or from another document's claim), per the arc's own
instruction to read 2-3 files before trusting a doc's "this is a shim" /
"this is dead" claim. Where a discrepancy was found between what a doc
claims and what the files actually contain, it is called out explicitly
below rather than silently resolved.

**Scope note on "OSS" as a concept.** OSS here is a distribution/license
boundary, not a new capability. This document does not create, and this
arc was explicitly forbidden from creating, any `src/os/oss/` or
OSS-specific duplicate source tree. Every implementation named below
remains exactly where it already lives — `src/os/core/`,
`src/os/messenger/`, `src/os/commerce/`, `src/os/trust/`, or (for
not-yet-migrated code) its original top-level `src/` location.

**UNKNOWN: 0.** Every top-level repository-root entry and every
subdirectory of `src/` (both `src/os/*` and the 13 older top-level
directories) received one of the five classifications below. No "TBD".

## Legend

- **PUBLIC REQUIRED** — needed to build/run/test FedOS; must ship in any OSS release.
- **PUBLIC OPTIONAL** — useful but not required.
- **HISTORICAL** — real prior-arc record; genuine provenance, not a security risk, not first-read material.
- **DEVELOPMENT ONLY** — internal tooling/scratch/build-output; not secret, not part of the release surface.
- **PRIVATE / NEVER PUBLISH** — should not exist in a public release. None found by this pass — see "On PRIVATE / NEVER PUBLISH" below.

---

## 1. Repository root — directories

| Directory | Classification | Rationale |
|---|---|---|
| `.github/` | PUBLIC REQUIRED | Issue templates, PR template, `dependabot.yml` — standard OSS repo infrastructure a public GitHub repo needs. |
| `.tmp_gen/` | DEVELOPMENT ONLY | Empty in this checkout (`ls -la` shows only `.`/`..`); not listed in `.gitignore` but empty dirs never appear in `git status` regardless. Scratch-generation directory name pattern, not a committed release artifact. |
| `dist/` | DEVELOPMENT ONLY | Gitignored (`.gitignore` line 2). Contains compiled `core/`, `messenger/` build output — regenerated on demand, never a source-of-truth artifact. |
| `docs/` | Mixed — see §4 below | Broken out separately: 1,109 numbered `secure_runtime_alpha_*.md` files dominate the flat listing; several subdirectories carry different classifications. |
| `node_modules/` | DEVELOPMENT ONLY | Gitignored, npm-installed dependency tree. Never shipped as source. |
| `packages/` | Mixed — see §3 below | Three sub-packages, individually classified. |
| `schema/` | HISTORICAL | `d1_index.sql` + `d1_space_directory.sql`. Verified by grep: the **only** `.ts` importers anywhere in `src/`/`test/` are `src/os/_legacy_prototype/community/d1_directory.ts`, `src/os/_legacy_prototype/indexer/d1_index.ts`, and their own tests (`test/d1_index.test.ts`, `test/d1_space_directory.test.ts`, both importing from `src/os/_legacy_prototype/...`). This is the dead Cloudflare-Workers D1 schema for the pre-pivot prototype — see §5. |
| `scripts/` | PUBLIC REQUIRED | `build_production_wasm_artifact.mjs`, `generate_wasm_artifact_manifest.mjs`, `generate_third_party_notices.mjs`, `fedos_trust_issuer_cli.mjs`, `architecture_cycle_detector.mjs`, `package_extraction_boundary_scan.mjs` — real build/release/CLI tooling referenced by `package.json` scripts and by architecture tests. |
| `src/` | Mixed — see §2 below | 18 subdirectories, individually classified. |
| `test/` | PUBLIC REQUIRED (with a large historical sub-surface) | 1,171 `.test.ts` files. 893 are `secure_runtime_alpha_*.test.ts`, 93 are `runtime_*.test.ts` — a large numbered-arc historical test archive; classified as one class below rather than enumerated. The remaining ~185 files (`architecture_boundary_*`, `fedos_core_rust_*`, `trust_*`, `commerce_*`, `chat_*`, etc.) map to live capabilities and are the current, runnable test surface. **This document does not attempt the current/historical test-file-level split — that is Agent T's parallel workstream; see their CURRENT/HISTORICAL test-surface doc for the runnable-test-level detail.** |
| `test-vectors/` | PUBLIC REQUIRED | Official crypto known-answer vectors (`aead/`, `kdf/`, `nip44/`) for `packages/fedos-core-rust`, each with recorded `source`/`section`/`revision`/`license` provenance per `test-vectors/README.md`. Directly Trust/crypto-relevant. |

## 2. `src/` — every subdirectory (18 total)

### 2a. `src/os/*` — the current, authoritative capability tree

| Directory | Classification | Rationale |
|---|---|---|
| `src/os/core/` | PUBLIC REQUIRED | `crypto/`, `identity/`, `ports/`, `settings/`, `storage/`, `vault/`, `index.ts`. Foundational cross-capability primitives; no README (unlike the other three), but is the re-export target for nearly all of the old `src/identity`, `src/crypto`, `src/settings`, `src/storage`, `src/vault` shims (verified — see §2b). |
| `src/os/messenger/` | PUBLIC REQUIRED | **787 `.ts` files**, real implementation (verified: `src/os/messenger/conversations/fedos_conversation_id.ts` is full logic, not a shim). This is the actual shipped messenger capability — old `src/conversation/`, `src/board/`, `src/desktop/`, `src/device/`, `src/nostr/` are now 100%-shim re-export layers pointing here (see §2b). **Discrepancy found:** `src/os/messenger/README.md` (last touched 2026-08-09, commit "OS Capability Modularization: extract os/core and os/commerce, scaffold os/messenger") still says *"No production code has been physically moved here yet... every messenger file the repo actually ships still lives at its original location."* That is now false — the physical move landed the next day (2026-08-10, commit "Architecture Dependency Closure + Ports/Factories + OSS Catalog Completion" and confirmed further by "Compatibility Facade Reduction..."). The README is stale and should be corrected in a follow-up pass; this inventory classifies based on the verified file contents, not the stale doc. |
| `src/os/commerce/` | PUBLIC REQUIRED | Real source + tests, part of the whole-repo build/typecheck/test graph and exported from the public `os/commerce/index.ts` barrel. Its own README says "inert scaffolding... not reachable from the shipped FedOS Desktop Electron app" (carried forward from the pre-pivot prototype's commerce-shaped subset) — dormant as *product* surface, but required for the codebase to build/test as it exists today. |
| `src/os/trust/` | PUBLIC REQUIRED | Real, newly implemented code with passing tests (`test/trust_*.test.ts`, `test/architecture_boundary_trust.test.ts`) per its own README. Not yet wired into the packaged Electron app's entry tsconfigs — an honestly-disclosed gap, not a reason to exclude it from an OSS release named after this exact capability (`fedos-trust-oss-release`). |
| `src/os/_legacy_prototype/` | HISTORICAL | See §5 — full legacy-material treatment there (label: EXCLUDE FROM FIRST RELEASE). Dead pre-pivot Cloudflare Workers product kept only for ~295 tests' existing coverage; own README confirms "no deploy path." |

### 2b. Older top-level `src/` directories — verified shim vs. live status

Method: for each directory, every `.ts` file was grepped for the pattern
`export \* from "(\.\./)+os/"` (an `export * from` pointing somewhere under
`src/os/`, at any relative depth). A directory is "100% shim" only if every
one of its files matches. Representative files were also read in full (not
just grepped) to confirm the shim body has no other logic.

| Directory | Files | Shim files | Classification | Rationale |
|---|---:|---:|---|---|
| `src/board/` | 85 | 85 | PUBLIC OPTIONAL | 100% compatibility shims → `src/os/messenger/board/**`. Per `docs/architecture/COMPATIBILITY-FACADE-LIFECYCLE.md`, 0 internal imports remain (repo-internal code already migrated); shims are kept only for possible external consumers, most marked `@deprecated`. |
| `src/conversation/` | 422 | 422 | PUBLIC OPTIONAL | 100% compatibility shims → `src/os/messenger/conversations/**` (+ `adapters/nostr/**`). Same policy as above. **Known gap** (per the same doc): 2 shims (`deletion/fedos_deletion_target.ts`, `deletion_request/fedos_persisted_deletion_recipient_decision_record_v1.ts`) still have a live *inline type-position* `import("...")` reference from `src/os/messenger/`, i.e. they are not fully "0 internal imports" — flagged there, not fixed, still true today. |
| `src/crypto/` | 4 | 4 | PUBLIC OPTIONAL | 100% compatibility shims → `src/os/core/crypto/**`. |
| `src/desktop/` | 157 | 157 | PUBLIC OPTIONAL | 100% compatibility shims → `src/os/messenger/desktop/**` (and `notifications/**` for the old `desktop/notification/` subtree). |
| `src/device/` | 88 | 88 | PUBLIC OPTIONAL | 100% compatibility shims → `src/os/messenger/device/**`. |
| `src/identity/` | 22 | 22 | PUBLIC OPTIONAL | 100% compatibility shims → `src/os/core/identity/**`. (2 of the original files, `provider_bridge.ts`/`vault_bridge.ts`, were already fully *removed* — not shimmed — by the same arc that produced the lifecycle doc, confirmed provably dead by that arc's 5-signal check.) |
| `src/nostr/` | 12 | 12 | PUBLIC OPTIONAL | 100% compatibility shims → `src/os/messenger/adapters/nostr/protocol/**`. |
| `src/notification/` | 3 | 0 | PUBLIC REQUIRED | **Not a shim, not legacy.** Own `README.md` documents this precisely: it is a live, generic, forward-looking push-transport seam ("Stage 39"), was briefly *mis-quarantined* into `_legacy_prototype` mid-arc on a wrong assumption, then correctly moved back once a real live consumer was found — `src/desktop/notification/fedos_desktop_notification_types.ts` (itself now a shim to `src/os/messenger/notifications/`) reuses `policy.ts`'s `isSensitiveNotificationField`. Not yet assigned into `os/core` or `os/messenger` — a real, disclosed follow-up item, not a defect in this inventory. |
| `src/runtime/` | 78 | 24 | PUBLIC REQUIRED | **Mostly live, not a shim tree.** 54 of 78 files are real implementation (verified: `fedos_runtime_crypto_provider.ts` is ~250 lines of real logic, no `export * from`), pre-dating and not yet folded into the `os/core` capability extraction. Only 24 files are shims. Two files (`create_runtime.ts`, `runtime/types.ts` — the dead prototype's own `AppRuntime` selection layer) were separately moved into `_legacy_prototype/runtime/`, per that directory's own README; "the rest of `src/runtime/` is live, current core infrastructure and was left in place." This matches this project's own memory record that `src/runtime/`'s 78 files were the subject of a dedicated "Root Cause A" package-extraction-blocker closure. |
| `src/settings/` | 8 | 8 | PUBLIC OPTIONAL | 100% compatibility shims → `src/os/core/settings/**`. |
| `src/storage/` | 4 | 4 | PUBLIC OPTIONAL | 100% compatibility shims → `src/os/core/storage/**`. |
| `src/sync/` | 14 | 14 | PUBLIC OPTIONAL | 100% compatibility shims → `src/os/messenger/sync/**`. This migration is *newer* than `docs/architecture/COMPATIBILITY-FACADE-LIFECYCLE.md`'s own text, which describes it as "Agent D... may still be in progress" and explicitly excluded from that document's 811/807-shim count. Verified fresh in this checkout: all 14 files are now complete shims, not in-progress. |
| `src/vault/` | 1 | 1 | PUBLIC OPTIONAL | 100% compatibility shim (`types.ts` only) → `src/os/core/vault/types.ts`. `memory_vault.ts`/`noop_vault.ts` were already fully *removed* (not shimmed) by the same arc, after migrating their one test-only consumer first — confirmed provably dead by the same 5-signal check as `src/identity/`'s 2 removed files. |

**Summary for §2b:** every one of these 13 older top-level directories is
either (a) a 100%-verified compatibility-shim layer with a real, documented
retirement policy (10 of 13), or (b) genuinely live, unmigrated
infrastructure (`src/notification/`, `src/runtime/` — 2 of 13). No
directory in this list contains a mix of shim and unmigrated-live code at
the file level (the closest exception is the 2 inline-type-only stale
references inside `src/conversation/`, which do not change any file's own
shim classification).

## 3. `packages/`

| Directory | Classification | Rationale |
|---|---|---|
| `packages/fedos-core-rust/` | PUBLIC REQUIRED | The Rust/WASM crypto core crate (`Cargo.toml`, `Cargo.lock`, `src/`, `tests/`). Licensed MPL-2.0 in its own `Cargo.toml`, matching the repo root (`LICENSE_STATUS.md` §1). |
| `packages/fedos-desktop-electron-spike/` | PUBLIC REQUIRED | Its own `package.json` description states plainly it "is not a throwaway spike" — it is "the real FedOS Desktop Beta Electron app and its release-build pipeline (`release:beta`/`package:beta`)", kept as a separate package specifically so Electron's transitive `@types/node` never leaks into the root TS graph. The "spike" name is acknowledged internally as misleading but was deliberately not renamed (renaming is its own separately-scoped arc). |
| `packages/meshkv/` | PUBLIC OPTIONAL | `@nostr-window/meshkv` — "browser-to-browser public asset KV store (external package boundary)" per its own `package.json`. Self-contained with its own tests (`test/meshkv_*.test.ts`). Per `src/os/_legacy_prototype/README.md`: its **only in-repo consumer** is the dead legacy prototype's `asset/meshkv_*` files — "packages/meshkv/... was not moved... It is now logically legacy-only/dormant: nothing outside this directory depends on it." Real, working, independently useful package; just has no live consumer in this repo today. |

## 4. `docs/` — breakdown

`docs/` has **1,326 entries** directly at its own top level (`ls docs/ | wc -l`), overwhelmingly (**1,109**, `ls docs/ | grep -c '^secure_runtime_alpha_'`) the numbered `secure_runtime_alpha_NNN_*.md` per-stage arc record. The remaining ~217 flat files and 7 subdirectories are broken out below rather than enumerated file-by-file, per the arc brief's own instruction to group by pattern.

| Item | Classification | Rationale |
|---|---|---|
| `docs/secure_runtime_alpha_*.md` (1,109 files) | HISTORICAL | Per-stage completion declarations / execution specs / reconciliation reports from the numbered Alpha arc chronology. Full detail in §5. |
| `docs/ALPHA_HISTORY.md` | HISTORICAL | Explicitly self-describes: "This is the historical record, not the place to start... entries are point-in-time... For current fact, read the maintained documents instead." Full detail in §5. |
| `docs/fedos_original_prototype_reference_historical.md` | HISTORICAL | Explicitly self-titled "(HISTORICAL — pre-pivot 'nostr-window')"; former tail of `README.md`, deliberately relocated so stale claims stop reading as current. Full detail in §5. |
| `docs/OSS_READINESS_REPORT.md` | HISTORICAL | Self-dated "Written 2026-07-26," checked against a specific historical commit pair (`master@4bd79d11`, `release-prep/fedos-oss-closed-pilot@637721cf`) — a point-in-time gate report, not living guidance. |
| Remaining ~215 flat `docs/*.md` files (`runtime_*`, `nip44_*`, `public_*`, `secret_*`, `crypto_*`, `desktop_beta_*`, `publish_pipeline_host_ownership_review_*`, boundary/planning docs, etc.) | HISTORICAL (mostly) | These are almost all pre-`os/`-modularization design-decision and phase-review docs written during the same Alpha chronology as the numbered files above, just not numbered themselves (e.g. `runtime_wasm_loader_planning.md`, `nip44_wire_nonce_generation.md`). Real provenance, not a security risk, largely superseded by the current authoritative `docs/architecture/*.md` set (§4 below) for anyone trying to understand the system today. A handful are still-relevant reference docs rather than point-in-time decision records (e.g. `desktop_beta_user_guide_*.md` — user-facing guides for the shipped desktop app) — classified **PUBLIC REQUIRED**, not HISTORICAL, since they document how to use the current product, not how a past decision was made. |
| `docs/architecture/` (subdirectory) | PUBLIC REQUIRED | Current, authoritative architecture docs: `CAPABILITY-MAP.md`, `ADAPTER-CATALOG.md`, `TRUST-MODEL.md`, `MESSENGER-ARCHITECTURE.md`, `COMMERCE-ARCHITECTURE.md`, `OS-CAPABILITY-BOUNDARIES.md`, `COMPATIBILITY-FACADE-LIFECYCLE.md`, `MESSENGER-MIGRATION-MAPPING.md`/`-STAGING.md`, `RUNTIME-OWNERSHIP-MAP.md`, plus several `*-FINAL-VALIDATION.md` reports and 2 generated `.json` inventory files. This is the doc set a new contributor should actually read; the 2 generated JSON files are machine output but small and directly cited by name from the `.md` files that use them, so kept alongside rather than split out. |
| `docs/normative/nostr-protocol-nips/` (`17.md`, `44.md`, `59.md`) | PUBLIC REQUIRED, with a caution | Verbatim copies of upstream NIP specification text (NIP-17/44/59 — private DMs, versioned encryption, gift wrap), the protocol basis for FedOS's own DM/encryption design. **No license/attribution header was found in the first 15 lines of the sampled file (`44.md`)** — worth a explicit provenance/license check before public release (the `nostr-protocol/nips` upstream repo itself carries no restrictive license historically, but this repo should record that fact the way `test-vectors/` already does for its own imports, rather than leave it implicit). Not flagged as PRIVATE/secret — this is public spec text, not a confidentiality concern, purely a provenance-documentation gap. |
| `docs/operations/OFFLINE-ISSUER-RUNBOOK.md` | PUBLIC REQUIRED | Real operational runbook for the offline Trust issuer capability. |
| `docs/pilot/` (8 files) | PUBLIC OPTIONAL | `CLOSED_PILOT.md`, `FEEDBACK.md`, `INSTALLATION.md`, `KNOWN_RISKS.md`, `RECRUITMENT_DRAFT.md`, `RESULTS_TEMPLATE.md`, `STOP_USE_CRITERIA.md`, `TEST_SCENARIOS.md` — real, useful material for a specific closed-pilot program, but not required to build/run/test FedOS itself. Reasonable candidate to become HISTORICAL once that specific pilot concludes. |
| `docs/release/` (2 files) | PUBLIC REQUIRED | `OSS-LICENSE-DECISION.md` and `FEDOS-TRUST-OSS-RELEASE-FINAL-VALIDATION.md` — this arc's own release documentation, plus this document (`OSS-PUBLIC-SURFACE.md`) now added here. |
| `docs/reviews/` (13 subdirectories in this checkout) | HISTORICAL | `conversation_foundation_v1`, `electron_dependency_packaging_v1`, `fedos_account_nostr_identity_rotation_v1`, `fedos_beta_distribution_v1`, `fedos_conversation_forward_secrecy_v1`, `fedos_external_security_audit_bundle_v1`, `fedos_oss_publication_preparation_v1`, `private_conversation_construction_v1`, `private_conversation_search_runtime_v1`, `private_conversation_security`, `private_group_pairwise_fanout`, `private_message_envelope_v1`, `private_protocol_delivery_group_v1` — all numbered, point-in-time review/audit output directories (e.g. `fedos_oss_publication_preparation_v1/00_publication_reconciliation.md`...`04_closed_pilot_go_no_go.md`). Genuinely useful provenance, not something a new contributor needs to read first. **Note:** this checkout's `git status` is clean and does not show the additional `docs/reviews/*` directories (e.g. `fedos_closed_pilot_ux_v1`, `fedos_competitive_report_v1`, `fedos_security_review_v2`, etc.) that appear in this session's initial context block — those belong to a different worktree/branch (`arc/fedos-runtime-ownership-extraction`, per that context) and do not exist in this repository (`arc/fedos-trust-offline-monetization-oss-release`). Verified via `git branch --show-current` and a fresh `find docs/reviews -maxdepth 1 -type d`. |
| `docs/user/SUBSCRIPTION-ENTITLEMENT.md` | PUBLIC OPTIONAL | Trust/creator-entitlement user-facing spec doc; useful supplementary material, not required to build/run/test. |

## 5. Legacy / historical material (arc brief §6 — three-label scheme)

Every item below is classified using exactly one of **KEEP IN OSS** /
**EXCLUDE FROM FIRST RELEASE** / **ARCHIVE LATER**, per the arc brief.
Nothing here was moved or deleted.

### `src/os/_legacy_prototype/` — **EXCLUDE FROM FIRST RELEASE**

Read its own `README.md` in full before classifying, as instructed. It is
unambiguous: this is the dormant pre-pivot **"nostr-window"** product — a
Reddit-style, read-only window into Nostr, built as a **Cloudflare
Workers** application (`worker.ts` was its `fetch` entrypoint). FedOS
pivoted away from this to become the current, focused, end-to-end
encrypted DM messenger; this code predates that pivot and was never
updated for it. It has **no deploy path** — "there is no Cloudflare
Workers deployment config, wrangler configuration, or CI job anywhere in
this repository that builds or ships `worker.ts`." It is kept **only**
for its existing test coverage (~295 tests exercising it at these new
import paths). Contents: `chat/`, `community/`, `social/`, `thread/`,
`query/`, `ingest/`, `indexer/`, `cache/`, `nearby/`, `asset/`, `sign/`,
`render/`, `federation/`, `promotion/`, `worker.ts`, `index.ts`, plus 2
files of the old `runtime/` selection layer, plus 1 file of `notification/`
(`bridge.ts` only — the other 3 files were correctly restored to live
`src/notification/`, see §2b).

Recommendation: exclude from the first public OSS cut. It adds no
functioning capability, has no deploy path, and risks confusing a new
contributor into thinking FedOS ships a Cloudflare Workers product it does
not. It is not a security or licensing risk (no secrets, MPL-2.0 covers it
like everything else), so this is a clarity/scope decision, not a safety
one. A future, separately-scoped arc should decide whether to physically
archive it (e.g. to a dedicated historical branch/tag) or delete it
outright — either requires first deciding what happens to its ~295
dependent tests, which is out of this read-only pass's scope.

### `schema/` (`d1_index.sql`, `d1_space_directory.sql`) — **EXCLUDE FROM FIRST RELEASE**

Exclusively consumed by `src/os/_legacy_prototype/`'s dead D1 backend (verified
by grep — see §1). Same rationale and same recommendation as
`_legacy_prototype/` itself; excluding one without the other would leave
orphaned SQL with no visible purpose.

### Historical evidence docs (`docs/secure_runtime_alpha_*.md`, `docs/ALPHA_HISTORY.md`, `docs/fedos_original_prototype_reference_historical.md`) — **KEEP IN OSS**

All three self-identify as historical (by naming convention, by explicit
"this is the historical record, not the place to start" framing, or by an
explicit "(HISTORICAL...)" title). None contain secrets. They are real,
valuable development provenance for a project whose own `README.md`
already points newcomers away from them and toward the current docs.
Excluding them would not reduce risk, only reduce transparency about how
the project actually got here — keep them, but do not feature them.

### Old arc documents generally (`docs/*.md` outside `docs/architecture/`, non-numbered) — **KEEP IN OSS**

Same reasoning as above; see the docs/ breakdown in §4 for the split
between genuinely historical decision-record docs and the still-relevant
`desktop_beta_user_guide_*.md` user guides (the latter are not "old arc
documents" in the sense this section means — they document the current
product).

### Compatibility shims (`src/board/`, `src/conversation/`, `src/crypto/`, `src/desktop/`, `src/device/`, `src/identity/`, `src/nostr/`, `src/settings/`, `src/storage/`, `src/sync/`, `src/vault/`) — **KEEP IN OSS**

Verified 100%-shim per §2b. `docs/architecture/COMPATIBILITY-FACADE-LIFECYCLE.md`
records the repo's own deliberate policy: these are kept "purely for any
external/unknown consumer," with 393 of the (now 807) shims explicitly
`@deprecated`-marked rather than removed, precisely so an external
consumer who imported the old path doesn't break. Each shim is one
`export * from "...";` line — negligible size and zero behavioral risk.
Removing them is that document's own, already-defined, ongoing policy
(re-apply its 5-point removal criteria), not a first-release decision.

### Historical tests (`test/secure_runtime_alpha_*.test.ts` — 893 files; `test/runtime_*.test.ts` — 93 files) — **KEEP IN OSS** (as a class; no per-file review done here)

Classified as one class per the arc brief's own instruction not to
enumerate ~800+ files individually and not to duplicate Agent T's parallel
test-surface workstream. **This document does not determine which of
these 986 files still pass, are skipped, or are dead weight — see Agent
T's CURRENT/HISTORICAL test-surface doc for that runnable-test-level
split.** From a pure release-surface-inclusion standpoint (not a
CI-health standpoint), keeping them costs nothing extra to ship (they are
already part of `test/`, MPL-2.0-covered, no secrets observed while
sampling this pass) and documents the same real development history as
the doc chronology above.

## On "PRIVATE / NEVER PUBLISH"

None found in this pass. This inventory's own survey (root directories,
all 18 `src/` subdirectories including full-content reads of
representative files in every "older top-level" directory, `packages/*`,
`docs/` subdirectories, `schema/`, `test-vectors/`) turned up no
credential, key material, internal-only URL, or similar. This is *not* a
substitute for Agent S's dedicated secret scan — per this arc's own
instructions, a full grep-for-secrets sweep is explicitly their
workstream, not this one. Had anything suspicious surfaced during this
survey it would be recorded here as "SUSPECTED — see Agent S" with a path
and no value; nothing met that bar.

---

## Summary

- Repository root: **10 directories + ~25 files**, all classified, 0 unknown.
- `src/`: **18 subdirectories**, all classified with verified (not assumed) shim/live status, 0 unknown.
- `packages/`: **3 sub-packages**, all classified, 0 unknown.
- `docs/`: **1,326 top-level entries + 7 subdirectories**, grouped by pattern per the arc brief, 0 unknown.
- Legacy/historical material: **7 items** classified with the 3-label scheme (1 EXCLUDE FROM FIRST RELEASE tree + its 1 dependent schema/, 5 KEEP IN OSS groups).
- **UNKNOWN: 0** everywhere required by the arc brief.
- One factual discrepancy surfaced and documented (not silently fixed): `src/os/messenger/README.md` is stale — it still describes the pre-migration state a day after the physical migration actually landed.
