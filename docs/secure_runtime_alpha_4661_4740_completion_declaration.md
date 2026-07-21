# Secure Runtime Alpha 4661-4740 — Master Seed Unlock, First-Run Onboarding, and Local Profile Initialization Arc — Completion Declaration

**Honest partial completion.** A fresh installation can now reach a safe,
explicit, per-user usable state — detect profile state, run first-run
onboarding OR existing-profile unlock, initialize/seal/restore Master Seed
authority, initialize account + local Device identity (with REAL BIP-340
proofs), initialize durable per-profile paths, start the real Desktop
Runtime, and lock/relaunch — **through a single new application coordinator
that owns no cryptography and constructs no second Runtime/Registry/Master
Seed authority.** All three target flows (new profile, existing-profile
unlock, locked/invalid) are real and tested.

**The one thing honestly blocked, exactly as the spec anticipated:** real,
production **Master Seed generation/sealing/restoration** is unreachable in
this worktree. The ONE real implementation (`FedosWasmMasterSeedAuthority`)
requires a compiled WASM `pkg/` that is absent here AND a dev-only crypto
gate that is hardcoded shut by design (`fedos_dynamic_loader_gate.ts` /
`fedos_dynamic_loader_dev_approval.ts` — Phase A §2). Per Phase D's fallback
clause this Arc implements profile detection, locked-state presentation, the
full application service boundary, and a clearly-labeled **development-only
injected Master Seed authority**, and STOPS before claiming user-ready
production unlock. This is the pre-authored honest-partial commit condition.

See `secure_runtime_alpha_4661_4740_phase_a_first_run_inventory.md`
(reconciliation + inventory) and `secure_runtime_alpha_4661_4740_execution_spec.md`
(phase-by-phase).

## What was built

Ten new source files under `src/desktop/onboarding/` (Phases B–K/M) plus
one real acceptance suite. Zero existing source file modified except
`README.md`. The coordinator consumes the existing
`FedosDesktopRuntimeConfig` surface unchanged — no config field added, no
Runtime/Shell/Host/Electron file touched.

## Phase P — Security claims (honest)

**Proven (through the real Desktop Runtime + real BIP-340, dev seed
double):**
- The profile descriptor contains no raw secret — a strict validator
  rejects every forbidden secret-shaped key, and a real test scans the
  encoded bytes.
- The Master Seed is sealed through the existing reviewed authority's
  `seal()` and only sealed material is persisted (`writeIfAbsent`, never
  plaintext) — the sealed file is asserted to contain no plaintext
  passphrase/seed byte.
- Unlock is required before Runtime construction: no code path constructs a
  Runtime except inside a successful create/unlock; a wrong secret and every
  fail-closed branch leave NO running Runtime (asserted).
- Restored identity is checked against the persisted account public
  identity; a mismatch enters `recovery-required`, never `ready`.
- Local Device registration uses the accepted account + Device Schnorr
  proofs (`runtime.devicePairing()`), reaching `"trusted"` — never a
  caller-supplied `trusted=true`.
- Lock stops the application Runtime and clears in-memory unlock material;
  durable encrypted state survives; relaunch reads the profile back as
  locked.
- Durable state is isolated per profile (distinct roots share no subpath —
  asserted).

**NOT proven (stated plainly):**
- **Production crypto availability** — the dev-only WASM gate remains
  closed; real Argon2id sealing / real seed generation is NOT exercised or
  claimed. The dev double proves coordination, not cryptography.
- Protection from local malware or memory scraping (best-effort buffer
  zeroing only; no OS-memory-inspection defense).
- Secure OS credential storage — none implemented; none claimed.
- Forgotten-passphrase recovery, remote/custodial account recovery,
  hardware-backed keys — none exist; the recovery notice states so.
- Physical possession of the intended Device owner — only that some actor
  holding the Device key produced the proof.
- A reviewed Electron GUI passphrase-input boundary — none exists (Alpha
  1267 scope limit still in force); the trusted secret payload defines the
  type/lifetime only.

## Phase Q — Structural guards (verified, not merely asserted)

- **One Runtime** — the coordinator never constructs a Runtime; it calls the
  existing single `startFedosDesktopRuntime()` and holds one handle.
- **One Master Seed authority / one Device Registry / one Sync Journal** —
  the coordinator injects the SAME authority instance and builds a config
  that reuses the Runtime's own single Registry/Journal (Phase A §7); it
  creates none of its own.
- **No plaintext seed / passphrase persistence** — asserted by tests
  scanning the sealed file and descriptor; the dev double stores only a
  random salt + a one-way verifier.
- **No secret logging** — `FedosProfileUnlockSecret` redacts `toString`/
  `toJSON`; `redactFedosOnboardingCommand` redacts the secret; no response
  echoes it (asserted).
