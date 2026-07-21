# Secure Runtime Alpha 4741-4820 — Phase A: Gate & Artifact Inventory + Blocker Reproduction

Base commit: `bda2c1f` (Alpha 4661-4740, First-Run Profile and Unlock
Boundary Arc). Branch `arc/production-master-seed-runtime-activation-secure-unlock`,
worktree `C:\wt\production-master-seed-unlock`. This is the mandated Phase A
report — written before any production edit. Every claim below was
re-derived from the real source (not from a prior completion declaration),
per the spec's "do not rely on completion declarations alone" instruction.

## 0. Headline finding (the blocker is CLOSABLE here)

The prior Arc disclosed one honest blocker: the real
`FedosWasmMasterSeedAuthority` needs a compiled WASM `pkg/` that did not
exist in the worktree, and the dev-only crypto gate is hardcoded shut. This
Arc **verified firsthand that the WASM artifact CAN be built in this
environment** and that the real Master Seed crypto runs end-to-end:

- Toolchain present: `cargo 1.95.0`, `rustc 1.95.0`, `wasm32-unknown-unknown`
  target installed, `wasm-bindgen 0.2.126` (exactly the pinned version). No
  `wasm-pack` — but `build:wasm` uses `cargo build` + `wasm-bindgen`
  directly, so it is not needed.
- `npm run build:wasm` (with the getrandom cfg the Cargo.toml documents —
  `RUSTFLAGS='--cfg getrandom_backend="wasm_js"'`) **succeeds** in ~34s and
  emits `packages/fedos-core-rust/pkg/` with `fedos_core_rust.js` (42 KB),
  `fedos_core_rust_bg.wasm` (260 KB / 263 292 bytes), and `.d.ts` files.
- The JS glue exports the full `FedosMasterSeedAuthority` class (generate,
  seal, restore_sealed, clear, is_available, is_cleared, sign_nostr_event,
  public_key_hex_for_account, resolve_conversation_key) plus `initSync`.
- Driven through the REAL `FedosWasmLoaderSkeleton` in Node (planLoad ->
  attemptDevOnlyJsGlueImport -> attemptDevOnlyWasmInitialization -> master
  seed calls), the real WASM performs **generate -> seal (Argon2id +
  ChaCha20-Poly1305) -> restore -> identity consistency -> wrong-passphrase
  fail-closed**. Reproduced live before writing any production code.

Therefore this Arc does not stop at "packaged real-unlock blocked by the
missing artifact." It builds the artifact, builds the production activation
boundary, and proves real production unlock through the coordinator. The
ONLY honest stop is Phase L (a packaged Electron GUI process) — see §12.

## 1. Master Seed authority — the REAL Rust/WASM implementation

`packages/fedos-core-rust/src/lib.rs` (~12 800 lines) exposes, at crate
root, a `#[wasm_bindgen]` opaque class `FedosMasterSeedAuthority` (Alpha
436+). It is genuine production crypto, not a placeholder (the stale
`Cargo.toml` header comment claiming "no `#[wasm_bindgen]`, 27 pub fn" is
out of date — 20 `#[wasm_bindgen]` items exist, 63 `pub fn`):

- `generate()` — draws a 32-byte seed from the OS CSPRNG (`getrandom::fill`),
  fails closed if not `Empty`.
- `seal(passphrase: &[u8]) -> Option<String>` — Argon2id (fresh random salt)
  wrapping key + ChaCha20-Poly1305 AEAD under a dedicated
  `MasterSeedSealing` AAD domain; returns the Sealed Envelope V1 JSON.
- `restore_sealed(envelope_json, passphrase) -> bool` — parses, re-derives
  the wrapping key, AEAD-opens; fails closed on wrong passphrase / tamper /
  non-`Empty` state, never distinguishing which (RFC 8439 guidance).
- `clear()` — zeroizes + irreversibly `Cleared`.
- `public_key_hex_for_account`, `resolve_conversation_key`,
  `sign_nostr_event` — identity/derivation/signing, all reusing the Alpha
  146-200 chain. No raw-seed / nsec getter of any kind.

The crate's native `cargo test` module `master_seed_authority_tests` already
covers this surface (round-trip, wrong-passphrase, corrupted-ciphertext,
unrecognized-schema, malformed-JSON, overwrite-refusal).

## 2. WASM loader gate — what it is and why it stays untouched

`src/runtime/fedos_wasm_loader.ts` (`FedosWasmLoaderSkeleton`, ~4 450 lines)
reaches the real WASM through `attemptDevOnly*Call()` methods, EACH gated on
six recorded conditions: `artifactCheck.artifactsExist &&
devGate.developmentAllowed && importReadiness.ready && importExecution.succeeded
&& jsGlueModule present && wasmInitialization.succeeded`. `developmentAllowed`
is a `NODE_ENV`-derived Runtime-Mode classification. This is the **dev-only**
path — appropriate for development, and correctly closed in production
(`NODE_ENV=production`) and in Workers/browsers.

