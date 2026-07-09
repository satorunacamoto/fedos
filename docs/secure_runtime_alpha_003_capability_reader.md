# FedOS Secure Runtime Alpha 003 — Runtime Capability Reader

**Status: this document records ONE new, read-only field on
`AppRuntime` — `runtimeCapabilities()` (Stage 999) — the FIRST time
any Prototype-derived capability is wired into `AppRuntime`'s own
assembled object. `AppRuntime.initializeCrypto()`'s own contract is
byte-for-byte unchanged. No Worker, Production, Rust, Cargo,
package.json, or Secure Storage change of any kind.**

## 1. What this Phase adds

```ts
export interface RuntimeCapabilities {
  readonly prototypeCompleted: boolean;
  readonly rustReachable: boolean;
  readonly rustVersion: string | null;
  readonly runtimeState: "Prototype" | "Development" | "Production";
}

export async function runtimeCapabilities(): Promise<RuntimeCapabilities>
```

(`src/runtime/fedos_runtime_prototype_execution.ts`), wired into
`AppRuntime` (`src/runtime/types.ts`, `src/runtime/create_runtime.ts`)
as a NEW, second field alongside `initializeCrypto`:

```ts
const runtime = createRuntime();
const caps = await runtime.runtimeCapabilities();
// { prototypeCompleted: true, rustReachable: false, rustVersion: null, runtimeState: "Prototype" }  (outside Development Runtime)
```

## 2. What each field means, and where it comes from

- **`prototypeCompleted`** — a FIXED constant, `true`. Records that
  `docs/fedos_prototype_completion.md` (Stage 996) already declared
  the Prototype complete. Never computed from file/git state.
- **`rustReachable`** / **`rustVersion`** — read DIRECTLY from ONE call
  to `attemptDevOnlyRuntimeRustIntegration()` (Stage 994, unmodified) —
  `{ reachedRust, rustVersion }` passed straight through. No second
  `FedosWasmLoader` instance, no direct call to any of its
  `attemptDevOnly*` methods, no new Rust reach of any kind.
- **`runtimeState`** — `"Development"`/`"Production"` when
  `process.env.NODE_ENV` reads exactly `"development"`/`"production"`;
  `"Prototype"` otherwise (unset, `"test"`, or unreadable). This is
  the SAME three-way, try/catch-wrapped, Fail-Closed-to-a-safe-default
  shape `FedosWasmLoaderSkeleton`'s own `#evaluateDevOnlyGate()`
  already uses — re-labeled for this reader's own purpose, and NOT a
  new gate: nothing inside `attemptDevOnlyRuntimeRustIntegration()`'s
  own control flow branches on it.

## 3. `initializeCrypto()` — byte-for-byte unchanged

`createRuntimeInitializeCryptoResult()` (`create_runtime.ts`) is not
edited by this Phase. It still ALWAYS resolves:

```ts
{ allowed: false, initialized: false, reason: "PrototypeDisabled" }
```

`runtimeCapabilities()`'s own result is never read by, or merged into,
this function — the two fields on `AppRuntime` are provably
independent, verified by a direct test calling both.

## 4. Fail Closed — maintained

- `runtimeCapabilities()` only ever REPORTS what
  `attemptDevOnlyRuntimeRustIntegration()`'s own six-condition,
  Fail-Closed gate already decided — it adds no new condition, no new
  environment check beyond the one, non-gating `runtimeState` label.
- Calling `runtimeCapabilities()` has NO side effect — no write, no
  cache, no mutation of any Runtime/Loader instance state beyond the
  fresh, transient `FedosWasmLoader` `attemptDevOnlyRuntimeRustIntegration()`
  itself already constructs and discards.
- Outside Development Runtime, `rustReachable` is `false` and
  `rustVersion` is `null` — exactly as every prior Stage's own
  Fail-Closed chain already guarantees.

## 5. Worker / Production / Secure Storage — unaffected

- `src/worker.ts` is not modified and does not reference
  `runtimeCapabilities`/`RuntimeCapabilities`/
  `fedos_runtime_prototype_execution.ts` in any way.
- Nothing calls `runtimeCapabilities()` automatically from any
  Production code path — it is a field on `AppRuntime` a caller must
  explicitly invoke, exactly as `initializeCrypto()` itself already
  is.
- No key material, `SecretHandle`, or any exportable secret is
  returned or could be — every field is a non-secret label or a
  build-identifier `string`.

## 6. What this Phase does NOT do

- Does **not** change `initializeCrypto()`'s return contract.
- Does **not** change `AppRuntime.crypto`/`RuntimeCryptoProvider`.
- Does **not** change any `FedosWasmLoader*Plan` interface.
- Does **not** change `FedosWasmLoader.planLoad()`.
- Does **not** change `attemptDevOnlyRustVersionCall()`'s own
  specification or behavior.
- Does **not** connect to Worker.
- Does **not** connect to any Production runtime path.
- Does **not** add Secure Storage of any kind.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** change `version()`'s own specification.
- Does **not** add any new Crypto API (`encrypt`/`decrypt`/`deriveKey`/
  `randomBytes`).
- Does **not** add any new WASM API.

## 7. See also

- `docs/secure_runtime_alpha_002_public_surface_review.md` §7 — named
  this exact reader as Alpha 003's recommended first deliverable.
- `docs/runtime_prototype_execution_runtime_integration.md`
  (Prototype EXECUTION Phase 013) — added
  `attemptDevOnlyRuntimeRustIntegration()`, unmodified by this Phase,
  now called from a real `AppRuntime` field for the first time.
- `docs/fedos_prototype_completion.md` (Stage 996) — the declaration
  `prototypeCompleted: true` records.
