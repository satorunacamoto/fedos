# FedOS Secure Runtime Alpha 021 — Storage Backend Abstraction Layer

**Status: IMPLEMENTED.** Extracts Alpha 019's `MemoryCiphertextStorage`
(and its `RuntimeCiphertextStorage` Storage Interface) out of the
Runtime Storage Service (`fedos_runtime_ciphertext_storage.ts`) into two
new modules — a Storage Backend Interface/implementation
(`fedos_runtime_storage_backend.ts`) and a Storage Resolver
(`fedos_runtime_storage_resolver.ts`) — so a future OS-backed Secure
Storage backend can be added without touching the Runtime Storage
Service or any Public Runtime API. No persistent storage is implemented
by this Stage. No new Storage API, no new Crypto API, no Worker/
Production connection, no Rust/Cargo/`package.json` change.

## 1. Why now

Alpha 019 ("Secure Storage Foundation") shipped `MemoryCiphertextStorage`
as the ONE backend the Runtime Storage Service directly defined and
constructed — reasonable at the time, since no second backend existed
and no layered structure was needed yet. Alpha 020 then consolidated
Runtime's environment classification into a single shared Authority.
This Stage does the analogous thing for Storage: before any real
OS-backed backend (Windows DPAPI / macOS Keychain / Linux Secret
Service / SQLite) is ever proposed, separate the Runtime Storage
Service's own Fail-Closed/shape-guard logic from WHICH backend it talks
to, so that a future backend addition is a change to ONE small Resolver
file, not a change to the Service every `AppRuntime.storeCiphertext()`
caller depends on.

## 2. Before → after

```txt
Before (Alpha 019):

  AppRuntime
    |
    v
  fedos_runtime_ciphertext_storage.ts
    (defines RuntimeCiphertextStorage + MemoryCiphertextStorage itself)

After (Alpha 021):

  AppRuntime
    |
    v
  fedos_runtime_ciphertext_storage.ts        Runtime Storage Service
    |                                        (Fail-Closed gate, id/wire shape guard, try/catch)
    v
  resolveRuntimeStorageBackend()             Storage Resolver
    |                                        (fedos_runtime_storage_resolver.ts)
    v
  RuntimeStorageBackend                      Storage Backend Interface
    |                                        (fedos_runtime_storage_backend.ts)
    v
  MemoryStorageBackend                       Storage Backend
                                              (fedos_runtime_storage_backend.ts, the ONLY backend)
```

## 3. Backend Interface — moved and renamed, not redesigned

`RuntimeStorageBackend` (`fedos_runtime_storage_backend.ts`) is
byte-for-byte the same three-method shape Alpha 019's
`RuntimeCiphertextStorage` already defined:

```ts
export interface RuntimeStorageBackend {
  store(id: string, wire: AeadCiphertextWire): Promise<boolean>;
  load(id: string): Promise<AeadCiphertextWire | null>;
  delete(id: string): Promise<boolean>;
}
```

Only the name and the file moved. Still exactly three methods, still no
query/list/enumerate capability, still `AeadCiphertextWire` in/out only
— accepting an `AeadKeyHandle` remains a compile-time error, exactly as
Alpha 019 already established.

## 4. Memory Backend — unchanged behavior, new name

`MemoryStorageBackend` (`fedos_runtime_storage_backend.ts`) is
byte-for-byte the same plain in-process `Map<string, AeadCiphertextWire>`
Alpha 019's `MemoryCiphertextStorage` already was:

```ts
export class MemoryStorageBackend implements RuntimeStorageBackend {
  #entries = new Map<string, AeadCiphertextWire>();
  async store(id, wire) { this.#entries.set(id, wire); return true; }
  async load(id) { const v = this.#entries.get(id); return v === undefined ? null : v; }
  async delete(id) { return this.#entries.delete(id); }
}
```

No field added, no field removed, no method signature changed, no
serialization added. Data still does NOT survive an actual process
restart, is never written to disk, and is never visible to a Worker or
any other process.

## 5. Storage Resolver — the ONE seam for future backend selection

`resolveRuntimeStorageBackend()` (`fedos_runtime_storage_resolver.ts`)
is the single function the Runtime Storage Service calls to obtain a
backend:

```ts
const sharedBackend: RuntimeStorageBackend = new MemoryStorageBackend();
export function resolveRuntimeStorageBackend(): RuntimeStorageBackend {
  return sharedBackend;
}
```

