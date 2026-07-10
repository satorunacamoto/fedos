# FedOS Secure Runtime Alpha 020 — Runtime Mode Authority Consolidation

**Status: IMPLEMENTED.** Consolidates the three independent
`process.env.NODE_ENV` classifiers Alpha 006
(`docs/secure_runtime_alpha_006_mode_authority_review.md`) reviewed and
Alpha 019 triggered into ONE shared Runtime Mode Authority
(`src/runtime/fedos_runtime_mode_authority.ts`). No new Storage Backend,
no new Crypto API, no Worker/Production connection, no Rust/Cargo/
`package.json` change.

## 1. The trigger

Alpha 006 named four conditions under which the two (at the time)
independent classifiers — `FedosWasmLoaderSkeleton#evaluateDevOnlyGate()`
and `runtimeCapabilities()`'s own `determineRuntimeMode()` — should be
consolidated instead of kept separate, and deliberately declined to
extract a shared function until one of them became imminent (§4 of that
review). Condition 4 read:

> Before Secure Storage or any new Crypto API branches on `runtimeMode`
> for a real decision — today `runtimeMode` is PURELY informational; the
> moment anything DECIDES based on it, having two potentially-divergent
> sources becomes a genuine Fail-Closed risk, not merely a hygiene one.

Alpha 019 ("Secure Storage Foundation") added
`fedos_runtime_ciphertext_storage.ts`'s own
`isDevelopmentRuntimeForCiphertextStorage()` — a THIRD independent
`NODE_ENV` classifier, and the first one to gate a real Storage
decision (`storeCiphertext()`/`loadCiphertext()`/`deleteCiphertext()`
all resolve `null` outside Development Runtime). That is condition 4,
satisfied. This Phase is the pre-committed extraction Alpha 006 named,
triggered exactly the way it said it would be.

## 2. What was consolidated

```txt
FedosWasmLoaderSkeleton#evaluateDevOnlyGate()          (fedos_wasm_loader.ts, Stage 929)
runtimeCapabilities()'s determineRuntimeMode()          (fedos_runtime_prototype_execution.ts, Stage 999/1001)
isDevelopmentRuntimeForCiphertextStorage()              (fedos_runtime_ciphertext_storage.ts, Stage 1012 / Alpha 019)
```

A repo-wide search confirmed these were the ONLY three places under
`src/` reading `process.env.NODE_ENV` — no other file, in `src/`,
`test/`, or `packages/`, classifies environment.

## 3. The shared Authority

A new file, `src/runtime/fedos_runtime_mode_authority.ts`, exports
exactly two symbols:

```ts
export type FedosRuntimeMode = "Development" | "Production" | "Unknown";

export function determineFedosRuntimeMode(): FedosRuntimeMode;
```

`determineFedosRuntimeMode()` reads `process.env.NODE_ENV` — the ONLY
environment variable this file, or any of its three callers, ever
reads — inside a `try`/`catch`. `"development"` maps to `"Development"`,
`"production"` maps to `"Production"`, and everything else (unset, any
other string, or a read failure including `process`/`process.env` being
unavailable at all) maps to `"Unknown"`. No exception ever escapes.

## 4. A classifier, not an authorizer

**The Authority answers one question only: "what does `NODE_ENV` say?"
It does not answer "is this allowed?"** There is no
`isProductionAllowed()`, `isSecure()`, `productionReady()`, or
`authorizeRuntime()` in this file, and there should never be one — those
are each caller's own Fail-Closed decision to make, not a decision this
shared module should centralize. This mirrors Alpha 006 §2's own
distinction between an EXECUTION GATE (a real Fail-Closed decision
point) and a PUBLIC REPORT (an informational label): consolidating the
CLASSIFICATION does not, and must not, collapse that distinction —
each of the three call sites below still decides for itself what its
own classification means.

## 5. Each call site keeps its own Fail-Closed decision

- **`FedosWasmLoaderSkeleton#evaluateDevOnlyGate()`**
  (`fedos_wasm_loader.ts`) calls `determineFedosRuntimeMode()` and maps
  the result to its OWN, unchanged result type —
  `FedosWasmLoaderDevOnlyGateEvaluation { evaluated: true,
  developmentAllowed: boolean, reason: "DevelopmentRuntime" |
  "ProductionRuntime" | "UnknownRuntime" | "PrototypeStillClosed" }` —
  byte-for-byte the same four-value reason set as before. `"Development"`
  → `developmentAllowed: true`/`"DevelopmentRuntime"`; `"Production"` →
  `false`/`"ProductionRuntime"`; `"Unknown"` → `false`/`"UnknownRuntime"`;
  and if the Authority call itself somehow threw, the surrounding
  `try`/`catch` this method already had resolves `false`/
  `"PrototypeStillClosed"` — the SAME Fail-Closed fallback that existed
  before this Phase. `planLoad()`'s own behavior — always
  `BlockedByPolicy`, the evaluation result recorded but never read by
  any `if` — is untouched.
