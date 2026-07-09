# FedOS Secure Runtime Alpha 005 — Runtime State Naming Cleanup

**Status: this document records a NAMING CLEANUP ONLY — no new
feature, no behavior change. `RuntimeCapabilities.runtimeState` is
renamed `runtimeMode`, and its `"Prototype" | "Development" |
"Production"` union becomes `FedosRuntimeMode = "Development" |
"Production" | "Unknown"`. `AppRuntime.initializeCrypto()`'s own
contract, `FedosWasmLoader.planLoad()`, `version()`, Worker,
Production, Rust, Cargo, and package.json are all byte-for-byte
unchanged.**

## 1. What this Phase fixes

Alpha 004's own review
(`docs/secure_runtime_alpha_004_state_model_review.md` §1) found the
word **"Prototype" overloaded THREE separate ways** across this
codebase:

1. The historical arc name (Stage 689–995, now COMPLETE per
   `docs/fedos_prototype_completion.md`).
2. `RuntimeCapabilities.runtimeState: "Prototype"` (Stage 999) — an
   ENVIRONMENT FALLBACK label, unrelated to arc completion.
3. `RuntimeInitializeCryptoReason: "PrototypeDisabled"` (Stage 691) —
   a Fail-Closed DISABLEMENT REASON, unrelated to environment.

This Phase removes overlap #2 — the field this arc actually controls
and can safely rename without breaking a thirty-five-Stage-old pinned
contract (overlap #3, `"PrototypeDisabled"`, is explicitly NOT
touched — see §3).

## 2. What changed

```ts
// Before (Stage 999)
export interface RuntimeCapabilities {
  readonly prototypeCompleted: boolean;
  readonly rustReachable: boolean;
  readonly rustVersion: string | null;
  readonly runtimeState: "Prototype" | "Development" | "Production";
}

// After (Stage 1001)
export type FedosRuntimeMode = "Development" | "Production" | "Unknown";

export interface RuntimeCapabilities {
  readonly prototypeCompleted: boolean;
  readonly rustReachable: boolean;
  readonly rustVersion: string | null;
  readonly runtimeMode: FedosRuntimeMode;
}
```

- Field renamed: `runtimeState` → `runtimeMode`.
- Type extracted and named: the inline union becomes the exported
  `FedosRuntimeMode` type.
- Value renamed: the environment-fallback bucket's label changes from
  `"Prototype"` to `"Unknown"` — matching
  `FedosWasmLoaderDevOnlyGateEvaluation`'s own `"UnknownRuntime"`
  value more directly, and no longer colliding with either of the
  other two "Prototype" meanings named in §1.
- The PRIVATE helper function is renamed to match:
  `determineRuntimeState()` → `determineRuntimeMode()`.

**No behavior change**: the function still reads `process.env.NODE_ENV`
exactly once, in the exact same try/catch-wrapped shape, and still
resolves the exact same THREE logical buckets
(`"development"`/`"production"`/everything else) — only the field's
own name and the third bucket's own label changed.

## 3. `NODE_ENV` classification — NOT consolidated into one place

Alpha 004 §1 also found the CONCEPT of environment classification
duplicated across two files:
`FedosWasmLoaderSkeleton#evaluateDevOnlyGate()` (a real Fail-Closed
GATE, four values) and this file's own `determineRuntimeMode()` (a
non-gating LABEL, three values). This Phase does **NOT** merge these
into a single shared function — doing so would require either:

- `fedos_wasm_loader.ts` importing from
  `fedos_runtime_prototype_execution.ts` (or vice versa), a NEW
  cross-file dependency neither file has today, or
- extracting a THIRD, shared module both would import — a real,
  non-trivial refactor.

Per this Phase's own explicit scope ("大規模リファクタはしないでください"
— no large-scale refactor), both classifiers are left as separate,
independent implementations. This is an intentional, recorded
trade-off, not an oversight: the two serve genuinely different
purposes (one Fails Closed a real reach chain; the other labels a
read-only reader's output), and consolidating them is a large enough
change to deserve its own, separately-reviewed future Stage if ever
pursued.

## 4. `PrototypeDisabled` — explicitly retained, unchanged

`RuntimeInitializeCryptoReason = "PrototypeDisabled"`
(`src/runtime/types.ts`, Stage 691) is **NOT renamed, NOT touched, NOT
reconsidered** by this Phase. It remains exactly what it always was: a
Fail-Closed REASON explaining why `initializeCrypto()` refused to
activate anything — a fundamentally different concept from an
environment classification, and this Phase does not conflate the two.
The only thing this Phase removes is the ACCIDENTAL naming overlap the
word "Prototype" previously created between `"PrototypeDisabled"` and
the (now-renamed) `runtimeMode` field — not the reason itself.

## 5. `initializeCrypto()` — byte-for-byte unchanged, reconfirmed

```ts
{ allowed: false, initialized: false, reason: "PrototypeDisabled" }
```

`createRuntimeInitializeCryptoResult()` (`create_runtime.ts`) is not
edited by this Phase in any way. Reconfirmed by a direct test call.

## 6. This is naming cleanup, not a new feature

- No new field is added to `RuntimeCapabilities`.
- No new function is added.
- No new gate, environment check, or Fail-Closed reason is
  introduced.
- `runtimeCapabilities()`'s own call graph is unchanged — it still
  calls `attemptDevOnlyRuntimeRustIntegration()` exactly once and
  nothing else.
- The three logical environment buckets `runtimeMode` reports are
  IDENTICAL to what `runtimeState` reported before this Phase — only
  the field's own name and the third bucket's own label changed.

## 7. What this Phase does NOT do

- Does **not** add any new Runtime feature.
- Does **not** add any new Crypto API.
- Does **not** add Secure Storage of any kind.
- Does **not** connect to Worker.
- Does **not** connect to any Production runtime path.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** change `initializeCrypto()`'s own return value.
- Does **not** change `FedosWasmLoader.planLoad()`.
- Does **not** change `version()`'s own specification.
- Does **not** merge `FedosWasmLoaderSkeleton#evaluateDevOnlyGate()`
  and `determineRuntimeMode()` into one shared classifier (§3).
- Does **not** commit `target/`, `Cargo.lock`, or `pkg/`.

## 8. See also

- `docs/secure_runtime_alpha_004_state_model_review.md` §1 — the
  review finding this Phase resolves.
- `docs/secure_runtime_alpha_003_capability_reader.md` (Stage 999) —
  introduced the `runtimeState` field this Phase renames.
- `docs/runtime_initialize_crypto_prototype.md` (Stage 691) — the
  origin of `"PrototypeDisabled"`, explicitly untouched by this Phase.
