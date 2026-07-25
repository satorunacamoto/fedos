# Errata and Corrections — FedOS External Security Audit Bundle v1

**Read this file FIRST, before any of files 00-19 in this directory.**
Files 00-19 are preserved **verbatim, unmodified**, exactly as
committed at `4158243f20be50ec49c8aa5625824823fe471c87` ("Finalize
FedOS External Security Audit Bundle v1", branch
`review/fedos-external-security-audit-bundle-v1`) — copied into this
worktree's own docs tree at Secure Runtime Alpha 8441-8520 (FedOS
Public Beta Governance, Licensing, Audit Handoff, and Final Technical
Closure Arc) via `git show 4158243f:<path>`, with **no wording changed
in any of them**. This file records every correction found necessary
when revalidating the bundle against current source, per this Arc's own
Phase F instruction, without concealing the bundle's real origin or
silently editing its own text.

**Base the bundle was assembled against:** documents 00-07 against
`81305b37`; documents 08-19 against `68e7be16`. **Base this errata was
checked against:** `arc/fedos-public-beta-governance-audit-handoff` @
`00145205` (which contains master `59a0307b`, plus two previously
unmerged Arcs reconciled at Phase A of this Arc — Alpha 8281-8360
`cc510fcb` and Alpha 8361-8440 `bc8482d2` — plus this Arc's own Phases
A-I). **Only 6 non-doc source files changed across that entire gap, and
every one is comment-only or user-facing copy — zero crypto/protocol/
IPC behavioral change.** All of the bundle's crypto/threat-model
substance therefore survives; what's stale is counts, toolchain/
governance facts, and commit identity.

## Corrections by file

### 00_audit_package.md
- Cutoff banner (`81305b37`/`68e7be16`) → both are now ancestors of
  `master`; current base for this errata is `00145205`, master is
  `59a0307b`.
