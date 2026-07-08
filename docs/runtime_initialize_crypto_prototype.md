# FedOS Runtime initializeCrypto Prototype — Stage 689 (Prototype Phase 001)

**Status: this document marks the end of the pure-Planning arc
(Stage 585–688) and the start of Prototype Phase 001. This stage adds
`AppRuntime.initializeCrypto()` as a REAL, callable, public member —
the first time anything in this arc is actually wired into
`AppRuntime` — but calling it performs NO real work. No
Rust/WASM/Loader/generated JS glue call of any kind happens, no
`import()` (static or dynamic) is written anywhere, and the return
value is permanently `{ allowed: false, initialized: false, reason:
"PrototypeDisabled" }`. This adds the door. It does not open it.**

## 1. Planning Phase ends here

Stage 585–688 built twelve separate `PlanningOnly` layers
(`docs/runtime_initialize_crypto_planning_review.md`, Stage 681) that
model, in increasing detail, what a real connection between Runtime
and FedOS Core would eventually require — none of them was ever
reachable from `AppRuntime` or `src/worker.ts`.
`docs/runtime_initialize_crypto_first_wiring_plan.md` (Stage 683)
named `initializeCrypto()` as the sole first Runtime-exposure
candidate, and named a future `allowed: false` public-facing CHECK as
the only step in scope for a near-term stage. THIS stage is that step.

No thirteenth `PlanningOnly` layer is added, and none of the twelve
existing `fedos_*.ts` files is touched, called, imported, or referenced
by this stage's implementation. This is a deliberately fresh, minimal,
directly-on-`AppRuntime` prototype — not an extension of the parked
chain.

## 2. Prototype Phase 001 begins here

From this stage on, the repository is in **Prototype Phase** for this
arc: `initializeCrypto()` exists as a real `AppRuntime` member, callable
by any caller that holds a runtime. This is a narrow, deliberate first
step:

| Question | Answer in this stage |
|---|---|
| Does `AppRuntime.initializeCrypto` exist? | **Yes** — a real method, not a planning-only design doc. |
| Is it callable? | **Yes** — calling it throws nothing and returns a fixed object. |
| Does calling it do anything? | **No** — no Rust, no WASM, no Loader, no generated JS glue, no `import()` of any kind. |
| Does it return `allowed: true` ever? | **No** — `allowed` is typed as the literal `false`; nothing in this stage can produce `true`. |

## 3. The fixed return shape

```ts
export type RuntimeInitializeCryptoReason = "PrototypeDisabled";

export interface RuntimeInitializeCryptoResult {
  readonly allowed: false;
  readonly initialized: false;
  readonly reason: RuntimeInitializeCryptoReason;
}
```

`AppRuntime.initializeCrypto(): RuntimeInitializeCryptoResult` always
resolves `{ allowed: false, initialized: false, reason:
"PrototypeDisabled" }` — synchronously, purely, and identically on every
call. See `src/runtime/types.ts` (Stage 690) and
`src/runtime/create_runtime.ts` (Stage 691) for the real implementation.

## 4. What this stage explicitly does NOT do

- Does **not** call `packages/fedos-core-rust` (Rust crate or TS package
  boundary), any Facade (`fedos_crypto_loader_facade.ts`,
  `fedos_crypto_provider_facade_boundary.ts`), or any Loader
  (`fedos_wasm_loader.ts`, `fedos_wasm_loader_contract.ts`,
  `fedos_wasm_loader_plan.ts`).
- Does **not** import, reference, or evaluate the generated JS glue
  (`fedos_core_rust.js` / `fedos_core_rust_bg.wasm`) in any way.
- Does **not** write `import()` of any kind (static or dynamic),
  anywhere in this repository's source.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`/`initSync`/the default init
  export.
- Does **not** touch `src/worker.ts` — Worker exposure is explicitly
  OUT OF SCOPE for this stage, matching
  `docs/runtime_initialize_crypto_first_wiring_plan.md` §2. No Worker
  request path can reach `initializeCrypto()` as a result of this
  stage.
- Does **not** touch `RuntimeCryptoProvider.encrypt()`/`.decrypt()` —
  both stay exactly as they are today (`"Unsupported"`). This stage
  does not read, wire, or reason about them.
- Does **not** touch `AppRuntime.cryptoProvider` or `AppRuntime.crypto`
  (the pre-existing, unrelated crypto seams) — neither field's
  selection logic changes.
- Does **not** implement NIP-17/NIP-44/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.
- Does **not** add a thirteenth `PlanningOnly` layer or any new
  `fedos_*.ts` runtime module.

## See also

- `docs/runtime_initialize_crypto_planning_review.md` (Stage 681) —
  the inventory of the twelve `PlanningOnly` layers this prototype
  deliberately does not extend or call into.
- `docs/runtime_initialize_crypto_first_wiring_plan.md` (Stage 683) —
  the policy that named `initializeCrypto()` as the sole first
  Runtime-exposure candidate and this stage's `allowed: false` public
  check as the only in-scope near-term step.
- `src/runtime/types.ts` (Stage 690) — the `RuntimeInitializeCryptoResult`
  type and the `AppRuntime.initializeCrypto` member declaration.
- `src/runtime/create_runtime.ts` (Stage 691) — the real, fixed-value
  implementation wired into `createRuntime()`.