- **`runtimeCapabilities()`'s `determineRuntimeMode()`**
  (`fedos_runtime_prototype_execution.ts`) is now a one-line delegate:
  `return determineFedosRuntimeMode();`. `RuntimeCapabilities.runtimeMode`
  keeps its exact field name and its exact three-value type
  (`FedosRuntimeMode = "Development" | "Production" | "Unknown"`,
  declared locally in this file exactly as before — not merely
  re-exported — so every existing regression pin on its literal shape
  still holds).
- **The Ciphertext Storage Service's
  `isDevelopmentRuntimeForCiphertextStorage()`**
  (`fedos_runtime_ciphertext_storage.ts`) now reads
  `determineFedosRuntimeMode() === "Development"` instead of
  `process.env?.NODE_ENV === "development"` directly — still the ONE
  real Fail-Closed GATE among the three call sites (every exported
  function branches on it), still resolving `null` for
  `"Production"`/`"Unknown"`, still wrapped in its own `try`/`catch`.
  `MemoryCiphertextStorage`'s own storage behavior is completely
  unchanged.

No call site's public return shape, reason set, or Fail-Closed default
changed. Only WHERE the `NODE_ENV` read happens changed — from three
independent reads to one.

## 6. No duplicate classification remains in Runtime

`fedos_wasm_loader.ts` no longer declares `env` on its ambient `process`
type (narrowed back to `{ cwd(): string }`) and no longer contains
`process.env` anywhere in its own code — it imports
`determineFedosRuntimeMode` from `fedos_runtime_mode_authority.ts`
instead. `fedos_runtime_prototype_execution.ts` likewise dropped its own
ambient `process.env` declaration. `fedos_runtime_ciphertext_storage.ts`
dropped its own ambient `process.env` declaration too. A repo-wide
search after this Phase confirms exactly ONE file under `src/` reads
`process.env.NODE_ENV`: `fedos_runtime_mode_authority.ts` itself.

## 7. Authoritative-source direction — Option C, as Alpha 006 compared it

Alpha 006 §2 compared four candidates and rejected two outright:
Loader-side authoritative (Option A, would have required a real contract
change to `attemptDevOnlyRuntimeRustIntegration()`'s return shape) and
Runtime-side authoritative (Option B, would have inverted the existing
`fedos_runtime_prototype_execution.ts → fedos_wasm_loader.ts` import
direction). This Phase implements Option C exactly as compared: a THIRD,
shared module both files import, with no inversion and no contract
change. `fedos_wasm_loader.ts` still does not import
`fedos_runtime_prototype_execution.ts` (and never will need to) — both
it and the Runtime layer, and now the Ciphertext Storage Service, import
the SAME new leaf module instead.

## 8. Public API — unchanged

- `RuntimeCapabilities` — still exactly `prototypeCompleted`/
  `rustReachable`/`rustVersion`/`runtimeMode`, still exactly four fields.
- `runtimeMode` — still `"Development" | "Production" | "Unknown"`.
- `FedosWasmLoaderDevOnlyGateEvaluation` — still exactly `evaluated`/
  `developmentAllowed`/`reason`, still the same four reason values.
- `storeCiphertext()`/`loadCiphertext()`/`deleteCiphertext()` — still
  resolve their own value in Development Runtime, still resolve `null`
  otherwise; `MemoryCiphertextStorage`'s own storage behavior is
  unchanged.
- `initializeCrypto()`/`randomBytes()`/`generateAeadKey()`/`encrypt()`/
  `decrypt()`/`exportCiphertext()`/`importCiphertext()` — all
  byte-for-byte unchanged; none of these functions is touched by this
  Phase.

## 9. What this Phase does NOT do

- Does **not** add a new Storage Backend, Persistent Storage,
  Filesystem Storage, SQLite, IndexedDB, DPAPI, macOS Keychain, or Linux
  Secret Service.
- Does **not** add a new Crypto API.
- Does **not** connect a Worker.
- Does **not** connect Production.
- Does **not** change `MemoryCiphertextStorage`'s own storage behavior.
- Does **not** change encryption/decryption/wire format.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add an authorization API (`isProductionAllowed()`/
  `isSecure()`/`productionReady()`/`authorizeRuntime()`) of any kind —
  see §4.

## 10. See also

- `docs/secure_runtime_alpha_006_mode_authority_review.md` (Secure
  Runtime Alpha 006) — named this exact extraction as the pre-committed
  next step and the four trigger conditions this Phase checks against.
- `docs/secure_runtime_alpha_005_runtime_state_naming_cleanup.md`
  (Secure Runtime Alpha 005) — the naming cleanup this Phase's shared
  `FedosRuntimeMode` type continues (`"Prototype"` stays removed).
- `docs/secure_runtime_alpha_019_secure_storage_foundation.md` (Secure
  Runtime Alpha 019) — the Storage decision that satisfied trigger
  condition 4.