`src/runtime/fedos_dynamic_loader_gate.ts` /
`fedos_dynamic_loader_dev_approval.ts` are hardcoded shut
(`dynamicLoaderAllowed: false`, `approved: false`) with `true` only as a
reserved value. **This Arc does NOT weaken, open, or `NODE_ENV`-flip any of
these.** Instead it adds a SEPARATE, narrow production Desktop path (Phases
B-F) reachable only with a host attestation + a verified pinned manifest,
never through `NODE_ENV`.

## 3. TypeScript Master Seed authority surface (consumed unchanged)

`src/runtime/master_seed/fedos_master_seed_authority.ts` — the
`FedosMasterSeedAuthority` interface (async isAvailable/isCleared/generate/
seal/restoreSealed/clear/resolveConversationKey). One real implementation,
`FedosWasmMasterSeedAuthority`, routes through the dev-gated loader. The
sealed wire type `FedosSealedMasterSeedEnvelopeV1` is an opaque
`{ json: string }`. The production authority this Arc adds implements the
SAME interface, so the coordinator consumes it with zero change.

## 4. Onboarding coordinator (already accepts an injected authority)

`src/desktop/onboarding/fedos_profile_initialization_coordinator.ts` (Alpha
4661-4740) takes `masterSeedAuthority: FedosMasterSeedAuthority` as an
injected dependency and orchestrates create/unlock/lock, starting the real
`startFedosDesktopRuntime()`. The prior Arc injected
`DevelopmentFedosMasterSeedAuthority` (a labeled non-crypto double). **This
Arc changes NO coordinator code** — it provides a real production authority
via a new assembler and injects it in the acceptance suite; production
Electron main would do the same.

## 5. Build & packaging scripts

`package.json`: `build:wasm` (cargo + wasm-bindgen — but omits the getrandom
cfg, so it only succeeds when `RUSTFLAGS` is supplied externally);
`build:runtime`, `build:host-bridge`; the Electron package's own
`build`/`start`/`package`. `packages/fedos-desktop-electron-spike/` is a
physically isolated Electron package (electron ^43, electron-builder ^26) —
`node_modules` NOT installed in this worktree. `pkg/`, `target/`,
`node_modules/`, `dist/`, `dist-package/` are all gitignored.

## 6. Exact production files this Arc creates / changes

**New (all under `src/desktop/production_activation/`):**
- `fedos_production_wasm_artifact_manifest.ts` (Phase D)
- `fedos_production_desktop_host_attestation.ts` (Phase C)
- `fedos_production_wasm_master_seed_facade.ts` (Phase F)
- `fedos_production_desktop_crypto_activation_authority.ts` (Phase B)
- `fedos_production_master_seed_authority.ts` (Phase G)
- `fedos_production_profile_activation.ts` (Phase G assembler)

**New pipeline tooling:** `scripts/generate_wasm_artifact_manifest.mjs`,
`scripts/build_production_wasm_artifact.mjs`.

**Changed:** `package.json` (two additive scripts only), `README.md` (one
prepended blurb). **New tests + docs.**

**Explicitly NOT changed:** `fedos_wasm_loader.ts`, the dev gate / dev
approval files, `lib.rs` / any Rust source, the coordinator, the Runtime,
the Shell, the Electron `.cts` files, `p2p/`, `.tmp_gen/`.

## 7. Baseline failures (A/B classified)

`node_modules` was absent (fresh worktree) — installed with `npm install`.
Known pre-existing, not-ours classes, confirmed by A/B against the base
source and this lineage's carried notes:
- `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121` —
  one pre-existing `tsc` + runtime failure carried by every recent Arc.
- The `?raw`-import Cargo.toml/lib.rs source-inspection class (fresh
  worktrees read empty source, e.g. the wasm-init test's "23. Rust public
  API dependency count" assertion expecting 11 dep lines, receiving 0) —
  documented in project memory as a worktree artifact, not a regression.
- The `test/reviews/**` git-status-clean-only class (resolves on commit).

## 8. Threat model (Phase A summary; expanded in the activation doc)

This Arc contains capability, not host authenticity. It proves that a
renderer / Worker / arbitrary browser context cannot mint the host
attestation and cannot reach the production crypto; that the artifact is
hash-pinned before loading; and that no secret crosses a boundary. It does
NOT claim resistance to local malware, a modified binary, or memory
scraping, and it adds no cloud/keychain recovery.

## 9. Full / partial execution plan

Build the real artifact + manifest pipeline (Phase E); add the production
activation authority (B), host attestation (C), pinned manifest (D),
capability-limited facade (F), production authority + assembler (G); prove
real create/unlock through the unchanged coordinator (H) and a full failure
matrix (M) + structural guards (N) with an acceptance suite driving the REAL
WASM. **Stop precisely at Phase L** — a packaged Electron GUI process cannot
be launched/driven in this headless environment (no display; Electron not
installed; electron-builder packaging + GUI automation out of reach). Commit
under the pre-authored honest-partial title.