**Currently, and for this Stage only, it is hardcoded to always return
the same `MemoryStorageBackend` singleton.** There is no environment
read, no platform detection, and no switch condition of any kind — this
Stage does not decide HOW a future backend would be selected, only
WHERE that decision will eventually live. A future, separately-reviewed
Stage can add a real switch (e.g. platform detection choosing DPAPI on
Windows, Keychain on macOS, Secret Service on Linux, or SQLite) by
changing ONLY this one function's body — the Runtime Storage Service,
`types.ts`, `create_runtime.ts`, and every `AppRuntime.storeCiphertext()`
caller stay byte-for-byte unchanged when that happens.

**Singleton, not fresh-per-call**: `resolveRuntimeStorageBackend()`
always returns the exact same object, preserving Alpha 019's own
documented exception to this arc's "fresh instance per call" convention
— `storeCiphertext()` now and `loadCiphertext()` later must observe the
SAME data.

## 6. Runtime Storage Service — dependency swap only

`fedos_runtime_ciphertext_storage.ts` no longer defines an interface or
a class. It now imports `type RuntimeStorageBackend` and
`resolveRuntimeStorageBackend` and uses the latter as each exported
function's default parameter:

```ts
export async function storeCiphertext(
  id: string,
  wire: AeadCiphertextWire,
  storage: RuntimeStorageBackend = resolveRuntimeStorageBackend(),
): Promise<boolean | null> { ... }
```

Its own Fail-Closed gate (Development-Runtime-only, via the Secure
Runtime Alpha 020 shared Runtime Mode Authority), its `id`/`wire`
non-empty-string shape guard, and its `try`/`catch` around every
backend call are ALL UNCHANGED — only WHERE the backend instance comes
from changed, from a locally-defined singleton to a Resolver call.

## 7. Public API — completely unchanged

`storeCiphertext(id, wire)`/`loadCiphertext(id)`/`deleteCiphertext(id)`
keep their exact names, exact required-parameter signatures, and exact
return types (`Promise<boolean | null>`/`Promise<AeadCiphertextWire | null>`/
`Promise<boolean | null>`). `AppRuntime`'s own three fields in
`types.ts` are untouched — this Stage did not need to (and did not)
edit their type signatures, only their doc comments (to describe the
Resolver instead of a locally-defined singleton). `create_runtime.ts`'s
own wiring is untouched.

## 8. Fail Closed — unchanged

Exactly as Alpha 019 established: `"Development"` → the resolved
backend runs; `"Production"`/`"Unknown"` → every function resolves
`null`, regardless of what the resolved backend itself would have
returned. This Stage adds no new Fail-Closed condition and removes
none.

## 9. What this Stage does NOT do

- Does **not** implement a persistent Storage Backend of any kind.
- Does **not** add Windows DPAPI, macOS Keychain, Linux Secret Service,
  filesystem, SQLite, IndexedDB, or Cloud storage.
- Does **not** add a backend-selection condition — the Resolver is
  hardcoded to `MemoryStorageBackend` only.
- Does **not** add a new Crypto API or a new Storage API surface beyond
  the Backend Interface/Resolver seam itself.
- Does **not** connect a Worker.
- Does **not** connect Production.
- Does **not** change `MemoryStorageBackend`'s own storage behavior
  (inherited byte-for-byte from Alpha 019's `MemoryCiphertextStorage`).
- Does **not** change encryption/decryption/wire format.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** change any Public Runtime API signature.

## 10. What comes after

A future, separately-reviewed Stage may add a real backend switch
inside `resolveRuntimeStorageBackend()` — for example, platform
detection choosing a real OS-backed backend — and, separately, may
implement one or more of those backends against the SAME
`RuntimeStorageBackend` interface this Stage already fixed. Neither
change would require touching `fedos_runtime_ciphertext_storage.ts`,
`types.ts`, `create_runtime.ts`, or any `AppRuntime.storeCiphertext()`
caller.

## 11. See also

- `docs/secure_runtime_alpha_019_secure_storage_foundation.md` (Secure
  Runtime Alpha 019) — defined `RuntimeCiphertextStorage`/
  `MemoryCiphertextStorage`, the shapes this Stage moved and renamed
  without behavior change.
- `docs/secure_runtime_alpha_020_runtime_mode_authority_consolidation.md`
  (Secure Runtime Alpha 020) — the analogous consolidation for
  environment classification; the Runtime Mode Authority it introduced
  is unchanged and still the sole source of this Service's Fail-Closed
  gate.
