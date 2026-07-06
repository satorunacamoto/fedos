# FedOS WASM Loader Planning — when may the generated JS glue ever load? — Stage 501

**Status: this document records real code's current state — every
phase below is, and remains, in a PROHIBITED state. It orders the
phases; it advances none of them.**

`docs/runtime_wasm_loader.md` (Stage 493) named the Loader Skeleton's
own three fixed labels (`NotLoaded`/`PlanningOnly`/`FailClosed`). This
document goes one level deeper: it separates "when may the generated
JS glue (`packages/fedos-core-rust/pkg/fedos_core_rust.js`) ever
actually load" into FIVE distinct, ORDERED phases — because "the
loader exists" and "the loader may act" are different questions, and
collapsing them risks treating the mere existence of
`src/runtime/fedos_wasm_loader.ts` as if it were permission to use it.

## 1. The five phases, in required order

| # | Phase | Question it answers | State today |
|---|---|---|---|
| 1 | **Loader Creation** | Does a `FedosWasmLoader` object exist to plan against? | ✅ YES — `createFedosWasmLoader()` (Stage 489) |
| 2 | **Import Permission** | May the generated JS glue module ever be `import`ed (static or dynamic)? | ❌ NO — `planImport()` fixed `"BlockedByPolicy"` (Stage 502) |
| 3 | **Initialization Permission** | May `initSync`/the default async init export ever be called? | ❌ NO — `planInitialize()` fixed `"BlockedByPolicy"` (Stage 502) |
| 4 | **Runtime Attach** | May `create_runtime.ts`/`AppRuntime` ever reference this loader? | ❌ NO — `planRuntimeAttach()` fixed `"BlockedByPolicy"` (Stage 502) |
| 5 | **Worker Attach** | May `src/worker.ts` ever reference this loader? | ❌ NO — `planWorkerAttach()` fixed `"BlockedByPolicy"` (Stage 502) |

Every phase after #1 is a SEPARATE, INDEPENDENT gate — advancing #2
does not imply #3, #4, or #5 are also open, and none of the four is
implied by #1 (an object existing to describe a plan is not the same
as the plan being approved). `src/runtime/fedos_wasm_loader_plan.ts`
(Stage 502) is the file that names phases #2–#5 as its own four
`plan*()` operations, each independently fixed `"BlockedByPolicy"`.

## 2. Why five phases, not one flag

A single "loader enabled" boolean would conflate two different kinds
of risk this codebase keeps separate everywhere else in this WASM
arc:

- **What the loader does to itself** (#2 Import, #3 Initialization) —
  whether the generated JS glue is ever read into the JS module graph
  or its `wasm-bindgen` init functions ever run. Neither requires
  Runtime or Worker to exist at all; both are, by themselves, already
  the exact actions `docs/runtime_wasm_js_glue_contract.md` records as
  never yet performed.
- **What the loader is wired to** (#4 Runtime Attach, #5 Worker
  Attach) — whether either host actually references this loader, the
  SAME two-consumer split `docs/runtime_internal_execution_contract.md`
  already applies to every other link in this chain (`create_runtime.ts`
  vs. `src/worker.ts`, checked independently in every guard test in
  this arc).

Requiring all five phases in order — never skipping #2/#3 to reach
#4/#5, and never treating #1 as sufficient on its own — is this
document's own dual/multi-lock discipline, mirroring
`docs/runtime_crypto_activation_policy.md`'s two-flag gate applied
here to five gates instead of two.

## 3. What this stage does NOT do

- Does not import, `require()`, or dynamically `import()`
  `fedos_core_rust.js`/`fedos_core_rust_bg.wasm`, or any other
  generated artifact.
- Does not call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `initSync`/the JS glue's default export.
- Does not reference `create_runtime.ts`/`src/worker.ts` from
  `fedos_wasm_loader_plan.ts`, and neither of those files references
  `fedos_wasm_loader_plan.ts` back.
- Does not edit or commit any generated file under
  `packages/fedos-core-rust/pkg/`.
- Does not touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`), Runtime activation, or Worker activation.

## See also

- `docs/runtime_wasm_loader.md` (Stage 493) — the Loader Skeleton's
  own fixed labels this document's phase table builds on.
- `src/runtime/fedos_wasm_loader_plan.ts` (Stage 502) — the real,
  fixed-value implementation of phases #2–#5.
- `docs/runtime_internal_execution_contract.md` (updated Stage 505) —
  the diagram naming Loader Plan's position between Loader Skeleton
  and Generated JS Glue.
- `docs/runtime_crypto_activation_policy.md` — the dual-lock
  discipline this document's five-phase ordering generalizes.
