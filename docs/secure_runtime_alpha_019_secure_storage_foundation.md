# FedOS Secure Runtime Alpha 019 — Secure Storage Foundation

**Status: IMPLEMENTED.** Adds the minimal Storage layer that makes
`AeadCiphertextWire` (Stage 1011, Secure Runtime Alpha 018) persistable
across separate calls within one Runtime process.
`Cargo.toml`/`package.json`/`packages/fedos-core-rust/src/lib.rs` are
all byte-for-byte unchanged — this Stage needed no Rust change at all.
`encrypt()`, `decrypt()`, `exportCiphertext()`, `importCiphertext()`,
`generateAeadKey()`, `randomBytes()`, `initializeCrypto()`, and
`runtimeCapabilities()` are all byte-for-byte unchanged.

## 1. Public Runtime API

```ts
storeCiphertext(id: string, wire: AeadCiphertextWire): Promise<boolean | null>;
loadCiphertext(id: string): Promise<AeadCiphertextWire | null>;
deleteCiphertext(id: string): Promise<boolean | null>;
```

Wired into `AppRuntime` (`create_runtime.ts`/`types.ts`) as three new,
entirely separate fields, alongside `initializeCrypto`/
`runtimeCapabilities`/`randomBytes`/`generateAeadKey`/`encrypt`/
`decrypt`/`exportCiphertext`/`importCiphertext` — none of which is
modified, called, or read by any of these three new fields' own
implementation.

## 2. Storage restricted to `AeadCiphertextWire` ONLY — `AeadKeyHandle` storage remains forbidden

This is the single hardest constraint this Stage operates under, and it
is enforced at the type level, not merely documented: `storeCiphertext()`'s
own signature accepts `wire: AeadCiphertextWire`, never an
`AeadKeyHandle` — passing one is a compile-time error. No function,
method, or code path in `fedos_runtime_ciphertext_storage.ts` accepts,
stores, returns, or even references an `AeadKeyHandle` in any form.
`docs/public_crypto_opaque_handles.md`/Alpha 007 §6's permanent
exclusion of raw, persistable key material from a general-purpose
surface remains unchanged and unaffected. `exportKey()`/`importKey()`
remain unimplemented and are not made any more reachable by this Stage —
this Stage does not build a key-storage bridge, does not build a
key-export/import pair, and does not open any new path by which a raw
key byte could ever reach a storage backend.

## 3. Architecture — shorter than every prior Crypto API, because there is no Rust Boundary

```
AppRuntime.storeCiphertext()/loadCiphertext()/deleteCiphertext()  Public Runtime API
  |                                                              (create_runtime.ts / types.ts)
  v
storeCiphertext()/loadCiphertext()/deleteCiphertext()             Runtime Storage Service
  |                                                              (fedos_runtime_ciphertext_storage.ts)
  v
RuntimeCiphertextStorage (Storage Interface)                      Storage Interface
  |                                                              (fedos_runtime_ciphertext_storage.ts)
  v
MemoryCiphertextStorage                                          Storage Backend
                                                                   (fedos_runtime_ciphertext_storage.ts, the ONLY backend)
```

Every prior Crypto API in this arc reaches `FedosWasmLoader` and, from
there, a `#[wasm_bindgen]`-exported Rust function. This Stage reaches
NEITHER. By the time an `AeadCiphertextWire` value exists, `exportCiphertext()`
(Stage 1011) has already completed the one and only WASM/Rust round
trip that value ever needs — storing, loading, or deleting a `string`
requires no cryptographic operation, so `packages/fedos-core-rust/src/lib.rs`
gains nothing from this Stage, and adds nothing.

## 4. Storage Interface and the sole `MemoryCiphertextStorage` backend

```ts
export interface RuntimeCiphertextStorage {
  store(id: string, wire: AeadCiphertextWire): Promise<boolean>;
  load(id: string): Promise<AeadCiphertextWire | null>;
  delete(id: string): Promise<boolean>;
}

export class MemoryCiphertextStorage implements RuntimeCiphertextStorage {
  // an in-process Map<string, AeadCiphertextWire>; nothing else.
}
```

`MemoryCiphertextStorage` is the ONLY implementation this Stage ships —
a plain in-process `Map`. Data does NOT survive an actual process
restart, is never written to disk, and is never visible to a Worker or
any other process. SQLite, IndexedDB, filesystem, Windows DPAPI, macOS
Keychain, and Linux Secret Service are all explicitly NOT implemented —
`RuntimeCiphertextStorage` exists precisely so a future, separately
reviewed Stage can add one of those without changing this Stage's own
Public API shape at all.

## 5. Deliberate exception to the "fresh instance per call" convention

