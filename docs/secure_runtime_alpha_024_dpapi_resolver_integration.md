# FedOS Secure Runtime Alpha 024 — DPAPI Resolver Integration

**Status: IMPLEMENTED.** Wires `WindowsDpapiStorageBackend` (Alpha 023)
into `resolveRuntimeStorageBackend()` for real: Development Runtime on
Windows now resolves the DPAPI backend; every other case (Production/
Unknown Runtime of any platform, or Development Runtime on a
non-Windows platform) resolves `MemoryStorageBackend`, byte-for-byte
unchanged. No Public Runtime API change, no Rust/Cargo/`package.json`
change, no auto-fallback from a failed DPAPI call to Memory.

## 1. Why now

Alpha 021 built the Backend/Resolver seam and deliberately left the
Resolver hardcoded. Alpha 022 reviewed five backend candidates and
decided the switch belongs in the Resolver, reading platform identity
as a separate axis from Runtime Mode. Alpha 023 built and verified
`WindowsDpapiStorageBackend` in isolation, explicitly NOT wiring it in
— "completing the Backend is this Stage's ONLY objective." This Stage
is that deferred wiring: the last of the four Alpha 021→024 arc's own
named next-steps.

## 2. Resolver — before and after

```txt
Before (Alpha 021–023):
  resolveRuntimeStorageBackend() -> ALWAYS MemoryStorageBackend

After (Alpha 024):
  resolveRuntimeStorageBackend()
    -> determineFedosRuntimeMode() !== "Development"?  -> MemoryStorageBackend
    -> determineFedosRuntimePlatform() === "Windows"?  -> WindowsDpapiStorageBackend
    -> otherwise                                        -> MemoryStorageBackend
```

Two independent, pre-existing/newly-added Authorities are read as two
SEPARATE calls, combined with plain `if` logic inside the Resolver —
neither classifier is extended, modified, or merged with the other to
produce this answer.

## 3. Platform判定 — a new, separately-named classifier

`fedos_runtime_platform_authority.ts` adds `determineFedosRuntimePlatform(): "Windows" | "Other"`,
structurally identical in shape to Alpha 020's Runtime Mode Authority
(pure, synchronous, try/catch-wrapped, Fail-Closed-to-a-safe-default)
but on a COMPLETELY SEPARATE axis — reading `process.platform`, never
`process.env`. Per this Stage's own mandate, exactly two buckets exist:
`"Windows"` and `"Other"` — no macOS/Linux-specific value is
introduced.

**This module never imports, reads, or depends on
`fedos_runtime_mode_authority.ts`/`determineFedosRuntimeMode()`, and
vice versa.** Both are classifiers, never authorizers — there is no
`isDpapiAllowed()`/`isWindowsSecure()`/`authorizePlatform()` here,
mirroring Alpha 020 §4's own forbidden-API-shape list.

## 4. Runtime Modeとの責務分離 — confirmed

| | Runtime Mode Authority | Platform Authority |
|---|---|---|
| **Question** | Development / Production / Unknown? | Windows / Other? |
| **Input** | `process.env.NODE_ENV` | `process.platform` |
| **File** | `fedos_runtime_mode_authority.ts` (Alpha 020, unmodified) | `fedos_runtime_platform_authority.ts` (new, this Stage) |
| **Consulted by the Resolver** | Yes — decides whether the REAL DPAPI backend may even be considered | Yes — decides WHICH backend, only once Development is already confirmed |

The Resolver reads both, but never conflates them into a single value
or a single classifier function — `determineFedosRuntimeMode()` is
called first and checked on its own; only if it says `"Development"`
is `determineFedosRuntimePlatform()` even consulted. Each Authority's
own file is completely independent of the other; deleting either one
would not require changing the other's own source.

## 5. Fail Closed — why DPAPI failure never falls back to Memory

**Explicitly forbidden by this Stage's own mandate, and NOT
implemented**: if `WindowsDpapiStorageBackend.store()`/`load()`/
`delete()` fails (DPAPI call failure, `powershell.exe` unavailable,
etc.), the Resolver does NOT catch that failure and retry the same
operation against `MemoryStorageBackend` instead. The failure
propagates exactly as each method's own `RuntimeStorageBackend`
signature already promises — `store()`/`delete()` resolve `false`,
`load()` resolves `null` — precisely like Alpha 023 already documented.

**Why this is the correct choice, not merely the mandated one:**

1. **Silent fallback would hide a real security-relevant fact from the
   caller.** If DPAPI protection genuinely failed and the code silently
   wrote the SAME data into an unprotected, plaintext, in-memory `Map`
   instead, a caller who believed they were getting DPAPI-level
   protection would receive a materially weaker guarantee with NO
   signal that anything different happened. Fail Closed exists
   precisely to prevent this kind of silent downgrade.
