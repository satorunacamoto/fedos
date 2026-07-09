# FedOS Runtime Integration — Prototype Completion Candidate (Prototype EXECUTION Phase 013)

**Status: this document records ONE new, standalone file —
`src/runtime/fedos_runtime_prototype_execution.ts` (Stage 994) —
exporting a single async function,
`attemptDevOnlyRuntimeRustIntegration()`. `AppRuntime.initializeCrypto()`
(`create_runtime.ts`) and `FedosWasmLoader` (`fedos_wasm_loader.ts`)
are BOTH byte-for-byte unchanged. Worker, Production, Runtime
Diagnostics, and the `AppRuntime` shape are all unaffected.**

## 1. What this Phase adds

```ts
export interface RuntimePrototypeExecutionState {
  readonly reachedRust: boolean;
  readonly rustVersion: string | null;
}

export async function attemptDevOnlyRuntimeRustIntegration(): Promise<RuntimePrototypeExecutionState>
```

A single new file. It constructs its OWN, fresh `FedosWasmLoader`
instance (via `createFedosWasmLoader()`) and drives it through the
exact fixed sequence every prior Prototype EXECUTION Phase already
exercised individually:

```
planLoad() -> attemptDevOnlyJsGlueImport() -> attemptDevOnlyWasmInitialization() -> attemptDevOnlyRustVersionCall()
```

then reads back ONLY `succeeded`/`version` from the final result into
`RuntimePrototypeExecutionState`.

## 2. Why a new, standalone file — not a change to `create_runtime.ts`

