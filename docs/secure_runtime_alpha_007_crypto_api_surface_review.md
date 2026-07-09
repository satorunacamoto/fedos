# FedOS Secure Runtime Alpha 007 — Crypto API Surface Review

**Status: REVIEW ONLY. No code change of any kind — Runtime,
`FedosWasmLoader`, `create_runtime.ts`, `initializeCrypto()`,
`runtimeCapabilities()`, Worker, Production, Rust, Cargo,
package.json, and Diagnostics are all byte-for-byte unchanged. This
document resumes Alpha 001's own §3 item 3 ("Crypto API Surface"),
deferred through Alpha 002–006 while Runtime state-model hygiene was
resolved, and reviews what FedOS Secure Runtime should eventually
expose as its public cryptographic API — and, just as importantly,
what it should never expose at all.**

## 0. What the Rust crate already has — 28 `pub fn`, classified

`packages/fedos-core-rust/src/lib.rs` currently has 28 `pub fn`, only
ONE of which (`version()`) carries `#[wasm_bindgen]` and is therefore
JS-reachable today. Classified by what they actually do:

**Legacy placeholders (6)** — `fedos_core_status`,
`fedos_core_capabilities`, `random_bytes_placeholder`,
`derive_key_placeholder`, `encrypt_placeholder`, `decrypt_placeholder`.
Stage-69 skeleton functions, superseded by later real implementations
below. Return fixed, non-functional status labels. Should **never**
be exposed — they exist only as the crate's earliest scaffolding.

**Boundary status/descriptor/policy labels (16)** —
`fedos_crypto_boundary_status`, `fedos_random_boundary_status`,
`fedos_nonce_boundary_status`, `fedos_key_generation_boundary_status`,
`fedos_key_import_boundary_status`, `fedos_key_export_boundary_status`,
`fedos_capability_descriptors`, `fedos_algorithm_descriptors`,
`fedos_boundary_version`, `fedos_boundary_features`,
`fedos_boundary_policy_decision`,
`fedos_key_format_descriptor_placeholder`,
`fedos_key_usage_descriptor_placeholder`,
`fedos_algorithm_requirements`, `fedos_algorithm_capabilities`,
`fedos_algorithm_policy_decision`. Rust-INTERNAL self-description —
useful for Rust's own test suite and documentation, not meaningful to
a JS caller 1:1. A JS-facing capability surface should SYNTHESIZE its
own report (e.g. a future `runtimeCapabilities()` field), never expose
these enums directly.

**Real cryptographic operations, already implemented and tested (5)**
— `fedos_random_bytes_32` (OS CSPRNG, 32 bytes), `fedos_aead_nonce_96`
(OS CSPRNG, 96-bit AEAD nonce), `fedos_generate_aead_key_32` (OS
CSPRNG, 32-byte AEAD key), `fedos_encrypt`/`fedos_decrypt` (real AEAD,
tested against NIST CAVP vectors). These are the PRIME candidates for
future, one-at-a-time `#[wasm_bindgen]` exposure — the actual value
this whole crate exists to deliver.

**Proof-of-boundary (1)** — `version()` (Stage 986), already exposed,
the template every future exposure should follow.

**Real internal groundwork NOT yet `pub fn`** — `kdf_core`,
`hkdf_bridge`, `conversation_key`, `message_key` (all `pub(crate)`,
`packages/fedos-core-rust/src/crypto.rs`) implement real HKDF-based
key derivation and ECDH internally, tested, but not callable from
outside the crate at all today — the crate has NO public key-derivation
or signature primitive yet, only AEAD and randomness.

## 1. Public API — what `AppRuntime` should eventually expose directly

