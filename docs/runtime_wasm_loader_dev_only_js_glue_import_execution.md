# FedOS WASM Loader — Dev-only JS Glue Import (Prototype EXECUTION Phase 004)

**Status: this document describes an already-landed, narrowly-scoped
addition — `FedosWasmLoaderSkeleton.attemptDevOnlyJsGlueImport()`
(`src/runtime/fedos_wasm_loader.ts`, Stage 945). It is the FIRST time
this whole arc ever actually calls `import()`. It changes no
Runtime/Worker wiring, adds no diagnostics field, and — critically —
does not change `planLoad()`'s own body or external return value in
any way.**

## 1. What this Phase adds

A new capability, reachable only after `planLoad()` has already
recorded `importReadiness().ready === true`:

```txt
Execution Readiness Summary
  ↓
Dev-only JS Glue Import (REAL)
  ↓
BlockedByPolicy
```

`import()` is called for the FIRST time in this arc's history — but
ONLY when gated `true` by the readiness this Phase inherits from
Stage 937, and ONLY of the Generated JS Glue. WebAssembly and Rust are
still NOT reached this Phase.

## 2. Why this capability is a separate method, not inside `planLoad()`

Real dynamic `import()` is inherently asynchronous (`Promise`-based).
`planLoad()` is, and remains, a fully SYNCHRONOUS method returning
`FedosWasmLoaderDecision` directly — every prior stage's own test
suite (dozens of files) calls `planLoad()` and asserts on its return
value synchronously, immediately. Changing `planLoad()`'s signature to
return a `Promise` would be a breaking change far outside this stage's
"necessary minimum" scope.

This Phase therefore does **not** add any call inside `planLoad()`'s
own body — `planLoad()` is **byte-for-byte unchanged**. Instead, a
new, separate, PUBLIC, ASYNC method —
`attemptDevOnlyJsGlueImport(): Promise<FedosWasmLoaderImportExecution>`
— reads `this.#importReadiness` (populated by the MOST RECENT
`planLoad()` call) as its only gate, and `planLoad()` itself still
always returns `BlockedByPolicy` whether or not this new method has
ever been called, or with what result.

## 3. Import condition — `importReady === true` is the only entry point

```ts
async attemptDevOnlyJsGlueImport(): Promise<FedosWasmLoaderImportExecution>
```

| `this.#importReadiness` | Behavior |
|---|---|
| `null` (`planLoad()` never called) | `import()` NEVER attempted. `{ attempted: false, succeeded: false, reason: "PrototypeStillClosed" }` |
| `{ ready: false, ... }` | `import()` NEVER attempted. `{ attempted: false, succeeded: false, reason: "NotReady" }` |
| `{ ready: true, ... }` | Real `import()` attempted. |

No other condition ever authorizes a real import attempt.

## 4. Import target — Generated JS Glue only

Reuses the EXACT same artifact naming knowledge Stage 921's Generated
Artifact Check already established — no new filesystem exploration,
no new artifact discovery:

```txt
packages/fedos-core-rust/pkg/fedos_core_rust.js
```

Never `fedos_core_rust_bg.wasm`. The absolute `process.cwd()`-relative
path (SAME base as Stage 921) is converted to a `file://` URL via
`pathToFileURL` (`node:url` — a THIRD `@ts-expect-error`-suppressed
Node built-in, alongside Stage 921's `node:fs`/`node:path`), since
Node's ESM resolver requires a `file://` URL for an absolute
filesystem path specifier.

## 5. Import result

```ts
interface FedosWasmLoaderImportExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly reason: "Imported" | "NotReady" | "ImportFailed" | "PrototypeStillClosed";
}
```

Held as internal state (`#importExecution`), recorded by
`attemptDevOnlyJsGlueImport()` and readable via the new
`importExecution()` method — which never triggers a new import attempt
itself.

## 6. Import success still touches nothing further

**Even when `import()` resolves successfully**, this method does
NOTHING else:

- The imported module's own return value is **immediately discarded**
  — never assigned to a field, never inspected, never called.
- No `__wbg_init`.
- No `initSync()`.
- No `WebAssembly.instantiate()`/`WebAssembly.compile()`.
- No `new WebAssembly.Module`/`new WebAssembly.Instance`.
- No Rust API call of any kind, including `version()`.

`attemptDevOnlyJsGlueImport()`'s own result only ever names whether the
import ITSELF succeeded — never anything about what the imported
module contains or does.

## 7. Fail Closed

The following ALL resolve `succeeded: false` (Fail Closed), never a
thrown exception out of `attemptDevOnlyJsGlueImport()`:

- `importReady === false` → `attempted: false`, `reason: "NotReady"`.
- `planLoad()` never called → `attempted: false`, `reason: "PrototypeStillClosed"`.
- The real import genuinely fails (module not found, syntax error,
  etc.) → `attempted: true`, `reason: "ImportFailed"`.
- The generated artifact does not exist (the real, uncompiled state of
  this repo today) → `importReady` never becomes `true` in the first
  place, so import is never attempted at all.

Regardless of outcome, `planLoad()`'s own return value — `{ operation:
"load", state: "BlockedByPolicy", policy: "FailClosed", reason: "..." }`,
key order included — is unaffected, since `planLoad()` doesn't
reference `#importExecution`/`#importReadiness`'s later state at all
past its own single evaluation.

## 8. A testable seam, not a real-artifact dependency

`FedosWasmLoaderSkeletonOptions.importGeneratedJsGlue` lets a test
observe both the success and failure paths without depending on a real
Generated JS Glue file existing on disk, or writing one into the
shared `packages/fedos-core-rust/pkg/` directory (which would risk
interfering with concurrently-running tests that assert on that
directory's real, empty state):

```ts
new FedosWasmLoaderSkeleton({
  importGeneratedJsGlue: async (specifier) => ({ /* fake module */ }),
});
```

`createFedosWasmLoader()` NEVER supplies this option — every real
caller always gets real, native dynamic `import()`.

## 9. What this Phase does NOT do

- Does **not** call `__wbg_init`.
- Does **not** call `initSync()`.
- Does **not** call `WebAssembly.instantiate()`/`WebAssembly.compile()`.
- Does **not** construct `new WebAssembly.Module`/`new WebAssembly.Instance`.
- Does **not** call any Rust API, including `version()`.
- Does **not** introduce `#[wasm_bindgen]`.
- Does **not** add any call inside `planLoad()`'s own body.
- Does **not** connect to Worker or to any Production runtime path.
- Does **not** modify `Cargo.toml` or `package.json`.
- Does **not** change `runtime_crypto_diagnostics.ts` or
  `worker_crypto_diagnostics.ts` — no new diagnostics field.
- Does **not** change `planLoad()`'s own external return value, key
  order, or the public `FedosWasmLoader` contract.

## 10. See also

- `docs/runtime_wasm_loader_import_readiness_execution.md` (Stage 937,
  Prototype EXECUTION Phase 003) — the readiness gate this Phase's
  only entry point depends on.
- `docs/runtime_wasm_loader_generated_artifact_check_execution.md`
  (Stage 921, Prototype EXECUTION Phase 001) — the artifact naming
  knowledge this Phase reuses without any new discovery.
- `docs/runtime_wasm_loader_execution_readiness_review.md` (Stage 913,
  Prototype Phase 021) — named `Dev-only import()` as the fourth step
  in its own six-step conversion order (§2).
- `docs/runtime_internal_execution_contract.md` — the full, real
  call-graph ground truth, gaining a Stage 945 update alongside this
  doc.
- `src/runtime/fedos_wasm_loader.ts` (Stage 945) — the real
  implementation this document describes.
