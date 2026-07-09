# Secure Runtime Alpha 010 — Public Runtime AEAD Key Generation API

Stage 1005. Per `docs/secure_runtime_alpha_009_encrypt_api_surface_review.md`'s
own recommendation, adds the SECOND public Crypto API — `AppRuntime.generateAeadKey()`
— mirroring `randomBytes()`'s (Stage 1004) four-layer architecture
exactly, one layer at a time, for `fedos_generate_aead_key_32()` (Stage
171–176, UNCHANGED). This is the prerequisite Alpha 009 identified:
`encrypt()` itself remains unimplemented, and cannot be safely
implemented until a future arc resolves the opaque key-handle and
ciphertext-envelope questions Alpha 009 left open.

## Scope

**Allowed and done:** a new, narrowly-scoped `SecretHandle` accessor
(`expose_bytes_for_internal_wasm_export`, mirroring the crate's own
existing one-accessor-per-consumer convention); a new Rust Boundary
wrapper (`generate_aead_key_32`, `#[wasm_bindgen]`); a new Loader-level
method (`FedosWasmLoaderSkeleton.attemptDevOnlyAeadKeyGenerationCall()`);
a new Runtime Service file (`fedos_runtime_aead_key_generation.ts`); a
new Public Runtime API field (`AppRuntime.generateAeadKey()`); docs;
tests.

**Forbidden and not done:** `encrypt()`, `decrypt()`, `importKey()`,
`exportKey()`, Secure Storage, key persistence of any kind, a decided
key-handle design, any change to `fedos_generate_aead_key_32()`'s own
algorithm/implementation, Worker connection, Production connection,
`initializeCrypto()` changes, `runtimeCapabilities()` changes,
`randomBytes()` changes, `package.json` changes.

## The four layers

```
AppRuntime.generateAeadKey()                                Public Runtime API
    |                                                        (create_runtime.ts / types.ts)
    v
attemptDevOnlyRuntimeAeadKeyGeneration()                     Runtime Service
    |                                                        (fedos_runtime_aead_key_generation.ts)
    v
FedosWasmLoaderSkeleton.attemptDevOnlyAeadKeyGenerationCall() Rust Boundary reach
    |                                                        (fedos_wasm_loader.ts)
    v
generate_aead_key_32()                                        Rust Boundary
    |                                                        (lib.rs, #[wasm_bindgen])
    v
fedos_generate_aead_key_32()                                  Internal Rust
                                                                (lib.rs, Stage 171-176, UNCHANGED)
```

### Public Runtime API

`AppRuntime.generateAeadKey(): Promise<Uint8Array | null>` (`types.ts`,
`create_runtime.ts`). Resolves either 32 real, CSPRNG-drawn key bytes or
`null` — never a partial/zeroed/degraded result, never a thrown
exception.

### Runtime Service

`fedos_runtime_aead_key_generation.ts` — a NEW file, mirroring
`fedos_runtime_random_bytes.ts`'s own `attemptDevOnlyRuntimeRandomBytes()`
(Stage 1004) exactly. `attemptDevOnlyRuntimeAeadKeyGeneration()`
constructs a FRESH `FedosWasmLoader`, drives it through `planLoad()` ->
`attemptDevOnlyJsGlueImport()` -> `attemptDevOnlyWasmInitialization()`
-> `attemptDevOnlyAeadKeyGenerationCall()`, then reads back
`succeeded`/`keyBytes`. The exported `generateAeadKey()` wraps that call
in `try`/`catch` — Fail Closed at the Runtime Service boundary, on top
of the Loader's own already-Fail-Closed six-condition chain.

### Rust Boundary reach

`FedosWasmLoaderSkeleton.attemptDevOnlyAeadKeyGenerationCall()`
(`fedos_wasm_loader.ts`) — mirrors `attemptDevOnlyRandomBytesCall()`
(Stage 1004) exactly: gated on the SAME six previously-recorded
conditions. Checks, at runtime, only
`typeof module.generate_aead_key_32 === "function"`; calls it with no
argument inside `try`/`catch`. A genuine `Uint8Array` return resolves
`succeeded: true`; a genuine `undefined` return (Rust's own
`EntropySourceUnavailable`) resolves `reason: "EntropySourceUnavailable"`
— not `"CallFailed"`, since nothing threw; any thrown error resolves
`"CallFailed"`.

### Rust Boundary

`generate_aead_key_32()` (`lib.rs`, `#[wasm_bindgen]`) — a thin wrapper.
Calls `fedos_generate_aead_key_32()` EXACTLY ONCE and, on success,
unwraps the returned opaque `FedosAeadKeyHandle` back into raw bytes via
a NEW, narrowly-scoped `SecretHandle` accessor,
`expose_bytes_for_internal_wasm_export()` — the crate's FOURTH such
accessor, mirroring the exact convention Stage 147 (`kdf_core`), Stage
152–154 (`aead_internal`), and Stage 199 (`conversation_key`) already
established: each new consumer gets its own narrowly-named accessor,
never a generic `expose()`. The local `[u8; 32]` copy is zeroized
immediately after conversion to `Vec<u8>` (`wasm-bindgen` maps this to
`Uint8Array | undefined`). No new entropy source, no new algorithm — the
32 bytes are the exact same bytes `fedos_generate_aead_key_32()` itself
already draws via `getrandom::fill`, verified against the real generated
`.d.ts` during this Stage's own build-and-inspect step.