`AppRuntime.initializeCrypto()` (`createRuntimeInitializeCryptoResult()`)
MUST remain synchronous and byte-for-byte unchanged (§3). Calling the
asynchronous `attemptDevOnlyRustVersionCall()` chain from inside it is
therefore impossible without either breaking its sync contract or
firing-and-forgetting a promise nobody awaits. This Phase follows the
SAME discipline every prior Phase already established for exactly this
tension (Stage 945/969/993's own "add a NEW, separate, async method;
never touch the existing sync entry point"): a NEW, standalone,
PUBLIC, ASYNC function, in a NEW file, is the connection —
`create_runtime.ts` and `fedos_wasm_loader.ts` are BOTH left
byte-for-byte untouched, so every pre-existing guard on either file's
own source text remains accurate.

## 3. `initializeCrypto()` — return contract unchanged, never called from this file

`AppRuntime.initializeCrypto()` (`create_runtime.ts`, Stage 691/697)
ALWAYS resolves:

```ts
{ allowed: false, initialized: false, reason: "PrototypeDisabled" }
```

This Phase's new function does not import, call, or otherwise
reference `createRuntimeInitializeCryptoResult()`/`create_runtime.ts`
at all — there is no code path by which obtaining a real
`rustVersion` could ever influence that answer. `allowed`/`initialized`
remain `false` unconditionally, regardless of whether
`attemptDevOnlyRuntimeRustIntegration()` has ever been called, and
regardless of what it returns.

## 4. Call conditions — identical to Stage 993's own six-condition gate

`attemptDevOnlyRuntimeRustIntegration()` adds NO new gate, NO new
environment check, and NO new Fail-Closed reason of its own. It only
drives the Loader's OWN existing chain, which already Fails Closed at
every step outside Development Runtime:

1. Generated Artifact Check succeeded.
2. Development Runtime (`NODE_ENV === "development"`).
3. Import Ready.
4. JS Glue Import succeeded.
5. JS Glue Module retained.
6. WASM Initialization succeeded.

Whenever any condition is unmet, `attemptDevOnlyRustVersionCall()`
itself resolves `succeeded: false, version: null` (see
`docs/runtime_wasm_loader_dev_only_rust_version_call_execution.md`),
which this file passes straight through as
`{ reachedRust: false, rustVersion: null }`.

## 5. What is retained — `reachedRust`/`rustVersion` only

No module, no Rust object, no `InitOutput`/memory/instance, and no
`FedosWasmLoader` instance itself is ever returned or retained beyond
the single call. `RuntimePrototypeExecutionState` carries exactly two
primitive fields.

## 6. Worker/Production — untouched

This file is not imported by, and does not import, `src/worker.ts`.
Nothing in `create_runtime.ts`'s own assembled `AppRuntime` object
references it — no new field, no new Runtime Service. Nothing
automatically invokes `attemptDevOnlyRuntimeRustIntegration()` from
any production code path; it exists as a standalone, explicitly-called
capability, the same way `attemptDevOnlyRustVersionCall()` itself
exists as a standalone capability on `FedosWasmLoader`.

## 7. What this Phase does NOT do

- Does **not** change `AppRuntime.initializeCrypto()`'s return value.
- Does **not** change `planLoad()`.
- Does **not** change `runtime_crypto_diagnostics.ts`/
  `worker_crypto_diagnostics.ts`.
- Does **not** connect to Worker.
- Does **not** connect to any Production runtime path.
- Does **not** call `encrypt()`, `decrypt()`, `randomBytes()`,
  `deriveKey()`, or add any new Rust API.
- Does **not** add a new Runtime Service to `AppRuntime`'s own shape.
- Does **not** add Secure Storage of any kind.
- Does **not** change `fedos_crypto_backend_resolver.ts`.
- Does **not** change `Cargo.toml` or `package.json`.
- Does **not** commit `target/`, `Cargo.lock`, or `pkg/`.

## 8. Prototype termination condition — review

This repository's Prototype was scoped to end when **"Runtime reaches
the Rust minimal API, and its return value reaches back to Runtime."**
Phase 013 makes `attemptDevOnlyRuntimeRustIntegration()` — a function
that lives in `src/runtime/`, is Runtime-layer code by any reasonable
definition — genuinely call `version()` (through the full six-condition,
Fail-Closed chain) and genuinely receive `"fedos-core-rust/0.0.0"` back
as its own return value, verified end-to-end against a real,
freshly-built artifact during this Phase's own implementation.

**Read literally, the condition is satisfied**: a piece of code living
in Runtime's own directory reached Rust's minimal API and received its
return value back, in Development Runtime, Fail-Closed everywhere
else.

**Read as "observable from the PUBLIC Runtime API"** (i.e., from
`AppRuntime.initializeCrypto()`'s own return value, the one surface
any caller outside `src/runtime/` actually sees), the condition is
**NOT yet satisfied by design** — `initializeCrypto()` is deliberately,
explicitly unchanged, and nothing merges `rustVersion` into it.

These two readings are not in tension; they are two different
completion bars, and this Phase's own explicit instructions (`戻り値契約は壊しません` /
"the return contract must not be broken") make clear the STRICTER,
publicly-observable bar is deliberately deferred, not accidentally
missed. Whether "Prototype termination" requires the publicly-observable
bar is a judgment call for whoever authored the original scoping
language — this document records the fact pattern (both bars, and
which one Phase 013 actually clears) rather than resolving the
ambiguity unilaterally, since resolving it would mean either changing
`initializeCrypto()`'s return contract (explicitly forbidden this
Phase) or declaring the Prototype complete without that step. The
Fail-Closed design philosophy this whole arc has maintained argues for
requiring the STRICTER bar before declaring completion: a `string`
becoming reachable inside `src/runtime/` is a capability, not yet a
promise made to any caller of the public API — and every prior Phase
in this arc has treated "reachable internally" and "safe to expose
publicly" as two separate, separately-reviewed steps.

## 9. See also

- `docs/runtime_wasm_loader_dev_only_rust_version_call_execution.md`
  (Prototype EXECUTION Phase 012) — the six-condition gate and
  `version()` call contract this Phase's new function drives
  end-to-end without modifying.
- `docs/runtime_initialize_crypto_prototype.md` (Stage 691) — the
  original `{ allowed: false, initialized: false, reason:
  "PrototypeDisabled" }` contract this Phase leaves untouched.
- `docs/runtime_internal_execution_contract.md` — the target-architecture
  diagram this arc has followed throughout.
