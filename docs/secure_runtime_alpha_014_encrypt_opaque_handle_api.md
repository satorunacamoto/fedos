# Secure Runtime Alpha 014 — Public Runtime encrypt() API (Opaque Handle Edition)

Stage 1009. Adds `AppRuntime.encrypt()` — the THIRD public Crypto API
Runtime exposes, and the FIRST performing a real cryptographic
OPERATION (as opposed to randomness/key generation). Built directly
against Alpha 013's opaque `AeadKeyHandle`: `encrypt()` accepts ONLY an
opaque handle, never a raw `Uint8Array` key, honoring the sequencing
Alpha 010/012 both committed to ("migrate the key boundary before
`encrypt()`/`decrypt()` are implemented").

This Stage implements `encrypt()` only. `decrypt()`/`importKey()`/
`exportKey()` remain unimplemented, per this arc's own established
"one operation, one Stage" discipline.

## Scope

**Allowed and done:** two new `#[wasm_bindgen]` items in `lib.rs`
(`AeadCiphertextHandle` opaque class + `encrypt_aead()` wrapper), a
`#[wasm_bindgen]` annotation added to the existing `FedosAeadAlgorithm`/
`FedosAeadAadDomain` public label enums, a new `pub(crate) fn inner()`
accessor on `AeadKeyHandle` (Stage 1008's own doc comment already
anticipated this), a new Loader-level method
(`FedosWasmLoaderSkeleton.attemptDevOnlyEncryptCall()`), a new Runtime
Service file (`fedos_runtime_encrypt.ts`), a new Public Runtime API
field (`AppRuntime.encrypt()`), docs, tests.

**Forbidden and not done:** `decrypt()`, `importKey()`, `exportKey()`,
Secure Storage, Worker connection, Production connection,
`initializeCrypto()`/`runtimeCapabilities()`/`randomBytes()`/
`generateAeadKey()` changes, any change to `fedos_encrypt()`'s own
algorithm/implementation, any raw key or raw ciphertext byte returned
or accepted anywhere in the new surface, `package.json` changes, a
decided Ciphertext wire-format design.

## The four layers

```
AppRuntime.encrypt()                                  Public Runtime API
    |                                                  (create_runtime.ts / types.ts)
    v
attemptDevOnlyRuntimeEncrypt()                         Runtime Service
    |                                                  (fedos_runtime_encrypt.ts)
    v
FedosWasmLoaderSkeleton.attemptDevOnlyEncryptCall()     Rust Boundary reach
    |                                                  (fedos_wasm_loader.ts)
    v
encrypt_aead()                                          Rust Boundary
    |                                                  (lib.rs, wasm_bindgen)
    v
fedos_encrypt()                                         Internal Rust
                                                        (lib.rs, Stage 166-176, UNCHANGED)
```

### Public Runtime API

```ts
AppRuntime.encrypt(
  key: AeadKeyHandle,
  algorithm: AeadAlgorithm,
  aadDomain: AeadAadDomain,
  plaintext: Uint8Array,
): Promise<AeadCiphertextHandle | null>
```

`AeadAlgorithm = "ChaCha20Poly1305" | "Aes256Gcm"`;
`AeadAadDomain = "RootKey" | "Identity" | "Storage" | "Conversation" | "TestOnly"` —
hand-declared TS unions, deliberately NOT imported from any generated
glue type (none is ever committed to this repository). The Rust
Boundary reach translates each label to `lib.rs`'s own numeric
discriminant (fixed by `FedosAeadAlgorithm`/`FedosAeadAadDomain`'s own
declaration order), verified against the real generated `.d.ts` during
this Stage's own build-and-inspect step.

### Opaque Handle only — key in, ciphertext out

`key` MUST be an opaque `AeadKeyHandle` (Stage 1008) — there is no code
path anywhere in this Stage's new files that accepts, constructs, or
derives a key from raw bytes. The return value is likewise an opaque
`AeadCiphertextHandle` (this Stage's own new type), mirroring
`AeadKeyHandle` exactly:

```ts
export interface AeadCiphertextHandle {
  readonly kind: "AeadCiphertextHandle";
}
```

**Why an Opaque Ciphertext Handle, not raw bytes.** This arc's own
earlier encrypt-boundary review compared three candidates for the
Ciphertext boundary — `Uint8Array`, an Opaque Class, and JSON — and
found `Uint8Array`/JSON both require writing a not-yet-existing Rust
serialization encoder (and likely a new production dependency), while
an Opaque Class is buildable today with ZERO serialization work,
matching the SAME opaque-handle discipline this arc just finished
applying to the key boundary. Choosing it here keeps `encrypt()`'s
first version symmetric with `generateAeadKey()` — no raw key byte in,
no raw ciphertext byte out — and does not foreclose a future,
separately-reviewed Stage from deciding the Ciphertext boundary's real
wire format (needed only once `decrypt()`, storage, or transport
actually requires bytes to cross a real boundary). This is a
deliberate, Alpha-limited choice, not a final design.

### Rust Boundary

```rust
#[wasm_bindgen]
pub struct AeadCiphertextHandle {
    inner: FedosCiphertextEnvelope,
}

#[wasm_bindgen]
impl AeadCiphertextHandle {
    #[wasm_bindgen(getter)]
    pub fn kind(&self) -> String {
        "AeadCiphertextHandle".to_string()
    }
}

#[wasm_bindgen]
pub fn encrypt_aead(
    key: &AeadKeyHandle,
    algorithm: FedosAeadAlgorithm,
    aad_domain: FedosAeadAadDomain,
    plaintext: &[u8],
) -> Option<AeadCiphertextHandle> {
    let decision = fedos_encrypt(algorithm, key.inner(), aad_domain, plaintext);
    match decision.status {
        FedosEncryptStatus::Ready => decision
            .envelope
            .map(|envelope| AeadCiphertextHandle { inner: envelope }),
        _ => None,
    }
}
```

`AeadCiphertextHandle` mirrors `AeadKeyHandle` (Stage 1008) exactly:
private `inner` field (no modifier — unreadable/unconstructible outside
this crate's defining module), derives nothing, exposes exactly one
method (`kind`), no constructor, no raw-byte getter, no
`serialize`/`toBytes`-shaped method. The ONLY way to obtain one is
`encrypt_aead()`.

`encrypt_aead()` takes `key: &AeadKeyHandle` — a REFERENCE, so the
caller's own handle is never consumed/dropped by one call and remains
valid for a later call. Reaches the real, permanently-opaque
`FedosAeadKeyHandle` via a NEW `pub(crate) fn inner()` accessor on
`AeadKeyHandle` — Stage 1008's own doc comment already named this exact
addition as the anticipated next step. Calls the pre-existing,
byte-for-byte UNCHANGED `fedos_encrypt()` EXACTLY ONCE. On ANY
non-`Ready` `FedosEncryptStatus` (`InvalidKey`/`NonceUnavailable`/
`InternalFailure`), returns `None` — the SAME null-on-any-non-success
pattern `random_bytes_32()`/`generate_aead_key_handle()` already
established, collapsing three distinct Rust-side failure causes into
one Fail-Closed result.

`FedosAeadAlgorithm`/`FedosAeadAadDomain` gain a `#[wasm_bindgen]`
annotation — a pure export-surface change (wasm-bindgen's own
long-standing native support for fieldless/C-style enums) that adds no
new variant and changes no existing conversion logic
(`fedos_aead_algorithm_to_internal`/`fedos_aead_aad_domain_to_internal`
are untouched). Declaration order fixes each wire discriminant
(`ChaCha20Poly1305 = 0`/`Aes256Gcm = 1`;
`RootKey = 0`/`Identity = 1`/`Storage = 2`/`Conversation = 3`/`TestOnly = 4`),
which `fedos_wasm_loader.ts` hand-maps to the same numeric values.

`fedos_encrypt()` (Stage 166–176) — UNCHANGED, byte-for-byte. This
Stage adds no line to this function.

### Rust Boundary reach

`FedosWasmLoaderSkeleton.attemptDevOnlyEncryptCall(key, algorithm, aadDomain, plaintext)`
— gated on the SAME six previously-recorded conditions every other Rust
Boundary reach method uses. Adds ONE new check no prior Crypto API
needed: BEFORE even checking whether `module.encrypt_aead` exists, `key`
is validated structurally via `isAeadKeyHandleShape()` (the SAME
validator `generate_aead_key_handle()`'s own reach already introduced,
Stage 1008) — an obviously-wrong `key` (not a genuine `AeadKeyHandle`)
never reaches the WASM call at all, resolving `reason:
"InvalidKeyHandle"`. Once `key` is confirmed valid, the same
"absent export / thrown error / genuine `undefined` / wrongly-shaped
return / genuine success" five-way split every prior Rust Boundary
reach method already uses applies here too, with a ciphertext-specific
name for each: `"EncryptUnavailable"` (export absent),
`"CallFailed"` (thrown), `"EncryptionFailed"` (genuine `undefined` —
Rust's own three failure causes collapsed), `"InvalidCiphertextShape"`
(genuine but wrongly-shaped return), `"Succeeded"` (genuine handle).

### Runtime Service

`fedos_runtime_encrypt.ts` (NEW file) — mirrors
`fedos_runtime_aead_key_generation.ts` (Stage 1008) exactly:
`attemptDevOnlyRuntimeEncrypt()` constructs a FRESH `FedosWasmLoader`
and drives it through the same four-step chain; `encrypt()` wraps that
call in `try`/`catch` — Fail Closed at the Runtime Service boundary, on
top of the Loader's own already-Fail-Closed chain.

## Fail Closed

Every layer Fails Closed independently:

- **Not Development Runtime / artifact missing / import failed / WASM
  initialization failed**: the SAME six-condition gate every prior
  Crypto API uses; `encrypt_aead` is never even read. Resolves `null`.
- **`key` is not a genuine opaque handle** (`InvalidKeyHandle`): checked
  BEFORE the wasm call is attempted at all. Resolves `null`.
- **Wrapper not present** (`EncryptUnavailable`): resolves `null`.
- **Rust call throws** (`CallFailed`): resolves `null` — no exception
  ever escapes this layer.
- **Rust declines to encrypt** (`EncryptionFailed` — `InvalidKey`/
  `NonceUnavailable`/`InternalFailure` all collapsed): resolves `null`.
- **Return value is not a genuine ciphertext handle**
  (`InvalidCiphertextShape`): resolves `null`.
- **Exception anywhere in the Loader chain**: `encrypt()`'s own
  `try`/`catch` (Runtime Service boundary) converts it to `null` — no
  exception ever escapes past the Public Runtime API.

Verified: against this repository's own real, unmocked state (no
locally-generated JS glue committed), `encrypt()` resolves `null`. An
injected-loader test drives a genuine opaque-ciphertext-handle success
end to end, plus every Fail-Closed outcome above (including six
distinct wrongly-shaped `key`/return values). Production/Unknown
Runtime Fail Closed even with a real, handle-returning mock present.

## Raw key/ciphertext material is never exposed — verified, not assumed

- `AeadCiphertextHandle` (Rust) derives nothing and exposes exactly one
  method, `kind` — no raw-byte getter, no `AsRef<[u8]>`, no
  `Serialize`.
- `AeadCiphertextHandle` (TypeScript) declares exactly one field,
  `kind` — no `bytes`/`ciphertext`/`nonce`/`export*`/`serialize*` field,
  no `toJSON`/`toString` override.
- `encrypt_aead()` never reads a byte out of `key` beyond calling
  `key.inner()` (a reference pass-through, not a copy) and never reads
  a byte out of the resulting envelope before wrapping it.
- No layer in this Stage's own new/changed code reads, copies, logs, or
  serializes a raw key or ciphertext byte anywhere.

## Unchanged, confirmed by real calls

- `AppRuntime.initializeCrypto()` — still `{ allowed: false, initialized:
  false, reason: "PrototypeDisabled" }`, byte-for-byte.
- `AppRuntime.runtimeCapabilities()` — still exactly its Alpha 005 four
  fields.
- `AppRuntime.randomBytes()` — unaffected; constructs its own,
  entirely separate `FedosWasmLoader` instance.
- `AppRuntime.generateAeadKey()` — unaffected; still resolves an opaque
  `AeadKeyHandle` (or `null`), unchanged since Stage 1008.
- `FedosWasmLoader`'s seven Plan interfaces — untouched.
- Worker (`src/worker.ts`) — no reference to `encrypt`,
  `attemptDevOnlyRuntimeEncrypt`, `attemptDevOnlyEncryptCall`,
  `fedos_runtime_encrypt`, `encrypt_aead`, `fedos_encrypt`,
  `AeadCiphertextHandle`, or `AeadKeyHandle` anywhere.
- Production — no new environment branch, no new deploy-time wiring.
- `decrypt()`/`importKey()`/`exportKey()` — none implemented anywhere
  in this Stage.
- `Cargo.toml`/`package.json` — no new dependency.

## What comes after

`decrypt()` remains its own, later, SEPARATE Stage, per this arc's own
earlier reaffirmed recommendation (`encrypt()` first, since `decrypt()`
consumes exactly the types `encrypt()`'s own Stage settles). A future
Stage may also decide the Ciphertext boundary's real wire format (if
storage or transport ever needs real bytes), and may add `importKey()`/
`exportKey()` on their own separate merits — neither is scheduled or
foreclosed by this Stage.