### Internal Rust

`fedos_generate_aead_key_32()` (`lib.rs`, Stage 171–176) — UNCHANGED,
byte-for-byte. Calls `getrandom::fill` into a `[u8; 32]` staging buffer,
zeroizes that buffer once its own `SecretHandle` takes its copy, and
returns the result wrapped in the opaque `FedosAeadKeyHandle`. This
Stage adds no line to this function.

## This is NOT a key-handle design, and NOT Secure Storage

This Stage is explicitly **Alpha-limited**:

- **Not an opaque key handle.** `fedos_generate_aead_key_32()` already
  returns an opaque `FedosAeadKeyHandle` on the Rust side — this Stage's
  own wrapper deliberately unwraps it back into raw bytes before
  crossing the WASM boundary, because Alpha 009 found no decided
  cross-boundary shape for the handle itself (see
  `docs/secure_runtime_alpha_009_encrypt_api_surface_review.md` §3–§4).
  Raw bytes are a conscious, temporary substitute — not the intended
  final design.
- **Not Secure Storage.** Nothing this Stage adds writes a key to disk,
  `localStorage`, `sessionStorage`, `indexedDB`, or any storage backend.
  `generateAeadKey()` returns a plain, transient `Uint8Array`; the
  caller is solely responsible for whatever it does with it.
- **Key material handling is Alpha-only.** The Rust-side local copy
  (`[u8; 32]`) is zeroized immediately after conversion, but the
  *returned* `Vec<u8>`/`Uint8Array` is, by design, raw application data
  once it crosses into JS — this crate cannot zeroize memory it no
  longer owns. No line of Runtime code introduced by this Stage retains
  a copy of any key beyond one `generateAeadKey()` call's own `await`
  chain.
- **Future migration planned.** A future arc is expected to replace
  this raw-bytes shape with an opaque, `#[wasm_bindgen]`-exported
  key-handle class — the direction Alpha 009 itself recommended — before
  `encrypt()`/`decrypt()` are implemented. That migration is NOT
  attempted here; this Stage exists only to unblock it by resolving the
  simpler of Alpha 009's two open questions first.

## Fail Closed

Every layer Fails Closed independently, matching `randomBytes()`'s own
guarantees exactly:

- **Rust**: `fedos_generate_aead_key_32()` returns `None` on CSPRNG
  failure — never panics, never returns zeroed/predictable bytes.
- **Rust Boundary**: `generate_aead_key_32()` propagates `None` as
  `undefined` — no default substitution; the `?` operator short-circuits
  on either the key or the byte-exposure step failing.
- **Loader**: any of the six pre-conditions unmet, the export absent, or
  the call throwing all resolve `keyBytes: null` — never a partial
  result.
- **Runtime Service**: `generateAeadKey()`'s own `try`/`catch` ensures
  NO exception — synchronous or asynchronous, from any layer below —
  ever escapes past the Public Runtime API. A caller only ever sees
  `Uint8Array` or `null`.

Verified live: with `NODE_ENV=development` and the real, locally-built
WASM artifact present, `generateAeadKey()` resolved 32 real, distinct
key bytes on two successive calls. With `NODE_ENV=production` (or
unset), it resolved `null` — the Loader's Development Runtime gate is
unmet, so `generate_aead_key_32()` is never called.

## Unchanged, confirmed by real calls

- `AppRuntime.initializeCrypto()` — still `{ allowed: false, initialized:
  false, reason: "PrototypeDisabled" }`, byte-for-byte.
- `AppRuntime.runtimeCapabilities()` — still exactly its Alpha 005 four
  fields, never reading or read by `generateAeadKey()`'s own control
  flow.
- `AppRuntime.randomBytes()` — still resolving genuine random bytes
  independently; `generateAeadKey()` constructs its OWN, entirely
  separate `FedosWasmLoader` instance and never reuses
  `randomBytes()`'s own.
- `FedosWasmLoader`'s seven Plan interfaces — untouched.
- Worker (`src/worker.ts`) — no reference to `generateAeadKey`,
  `fedos_runtime_aead_key_generation.ts`, `generate_aead_key_32`,
  `fedos_generate_aead_key_32`, `FedosAeadKeyHandle`, or
  `attemptDevOnlyAeadKeyGenerationCall` anywhere.
- Production — no new environment branch, no new deploy-time wiring.
- `encrypt()`/`decrypt()` — neither is implemented anywhere in this
  Stage; `fedos_encrypt`/`fedos_decrypt` remain unreferenced by every
  new file this Stage adds.
- `Cargo.toml`/`package.json` — no new dependency; `generate_aead_key_32()`
  uses only `getrandom`/`zeroize` (already Stage 137/171–176
  dependencies) via the pre-existing `fedos_generate_aead_key_32()`.

## What comes after

Per Alpha 007/009's own ranking, `encrypt()`/`decrypt()` remain the
recommended next Public API additions once a future arc resolves the two
open type-boundary questions Alpha 009 named (the key handle's own
cross-boundary shape, and the ciphertext envelope's own serialization
plan) — this Stage deliberately does not attempt either.