2. **A `load()` fallback would be actively incorrect, not merely
   weaker.** `WindowsDpapiStorageBackend` and `MemoryStorageBackend`
   are two SEPARATE backends with two SEPARATE, non-overlapping `Map`
   instances. An entry `store()`d via DPAPI physically does not exist
   in `MemoryStorageBackend`'s own `Map` — there is nothing to "fall
   back" to that would return the CORRECT value; a load-side fallback
   could only ever return `null` (indistinguishable from Fail Closed)
   or, worse, incorrectly report a value that was never actually
   stored under that `id` by that path.
3. **Auto-fallback would make Fail-Closed behavior conditional on
   ambient OS state, which this arc has never allowed.** Every prior
   Fail-Closed decision in this arc (Runtime Mode, Loader gate, Storage
   gate) is a clean binary: allowed or denied, never "denied, but try
   something else automatically." Introducing the first-ever automatic
   cross-backend retry here would be a new category of behavior,
   inconsistent with every other Fail-Closed boundary already
   established.
4. **This Stage's own Resolver is a PICKER, not a RECOVERY mechanism.**
   `resolveRuntimeStorageBackend()`'s entire job is to choose which
   backend object a caller receives BEFORE any call is made — it has no
   visibility into whether a subsequent `store()`/`load()`/`delete()`
   call succeeds, and adding that visibility (to decide whether to
   retry elsewhere) would turn a simple, stateless picker into a
   stateful orchestrator, a significantly larger and riskier surface
   for very little practical benefit given point 1–3 above.

## 6. Memoryを残す理由 — Memory Backend is not legacy, it is the universal default

`MemoryStorageBackend` remains fully present, fully exported, and is
still the resolved backend for the OVERWHELMING majority of real
conditions: every Production/Unknown Runtime call (regardless of
platform), and every Development Runtime call on macOS/Linux/any
non-Windows platform. It is not a deprecated fallback path — it is the
UNIVERSAL default this arc has always needed and will continue to need
for every non-Windows environment, including this project's own
`types: ["@cloudflare/workers-types"]`-flavored ambition beyond
Node-only environments. `fedos_runtime_storage_backend.ts` (its own
file) is untouched by this Stage.

## 7. Regression — confirmed across all combinations

| Runtime Mode | Platform | Resolved backend | Verified |
|---|---|---|---|
| Development | Windows | `WindowsDpapiStorageBackend` | Real round trip on this machine |
| Development | Other (injected) | `MemoryStorageBackend` | Confirmed via platform override |
| Production | Windows | `MemoryStorageBackend` | Confirmed — DPAPI never reached |
| Production | Other | `MemoryStorageBackend` | Confirmed |
| Unknown | Windows | `MemoryStorageBackend` | Confirmed — DPAPI never reached |
| Unknown | Other | `MemoryStorageBackend` | Confirmed |

`storeCiphertext()`/`loadCiphertext()`/`deleteCiphertext()` keep their
exact Public API signatures; `initializeCrypto()`/`runtimeCapabilities()`/
`randomBytes()`/`generateAeadKey()`/`encrypt()`/`decrypt()`/
`exportCiphertext()`/`importCiphertext()` are all byte-for-byte
unchanged.

## 8. What this Stage does NOT do

- Does **not** remove, deprecate, or change `MemoryStorageBackend`'s own
  behavior.
- Does **not** add macOS Keychain, Linux Secret Service, or Browser
  Secure Storage.
- Does **not** add filesystem, registry, SQLite, or IndexedDB
  persistence.
- Does **not** add any fallback from a failed DPAPI call to Memory —
  see §5.
- Does **not** add a new Development/Production gate beyond the
  Runtime Storage Service's own, byte-for-byte-unchanged
  `isDevelopmentRuntimeForCiphertextStorage()`.
- Does **not** add Identity or Network capability of any kind.
- Does **not** add a new Crypto API or a new Storage API surface.
- Does **not** connect a Worker.
- Does **not** connect Production.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** change any Public Runtime API signature.

## 9. See also

- `docs/secure_runtime_alpha_021_storage_backend_abstraction.md`
  (Secure Runtime Alpha 021) — built the Backend Interface/Resolver
  seam this Stage finally uses for a real switch.
- `docs/secure_runtime_alpha_022_storage_backend_selection_policy_review.md`
  (Secure Runtime Alpha 022) — decided the switch belongs in the
  Resolver and that platform/environment must stay two separate reads;
  this Stage implements exactly that design.
- `docs/secure_runtime_alpha_023_windows_dpapi_storage_backend.md`
  (Secure Runtime Alpha 023) — built `WindowsDpapiStorageBackend`,
  unmodified by this Stage.