Every prior Crypto API's Runtime Service constructs a BRAND NEW
`FedosWasmLoader` on every single call — nothing persists between
calls. Storage's entire purpose is the opposite: `storeCiphertext()` now
and `loadCiphertext()` later must observe the SAME data. This Stage's
default storage (`defaultCiphertextStorage`, a module-level singleton
`MemoryCiphertextStorage`) is therefore shared across every call that
omits the optional `storage` parameter — the one deliberate, documented
departure from this arc's own fresh-instance convention, confined
entirely to `fedos_runtime_ciphertext_storage.ts`.

## 6. Fail Closed

Mirroring `FedosWasmLoaderSkeleton#evaluateDevOnlyGate()`/
`fedos_runtime_prototype_execution.ts`'s own `determineRuntimeMode()`
Fail-Closed try/catch shape exactly (this file's OWN, directly analogous
`process.env.NODE_ENV` read, since there is no `FedosWasmLoader` to
reach for this gate):

| Condition | Result |
|---|---|
| Runtime is not Development (`"production"`, any other value, or an unreadable `process.env`) | `null` |
| `id`/`wire` (for `storeCiphertext`) is not a genuine non-empty `string` | `null` |
| `id` (for `loadCiphertext`/`deleteCiphertext`) is not a genuine non-empty `string` | `null` |
| The storage backend itself throws | `null` |
| Nothing was ever stored under `id`, or it was deleted (`loadCiphertext`) | `null` |
| Every gate/shape check passes and the backend call does not throw | The backend's own `true`/`false`/`AeadCiphertextWire` |

No exception ever escapes `storeCiphertext()`/`loadCiphertext()`/
`deleteCiphertext()` — every storage-backend call is wrapped in
`try`/`catch`.

## 7. Round-trip completion criterion

```
generateAeadKey() -> encrypt() -> exportCiphertext() -> storeCiphertext()
  -> loadCiphertext() -> importCiphertext() -> decrypt()
```

This full chain succeeds, in Development Runtime only, recovering the
exact original plaintext — verified both against a mocked WASM Loader
(this Stage's own guard test) and against a REAL, compiled WASM
artifact (this Stage's own completion report).

## 8. What this Stage does NOT do

- No `exportKey()`/`importKey()` implementation.
- No OS Keychain, Secure Enclave, Cloud, Network, Nostr, ActivityPub,
  Bluesky, or Session connection or reference of any kind.
- No Worker connection — `src/worker.ts` is untouched and contains no
  reference to `storeCiphertext`/`loadCiphertext`/`deleteCiphertext`/
  `fedos_runtime_ciphertext_storage`.
- No Production connection — Production resolves `null` for all three
  new functions, regardless of what `MemoryCiphertextStorage` itself
  would have returned.
- No SQLite, IndexedDB, filesystem, Windows DPAPI, macOS Keychain, or
  Linux Secret Service backend.
- No new Rust function, no new `#[wasm_bindgen]` item, no new
  cryptographic operation of any kind.
- No `Cargo.toml`/`package.json` change — no new dependency.

## 9. Confirmed unchanged

- `AppRuntime.initializeCrypto()`/`runtimeCapabilities()`/`randomBytes()`/
  `generateAeadKey()`/`encrypt()`/`decrypt()`/`exportCiphertext()`/
  `importCiphertext()` — all confirmed unchanged by actual calls.
- `FedosWasmLoader`'s seven Plan interfaces and `planLoad()` — untouched.
- `packages/fedos-core-rust/src/lib.rs` — still 36 `pub fn`, still
  exactly thirteen `#[wasm_bindgen]` occurrences (byte-for-byte
  unchanged from Alpha 018).
- `Cargo.toml`/`package.json` — no new dependency, no count change.
- `exportKey()`/`importKey()` — remain unimplemented.

## 10. What comes after

A real, persistent storage backend (filesystem, IndexedDB, or an OS
Keychain/Secure Enclave-backed one) remains its own, future,
separately-reviewed Stage — `RuntimeCiphertextStorage` is the seam it
would implement. `exportKey()`/`importKey()` remain explicitly deferred,
per Alpha 007 §1/§9 and Alpha 012 §4's original deferral, unaffected by
this Stage. Connecting any of this to Worker, Production, or a network
transport remains its own, future, separately-reviewed Stage.

## 11. See also

- `docs/secure_runtime_alpha_018_ciphertext_wire_export_import_api.md` —
  the `AeadCiphertextWire` value this Stage makes persistable.
- `docs/public_crypto_opaque_handles.md` — the permanent key-material
  exclusion this Stage's §2 reaffirms.
- `docs/secure_runtime_alpha_012_key_boundary_decision.md` — the
  `exportKey()`/`importKey()` deferral this Stage does not revisit.
