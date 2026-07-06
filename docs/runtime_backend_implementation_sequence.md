# Runtime backend implementation sequence — Stage 410 (docs only, no code)

**Status: this document adds no code.** It fixes, in writing, the
ORDER in which the still-`"Planning"`/`"NotConnected"`/`"BlockedBy
Implementation"` links named in
`docs/runtime_architecture_phase_review.md` (Stage 409) would be
replaced with real implementation, one link and one stage at a time.
Nothing in this document is scheduled, approved, or started by writing
it down. No item below may be combined with another in a single future
stage, per the same one-concern-per-stage convention
`docs/implementation_phase_roadmap.md` §3 already fixes for the crypto
core.

## 1. Fixed order

1. **WASM build toolchain planning final check.** Re-review
   `docs/runtime_wasm_build_plan.md` (Stage 393) against whatever has
   changed in the Rust/WASM tooling ecosystem since it was written, and
   confirm the pipeline it describes (crate → wasm32 target → bindgen
   → loader → Runtime Provider) is still the intended shape before any
   tool is invoked. Docs only — no toolchain installed, no target
   added.
2. **`wasm32` target / `wasm-bindgen` introduction.** The first stage
   that actually adds `wasm32-unknown-unknown` as a build target and
   introduces the `wasm-bindgen` dependency/attribute macros to
   `packages/fedos-core-rust`. Still produces no `.wasm` artifact by
   itself — this stage is scoped to toolchain + annotation only.
3. **WASM artifact generation.** The first stage that actually runs a
   build producing a real `.wasm` file from `packages/fedos-core-rust`,
   replacing `FedosWasmArtifact`'s fixed `"BlockedByImplementation"`
   answer (`src/runtime/fedos_wasm_artifact.ts`, link 11) with a real
   build result. The artifact is produced, not yet loaded anywhere.
4. **TS loader real connection.** Wire `FedosWasmBoundary`'s
   `planLoad()` (link 10) to actually load the item 3 artifact via
   `WebAssembly.instantiate`/`compile`, replacing its fixed
   `"BlockedByImplementation"` answer with a real load result. This is
   the first stage in this sequence where `WebAssembly.instantiate`/
   `compile` is actually called.
5. **`ping` real cross-boundary execution.** Only after items 3–4 are
   real, wire `planPing()`'s pure-TypeScript mirror
   (`docs/runtime_first_rust_ping_execution.md`) to actually call
   across the loaded WASM boundary into `packages/fedos-core-rust`'s
   `fedos_runtime_ping_internal()` — the lowest-risk possible real
   cross-boundary call (no secret, no key, no ciphertext), used to
   validate the load-and-call mechanics before any cryptographic
   function is ever reached this way.
6. **NIP-44 real connection.** Only after item 5 proves the mechanics
   work, wire the real `fedos_encrypt`/`fedos_decrypt` (link 12,
   already real and independently tested inside
   `packages/fedos-core-rust`) through the now-real links 8–11 to
   an actual NIP-44 v2 wire operation. This is the first stage in this
   sequence where any cryptographic operation actually executes.
7. **Runtime dev-only activation.** Only after item 6 is real and
   tested, flip `FedosRuntimeCryptoProvider`'s selection to actually
   reach it, gated behind an explicit, default-OFF dev-only flag —
   `NoopCryptoProvider`/`"Unsupported"` stays the production default
   until a separate, later stage reviews removing the gate.
8. **Worker/Nostr integration.** Only after item 7 is real, dev-gated,
   and reviewed in isolation, connect `src/worker.ts` to the same
   activated path for Nostr DM handling — the last item, and the one
   with the largest blast radius (a live network-facing surface),
   attempted only once every earlier item is independently real and
   tested.

## 2. Why this order, not another

- **Items 1–4 (toolchain → target → artifact → loader) are ordered as
  a strict build-then-load dependency chain** — there is nothing to
  load before there is an artifact, and no artifact before there is a
  target and toolchain, matching the exact link order already fixed in
  `docs/runtime_internal_execution_contract.md` (links 9 → 10 → 11
  reversed for construction, since the artifact is built before it is
  loaded even though it is discovered one link "deeper" in the call
  chain).
- **Item 5 (`ping`) is inserted before item 6 (NIP-44)** specifically
  because it carries no secret material and no cryptographic
  correctness requirement — it is the cheapest possible way to prove
  the WASM load-and-call mechanics work before trusting them with real
  key material, mirroring why `docs/runtime_first_rust_ping_execution.md`
  was written as its own stage separate from any crypto stage in the
  first place.
- **Item 6 (NIP-44) is the first cryptographic-execution item**,
  deliberately last among the "make it real" items and first among the
  "make it dangerous" items — everything before it can be reverted
  with zero risk of a leaked secret; item 6 cannot.
- **Items 7–8 (Runtime, then Worker) are ordered exactly as
  `docs/runtime_worker_activation_boundary.md` (Stage 276) already
  requires**: Worker activation is reviewed strictly after, and
  independently of, Runtime activation — never bundled, never
  reordered ahead of it.
- **No two items may share a stage.** Each item has its own
  test-vector/guard-test surface (matching the precedent set by every
  Stage 74–406 boundary in this repository) that must be independently
  reviewable before the next item is attempted.

## 3. What is explicitly NOT changed by writing this sequence down

- No `wasm32` target, no `wasm-bindgen`/`wasm-pack` dependency exists
  in `Cargo.toml` after this document is added.
- No `.wasm` artifact exists anywhere in this repository.
- `WebAssembly.instantiate`/`compile` are still never called.
- `planPing()`, `planEncrypt()`, `planDecrypt()` at every link are
  still fixed `"BlockedByImplementation"`/`"Planning"`/`"Unsupported"`.
- `FedosRuntimeCryptoProvider` selection is unchanged;
  `NoopCryptoProvider` remains the only reachable provider.
- `src/worker.ts` still imports none of the chain's files.
- `evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation`
  still never return `"Allowed"`.

## See also

- `docs/runtime_architecture_phase_review.md` (Stage 409) — the chain
  summary this sequence is ordered against.
- `docs/runtime_backend_risk_register.md` (Stage 411) — named risks
  for the items in §1, particularly items 2–4 and 6–8.
- `docs/runtime_backend_verification_policy.md` (Stage 412) — the
  `cargo check`/`cargo test` gate every future stage touching items
  2–6 must pass.
- `docs/implementation_phase_roadmap.md` (Stage 133) — the equivalent,
  earlier-established sequencing document for the crypto-core (not
  WASM-boundary) implementation arc; this document follows the same
  one-item-per-stage, no-combining convention.
- `docs/runtime_wasm_build_plan.md` (Stage 393) — item 1's subject.
- `docs/runtime_first_rust_ping_execution.md` (Stage 377–384) — item
  5's existing pure-TypeScript mirror.
- `docs/nip44_wire_implementation_roadmap.md` — item 6's existing
  wire-format groundwork.
- `docs/runtime_worker_activation_boundary.md` (Stage 276) — the
  ordering rule items 7–8 restate.
