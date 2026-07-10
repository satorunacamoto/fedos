# Secure Runtime Alpha 013 — Opaque AEAD Key Handle Migration

Stage 1008. Implements this arc's own Alpha 012 Key Boundary Decision's
adopted candidate: migrates `AppRuntime.generateAeadKey()`'s public
return shape from Alpha 010's raw `Uint8Array` to an opaque
`AeadKeyHandle`, **before** `encrypt()`/`decrypt()` are ever built
against it. This is a **deliberate, one-time breaking change** to
Alpha 010's shipped Public API — the ONLY breaking change Alpha 012
authorized, made at the cheapest possible moment (no real caller of
`generateAeadKey()` exists outside this repository's own tests).

This Stage migrates the **Key Boundary only**. `encrypt()`/`decrypt()`
remain unimplemented — building them against a real opaque handle,
instead of raw bytes, is exactly what this migration unblocks for a
future Stage.

## Scope

**Allowed and done:** a new `#[wasm_bindgen]`-exported opaque class,
`AeadKeyHandle` (wrapping the existing, permanently-opaque
`FedosAeadKeyHandle`); a new Rust Boundary wrapper function,
`generate_aead_key_handle()`, REPLACING Alpha 010's
`generate_aead_key_32()`; removal of the now-unused
`SecretHandle::expose_bytes_for_internal_wasm_export()` accessor (its
sole caller no longer exists); reshaping the Loader's
`FedosWasmLoaderAeadKeyGenerationExecution`/`attemptDevOnlyAeadKeyGenerationCall()`,
the Runtime Service's `RuntimeAeadKeyGenerationState`/`generateAeadKey()`,
and the Public API's `AppRuntime.generateAeadKey` field to all thread
the opaque handle instead of raw bytes; docs; tests.

**Forbidden and not done:** `encrypt()`, `decrypt()`, `importKey()`,
`exportKey()`, Secure Storage, key persistence of any kind, any change
to `fedos_generate_aead_key_32()`'s own algorithm/implementation,
Worker connection, Production connection, `initializeCrypto()`/
`runtimeCapabilities()`/`randomBytes()` changes, `package.json`
changes, any raw-key-byte return value or getter anywhere in the new
surface.

## The four layers, updated

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
generate_aead_key_handle()                                    Rust Boundary
    |                                                        (lib.rs, wasm_bindgen)
    v
fedos_generate_aead_key_32()                                  Internal Rust
                                                                (lib.rs, Stage 171-176, UNCHANGED)
```

Every layer's own name and structure is UNCHANGED from Alpha 010 —
only the TYPE threaded through all four layers changes, from
`Uint8Array` to `AeadKeyHandle`.

### Public Runtime API

`AppRuntime.generateAeadKey(): Promise<AeadKeyHandle | null>`
(`types.ts`, `create_runtime.ts`). Resolves either a genuine opaque
handle or `null` — never a partial/degraded result, never a thrown
exception, and never a raw key byte.

### Opaque Handle design — what is allowed, what is forbidden

`AeadKeyHandle` (`types.ts`, re-exported from
`fedos_runtime_aead_key_generation.ts`) is deliberately minimal:

```ts
export interface AeadKeyHandle {
  readonly kind: "AeadKeyHandle";
}
```

**Allowed:**
- **Existence confirmation** — a caller checks `handle !== null`.
- **Kind confirmation** — `handle.kind === "AeadKeyHandle"`, a FIXED,
  non-secret label, never derived from key material.
- **Holding the value for a future `encrypt()`/`decrypt()` call** — the
  SAME reference `generate_aead_key_handle()` produces is threaded,
  unchanged, through every layer up to the Public Runtime API, so a
  future Stage's `encrypt()` can accept it back directly.

**Forbidden, and verified absent everywhere in this Stage's own new
surface:**
- Raw key bytes, in any field or return value.
- An `exportKey()`-shaped method or any equivalent.
- `serialize`/`toJSON`.
- A `toString()`/`Debug`/`Display` override that would print key
  material (Rust's `AeadKeyHandle` derives nothing at all — no
  `Clone`/`Debug`/`Serialize`).
- Public `.bytes`/`.key`/`.material` fields, or any field beyond `kind`.
- Any path by which raw key material reaches JS.

### Runtime Service

`fedos_runtime_aead_key_generation.ts` — same file, same two exports
(`attemptDevOnlyRuntimeAeadKeyGeneration()`/`generateAeadKey()`), same
control flow. `RuntimeAeadKeyGenerationState.keyBytes: Uint8Array | null`
becomes `keyHandle: AeadKeyHandle | null`. The value is never read,
copied, or destructured here — it is passed through exactly as
received from the Loader.

### Rust Boundary reach

`FedosWasmLoaderSkeleton.attemptDevOnlyAeadKeyGenerationCall()`
(`fedos_wasm_loader.ts`) — mirrors its own Alpha 010 shape exactly,
gated on the SAME six previously-recorded conditions. Checks, at
runtime, only `typeof module.generate_aead_key_handle === "function"`;
calls it with no argument inside `try`/`catch`. The return value is
validated STRUCTURALLY by a new, private `isAeadKeyHandleShape()`
helper — `typeof value === "object" && value !== null && value.kind ===
"AeadKeyHandle"` — never `instanceof` (this file never imports or
references the generated JS glue's own class constructor). A
structurally genuine handle resolves `succeeded: true`; a genuine
`undefined` return (Rust's own `EntropySourceUnavailable`) resolves
`reason: "EntropySourceUnavailable"`; a genuine but WRONGLY-shaped
return (anything else — e.g. a raw `Uint8Array`, a plain `{}`) resolves
a NEW, distinct reason, `"InvalidHandleShape"` — never silently treated
as success, and distinguished from `"CallFailed"` since nothing threw
either way; any thrown error resolves `"CallFailed"`.

### Rust Boundary

Two new items, both `#[wasm_bindgen]`-annotated, in `lib.rs`:

```rust
#[wasm_bindgen]
pub struct AeadKeyHandle {
    inner: FedosAeadKeyHandle,
}

#[wasm_bindgen]
impl AeadKeyHandle {
    #[wasm_bindgen(getter)]
    pub fn kind(&self) -> String {
        "AeadKeyHandle".to_string()
    }
}

#[wasm_bindgen]
pub fn generate_aead_key_handle() -> Option<AeadKeyHandle> {
    let key_handle = fedos_generate_aead_key_32().key?;
    Some(AeadKeyHandle { inner: key_handle })
}
```

`AeadKeyHandle` is the crate's FIRST opaque wasm-bindgen-exported
CLASS — as opposed to a plain function like `version()`/
`random_bytes_32()`. It wraps the EXISTING, permanently-opaque
`FedosAeadKeyHandle` (Stage 171–176, UNCHANGED) with a private `inner`
field — no modifier, so no code outside this crate's own defining
module can read or construct it, the SAME discipline
`docs/public_crypto_opaque_handles.md` already established, now
extended across the WASM boundary itself. Derives nothing (no
`Clone`/`Debug`/`Serialize`). Exposes exactly ONE method, `kind` (a
`#[wasm_bindgen(getter)]`, so it surfaces in JS as a property,
`handle.kind`) — a fixed, non-secret label, never a raw-byte getter, no
`exportKey`-shaped method, and no public constructor. The ONLY way to
obtain an instance is `generate_aead_key_handle()`.

`generate_aead_key_handle()` REPLACES Alpha 010's
`generate_aead_key_32()`. Calls the pre-existing, byte-for-byte
UNCHANGED `fedos_generate_aead_key_32()` EXACTLY ONCE and moves its
`FedosAeadKeyHandle` into the new wrapper — it never reads, copies, or
converts a byte out of it. `fedos_generate_aead_key_32()`'s own doc
comment, behavior, and signature are all untouched by this Stage.

**The now-orphaned accessor is removed, not left dead.**
`SecretHandle::expose_bytes_for_internal_wasm_export()` (Alpha 010's
own fourth narrowly-scoped accessor) existed for exactly ONE caller —
the raw-bytes `generate_aead_key_32()` wrapper. That caller no longer
exists, so the accessor is deleted rather than left as unused surface,
matching this crate's own "narrowly-scoped, one accessor per real
consumer" discipline. `SecretHandle`'s `impl` block returns to NINE
methods (from Alpha 010's ten).

### Internal Rust

`fedos_generate_aead_key_32()` (`lib.rs`, Stage 171–176) — UNCHANGED,
byte-for-byte. This Stage adds no line to this function.

## Fail Closed

Every layer Fails Closed independently, matching `randomBytes()`'s
(Alpha 008) and Alpha 010's own guarantees exactly:

- **Not Development Runtime**: the Loader's own six-condition gate is
  unmet — `generate_aead_key_handle` is never even read; resolves
  `null`.
- **Artifact missing / Import failed / WASM initialization failed**:
  same six-condition gate, same `null` result — no code in this Stage
  adds a new environment check of its own.
- **Wrapper not present** (`typeof module.generate_aead_key_handle !==
  "function"`): resolves `reason: "KeyGenerationUnavailable"`, `null`.
- **Rust call throws**: resolves `reason: "CallFailed"`, `null` — no
  exception ever escapes this layer.
- **Return value is not a genuine opaque handle** (structurally
  verified by `isAeadKeyHandleShape()`): resolves `reason:
  "InvalidHandleShape"`, `null` — a DISTINCT Fail-Closed reason from
  both `"EntropySourceUnavailable"` (Rust's own genuine `undefined`)
  and `"CallFailed"` (a thrown error), since neither actually happened.
- **Exception anywhere in the Loader chain**: `generateAeadKey()`'s own
  `try`/`catch` (Runtime Service boundary) converts it to `null` — no
  exception ever escapes past the Public Runtime API.

Verified: against this repository's own real, unmocked state (no
locally-generated JS glue committed), `generateAeadKey()` resolves
`null`. An injected-loader test drives all five Fail-Closed outcomes
(genuine handle, absent export, thrown error, `undefined` return,
wrongly-shaped return) plus explicit Production/Unknown Runtime
Fail-Closed checks even WITH a real, handle-returning mock present.

## Raw key material is never exposed — verified, not assumed

- `AeadKeyHandle` (Rust) derives nothing and exposes exactly one
  method, `kind` — no raw-byte getter, no `AsRef<[u8]>`, no
  `Serialize`.
- `AeadKeyHandle` (TypeScript) declares exactly one field, `kind` — no
  `bytes`/`key`/`material`/`export*` field, no `toJSON`/`toString`
  override.
- No layer in this Stage's own new/changed code (`fedos_wasm_loader.ts`,
  `fedos_runtime_aead_key_generation.ts`, `types.ts`,
  `create_runtime.ts`, `lib.rs`) reads, copies, logs, or serializes a
  raw key byte — the opaque value is passed through by reference only.
- `generateAeadKey()`'s own real, end-to-end return value is confirmed
  (by this Stage's own guard test) to never be a `Uint8Array`.

## Unchanged, confirmed by real calls

- `AppRuntime.initializeCrypto()` — still `{ allowed: false, initialized:
  false, reason: "PrototypeDisabled" }`, byte-for-byte.
- `AppRuntime.runtimeCapabilities()` — still exactly its Alpha 005 four
  fields.
- `AppRuntime.randomBytes()` — still resolving genuine random bytes
  independently; unaffected by this Stage's own changes.
- `FedosWasmLoader`'s seven Plan interfaces — untouched.
- Worker (`src/worker.ts`) — no reference to `generateAeadKey`,
  `fedos_runtime_aead_key_generation.ts`, `generate_aead_key_handle`,
  `fedos_generate_aead_key_32`, `AeadKeyHandle`, or
  `attemptDevOnlyAeadKeyGenerationCall` anywhere.
- Production — no new environment branch, no new deploy-time wiring.
- `encrypt()`/`decrypt()`/`importKey()`/`exportKey()` — none
  implemented anywhere in this Stage.
- `Cargo.toml`/`package.json` — no new dependency; `generate_aead_key_handle()`
  introduces no new crate dependency.

## What comes after

Per this arc's own Alpha 012 Key Boundary Decision §5 roadmap: a
future Stage builds the minimal `encrypt()` wrapper directly against
this Stage's now-opaque `AeadKeyHandle` — never against raw bytes at
any point. `decrypt()` remains its own, later, SEPARATE Stage, per
Alpha 009 §6/Alpha 011 §6's reaffirmed recommendation.
`importKey()`/`exportKey()` remain explicitly deferred, per Alpha 007.
Secure Storage remains unimplemented and unscheduled.