A small, curated, VERB-shaped set an application developer calls
directly — never a 1:1 mirror of Rust's own function names or types.
Candidate operations (from the user's own example list): `randomBytes()`,
`encrypt()`, `decrypt()`, `deriveKey()`, `hash()`, `sign()`, `verify()`.
Each candidate must be Fail-Closed gated exactly like
`runtimeCapabilities()` and `initializeCrypto()` already are, and must
return application-meaningful types (bytes, strings, booleans) —
never a Rust struct, a WASM handle, or anything the caller could use
to reach past the intended boundary.

**NOT every Rust-side primitive belongs at this layer.** `generateKey`/
`importKey`/`exportKey` (also in the user's candidate list) need
careful scoping BEFORE exposure: "generate a key" is safe to expose as
an opaque, non-extractable capability; "export a key" as RAW BYTES is
a fundamentally different, much higher-stakes operation that may
never belong on a public, general-purpose surface without its own
dedicated, separately-reviewed Stage (see §6).

## 2. Internal Runtime API — Runtime-internal only, never public

The existing Planning Chain (Facade → Backend Abstraction → Backend
Interface → Backend Resolver → WASM Backend Planning →
`FedosWasmLoader`) and the Execution Chain
(`attemptDevOnlyJsGlueImport`/`attemptDevOnlyWasmInitialization`/
`attemptDevOnlyRustVersionCall`/`attemptDevOnlyRuntimeRustIntegration`)
both stay exactly here — internal orchestration and wiring, never
exposed directly to an application. `runtimeCapabilities()` is a
special case: it IS public, but only ever REPORTS reachability, never
EXECUTES an operation — it belongs to the Public API layer as a
reader, not as the operation surface itself.

## 3. Rust Boundary — what only Rust should ever own

**AEAD** (encrypt/decrypt), **RNG** (random bytes, nonce, key
generation), **KDF** (key derivation), **Hash**, **Signature**
(sign/verify). This is not aspirational — AEAD and RNG are ALREADY
real, tested Rust code today (§0); KDF groundwork exists internally;
Hash and Signature do not yet exist as real implementations at all.
Every one of these primitives belongs in Rust for the same reason
`version()` does: Rust is the ONE place this arc has ever trusted with
actual cryptographic computation — JS/WASM glue code is orchestration,
never computation.

## 4. What JS-side code is responsible for

**Capability** (reporting what's reachable — `runtimeCapabilities()`'s
own role), **Policy** (deciding whether an operation is currently
allowed — the Dual-Lock Activation Gate, Fail-Closed evaluation),
**Fail Closed** (defaulting to denied/absent, never assuming success),
**State** (`runtimeMode`, environment classification), **Permission**
(any future authorization/authentication check gating a real
operation). JS orchestrates WHETHER and WHEN to call Rust and how to
report the outcome — it must never perform the cryptographic
computation itself, and never hold key material longer than the
single call it's brokering.

## 5. What gets handed to Rust

**Key generation, encryption/decryption, random/nonce generation, key
derivation, hashing, and signing/verification** — i.e. every operation
listed in §3. JS passes INPUT (plaintext, a public key, a domain
label) and receives OUTPUT (ciphertext, a boolean, a derived key
handle) — it never implements any part of the operation itself, and
never inspects intermediate cryptographic state.

## 6. What is NEVER publicly exposed

- Raw memory (`WebAssembly.Memory`, any `ArrayBuffer` view into WASM
  linear memory).
- Raw pointers (any `(ptr, len)` pair the generated JS glue uses
  internally to marshal strings/bytes).
- The `WebAssembly.Instance`/`WebAssembly.Module` themselves.
- The Generated JS Glue module object (`jsGlueModule()`'s own return
  value, Stage 961 — already documented as "never inspected, never
  destructured, never called" beyond the Loader's own internal use).
- `InitOutput`/memory/instance from any WASM initialization call
  (already never retained anywhere in this arc, Stage 969).
- The Internal Loader (`FedosWasmLoaderSkeleton`'s own private state
  and methods not part of the `FedosWasmLoader` interface).
- The Internal Plan objects (all seven `FedosWasmLoader*Plan`
  interfaces — Planning-Chain-only, never meaningful outside it).
- Raw key material as exportable bytes, by default — any future
  `exportKey()`-shaped operation needs its OWN, separately-reviewed
  Stage, never bundled into an initial Crypto API Surface rollout.
- The 22 non-operational Rust functions named in §0 (placeholders and
  boundary-status labels) — internal to Rust, never meaningful 1:1 to
  a JS caller.

## 7. Should all 28 `pub fn` be exposed, or should there be a layered boundary?

**Comparison:**

- **Expose all 28 `pub fn` via `#[wasm_bindgen]`** — rejected. Most of
  the 28 (§0) are Rust-internal labels or dead placeholders with no
  meaning to a JS caller; exposing them would leak Rust's own internal
  architecture through the WASM boundary, the exact opposite of what
  `docs/fedos_core_public_api_design.md`'s own layered design has
  always intended, and would make the JS-reachable surface grow in
  lockstep with Rust's own internal refactors rather than staying a
  small, deliberately-curated contract.
- **A layered boundary** — recommended (see §8). Matches the ONE
  precedent this arc has already set: `version()` is the crate's 28th
  `pub fn` but its FIRST `#[wasm_bindgen]`-annotated one — the crate
  has ALREADY been operating on a "not everything public in Rust
  becomes public in JS" model since Stage 986; this Phase makes that
  implicit precedent an explicit, named architecture.

## 8. Recommended architecture — four layers

```text
Public Runtime API      (encrypt(), decrypt(), randomBytes(), ... -- curated, Fail-Closed gated, application-facing)
        ↓
Runtime Service         (orchestration -- decides IF/WHEN to call Rust, reports capability/state, applies policy)
        ↓
Rust Boundary            (#[wasm_bindgen]-exposed functions ONLY -- a thin, deliberately small FFI surface, e.g. version() today)
        ↓
Internal Rust            (the full, growing pub fn/pub(crate) implementation -- most of it NEVER crosses into the Rust Boundary layer)
```

Each layer's own responsibility:

1. **Public Runtime API** — what an application developer calls. Never
   exposes Rust/WASM detail of any kind (§6).
2. **Runtime Service** — today's Facade/Backend/Resolver/Loader chain
   plus `runtimeCapabilities()`; the layer that knows FedOS's own
   internal wiring exists, so nothing above it has to.
3. **Rust Boundary** — the curated `#[wasm_bindgen]` surface. Grows
   ONE function at a time, each its own explicitly-reviewed Stage,
   exactly as `version()` was (Stage 986).
4. **Internal Rust** — everything else: the 22 non-operational
   functions in §0, and any future Rust-internal helper that never
   needs to cross the WASM boundary at all.

This directly answers §7: the 28 `pub fn` are an INTERNAL RUST
implementation detail; the Rust Boundary layer's own membership should
stay small and deliberate regardless of how large Internal Rust grows.

## 9. Alpha implementation order — recommended, with reasoning

Refined from the example order against §0's own evidence (what
already has a real, tested Rust implementation versus what would
require NEW Rust work first):

1. **`randomBytes()`** — backed by the ALREADY-implemented, tested
   `fedos_random_bytes_32()`. Closest precedent to `version()` itself:
   one function, one `#[wasm_bindgen]` annotation, minimal new Rust
   code (a thin wrapper, not a new primitive).
2. **`encrypt()` / `decrypt()`** — backed by the ALREADY-implemented,
   NIST-CAVP-tested `fedos_encrypt`/`fedos_decrypt`. The actual value
   proposition of this crate; ready to wrap, not to build from
   scratch.
3. **`deriveKey()`** — internal KDF groundwork (`hkdf_bridge`/
   `kdf_core`) already exists but is not `pub fn` yet; needs a new,
   minimal wrapper function before it can be `#[wasm_bindgen]`-annotated
   — a moderate, well-understood lift.
4. **`hash()`** — NO standalone hash primitive exists in the crate
   today (SHA-2 is used internally only for HKDF); this candidate
   needs a genuinely NEW Rust implementation, not just new exposure,
   and its own review of whether a bare hash is even the right public
   primitive (most real callers want HMAC or KDF output, not raw
   digest bytes).
5. **`sign()` / `verify()`** — no signature-scheme implementation
   exists yet (only ECDH, via `conversation_key`); this is the
   LARGEST lift and the most consequential candidate (signatures are
   authentication-relevant) — deserves its own, later, dedicated
   review once items 1–4 have established the `#[wasm_bindgen]`
   Rust-Boundary-growth pattern at smaller scale.

`generateKey()`/`importKey()`/`exportKey()` are deliberately NOT
ranked — per §1/§6, `exportKey()` in particular needs its own,
separately-reviewed Stage before any implementation work, not a slot
in this ranking.

## 10. What this Phase does NOT do

- Does **not** change any Runtime implementation code.
- Does **not** change `FedosWasmLoader`.
- Does **not** change `create_runtime.ts`.
- Does **not** change `initializeCrypto()`.
- Does **not** change `runtimeCapabilities()`.
- Does **not** change `src/worker.ts`.
- Does **not** change any Production code path.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** change `runtime_crypto_diagnostics.ts`/
  `worker_crypto_diagnostics.ts`.
- Does **not** add any `#[wasm_bindgen]` attribute to any of the 27
  non-`version()` `pub fn`.
- Does **not** implement any of the seven Public API candidates named
  in §1/§9.

## 11. See also

- `docs/secure_runtime_alpha_006_mode_authority_review.md` (Secure
  Runtime Alpha 006) §5 — ranked this review first for Alpha 007.
- `docs/secure_runtime_alpha_001_baseline.md` (Secure Runtime Alpha
  001) §3 — the original Crypto API Surface priority item this
  document resumes.
- `docs/runtime_wasm_rust_export_readiness_review.md` (Prototype
  EXECUTION Phase 008) and `docs/runtime_wasm_rust_version_export.md`
  (Prototype EXECUTION Phase 010) — the `version()`-first,
  one-function-per-Stage precedent §8/§9 both extend.
- `docs/fedos_core_public_api_design.md` — the crate's own original
  layered-boundary intent, now made explicit as a four-layer Runtime
  architecture.