- Recommendation "fill `SECURITY.md`'s contact fields" → **restructured,
  not merely untouched**: `SECURITY.md` now has an explicit
  `### SECURITY CONTACT — HUMAN INPUT REQUIRED BEFORE PUBLIC BETA`
  section plus separate `HUMAN INPUT REQUIRED` markers on acknowledgement
  SLA and disclosure-coordination timelines (this Arc's Phase E). The
  identity itself is still unfilled — that part of the recommendation
  stands.
- Add a 5th top recommendation: **choose a project license** — now a
  formal governance gate, see `LICENSE_STATUS.md` (this Arc's Phase D),
  which states Public Beta is blocked on redistribution rights until
  resolved.
- README's "Original project vision" section has since been **split
  out** to `docs/fedos_original_prototype_reference_historical.md`
  (this Arc's Phase B) — update any pointer to it accordingly.

### 01_architecture.md
- Diagram text says "THREE bridges" but lists FOUR objects immediately
  below — an internal inconsistency present at authoring time, not
  introduced by this errata.
- `fedosApp — 34 fedos-app:* channels` → **38 methods over 35 distinct
  channels** (`archiveInspect`/`Export`/`PreflightRestore`/`Restore`
  all multiplex one `fedos-app:archive` channel).
- `fedosAcceptance — 12 fedos-acceptance:* channels` → **15 methods /
  15 distinct channels**.
- `fedos_electron_beta_renderer.ts (~1,600+ lines)` → **~1,800 lines**;
  `fedos_electron_beta_page.html` is **327 lines**.
- **SecretHandle accessor count is materially wrong**: "27 accessors
  across ≥2 secret-carrying types" → the "27" figure is a **methodology
  artifact** (it counted 7 test-function names matching the same
  grep pattern as real accessors). Correct: **19 accessor definitions
  in `packages/fedos-core-rust/src/lib.rs`; 21 across
  `packages/fedos-core-rust/src/` repo-wide; ≥8 distinct
  secret-carrying types** (`FedosSecretHandle`, `FedosMasterSeedHandle`,
  `FedosIdentityRootHandle`, `FedosApplicationRootHandle`,
  `FedosProtocolRootHandle`, the Nostr secret-key handle,
  `FedosNostrPublicKeyHandle`, `FedosNostrSignatureHandle`). Correct
  grep: `grep -rn 'fn expose_bytes_for_internal_' packages/fedos-core-rust/src/ | grep -v 'returns_'`.
  This same "27" figure, wherever it recurs below (03, 17, 19), carries
  the identical correction.
- §3's open question about the legacy `productionCryptoGraph`
  resolution path being "provably redundant" → **resolved, and the
  opposite conclusion was reached**: Alpha 8281-8360 (`cc510fcb`)
  directly re-verified it and found it is a **live `??` fallback** with
  three real, currently-passing dependent tests — **not** redundant.
  New authoritative banner comments now exist on
  `src/runtime/create_runtime.ts` and
  `src/desktop/runtime/fedos_desktop_runtime.ts:892` documenting exactly
  this. Cite those banners, not the bundle's own open question.
- "roughly 4,700 commits behind" → this is an Alpha-NUMBER gap, not a
  commit count; reword to avoid the ambiguity.

### 02_threat_model.md
- §7's closing reference to `SECURITY.md`'s Alpha 8201-8280 text → that
  file was **rewritten again** at this Arc's Phase E (115 lines
  changed) — re-quote from the current file.
- Everything else (adversary table, non-goals, Master Seed §5,
  fail-closed §6, scenario matrices §9) — **no changes needed**.

### 03_review_order.md
- Items citing "27 accessors across ≥2 types" → see the 01 correction
  above (19/21, ≥8 types).
- Item about decision actions "taking zero arguments" (an implicit
  server-side "currently selected" item, a race-condition shape) →
  **stale, already fixed**. Alpha 8121-8200 Security Finding 3 changed
  `identityTransitionAccept/Reject/Defer` to take
  `(peerAccountRef, peerDeviceRef, transitionId)` and
  `deletionRequestApprove/Reject` to take `(requestId)` — the described
  race shape no longer exists at the bridge layer. This same correction
  applies to 05 and 19 below.

### 04_evidence_index.md
- Header's "ancestor of `master` (`81305b37`)" line → re-derive against
  `00145205`.
- A base-commit citation drops a character (`7337759` vs. the real
  `7337759e`) — cosmetic, correct if rewriting.
- The 34-channel `fedosApp` citation → 35 channels / 38 methods (see 01).
- Add rows for governance docs that didn't exist in either bundle
  cutoff: `LICENSE_STATUS.md`, `THIRD_PARTY_NOTICES.md`,
  `docs/secure_runtime_alpha_8281_8360_production_cleanup_consolidation.md`,
  `docs/secure_runtime_alpha_8361_8440_public_beta_final_readiness.md`,
  `docs/secure_runtime_alpha_8441_8520_code_signing_distribution_truth.md`.

### 05_known_issues.md
- Move "decision actions take zero arguments / implicit selection race"
  to an "already fixed" section (see 03's correction).
- "No double-submit guard" → **partially closed**: `onSettingsSave` now
  uses `setBusy(true, "settings-save")`; re-grep the Identity
  Replacement/Signed Deletion decision handlers specifically before
  restating this as fully open or fully closed.
- "Release-artifact code-signing status" (called "the sharpest single
  discrepancy" in the original) → **superseded**. This Arc's own
  `docs/secure_runtime_alpha_8441_8520_code_signing_distribution_truth.md`
  is now the canonical resolution (independently re-verified via
  `Get-AuthenticodeSignature`, confirmed `NotSigned`). Any citation of
  README line 732 for a code-signing claim is doubly stale — that
  section of README no longer exists in that form after this Arc's own
  Phase B split.
- Add: **no project license selected → Public Beta blocked on
  redistribution rights** (`LICENSE_STATUS.md`).
- Group Messaging / Sender-Key prototype / append-only O(T) / Device
  Relay Sync zero wiring / no `mlock` / `recovery-required` dead end →
  **no changes needed**.

### 06_disclosure_policy.md
- Every placeholder description should be re-derived from the
  **rewritten** `SECURITY.md` (this Arc's Phase E), which now has: a
  named security-contact gate; Closed Beta participants explicitly
  routed to a pilot-coordinator channel outside the repository; a
  supported-versions statement naming `0.1.0-beta.x` on
  `release/fedos-desktop-beta-0.1`; an explicit "what counts as a
  security issue" list that names the `fedosAcceptance` bridge staying
  structurally absent as a reportable class; an encryption-key-request
  policy; and separate `HUMAN INPUT REQUIRED` markers on both
  acknowledgement SLA and disclosure-coordination timelines.

### 07_reproduction_guide.md
- The toolchain is now **pinned by standard mechanisms** (this Arc's
  Phase C): `.nvmrc` = `24`; `rust-toolchain.toml` =
  `channel = "1.95.0"`, `targets = ["wasm32-unknown-unknown"]`; root
  `package.json` gained `"engines": { "node": ">=24.0.0 <25.0.0" }` and
  `"packageManager": "npm@11.12.1"`. Replace any "not pinned / whatever
  the environment happened to provide" framing.
- `BUILDING.md` gained substantial new reproduction documentation in the
  same phase (exact wasm-bindgen-cli version requirement, a documented
  fresh-worktree/junction `tsc` artifact, the full 9-step release
  pipeline) — re-read before citing it.

### 08_version_manifest.md
- **Delete/replace the closing paragraph** stating no `package.json`
  declares an `engines` field and that no version is "a pinned, enforced
  requirement" — **this is now false**, see 07's correction.
- Toolchain table (Node v24.15.0 / npm 11.12.1 / rustc 1.95.0 / cargo
  1.95.0 / wasm-bindgen-cli 0.2.126 / Electron 43.1.1 / electron-builder
  26.15.3) → the VALUES are still consistent with the new pins; only
  relabel the row's own SOURCE from "this review's environment happened
  to provide" to "enforced by `.nvmrc`/`engines`/`rust-toolchain.toml`".
- Product identity (`0.1.0-beta.1`, `beta-release-candidate`,
  `windows-x64`, `autoUpdateEnabled: false`) and all four schema
  versions (`1`) → **no changes needed**.
- WASM manifest block (`crateVersion 0.0.0`, `capabilityProfile
  desktop-master-seed-v1`, `allowedExports`) → **no changes needed**.

### 09_commit_manifest.md — every count needs regenerating
- `git rev-parse HEAD → 68e7be16…` → **`00145205`**, and on
  `arc/fedos-public-beta-governance-audit-handoff`, not `master`
  (`master` itself is `59a0307b`; the reconciled arc branch is ahead of
  it pending this Arc's own Phase L landing).
- `git rev-list --count HEAD → 723` → **734**.
- `git branch -a | wc -l → 164` → **169**.
- Tag count (`0`), single-author fact, no-remote fact → unchanged.
- The 15-commit "recent lineage" list needs full regeneration; the
  reconciled branch's own most recent commits are `00145205, 56418ac0,
  7ff3f53e, 3b1d4505, 698541e2` (this Arc's own Phases E/D/C/B/A) then
  `bc8482d2, cc510fcb` (the two reconciled arcs) then `59a0307b`
  (master's real tip) then `68e7be16` and older.
- The original "one-commit drift between the 00-07 cutoff and the 08-19
  cutoff" framing is now a **two-cutoff-plus-nine-commit** drift and
  should be restated as such, explicitly distinguishing `master` from
  this Arc's own reconciled branch (`cc510fcb`/`bc8482d2` are real,
  committed, but were NOT on `master` until this Arc's own Phase A
  merged them into its own branch — landing to `master` itself happens
  at this Arc's own Phase L, after this errata was written).

### 10_dependency_manifest.md
- `@noble/curves`/`@noble/hashes` real non-test production source-file
  count: "20+" → **40** non-test `.ts` files.
- The "two concrete production call sites" framing for Schnorr usage is
  a **material undercount** — see the 17 correction below (9 files, 4
  distinct feature areas).
- Direct-dependency counts, the 94/284-resolved split, the `ecdsa
  v0.16.9` graph nuance, `Cargo.lock` policy, and the fact neither
  `cargo audit` nor `npm audit` has been run → **no changes needed**
  (no lockfile changed across this entire gap).
- Add: `THIRD_PARTY_NOTICES.md` (this Arc's Phase D) now exists as a
  generated, deterministic license inventory
  (`node scripts/generate_third_party_notices.mjs`), reporting **313
  npm packages / 82 Rust crates** at generation time — reconcile against
  this document's own 94+284=378 figure (the two figures differ by
  cross-lockfile deduplication method, not by a real discrepancy in
  what's installed).

### 11_build_manifest.md
- The `cargo test --release` "639 passed / 1 known-failing dependency-
  count-drift test" figure should be re-run against the reconciled arc
  branch before being restated as current (not re-run as part of this
  errata pass; flagged for the next full verification run).
- Step 5's "dirty tree" justification names in-progress sibling review
  directories that are now fully committed elsewhere — restate or drop
  when next revised.
- The `10f7fdb2…` WASM output line (sha256, 385,565 bytes) →
  **independently reconfirmed a further time this Arc** (a fresh build
  in this Arc's own worktree, this errata's own verification pass,
  byte-identical) — keep verbatim, now with one more confirmation.

### 12_hashes.md
- `fedos_core_rust_bg.wasm` sha256
  `10f7fdb2e1f2e656013f68f591e452e49cfdbcf9f5822906054b02619730ff6a`,
  385,565 bytes → **exact match**, confirmed independently by this
  Arc's own fresh build. Bump whatever "N independent confirmations"
  count the original states by one more.
- `Cargo.lock` sha256 (82 entries) → no contradicting evidence found;
  not independently re-derived this specific pass.
- **Provenance clarification, not a contradiction**: this Arc's own
  earlier release build (commit `86825157`, on
  `release/fedos-desktop-beta-0.1`) is a **release-notes-only** commit
  (+67 lines to the release notes doc) — it does not itself carry a
  `release-manifest.v1.json` in that specific commit's diff (the
  manifest is a build OUTPUT, gitignored, not committed — consistent
  with `BUILDING.md`'s own "release/ is never committed" policy). The
  bundle's own "installer/ZIP not reproduced this pass" statement and
  this Arc's own real, checksummed release build are **describing
  different things, not disagreeing** — the release branch commit is a
  docs update; the actual installer/ZIP built this session exist only
  as local, gitignored artifacts with their hashes recorded in this
  Arc's own `docs/secure_runtime_alpha_8441_8520_code_signing_distribution_truth.md`.

### 13_release_artifact_inventory.md
- Signing-status content is superseded by
  `docs/secure_runtime_alpha_8441_8520_code_signing_distribution_truth.md`
  — cite it as the canonical, most-current resolution.
- Pipeline steps 1-8, `unsigned: true`, no certificate configured, no
  pre-flight WASM-artifact check in `build_release.mjs` → **no changes
  needed**.

### 14_sbom.md
- Component tables (94/284/82 packages; 5+2+14 direct; 460 total) →
  still accurate.
- Add: a real, generated, deterministic license inventory now exists
  (`THIRD_PARTY_NOTICES.md`, 313 npm + 82 Cargo, generated
  `2026-07-25T15:00:56Z`) — change the "recommendation for the external
  engagement" from "generate one" to "generate a standard SPDX/CycloneDX-
  format SBOM and diff it against this already-generated file" instead.

### 15_license_inventory.md — matches the main Arc's own independent finding
- Confirmed identical on independent re-check: no `LICENSE`/`LICENSE.md`
  at root; no `"license"` field in either `package.json`; zero copyleft
  across both npm trees; "all rights reserved by default" framing.
- **Gap the bundle never checked, add it**: `packages/fedos-core-rust/Cargo.toml`
  also has no `license` field — `LICENSE_STATUS.md` (this Arc) states
  this explicitly.
- **No `NOTICE` file either** — also not checked by the original bundle;
  now stated in `LICENSE_STATUS.md`.
- The bundle's own caveat "the Rust transitive graph was not
  individually re-derived (would require `cargo-license`)" → **now
  closed**: `THIRD_PARTY_NOTICES.md` derives it via `cargo metadata` (a
  Cargo built-in, no new tool installed) and confirms **no
  forced-copyleft dependency across 313 npm packages / 82 Rust crates**
  — replace the original's "unlikely but not independently confirmed"
  hedge with this direct confirmation.
- Add a pointer to `LICENSE_STATUS.md`'s own step-by-step "what to do
  once a license is chosen" procedure and its explicit HUMAN INPUT
  REQUIRED list (project license, copyright holder/legal entity,
  dependency-compatibility legal review).

### 16_third_party_inventory.md
- "All 378 resolved npm packages" → reconcile against
  `THIRD_PARTY_NOTICES.md`'s own 313-package figure (cross-lockfile
  deduplication difference, not a real discrepancy).
- "No CI service configured" → **re-confirmed true** on the reconciled
  arc branch (no `.github/` directory, no root `*.yml`/`*.yaml`).
- Relay/Electron/Windows/crates.io/wasm-bindgen-cli/signtool/7-Zip rows
  → **no changes needed**.

### 17_crypto_inventory.md — two material corrections
- **SecretHandle accessor count**: "27 accessors across ≥2 types" → see
  01's correction (19 in `lib.rs`, 21 repo-wide, ≥8 types, corrected
  grep pattern given there).
- **TypeScript-side BIP-340 Schnorr scope was materially understated.**
  The original scopes it to Signed Deletion Requests only ("two concrete
  production call sites"). Real count on the reconciled branch: **9**
  non-test `.ts` files reference `schnorr`:
  `src/conversation/deletion_request/fedos_deletion_request_signing.ts`,
  `src/conversation/identity_transition/fedos_identity_transition_continuity_evidence.ts`,
  `src/conversation/identity_transition/fedos_identity_transition_new_key_proof.ts`,
  `src/desktop/nostr_signature_verifier.ts`,
  `src/device/crypto/fedos_device_signing_keypair.ts`,
  `src/nostr/event.ts`, `src/nostr/noble_signature.ts`,
  `src/nostr/signature.ts`, `src/nostr/types.ts`. The real TS-side
  Schnorr surface covers **Signed Deletion, Identity Transition
  evidence/new-key proofs, Device signing keypairs, and generic Nostr
  event signing plus inbound signature verification** — four distinct
  feature areas, not one. This materially raises the priority of the
  original's own open question ("do the two Schnorr implementations
  [Rust and TypeScript] ever verify each other's signatures?"), since
  `nostr_signature_verifier.ts` sits on the **inbound** message path.
- Cargo dependency table (11 production crates, exact versions), the
  `ecdsa` dependency-graph nuance, NIP-44 v2 details, Direct Ratchet
  parameters (1000-key window / 14-day bound), the route-binding field,
  and "no new cryptographic primitive was invented" → **no changes
  needed**.

### 18_evidence_cross_reference.md
- Rows needing the same numeric corrections as above: commit under audit
  (`68e7be16` → `00145205`, on the reconciled arc branch, not `master`);
  commit/branch/tag counts (`723/0/164` → `734/0/169`); "one commit
  stale" → the two-cutoff-plus-nine-commit-plus-branch-reconciliation
  drift described in 09; `@noble` file count (20+ → 40); the
  accessor-count row (19/21, not 27, ≥8 types).
- Add a row for "no `license` field in `Cargo.toml`" and a row for the
  new `engines`/`.nvmrc`/`rust-toolchain.toml` pins (which supersedes
  08's old "not pinned" claim).
- Rows for 94/284 package counts, the `ecdsa` nuance, WASM hash,
  `Cargo.lock` hash, dirty-tree refusal behavior, signing-readiness
  inventory, the auto-update prohibition, schema versions, the
  wasm-bindgen-cli version match, and "no CI configured" → **no changes
  needed**.

### 19_reviewer_checklist.md
- "Independently confirm the 27-accessor count" → replace with "19 in
  `lib.rs` / 21 repo-wide" and the corrected grep pattern from 01/17.
- "Whether to add a `LICENSE` file / `package.json` `license` field" →
  also add "and a `Cargo.toml` `license` field, and a `NOTICE` file" —
  point at `LICENSE_STATUS.md`'s own 5-step procedure rather than
  restating it inline.
- "Whether to fill `SECURITY.md`'s contact placeholder" → still open,
  but point at the new Phase E structure (separate contact/SLA/
  disclosure-timeline `HUMAN INPUT REQUIRED` markers, not one
  undifferentiated placeholder).
- The toolchain-match checklist item → replace "confirm your toolchain
  matches or exceeds [X]" with "the repository now PINS Node 24 / rustc
  1.95.0 / wasm-bindgen-cli 0.2.126 via `.nvmrc`/`engines`/
  `rust-toolchain.toml` — a mismatch is now a hard, checkable
  divergence, not an informal suggestion."
- Add a new checklist item: verify the full TS-side Schnorr surface
  across all 9 files named in 17, not just the deletion-request path.
- Sign-off block, severity-triage vocabulary, `cargo audit`/`npm audit`
  status, SBOM presence, `aes-gcm` reachability question, and the
  telemetry re-grep item → **no changes needed**.

## What this errata does NOT do

It does not perform the external audit itself, does not commission one,
does not fabricate a completion of any item still marked open in the
original bundle, and does not alter the original 20 files' own text —
every correction above is additive commentary layered on top of an
unmodified, faithfully-preserved original. Any future revalidation pass
should update THIS file, not silently edit 00-19.