- **No generic crypto IPC / no direct Renderer filesystem access** — the
  onboarding command vocabulary is closed and non-generic; presentation view
  models expose only fixed named fields, never a filesystem handle.
- **No new dependency** — `package.json` `dependencies` unchanged (only
  `@noble/*`, already present). **No Rust/Cargo change** (zero files under
  `packages/fedos-core-rust/`). **No Conversation/Search/Archive/Sender-Key
  redesign** (zero files under those trees touched). **Electron security
  settings unchanged** (zero `.cts` files touched). **`p2p/` / `.tmp_gen/`
  untouched** (confirmed via `git status`; neither is present in this
  worktree).
- No historical exact-shape test was weakened (none needed updating — this
  Arc adds only new files).

## Threat model (honest summary)

This Arc raises the bar from "no first-run path at all" to "an explicit,
fail-closed, unlock-gated profile lifecycle." It does NOT add any
cryptographic guarantee beyond what the existing sealed-envelope authority
already provides — and in THIS build that authority is the dev double, so
the at-rest confidentiality of the seed is NOT demonstrated here. A packaged
production build with the WASM gate opened (a future, separately-reviewed
step) is required before any real-crypto unlock claim can be made.

## Development vs production crypto truth

- **Development runtime (this suite):** real Runtime, real device
  registration, real durable persistence, real identity validation — with a
  non-cryptographic seed double. 40/40 acceptance tests pass.
- **Packaged production:** blocked. `FedosWasmMasterSeedAuthority` cannot be
  constructed (no `pkg/`; gate closed). No production unlock is claimed.

## Verification

- `npm run typecheck:core` (`tsc --noEmit`) — passes modulo the SAME one
  pre-existing, unrelated, documented failure every recent Arc carries
  (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`).
  This Arc's ten new source files + one test file add ZERO new type errors.
- **This Arc's own acceptance suite**
  (`test/secure_runtime_alpha_4661_4740_first_run_onboarding.test.ts`):
  **40/40 passing** — profile model/codec/corruption/no-secret-keys,
  persistence no-overwrite/fail-closed/duplicate-classification, the full
  lifecycle state machine, durable paths (absolute-required/traversal-proof/
  isolation/Japanese-OneDrive-path), the one-shot redacted unlock secret,
  the dev seed double (generate/seal/restore/wrong-passphrase/no-seed-byte),
  the recovery notice, the command vocabulary + redaction + dispatch, the
  presentation screens, and the end-to-end coordinator against the REAL
  runtime: baseline first-run gap, Flow A create -> ready with a REAL
  trusted local Device and a sealed file containing no plaintext seed,
  repeated-create-does-not-overwrite, invalid-label/weak-secret rejection,
  stop+relaunch+correct-unlock with stable identity, wrong-unlock stays
  locked with no partial runtime, repeated wrong unlock, identity-mismatch
  -> recovery-required, lock stops the runtime + idempotent, four
  interruption/corruption scenarios, independent-profile isolation, and the
  command-dispatch end-to-end (never echoing the secret).
- **Targeted regression** — the immediately-prior Arc's device
  registration/pairing/durable-journal suite
  (`test/secure_runtime_alpha_4581_4660_...`): **39/39 passing**, unchanged
  (this Arc modifies none of its files).
- `npm run build:wasm` / `cargo test`: N/A — this Arc touches no Rust/WASM
  file, and the real-WASM onboarding path is honestly blocked (documented),
  so building WASM would not change any claim here. Not run.
- Environment note: this fresh worktree had no `node_modules` (same as the
  prior Arc's environment note) — `npm install` was run at the root before
  verification. No `pkg/` was built (memory-documented; the missing-WASM /
  `?raw`-import failure class is pre-existing, confirmed by the lineage's
  own A/B method, not this Arc's regression).

## Recommended next Arc

**Desktop Settings, Relay Configuration, and User Preferences Arc** (the
spec's own preferred choice). With the profile lifecycle, unlock gate, and
durable per-profile path authority now real, the natural next step is the
non-secret user-configuration surface (relay lists, sync cadence, display
preferences) that a running profile persists under the same durable root —
independent of, and not blocked by, the still-closed WASM crypto gate. (A
separate, explicitly-reviewed "open the production Master Seed WASM gate"
step remains the prerequisite for any real production unlock claim, but that
is a crypto-activation Arc, not an onboarding one.)

## Concurrent-session check

`git log --oneline` and `git status` were checked in this exact worktree
before the first production edit (branch at `568ddb8`, working tree clean)
and again immediately before the commit — no unexpected commits or files
from another session were found at either point.
