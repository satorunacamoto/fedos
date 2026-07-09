/**
 * Stage 489–492 — FedOS WASM Loader Skeleton (standalone, unwired,
 * fixed-value only).
 *
 * `docs/runtime_wasm_js_glue_contract.md` (Stage 481) recorded, by
 * direct observation, what the real, locally-generated `wasm-bindgen`
 * JS glue actually exports. `src/runtime/fedos_wasm_loader_contract.ts`
 * (Stage 482) named a fixed CONTRACT SHAPE — a `status()`-only read.
 * THIS file is the next, separate link: a LOADER SKELETON that also
 * names the three OPERATIONS a real loader would eventually perform
 * (`planLoad`/`planInitialize`/`planUnload`) — each one PLANNED, never
 * executed, and each one blocked by a named POLICY
 * (`docs/runtime_wasm_loader.md`, Stage 493) rather than only by "not
 * implemented yet". This file does NOT load, import, or execute
 * anything — it names a shape a future, separate, explicitly-reviewed
 * loader stage could implement against, the same "plan/observation
 * label, never a real action" discipline every other file in this
 * WASM arc already uses.
 *
 * "Unwired" (Stage 489–789) meant: NO other module in this repository
 * imported this file. `create_runtime.ts`/`src/worker.ts` did not
 * reference it, neither did `fedos_wasm_loader_contract.ts`/
 * `fedos_wasm_artifact.ts`/`fedos_wasm_boundary.ts`. Only
 * `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts`
 * (Stage 495) read its pure, standalone functions for DISPLAY, and
 * this codebase's own test suite exercised it directly.
 *
 * Stage 793 (Prototype Phase 008) ends that isolation, ONCE: `src/runtime/fedos_wasm_backend.ts`'s
 * `createWasmBackend()` now calls `createFedosWasmLoader()` and its
 * `planLoad()` — the FIRST real caller of this file anywhere in this
 * repository besides tests. The result (`"BlockedByPolicy"`) is
 * discarded, and `createWasmBackend()`'s own return value is
 * unchanged. `fedos_wasm_loader_plan.ts`/`fedos_wasm_loader_contract.ts`/
 * `fedos_wasm_artifact.ts`/`fedos_wasm_boundary.ts`/`create_runtime.ts`/
 * `src/worker.ts` still do NOT reference this file, and none of them
 * is modified by this stage — this file itself is UNMODIFIED in its
 * own behavior too: `planLoad()` still always resolves
 * `"BlockedByPolicy"`, and still reaches nothing past its own internal
 * Loader Plan (`fedos_wasm_loader_plan.ts`).
 *
 * Stage 503 extends `planLoad()` DOWNWARD only: it now builds a
 * `FedosWasmLoaderPlan` (`fedos_wasm_loader_plan.ts`, Stage 502) and
 * calls its `planImport()` — then DISCARDS the result and returns its
 * OWN, unchanged `"BlockedByPolicy"` answer. This does NOT change
 * "unwired" above (still no reference to `fedos_wasm_loader_contract.ts`/
 * `fedos_wasm_artifact.ts`/`fedos_wasm_boundary.ts`/`create_runtime.ts`/
 * `src/worker.ts`, and neither does `fedos_wasm_loader_plan.ts` itself)
 * — it only wires this file to the NEW, separate plan file directly
 * below it, mirroring `fedos_wasm_boundary.ts`'s own precedent
 * (`#reachWasmArtifact()`) of reaching one link deeper while changing
 * nothing about its own return value.
 *
 * Stage 809 (Prototype Phase 009) adds a Loader STATE reader,
 * `planningState()`, plus standalone accessors
 * (`loaderPlanningState()`/`loaderPlanningDecision()`/`loaderLoaded()`).
 * **Naming note — a design conflict, found and resolved before this
 * addition landed**: `status()` (Stage 489) already exists, already
 * returns a DIFFERENT, exact-shape-pinned value
 * (`{ state: "NotLoaded", mode: "PlanningOnly", policy: "FailClosed",
 * reason }`, guarded by `test/runtime_wasm_loader.test.ts` #1/#3 with
 * `toEqual`), and `FedosWasmLoaderState` (Stage 489) already exports
 * `"NotLoaded" | "Loaded"`. Redefining either under the SAME name with
 * DIFFERENT values, as a literal reading of a `{ state, decision,
 * loaded }` request might suggest, would both fail to compile (duplicate
 * exported type name in one module) and break that pinned test. This
 * stage therefore adds a NEW, separately-named method (`planningState()`,
 * NOT `status()`) and a NEW, separately-named type
 * (`FedosWasmLoaderPlanningState`, NOT `FedosWasmLoaderState`) instead —
 * `status()`'s own return value, and every existing export's value, is
 * byte-for-byte unchanged. `planningState()` is PURE and returns its OWN
 * fixed `{ state: "Planning", decision: "BlockedByPolicy", loaded: false }`
 * directly — it does NOT call `planLoad()` (no `status→planLoad` reverse
 * reference of any kind), and `planLoad()` itself is UNCHANGED and does
 * NOT call `planningState()` either — the two are independent readers of
 * the same fixed design, never calling one another.
 *
 * HARD GUARDRAILS:
 *   - Every function/method in this file is PURE, synchronous, and
 *     returns a hand-fixed constant. None ever inspects
 *     `packages/fedos-core-rust/pkg/`, `import.meta`, the filesystem,
 *     or any environment variable.
 *   - NO `import`/`import()`/`require()` of `fedos_core_rust.js`/
 *     `fedos_core_rust_bg.wasm`, or any other generated artifact.
 *   - NO `WebAssembly.instantiate`/`WebAssembly.compile`/`fetch`
 *     reference of any kind.
 *   - NO `child_process`/filesystem/`process.env` reference.
 *   - `planLoad()`/`planInitialize()`/`planUnload()` ALWAYS resolve
 *     `"BlockedByPolicy"` in this stage — `"Allowed"` exists in
 *     `FedosWasmLoaderDecisionState` only as a RESERVED label for a
 *     future, separate, explicitly-reviewed stage; nothing in this
 *     file can ever produce it.
 *   - `loaderState()` is fixed `"NotLoaded"` — no loader has ever run,
 *     and this file cannot make one run.
 *   - `loaderMode()` is fixed `"PlanningOnly"` — this stage only ever
 *     PLANS an operation, never performs one.
 *   - `loaderPolicy()` is fixed `"FailClosed"` — every planned
 *     operation is denied by policy, not merely "not implemented".
 *   - `planningState()` is PURE, synchronous, takes no argument, and
 *     returns a hand-fixed constant. It NEVER calls `planLoad()`/
 *     `planInitialize()`/`planUnload()`, and neither of THOSE methods
 *     calls `planningState()` — no reverse reference of any kind
 *     between the two.
 *   - `planningState().state` is fixed `"Planning"` — `"Active"` is
 *     RESERVED, unreachable from this file.
 *   - `planningState().loaded` is fixed `false` — no module is ever
 *     loaded, imported, fetched, or instantiated by this file.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 *
 * Stage 817 (Prototype Phase 010) adds a LOADER POLICY reader,
 * `policy()`, plus standalone accessors (`loaderPolicyAllowed()`/
 * `loaderPolicyDecision()`/`loaderPolicyReason()`). **Naming note — the
 * same kind of design conflict Stage 809 already found and resolved,
 * checked again before this addition landed**: a standalone
 * `loaderPolicy()` function (Stage 489) already exists and already
 * returns a DIFFERENT, pinned value (the bare label `"FailClosed"`,
 * `FedosWasmLoaderPolicy`'s own fail-safety posture, guarded by
 * `test/runtime_wasm_loader_state.test.ts`). `policy()`'s own return
 * shape (`{ allowed, decision, reason }`) is a NEW, separately-named
 * type, `FedosWasmLoaderPolicyDecision` — NOT a redefinition of
 * `FedosWasmLoaderPolicy` — so neither the pre-existing `loaderPolicy()`
 * function nor its return type is touched. `policy()` is PURE, takes no
 * argument, and returns a hand-fixed constant `{ allowed: false,
 * decision: "BlockedByPolicy", reason: "PrototypePolicy" }`. It is
 * DELIBERATELY independent of every other reader on this class:
 * it does NOT call `planningState()`, `status()`, or `planLoad()`
 * (no reverse reference of any kind), and neither `planningState()`
 * nor `status()` calls `policy()` either — `planLoad()` alone is
 * PERMITTED to call `policy()` in a future stage, but this stage's
 * `planLoad()` is byte-for-byte unchanged and does NOT call it, so no
 * cycle (`policy()` -> `planLoad()` or otherwise) exists anywhere in
 * this file.
 *   - `policy().allowed` is fixed `false` — `true` is RESERVED for a
 *     future, separate, explicitly-reviewed stage; nothing in this
 *     file can ever produce it.
 *   - `policy().decision` is fixed `"BlockedByPolicy"` — the SAME
 *     `FedosWasmLoaderDecisionState` label `planLoad()`/`planInitialize()`/
 *     `planUnload()`/`planningState()` already use; `"Allowed"` stays
 *     RESERVED, unreachable from this file.
 *   - `policy().reason` is fixed `"PrototypePolicy"`.
 *
 * Stage 825 (Prototype Phase 011) wires `planLoad()` to READ the fixed
 * POLICY answer `policy()` (Stage 817) already provides — WITHOUT
 * changing what `planLoad()` acts on or returns. A new PRIVATE
 * `#reachLoaderPolicy()` helper calls `this.policy()` exactly once and
 * DISCARDS the result in full — the SAME "reach one link deeper,
 * discard the result, keep your own fixed answer" pattern
 * `#reachLoaderPlan()` (Stage 503) already established one call above
 * it. `planLoad()`'s own return value stays byte-for-byte `{
 * operation: "load", state: "BlockedByPolicy", policy: "FailClosed",
 * reason: "..." }` — the Policy answer is READ, never MERGED into it,
 * never branched on, and never used to decide whether to proceed. This
 * is **NOT** "`planLoad()` now obeys `policy()`" — it is "`planLoad()`
 * now also reaches `policy()`, and still ignores what it says,"
 * matching this whole file's own longstanding "plan/observe only,
 * never a real action" discipline. `policy()` itself is UNCHANGED — it
 * still does not call `planLoad()`/`planningState()`/`status()`, so no
 * cycle (`policy()` <-> `planLoad()` or any other direction) exists
 * anywhere in this file, only the new, one-directional
 * `planLoad() -> policy()` reach this stage adds. `planInitialize()`/
 * `planUnload()`/`planningState()`/`status()` are UNTOUCHED by this
 * stage and do NOT call `policy()`.
 *
 * Stage 833 (Prototype Phase 012) makes `planLoad()` actually EVALUATE
 * the `policy()` answer it already reaches (Stage 825), instead of
 * discarding it: `#reachLoaderPolicy()` now RETURNS the
 * `FedosWasmLoaderPolicyDecision` it reads (previously it discarded
 * the value in full), and `planLoad()` branches on `policy.allowed`
 * (`if (!policy.allowed) { return this.#blocked("load"); }`). Because
 * `policy().allowed` is fixed `false` in every stage that exists today,
 * this branch is ALWAYS taken — `planLoad()`'s own return value stays
 * byte-for-byte `{ operation: "load", state: "BlockedByPolicy", policy:
 * "FailClosed", reason: "..." }`, key order included. The `allowed:
 * true` path is NOT implemented — it is a single TODO comment marking
 * a RESERVED spot for a future, separate, explicitly-reviewed stage;
 * the line immediately after it still returns the SAME fail-closed
 * `#blocked("load")` answer, so even a hypothetical future bug in
 * `policy()` could never silently produce an `"Allowed"` decision from
 * this function alone. `policy()` itself is UNCHANGED, `planInitialize()`/
 * `planUnload()`/`planningState()`/`status()` do NOT call `policy()`
 * and are untouched, and no cycle exists — `policy()` still never calls
 * `planLoad()`.
 *
 * Stage 841 (Prototype Phase 013) adds a LOAD PLAN object,
 * `FedosWasmLoaderLoadPlan` — a NEW, separately-named, hand-fixed
 * record `{ allowed: false, shouldLoad: false, backend: "Wasm",
 * reason: "BlockedByPolicy" }`, built by a new PRIVATE
 * `#createLoadPlan()` method (no arguments, no `this.policy()` call —
 * `policy()` still runs exactly ONCE per `planLoad()` call, inside
 * `#reachLoaderPolicy()`, unchanged from Stage 833). `planLoad()`'s
 * flow is now: (1) call `#reachLoaderPolicy()` to get `policy` (one
 * `policy()` call), (2) evaluate `policy.allowed`
 * (`if (!policy.allowed)`), (3) inside that branch, call
 * `#createLoadPlan()` to build the Load Plan, (4) evaluate
 * `loadPlan.shouldLoad` (`if (!loadPlan.shouldLoad)`) as a SECOND,
 * independent confirmation, (5) return the SAME `#blocked("load")`
 * answer as every prior stage. Because `policy().allowed` and
 * `FedosWasmLoaderLoadPlan.shouldLoad` are BOTH fixed `false`, both
 * branches are ALWAYS taken, and `planLoad()`'s own return value stays
 * byte-for-byte `{ operation: "load", state: "BlockedByPolicy", policy:
 * "FailClosed", reason: "..." }`, key order included — the Load Plan's
 * OWN fields (`allowed`/`shouldLoad`/`backend`/`reason`) are never
 * merged into it. The `shouldLoad: true` (and `policy.allowed: true`)
 * paths remain NOT implemented — reserved TODO comments only, each
 * immediately followed by the SAME fail-closed `#blocked("load")`
 * fallback, so this function stays fail-closed no matter what either
 * object ever answers. This is still NOT a real load: no
 * `WebAssembly`/generated JS glue/`import()`/Rust reference of any
 * kind exists anywhere in this file. `policy()` itself, `planInitialize()`/
 * `planUnload()`/`planningState()`/`status()`, and every upstream layer
 * are UNCHANGED, and no cycle exists.
 *
 * Stage 865 (Prototype Phase 015) adds a JS GLUE ACCESS PLAN object,
 * `FedosWasmLoaderJsGlueAccessPlan` — a NEW, separately-named,
 * hand-fixed record `{ backend: "Wasm", shouldAccess: false, reason:
 * "BlockedByLoadPlan", currentStage: "JsGlueAccessPlanning",
 * nextRequiredCheck: "GeneratedArtifactCheck" }`, built by a new
 * PRIVATE `#createJsGlueAccessPlan()` method (no argument, calls
 * nothing, returns a hand-fixed constant — mirrors `#createLoadPlan()`'s
 * own "pure, no re-fetch" discipline). `planLoad()`'s flow extends ONE
 * step further, INSIDE the existing `if (!loadPlan.shouldLoad)`
 * branch: (6) build the JS Glue Access Plan via
 * `#createJsGlueAccessPlan()`, (7) confirm
 * `jsGlueAccessPlan.shouldAccess` (`if (!jsGlueAccessPlan.shouldAccess)`,
 * a THIRD, independent check, ALSO always taken because `shouldAccess`
 * is fixed `false`), (8) return the SAME `#blocked("load")` answer as
 * every prior stage. `planLoad()`'s own return value — `{ operation:
 * "load", state: "BlockedByPolicy", policy: "FailClosed", reason:
 * "..." }`, key order included — stays byte-for-byte unchanged; the JS
 * Glue Access Plan's OWN fields are never merged into it, it is not
 * part of the public `FedosWasmLoader` interface, and it is never
 * returned to any caller. `reason: "BlockedByLoadPlan"` names WHY
 * access is denied (the Load Plan one level up already said
 * `shouldLoad: false`) — `"PrototypeDisabled"`/
 * `"GeneratedArtifactUnchecked"` are the OTHER two labels the type
 * permits but this stage's fixed constant never produces, reserved for
 * a future stage that might deny access for a different reason.
 * `nextRequiredCheck: "GeneratedArtifactCheck"` NAMES, without
 * PERFORMING, the very next gate a future, separate,
 * explicitly-reviewed stage would need to add — this stage does NOT
 * check whether the generated artifact exists, does NOT `import()`
 * anything, does NOT reference `WebAssembly`, and does NOT call Rust;
 * all of that remains Phase 016+'s responsibility. The `shouldAccess:
 * true` path (like `loadPlan.shouldLoad: true` and `policy.allowed:
 * true` above it) is a single reserved TODO comment, immediately
 * followed by the SAME fail-closed fallback, so this function stays
 * fail-closed no matter what any of the three objects ever answers.
 * `policy()` itself, `planInitialize()`/`planUnload()`/`planningState()`/
 * `status()`, and every upstream layer are UNCHANGED, and no cycle
 * exists — `#createJsGlueAccessPlan()` calls nothing at all.
 *
 * Stage 873 (Prototype Phase 016) adds a GENERATED ARTIFACT CHECK PLAN
 * object, `FedosWasmLoaderGeneratedArtifactCheckPlan` — a NEW,
 * separately-named, hand-fixed record `{ backend: "Wasm", shouldCheck:
 * false, reason: "BlockedByJsGlueAccessPlan", currentStage:
 * "GeneratedArtifactCheckPlanning", nextRequiredCheck: "DevOnlyGate" }`,
 * built by a new PRIVATE `#createGeneratedArtifactCheckPlan()` method
 * (no argument, calls nothing, returns a hand-fixed constant — mirrors
 * `#createJsGlueAccessPlan()`'s own "pure, no re-fetch" discipline).
 * `planLoad()`'s flow extends ONE step further, INSIDE the existing
 * `if (!jsGlueAccessPlan.shouldAccess)` branch: (9) build the
 * Generated Artifact Check Plan via
 * `#createGeneratedArtifactCheckPlan()`, (10) confirm
 * `artifactCheckPlan.shouldCheck`
 * (`if (!artifactCheckPlan.shouldCheck)`, a FOURTH, independent check,
 * ALSO always taken because `shouldCheck` is fixed `false`), (11)
 * return the SAME `#blocked("load")` answer as every prior stage.
 * `planLoad()`'s own return value — `{ operation: "load", state:
 * "BlockedByPolicy", policy: "FailClosed", reason: "..." }`, key order
 * included — stays byte-for-byte unchanged; the Generated Artifact
 * Check Plan's OWN fields are never merged into it, it is not part of
 * the public `FedosWasmLoader` interface, and it is never returned to
 * any caller. `reason: "BlockedByJsGlueAccessPlan"` names WHY the
 * check is not yet performed (the JS Glue Access Plan one level up
 * already said `shouldAccess: false`) — `"PrototypeDisabled"`/
 * `"FilesystemAccessUnavailable"` are the OTHER two labels the type
 * permits but this stage's fixed constant never produces, reserved for
 * a future stage that might defer the check for a different reason.
 * `nextRequiredCheck: "DevOnlyGate"` NAMES, without PERFORMING, the
 * very next gate a future, separate, explicitly-reviewed stage would
 * need to add — this stage does NOT check whether the generated
 * artifact exists, does NOT touch the filesystem, does NOT `import()`
 * anything, does NOT reference `WebAssembly`, and does NOT call Rust;
 * all of that remains Phase 017+'s responsibility. The `shouldCheck:
 * true` path (like `shouldAccess: true`, `loadPlan.shouldLoad: true`,
 * and `policy.allowed: true` above it) is a single reserved TODO
 * comment, immediately followed by the SAME fail-closed fallback, so
 * this function stays fail-closed no matter what any of the four
 * objects ever answers. `policy()` itself, `planInitialize()`/
 * `planUnload()`/`planningState()`/`status()`, and every upstream layer
 * are UNCHANGED, and no cycle exists —
 * `#createGeneratedArtifactCheckPlan()` calls nothing at all.
 *
 * Stage 881 (Prototype Phase 017) adds a DEV-ONLY GATE PLAN object,
 * `FedosWasmLoaderDevOnlyGatePlan` — a NEW, separately-named,
 * hand-fixed record `{ backend: "Wasm", shouldEvaluate: false, reason:
 * "BlockedByGeneratedArtifactCheckPlan", currentStage:
 * "DevOnlyGatePlanning", nextRequiredCheck: "ImportPlanning" }`, built
 * by a new PRIVATE `#createDevOnlyGatePlan()` method (no argument,
 * calls nothing, returns a hand-fixed constant — mirrors
 * `#createGeneratedArtifactCheckPlan()`'s own "pure, no re-fetch"
 * discipline). `planLoad()`'s flow extends ONE step further, INSIDE
 * the existing `if (!artifactCheckPlan.shouldCheck)` branch: (12)
 * build the Dev-only Gate Plan via `#createDevOnlyGatePlan()`, (13)
 * confirm `devOnlyGatePlan.shouldEvaluate`
 * (`if (!devOnlyGatePlan.shouldEvaluate)`, a FIFTH, independent check,
 * ALSO always taken because `shouldEvaluate` is fixed `false`), (14)
 * return the SAME `#blocked("load")` answer as every prior stage.
 * `planLoad()`'s own return value — `{ operation: "load", state:
 * "BlockedByPolicy", policy: "FailClosed", reason: "..." }`, key order
 * included — stays byte-for-byte unchanged; the Dev-only Gate Plan's
 * OWN fields are never merged into it, it is not part of the public
 * `FedosWasmLoader` interface, and it is never returned to any caller.
 * `shouldEvaluate: false` NAMES a future intent (this Plan would only
 * ever evaluate `true` in a Development Runtime — never Production,
 * never Worker) WITHOUT performing any such evaluation: this stage
 * reads NO environment variable, `process.env`, `import.meta`, or
 * `NODE_ENV` of any kind — `shouldEvaluate` is a hand-fixed constant,
 * not a computed answer. `reason:
 * "BlockedByGeneratedArtifactCheckPlan"` names WHY evaluation is not
 * yet performed (the Generated Artifact Check Plan one level up
 * already said `shouldCheck: false`) — `"PrototypeDisabled"`/
 * `"DevelopmentGateUnavailable"` are the OTHER two labels the type
 * permits but this stage's fixed constant never produces, reserved
 * for a future stage that might defer evaluation for a different
 * reason. `nextRequiredCheck: "ImportPlanning"` NAMES, without
 * PERFORMING, the very next gate a future, separate,
 * explicitly-reviewed stage would need to add — this stage does NOT
 * evaluate Development/Production status, does NOT read any
 * environment variable, does NOT `import()` anything, does NOT
 * reference `WebAssembly`, and does NOT call Rust; all of that
 * remains Phase 018+'s responsibility. The `shouldEvaluate: true` path
 * (like every fixed-`false` field above it) is a single reserved TODO
 * comment, immediately followed by the SAME fail-closed fallback, so
 * this function stays fail-closed no matter what any of the five
 * objects ever answers. `policy()` itself, `planInitialize()`/
 * `planUnload()`/`planningState()`/`status()`, and every upstream layer
 * are UNCHANGED, and no cycle exists — `#createDevOnlyGatePlan()`
 * calls nothing at all.
 *
 * Stage 889 (Prototype Phase 018) adds an IMPORT PLAN object,
 * `FedosWasmLoaderImportPlan` — a NEW, separately-named, hand-fixed
 * record `{ backend: "Wasm", shouldImport: false, reason:
 * "BlockedByDevOnlyGatePlan", currentStage: "ImportPlanning",
 * nextRequiredCheck: "WebAssemblyPlanning" }`, built by a new PRIVATE
 * `#createImportPlan()` method (no argument, calls nothing, returns a
 * hand-fixed constant — mirrors `#createDevOnlyGatePlan()`'s own
 * "pure, no re-fetch" discipline). `planLoad()`'s flow extends ONE
 * step further, INSIDE the existing `if (!devOnlyGatePlan.shouldEvaluate)`
 * branch: (15) build the Import Plan via `#createImportPlan()`, (16)
 * confirm `importPlan.shouldImport`
 * (`if (!importPlan.shouldImport)`, a SIXTH, independent check, ALSO
 * always taken because `shouldImport` is fixed `false`), (17) return
 * the SAME `#blocked("load")` answer as every prior stage.
 * `planLoad()`'s own return value — `{ operation: "load", state:
 * "BlockedByPolicy", policy: "FailClosed", reason: "..." }`, key order
 * included — stays byte-for-byte unchanged; the Import Plan's OWN
 * fields are never merged into it, it is not part of the public
 * `FedosWasmLoader` interface, and it is never returned to any caller.
 * `shouldImport: false` NAMES the future intent that a real Loader
 * would eventually `import()` the generated JS glue WITHOUT
 * performing any such import: this stage contains NO `import()`, NO
 * dynamic `import()`, and does NOT load the generated JS glue —
 * `shouldImport` is a hand-fixed constant, not a computed answer.
 * `reason: "BlockedByDevOnlyGatePlan"` names WHY the import is not yet
 * performed (the Dev-only Gate Plan one level up already said
 * `shouldEvaluate: false`) — `"PrototypeDisabled"`/
 * `"ImportUnavailable"` are the OTHER two labels the type permits but
 * this stage's fixed constant never produces, reserved for a future
 * stage that might defer the import for a different reason.
 * `nextRequiredCheck: "WebAssemblyPlanning"` NAMES, without
 * PERFORMING, the very next gate a future, separate,
 * explicitly-reviewed stage would need to add — this stage does NOT
 * call `import()`, does NOT reference `WebAssembly`, does NOT call
 * `initSync`, and does NOT call Rust; all of that remains Phase
 * 019+'s responsibility. The `shouldImport: true` path (like every
 * fixed-`false` field above it) is a single reserved TODO comment,
 * immediately followed by the SAME fail-closed fallback, so this
 * function stays fail-closed no matter what any of the six objects
 * ever answers. `policy()` itself, `planInitialize()`/`planUnload()`/
 * `planningState()`/`status()`, and every upstream layer are
 * UNCHANGED, and no cycle exists — `#createImportPlan()` calls nothing
 * at all.
 *
 * Stage 897 (Prototype Phase 019) adds a WEBASSEMBLY PLAN object,
 * `FedosWasmLoaderWebAssemblyPlan` — a NEW, separately-named,
 * hand-fixed record `{ backend: "Wasm", shouldInstantiate: false,
 * reason: "BlockedByImportPlan", currentStage: "WebAssemblyPlanning",
 * nextRequiredCheck: "RustApiCallPlanning" }`, built by a new PRIVATE
 * `#createWebAssemblyPlan()` method (no argument, calls nothing,
 * returns a hand-fixed constant — mirrors `#createImportPlan()`'s own
 * "pure, no re-fetch" discipline). `planLoad()`'s flow extends ONE
 * step further, INSIDE the existing `if (!importPlan.shouldImport)`
 * branch: (18) build the WebAssembly Plan via
 * `#createWebAssemblyPlan()`, (19) confirm
 * `webAssemblyPlan.shouldInstantiate`
 * (`if (!webAssemblyPlan.shouldInstantiate)`, a SEVENTH, independent
 * check, ALSO always taken because `shouldInstantiate` is fixed
 * `false`), (20) return the SAME `#blocked("load")` answer as every
 * prior stage. `planLoad()`'s own return value — `{ operation: "load",
 * state: "BlockedByPolicy", policy: "FailClosed", reason: "..." }`,
 * key order included — stays byte-for-byte unchanged; the WebAssembly
 * Plan's OWN fields are never merged into it, it is not part of the
 * public `FedosWasmLoader` interface, and it is never returned to any
 * caller. `shouldInstantiate: false` NAMES the future intent that a
 * real Loader would eventually create and use a real WebAssembly
 * instance WITHOUT performing any such instantiation: this stage
 * contains NO `WebAssembly.instantiate`, NO `WebAssembly.compile`, NO
 * `new WebAssembly.Module`, and NO `new WebAssembly.Instance` —
 * `shouldInstantiate` is a hand-fixed constant, not a computed answer.
 * `reason: "BlockedByImportPlan"` names WHY WebAssembly is not yet
 * reached (the Import Plan one level up already said `shouldImport:
 * false`) — `"PrototypeDisabled"`/`"WebAssemblyUnavailable"` are the
 * OTHER two labels the type permits but this stage's fixed constant
 * never produces, reserved for a future stage that might defer
 * instantiation for a different reason. `nextRequiredCheck:
 * "RustApiCallPlanning"` NAMES, without PERFORMING, the very next gate
 * a future, separate, explicitly-reviewed stage would need to add —
 * this stage does NOT call any WebAssembly API, does NOT call
 * `initSync`, and does NOT call Rust; all of that remains Phase
 * 020+'s responsibility. The `shouldInstantiate: true` path (like
 * every fixed-`false` field above it) is a single reserved TODO
 * comment, immediately followed by the SAME fail-closed fallback, so
 * this function stays fail-closed no matter what any of the seven
 * objects ever answers. `policy()` itself, `planInitialize()`/
 * `planUnload()`/`planningState()`/`status()`, and every upstream
 * layer are UNCHANGED, and no cycle exists —
 * `#createWebAssemblyPlan()` calls nothing at all.
 *
 * Stage 905 (Prototype Phase 020) adds a RUST API CALL PLAN object,
 * `FedosWasmLoaderRustApiCallPlan` — a NEW, separately-named,
 * hand-fixed record `{ backend: "Wasm", shouldCall: false, reason:
 * "BlockedByWebAssemblyPlan", currentStage: "RustApiCallPlanning",
 * nextRequiredCheck: "PrototypeExecutionReadiness" }`, built by a new
 * PRIVATE `#createRustApiCallPlan()` method (no argument, calls
 * nothing, returns a hand-fixed constant — mirrors
 * `#createWebAssemblyPlan()`'s own "pure, no re-fetch" discipline).
 * `planLoad()`'s flow extends ONE step further, INSIDE the existing
 * `if (!webAssemblyPlan.shouldInstantiate)` branch: (21) build the
 * Rust API Call Plan via `#createRustApiCallPlan()`, (22) confirm
 * `rustApiCallPlan.shouldCall` (`if (!rustApiCallPlan.shouldCall)`, an
 * EIGHTH, independent check, ALSO always taken because `shouldCall` is
 * fixed `false`), (23) return the SAME `#blocked("load")` answer as
 * every prior stage. `planLoad()`'s own return value — `{ operation:
 * "load", state: "BlockedByPolicy", policy: "FailClosed", reason:
 * "..." }`, key order included — stays byte-for-byte unchanged; the
 * Rust API Call Plan's OWN fields are never merged into it, it is not
 * part of the public `FedosWasmLoader` interface, and it is never
 * returned to any caller. `shouldCall: false` NAMES the future intent
 * that a real Loader would eventually call a real Rust public function
 * (e.g. `version()`) WITHOUT performing any such call: this stage
 * contains NO Rust API call of any kind, NO `#[wasm_bindgen]`, NO
 * `__wbg_init`, and NO `initSync` — `shouldCall` is a hand-fixed
 * constant, not a computed answer. `reason:
 * "BlockedByWebAssemblyPlan"` names WHY the call is not yet performed
 * (the WebAssembly Plan one level up already said `shouldInstantiate:
 * false`) — `"PrototypeDisabled"`/`"RustApiUnavailable"` are the OTHER
 * two labels the type permits but this stage's fixed constant never
 * produces, reserved for a future stage that might defer the call for
 * a different reason. `nextRequiredCheck:
 * "PrototypeExecutionReadiness"` NAMES, without PERFORMING, the very
 * next gate a future, separate, explicitly-reviewed stage would need
 * to add — this Planning Chain (Load Plan → JS Glue Access Plan →
 * Generated Artifact Check Plan → Dev-only Gate Plan → Import Plan →
 * WebAssembly Plan → Rust API Call Plan) is now COMPLETE; the next
 * stage's own responsibility is reviewing the chain as a whole and
 * naming what Execution Readiness would require, NOT extending the
 * chain with an eighth internal Plan. The `shouldCall: true` path
 * (like every fixed-`false` field above it) is a single reserved TODO
 * comment, immediately followed by the SAME fail-closed fallback, so
 * this function stays fail-closed no matter what any of the eight
 * objects ever answers. `policy()` itself, `planInitialize()`/
 * `planUnload()`/`planningState()`/`status()`, and every upstream
 * layer are UNCHANGED, and no cycle exists — `#createRustApiCallPlan()`
 * calls nothing at all.
 */

import { createFedosWasmLoaderPlan } from "./fedos_wasm_loader_plan.js";

/**
 * The loader's own coarse state. `"NotLoaded"` is the ONLY value this
 * stage's implementation ever produces; `"Loaded"` is RESERVED for a
 * future, separate, explicitly-reviewed stage that actually calls the
 * generated JS glue's `initSync`/default export — nothing in this
 * file can ever produce it.
 */
export type FedosWasmLoaderState = "NotLoaded" | "Loaded";

/**
 * Whether this loader is only PLANNING operations or actually
 * performing them. `"PlanningOnly"` is the ONLY value this stage's
 * implementation ever produces; `"Active"` is RESERVED, unreachable
 * from this file.
 */
export type FedosWasmLoaderMode = "PlanningOnly" | "Active";

/**
 * The fail-safety posture this loader enforces. `"FailClosed"` is the
 * ONLY value this stage's implementation ever produces — every
 * planned operation is denied by policy. `"FailOpen"` is RESERVED,
 * unreachable from this file, and would be a dangerous default this
 * codebase never adopts.
 */
export type FedosWasmLoaderPolicy = "FailClosed" | "FailOpen";

/** A non-sensitive snapshot of the loader skeleton. `reason` is human-readable and non-sensitive. */
export interface FedosWasmLoaderStatus {
  readonly state: FedosWasmLoaderState;
  readonly mode: FedosWasmLoaderMode;
  readonly policy: FedosWasmLoaderPolicy;
  readonly reason: string;
}

/**
 * The outcome of `FedosWasmLoader.planLoad()`/`planInitialize()`/
 * `planUnload()`. `"BlockedByPolicy"` is the ONLY value this stage's
 * implementation ever produces; `"Allowed"` is RESERVED.
 */
export type FedosWasmLoaderDecisionState = "BlockedByPolicy" | "Allowed";

/** Which operation a `FedosWasmLoaderDecision` describes. */
export type FedosWasmLoaderOperation = "load" | "initialize" | "unload";

/** The result of a `FedosWasmLoader.planLoad()`/`planInitialize()`/`planUnload()` call. No module bytes, handle, or secret material of any kind. */
export interface FedosWasmLoaderDecision {
  readonly operation: FedosWasmLoaderOperation;
  readonly state: FedosWasmLoaderDecisionState;
  readonly policy: FedosWasmLoaderPolicy;
  readonly reason: string;
}

/**
 * Stage 809 — the Loader's own coarse PLANNING state, DELIBERATELY a
 * separate type from `FedosWasmLoaderState` above (which already means
 * something different: `"NotLoaded"`/`"Loaded"`, `status()`'s own
 * field). `"Planning"` is the ONLY value this stage's implementation
 * ever produces; `"Active"` is RESERVED, unreachable from this file —
 * the SAME "Planning vs reserved Active" convention every other layer
 * in this arc already uses.
 */
export type FedosWasmLoaderPlanningState = "Planning" | "Active";

/**
 * A non-sensitive snapshot combining the Loader's own coarse planning
 * state, the decision `planLoad()` would resolve to (without calling
 * it), and whether anything has ever actually loaded. DELIBERATELY a
 * separate shape from `FedosWasmLoaderStatus` above (`status()`'s own
 * return type) — see this module's top-of-file "Naming note" for why.
 */
export interface FedosWasmLoaderPlanningStatus {
  readonly state: FedosWasmLoaderPlanningState;
  readonly decision: FedosWasmLoaderDecisionState;
  readonly loaded: boolean;
}

/**
 * Stage 817 — the Loader's own fixed POLICY answer: whether a real
 * operation would be allowed, the decision label it maps to, and a
 * non-sensitive reason. DELIBERATELY a separate shape from
 * `FedosWasmLoaderStatus`/`FedosWasmLoaderDecision`/
 * `FedosWasmLoaderPlanningStatus` above, and NOT a redefinition of the
 * pre-existing `FedosWasmLoaderPolicy` label type — see this module's
 * top-of-file "Stage 817" doc note for why.
 */
export interface FedosWasmLoaderPolicyDecision {
  readonly allowed: boolean;
  readonly decision: FedosWasmLoaderDecisionState;
  readonly reason: string;
}

/**
 * Stage 841 — an internal-only LOAD PLAN object `planLoad()` builds
 * and confirms before returning its own, unrelated
 * `FedosWasmLoaderDecision`. DELIBERATELY a separate shape from every
 * other type in this file, and DELIBERATELY typed with literal `false`/
 * `"Wasm"`/`"BlockedByPolicy"` (not `boolean`/`string`) — this
 * Prototype stage can never construct any other value. Not part of
 * the public `FedosWasmLoader` interface; never returned to a caller
 * of `planLoad()` directly.
 */
export interface FedosWasmLoaderLoadPlan {
  readonly allowed: false;
  readonly shouldLoad: false;
  readonly backend: "Wasm";
  readonly reason: "BlockedByPolicy";
}

/**
 * Stage 865 — an internal-only JS GLUE ACCESS PLAN object `planLoad()`
 * builds and confirms one step past the Load Plan, before returning
 * its own, unrelated `FedosWasmLoaderDecision`. Names the DECISION to
 * access the generated JS glue (`shouldAccess`), WHY it cannot yet
 * (`reason`), and WHAT would need to be checked next
 * (`nextRequiredCheck`) — without performing any of it: no
 * `import()`, no `WebAssembly` reference, no generated-artifact
 * existence check, no Rust call. DELIBERATELY a separate shape from
 * every other type in this file, and DELIBERATELY typed with literal
 * `"Wasm"`/`false`/`"JsGlueAccessPlanning"`/`"GeneratedArtifactCheck"`
 * values (plus a three-member `reason` union, only one member of
 * which this Prototype stage ever actually produces) — see this
 * module's top-of-file "Stage 865" doc note for why. Not part of the
 * public `FedosWasmLoader` interface; never returned to a caller of
 * `planLoad()` directly.
 */
export interface FedosWasmLoaderJsGlueAccessPlan {
  readonly backend: "Wasm";
  readonly shouldAccess: false;
  readonly reason: "BlockedByLoadPlan" | "PrototypeDisabled" | "GeneratedArtifactUnchecked";
  readonly currentStage: "JsGlueAccessPlanning";
  readonly nextRequiredCheck: "GeneratedArtifactCheck";
}

/**
 * Stage 873 — an internal-only GENERATED ARTIFACT CHECK PLAN object
 * `planLoad()` builds and confirms one step past the JS Glue Access
 * Plan, before returning its own, unrelated `FedosWasmLoaderDecision`.
 * Names WHAT would need to be confirmed (the generated `.wasm`/JS
 * glue pair's own presence, per `fedos_generated_artifact_presence.ts`'s
 * present-vs-usable distinction), WHY it is not confirmed yet
 * (`reason`), and WHAT gate comes after it (`nextRequiredCheck`) —
 * without performing any of it: no filesystem access, no `import()`,
 * no `WebAssembly` reference, no Rust call. DELIBERATELY a separate
 * shape from every other type in this file, and DELIBERATELY typed
 * with literal `"Wasm"`/`false`/`"GeneratedArtifactCheckPlanning"`/
 * `"DevOnlyGate"` values (plus a three-member `reason` union, only one
 * member of which this Prototype stage ever actually produces) — see
 * this module's top-of-file "Stage 873" doc note for why. Not part of
 * the public `FedosWasmLoader` interface; never returned to a caller
 * of `planLoad()` directly.
 */
export interface FedosWasmLoaderGeneratedArtifactCheckPlan {
  readonly backend: "Wasm";
  readonly shouldCheck: false;
  readonly reason: "BlockedByJsGlueAccessPlan" | "PrototypeDisabled" | "FilesystemAccessUnavailable";
  readonly currentStage: "GeneratedArtifactCheckPlanning";
  readonly nextRequiredCheck: "DevOnlyGate";
}

/**
 * Stage 881 — an internal-only DEV-ONLY GATE PLAN object `planLoad()`
 * builds and confirms one step past the Generated Artifact Check
 * Plan, before returning its own, unrelated `FedosWasmLoaderDecision`.
 * Names the INTENT that a real Loader would only ever evaluate this
 * gate in a Development Runtime — never Production, never Worker —
 * WITHOUT performing any such evaluation: no `process.env`, no
 * `import.meta`, no `NODE_ENV`, no environment read of any kind.
 * DELIBERATELY a separate shape from every other type in this file,
 * and DELIBERATELY typed with literal `"Wasm"`/`false`/
 * `"DevOnlyGatePlanning"`/`"ImportPlanning"` values (plus a
 * three-member `reason` union, only one member of which this
 * Prototype stage ever actually produces) — see this module's
 * top-of-file "Stage 881" doc note for why. Not part of the public
 * `FedosWasmLoader` interface; never returned to a caller of
 * `planLoad()` directly.
 */
export interface FedosWasmLoaderDevOnlyGatePlan {
  readonly backend: "Wasm";
  readonly shouldEvaluate: false;
  readonly reason: "BlockedByGeneratedArtifactCheckPlan" | "PrototypeDisabled" | "DevelopmentGateUnavailable";
  readonly currentStage: "DevOnlyGatePlanning";
  readonly nextRequiredCheck: "ImportPlanning";
}

/**
 * Stage 889 — an internal-only IMPORT PLAN object `planLoad()` builds
 * and confirms one step past the Dev-only Gate Plan, before returning
 * its own, unrelated `FedosWasmLoaderDecision`. Names the FUTURE
 * intent to `import()` the generated JS glue (`shouldImport`), WHY it
 * cannot happen yet (`reason`), and WHAT gate comes after it
 * (`nextRequiredCheck`) — without performing any of it: no `import()`
 * (static or dynamic), no generated JS glue load, no `WebAssembly`
 * reference, no Rust call. DELIBERATELY a separate shape from every
 * other type in this file, and DELIBERATELY typed with literal
 * `"Wasm"`/`false`/`"ImportPlanning"`/`"WebAssemblyPlanning"` values
 * (plus a three-member `reason` union, only one member of which this
 * Prototype stage ever actually produces) — see this module's
 * top-of-file "Stage 889" doc note for why. Not part of the public
 * `FedosWasmLoader` interface; never returned to a caller of
 * `planLoad()` directly.
 */
export interface FedosWasmLoaderImportPlan {
  readonly backend: "Wasm";
  readonly shouldImport: false;
  readonly reason: "BlockedByDevOnlyGatePlan" | "PrototypeDisabled" | "ImportUnavailable";
  readonly currentStage: "ImportPlanning";
  readonly nextRequiredCheck: "WebAssemblyPlanning";
}

/**
 * Stage 897 — an internal-only WEBASSEMBLY PLAN object `planLoad()`
 * builds and confirms one step past the Import Plan, before returning
 * its own, unrelated `FedosWasmLoaderDecision`. Names the FUTURE
 * intent to create and use a real WebAssembly instance
 * (`shouldInstantiate`), WHY it cannot happen yet (`reason`), and WHAT
 * gate comes after it (`nextRequiredCheck`) — without performing any
 * of it: no `WebAssembly.instantiate`, no `WebAssembly.compile`, no
 * `new WebAssembly.Module`, no `new WebAssembly.Instance`, no
 * `initSync`, no Rust call. DELIBERATELY a separate shape from every
 * other type in this file, and DELIBERATELY typed with literal
 * `"Wasm"`/`false`/`"WebAssemblyPlanning"`/`"RustApiCallPlanning"`
 * values (plus a three-member `reason` union, only one member of
 * which this Prototype stage ever actually produces) — see this
 * module's top-of-file "Stage 897" doc note for why. Not part of the
 * public `FedosWasmLoader` interface; never returned to a caller of
 * `planLoad()` directly.
 */
export interface FedosWasmLoaderWebAssemblyPlan {
  readonly backend: "Wasm";
  readonly shouldInstantiate: false;
  readonly reason: "BlockedByImportPlan" | "PrototypeDisabled" | "WebAssemblyUnavailable";
  readonly currentStage: "WebAssemblyPlanning";
  readonly nextRequiredCheck: "RustApiCallPlanning";
}

/**
 * Stage 905 — an internal-only RUST API CALL PLAN object `planLoad()`
 * builds and confirms one step past the WebAssembly Plan, before
 * returning its own, unrelated `FedosWasmLoaderDecision`. Names the
 * FUTURE intent to call a real Rust public function
 * (`shouldCall`), WHY it cannot happen yet (`reason`), and WHAT comes
 * after it (`nextRequiredCheck`) — without performing any of it: no
 * Rust API call of any kind, no `#[wasm_bindgen]`, no `__wbg_init`, no
 * `initSync`. This is the LAST link in the Planning Chain
 * (`docs/runtime_wasm_loader_activation_readiness_review.md` §4,
 * extended by Stage 897) — `nextRequiredCheck:
 * "PrototypeExecutionReadiness"` names a REVIEW of the completed
 * chain, not an eighth internal Plan. DELIBERATELY a separate shape
 * from every other type in this file, and DELIBERATELY typed with
 * literal `"Wasm"`/`false`/`"RustApiCallPlanning"`/
 * `"PrototypeExecutionReadiness"` values (plus a three-member `reason`
 * union, only one member of which this Prototype stage ever actually
 * produces) — see this module's top-of-file "Stage 905" doc note for
 * why. Not part of the public `FedosWasmLoader` interface; never
 * returned to a caller of `planLoad()` directly.
 */
export interface FedosWasmLoaderRustApiCallPlan {
  readonly backend: "Wasm";
  readonly shouldCall: false;
  readonly reason: "BlockedByWebAssemblyPlan" | "PrototypeDisabled" | "RustApiUnavailable";
  readonly currentStage: "RustApiCallPlanning";
  readonly nextRequiredCheck: "PrototypeExecutionReadiness";
}

/**
 * The standalone, unwired WASM Loader Skeleton. Names the three
 * operations a real loader would eventually perform — never loads,
 * imports, or executes the generated JS glue. `FedosWasmLoaderSkeleton`
 * is the one implementation this stage provides.
 */
export interface FedosWasmLoader {
  status(): FedosWasmLoaderStatus;
  planLoad(): FedosWasmLoaderDecision;
  planInitialize(): FedosWasmLoaderDecision;
  planUnload(): FedosWasmLoaderDecision;
  planningState(): FedosWasmLoaderPlanningStatus;
  policy(): FedosWasmLoaderPolicyDecision;
}

/**
 * The placeholder `FedosWasmLoader` — always reports `"NotLoaded"`/
 * `"PlanningOnly"`/`"FailClosed"`, and every planned operation always
 * resolves `"BlockedByPolicy"`. Constructing an instance does
 * nothing: no file read, no module imported, no WASM instantiated.
 */
export class FedosWasmLoaderSkeleton implements FedosWasmLoader {
  constructor() {
    // Does nothing: no file read, no module imported, no WASM instantiated.
  }

  status(): FedosWasmLoaderStatus {
    return {
      state: "NotLoaded",
      mode: "PlanningOnly",
      policy: "FailClosed",
      reason: "FedOS WASM loader skeleton is a fixed planning record, not a real loader",
    };
  }

  planLoad(): FedosWasmLoaderDecision {
    this.#reachLoaderPlan(); // result discarded -- no import/initialize/attach ever happens
    const policy = this.#reachLoaderPolicy(); // 1. policy() -- exactly one call
    if (!policy.allowed) {
      // 2. policy.allowed evaluated -- ALWAYS false today, so this branch is ALWAYS taken
      const loadPlan = this.#createLoadPlan(); // 3. Load Plan generated
      if (!loadPlan.shouldLoad) {
        // 4. Load Plan's own result confirmed -- ALWAYS false today
        const jsGlueAccessPlan = this.#createJsGlueAccessPlan(); // 6. JS Glue Access Plan generated
        if (!jsGlueAccessPlan.shouldAccess) {
          // 7. JS Glue Access Plan's own result confirmed -- ALWAYS false today
          const artifactCheckPlan = this.#createGeneratedArtifactCheckPlan(); // 9. Generated Artifact Check Plan generated
          if (!artifactCheckPlan.shouldCheck) {
            // 10. Generated Artifact Check Plan's own result confirmed -- ALWAYS false today
            const devOnlyGatePlan = this.#createDevOnlyGatePlan(); // 12. Dev-only Gate Plan generated
            if (!devOnlyGatePlan.shouldEvaluate) {
              // 13. Dev-only Gate Plan's own result confirmed -- ALWAYS false today
              const importPlan = this.#createImportPlan(); // 15. Import Plan generated
              if (!importPlan.shouldImport) {
                // 16. Import Plan's own result confirmed -- ALWAYS false today
                const webAssemblyPlan = this.#createWebAssemblyPlan(); // 18. WebAssembly Plan generated
                if (!webAssemblyPlan.shouldInstantiate) {
                  // 19. WebAssembly Plan's own result confirmed -- ALWAYS false today
                  const rustApiCallPlan = this.#createRustApiCallPlan(); // 21. Rust API Call Plan generated
                  if (!rustApiCallPlan.shouldCall) {
                    // 22. Rust API Call Plan's own result confirmed -- ALWAYS false today
                    return this.#blocked("load"); // 23. same BlockedByPolicy answer as every prior stage
                  }
                  // TODO(reserved for a future, separate, explicitly-reviewed stage):
                  // rustApiCallPlan.shouldCall is permanently false in
                  // this Prototype stage (see
                  // FedosWasmLoaderRustApiCallPlan's own fixed shape
                  // above), so this line can never execute today. The
                  // real Rust API call -- including the Prototype
                  // Execution Readiness review named in
                  // nextRequiredCheck -- belongs here -- NOT
                  // implemented in this stage.
                  return this.#blocked("load");
                }
                // TODO(reserved for a future, separate, explicitly-reviewed stage):
                // webAssemblyPlan.shouldInstantiate is permanently false
                // in this Prototype stage (see
                // FedosWasmLoaderWebAssemblyPlan's own fixed shape
                // above), so this line can never execute today. The
                // real WebAssembly instantiation -- including the Rust
                // API Call Planning named in nextRequiredCheck --
                // belongs here -- NOT implemented in this stage.
                return this.#blocked("load");
              }
              // TODO(reserved for a future, separate, explicitly-reviewed stage):
              // importPlan.shouldImport is permanently false in this
              // Prototype stage (see FedosWasmLoaderImportPlan's own
              // fixed shape above), so this line can never execute
              // today. The real import() of the generated JS glue --
              // including the WebAssembly Planning named in
              // nextRequiredCheck -- belongs here -- NOT implemented in
              // this stage.
              return this.#blocked("load");
            }
            // TODO(reserved for a future, separate, explicitly-reviewed stage):
            // devOnlyGatePlan.shouldEvaluate is permanently false in
            // this Prototype stage (see FedosWasmLoaderDevOnlyGatePlan's
            // own fixed shape above), so this line can never execute
            // today. The real Development-Runtime-only evaluation path
            // -- including the Import Planning named in
            // nextRequiredCheck -- belongs here -- NOT implemented in
            // this stage.
            return this.#blocked("load");
          }
          // TODO(reserved for a future, separate, explicitly-reviewed stage):
          // artifactCheckPlan.shouldCheck is permanently false in this
          // Prototype stage (see
          // FedosWasmLoaderGeneratedArtifactCheckPlan's own fixed
          // shape above), so this line can never execute today. The
          // real, allowed filesystem check path -- including the
          // Dev-only Gate named in nextRequiredCheck -- belongs here
          // -- NOT implemented in this stage.
          return this.#blocked("load");
        }
        // TODO(reserved for a future, separate, explicitly-reviewed stage):
        // jsGlueAccessPlan.shouldAccess is permanently false in this
        // Prototype stage (see FedosWasmLoaderJsGlueAccessPlan's own
        // fixed shape above), so this line can never execute today.
        // The real, allowed JS Glue access path -- including the
        // Generated Artifact Check named in nextRequiredCheck --
        // belongs here -- NOT implemented in this stage.
        return this.#blocked("load");
      }
      // TODO(reserved for a future, separate, explicitly-reviewed stage):
      // loadPlan.shouldLoad is permanently false in this Prototype stage
      // (see FedosWasmLoaderLoadPlan's own fixed shape above), so this
      // line can never execute today. The real, allowed Load path
      // belongs here -- NOT implemented in this stage.
      return this.#blocked("load");
    }
    // TODO(reserved for a future, separate, explicitly-reviewed stage):
    // policy.allowed is permanently false in this Prototype stage (see
    // policy()'s own fixed answer above), so this line can never
    // execute today. The real, allowed Load path belongs here -- NOT
    // implemented in this stage; until it is, this function stays
    // fail-closed no matter what policy() ever answers.
    return this.#blocked("load");
  }

  planInitialize(): FedosWasmLoaderDecision {
    return this.#blocked("initialize");
  }

  planUnload(): FedosWasmLoaderDecision {
    return this.#blocked("unload");
  }

  /**
   * Stage 809 — the Loader's own coarse planning state, decision, and
   * loaded flag, in one non-sensitive snapshot. PURE: does NOT call
   * `planLoad()`/`planInitialize()`/`planUnload()` (no reverse
   * reference), does not read `status()`, and never loads, imports,
   * fetches, or instantiates anything. Fixed `{ state: "Planning",
   * decision: "BlockedByPolicy", loaded: false }`.
   */
  planningState(): FedosWasmLoaderPlanningStatus {
    return {
      state: "Planning",
      decision: "BlockedByPolicy",
      loaded: false,
    };
  }

  /**
   * Stage 817 — the Loader's own fixed POLICY answer, in one
   * non-sensitive snapshot. PURE: does NOT call `planningState()`,
   * `status()`, or `planLoad()`/`planInitialize()`/`planUnload()` (no
   * reverse reference of any kind), and never loads, imports, fetches,
   * or instantiates anything. Fixed `{ allowed: false, decision:
   * "BlockedByPolicy", reason: "PrototypePolicy" }`.
   */
  policy(): FedosWasmLoaderPolicyDecision {
    return {
      allowed: false,
      decision: "BlockedByPolicy",
      reason: "PrototypePolicy",
    };
  }

  /**
   * PRIVATE — builds a `FedosWasmLoaderPlan` and calls its
   * `planImport()`. The result is discarded; it is never passed to
   * `WebAssembly.instantiate`/`compile`, `initSync`/the default init
   * export, `packages/fedos-core-rust`, Runtime, or Worker. The
   * Loader Plan itself never imports anything either.
   */
  #reachLoaderPlan(): void {
    const plan = createFedosWasmLoaderPlan();
    plan.planImport();
  }

  /**
   * PRIVATE — Stage 825, RETURNS the decision as of Stage 833. Calls
   * `this.policy()` exactly once. Through Stage 825 the result was
   * discarded in full; Stage 833 has `planLoad()` actually branch on
   * `.allowed`, so this helper now returns the decision instead of
   * swallowing it. Still never merges the decision into `planLoad()`'s
   * own return VALUE (`.state`/`.policy`/`.reason` stay `planLoad()`'s
   * own, unrelated to `policy()`'s own `.decision`/`.reason`).
   */
  #reachLoaderPolicy(): FedosWasmLoaderPolicyDecision {
    return this.policy();
  }

  /**
   * PRIVATE — Stage 841. Builds the internal-only Load Plan
   * `planLoad()` confirms before returning. PURE: takes no argument,
   * calls nothing (in particular, does NOT call `this.policy()` again
   * — `policy()` already ran exactly once in `planLoad()`, via
   * `#reachLoaderPolicy()`), and returns a hand-fixed constant. Never
   * loads, imports, fetches, or instantiates anything.
   */
  #createLoadPlan(): FedosWasmLoaderLoadPlan {
    return {
      allowed: false,
      shouldLoad: false,
      backend: "Wasm",
      reason: "BlockedByPolicy",
    };
  }

  /**
   * PRIVATE — Stage 865. Builds the internal-only JS Glue Access Plan
   * `planLoad()` confirms one step past the Load Plan. PURE: takes no
   * argument, calls nothing (does NOT call `this.policy()` or
   * `this.#createLoadPlan()` again -- both already ran exactly once
   * earlier in `planLoad()`), and returns a hand-fixed constant. Never
   * loads, imports, fetches, or instantiates anything; does NOT check
   * whether a generated artifact exists (that remains
   * `nextRequiredCheck`'s own named, not-yet-performed, future step).
   */
  #createJsGlueAccessPlan(): FedosWasmLoaderJsGlueAccessPlan {
    return {
      backend: "Wasm",
      shouldAccess: false,
      reason: "BlockedByLoadPlan",
      currentStage: "JsGlueAccessPlanning",
      nextRequiredCheck: "GeneratedArtifactCheck",
    };
  }

  /**
   * PRIVATE — Stage 873. Builds the internal-only Generated Artifact
   * Check Plan `planLoad()` confirms one step past the JS Glue Access
   * Plan. PURE: takes no argument, calls nothing (does NOT call
   * `this.policy()`/`this.#createLoadPlan()`/`this.#createJsGlueAccessPlan()`
   * again -- all three already ran exactly once earlier in
   * `planLoad()`), and returns a hand-fixed constant. Never touches
   * the filesystem, loads, imports, fetches, or instantiates anything;
   * does NOT check whether the generated artifact exists (that
   * remains this Plan's own named, not-yet-performed, future step).
   */
  #createGeneratedArtifactCheckPlan(): FedosWasmLoaderGeneratedArtifactCheckPlan {
    return {
      backend: "Wasm",
      shouldCheck: false,
      reason: "BlockedByJsGlueAccessPlan",
      currentStage: "GeneratedArtifactCheckPlanning",
      nextRequiredCheck: "DevOnlyGate",
    };
  }

  /**
   * PRIVATE — Stage 881. Builds the internal-only Dev-only Gate Plan
   * `planLoad()` confirms one step past the Generated Artifact Check
   * Plan. PURE: takes no argument, calls nothing (does NOT call
   * `this.policy()`/`this.#createLoadPlan()`/
   * `this.#createJsGlueAccessPlan()`/`this.#createGeneratedArtifactCheckPlan()`
   * again -- all four already ran exactly once earlier in
   * `planLoad()`), and returns a hand-fixed constant. Never reads
   * `process.env`/`import.meta`/`NODE_ENV`, never touches the
   * filesystem, loads, imports, fetches, or instantiates anything;
   * does NOT evaluate Development/Production status (that remains
   * this Plan's own named, not-yet-performed, future step).
   */
  #createDevOnlyGatePlan(): FedosWasmLoaderDevOnlyGatePlan {
    return {
      backend: "Wasm",
      shouldEvaluate: false,
      reason: "BlockedByGeneratedArtifactCheckPlan",
      currentStage: "DevOnlyGatePlanning",
      nextRequiredCheck: "ImportPlanning",
    };
  }

  /**
   * PRIVATE — Stage 889. Builds the internal-only Import Plan
   * `planLoad()` confirms one step past the Dev-only Gate Plan. PURE:
   * takes no argument, calls nothing (does NOT call
   * `this.policy()`/`this.#createLoadPlan()`/
   * `this.#createJsGlueAccessPlan()`/`this.#createGeneratedArtifactCheckPlan()`/
   * `this.#createDevOnlyGatePlan()` again -- all five already ran
   * exactly once earlier in `planLoad()`), and returns a hand-fixed
   * constant. Never calls `import()` (static or dynamic), never loads
   * the generated JS glue, never references `WebAssembly`, never
   * touches the filesystem, and never calls Rust; does NOT actually
   * import anything (that remains this Plan's own named,
   * not-yet-performed, future step).
   */
  #createImportPlan(): FedosWasmLoaderImportPlan {
    return {
      backend: "Wasm",
      shouldImport: false,
      reason: "BlockedByDevOnlyGatePlan",
      currentStage: "ImportPlanning",
      nextRequiredCheck: "WebAssemblyPlanning",
    };
  }

  /**
   * PRIVATE — Stage 897. Builds the internal-only WebAssembly Plan
   * `planLoad()` confirms one step past the Import Plan. PURE: takes
   * no argument, calls nothing (does NOT call
   * `this.policy()`/`this.#createLoadPlan()`/
   * `this.#createJsGlueAccessPlan()`/`this.#createGeneratedArtifactCheckPlan()`/
   * `this.#createDevOnlyGatePlan()`/`this.#createImportPlan()` again --
   * all six already ran exactly once earlier in `planLoad()`), and
   * returns a hand-fixed constant. Never calls
   * `WebAssembly.instantiate`/`WebAssembly.compile`, never constructs
   * `new WebAssembly.Module`/`new WebAssembly.Instance`, never calls
   * `initSync`, never loads the generated JS glue, and never calls
   * Rust; does NOT actually instantiate anything (that remains this
   * Plan's own named, not-yet-performed, future step).
   */
  #createWebAssemblyPlan(): FedosWasmLoaderWebAssemblyPlan {
    return {
      backend: "Wasm",
      shouldInstantiate: false,
      reason: "BlockedByImportPlan",
      currentStage: "WebAssemblyPlanning",
      nextRequiredCheck: "RustApiCallPlanning",
    };
  }

  /**
   * PRIVATE — Stage 905. Builds the internal-only Rust API Call Plan
   * `planLoad()` confirms one step past the WebAssembly Plan -- the
   * LAST link in the Planning Chain. PURE: takes no argument, calls
   * nothing (does NOT call
   * `this.policy()`/`this.#createLoadPlan()`/
   * `this.#createJsGlueAccessPlan()`/`this.#createGeneratedArtifactCheckPlan()`/
   * `this.#createDevOnlyGatePlan()`/`this.#createImportPlan()`/
   * `this.#createWebAssemblyPlan()` again -- all seven already ran
   * exactly once earlier in `planLoad()`), and returns a hand-fixed
   * constant. Never calls any Rust public function (including
   * `version()`), never references `#[wasm_bindgen]`/`__wbg_init`,
   * never calls `initSync`, never references `WebAssembly`, never
   * loads the generated JS glue; does NOT actually call Rust (that
   * remains a future, separate, explicitly-reviewed stage's own
   * responsibility).
   */
  #createRustApiCallPlan(): FedosWasmLoaderRustApiCallPlan {
    return {
      backend: "Wasm",
      shouldCall: false,
      reason: "BlockedByWebAssemblyPlan",
      currentStage: "RustApiCallPlanning",
      nextRequiredCheck: "PrototypeExecutionReadiness",
    };
  }

  #blocked(operation: FedosWasmLoaderOperation): FedosWasmLoaderDecision {
    return {
      operation,
      state: "BlockedByPolicy",
      policy: "FailClosed",
      reason: `FedOS WASM loader skeleton does not perform ${operation} in this stage: fail-closed policy blocks every planned operation`,
    };
  }
}

/**
 * Build a `FedosWasmLoader`. `fedos_wasm_backend.ts`'s
 * `createWasmBackend()` (Stage 793) is the only real (non-test) caller
 * of this function; it also exists for direct construction by this
 * codebase's own test suite and for the pure, standalone functions
 * below. Pure; never throws.
 */
export function createFedosWasmLoader(): FedosWasmLoader {
  return new FedosWasmLoaderSkeleton();
}

/**
 * Pure, standalone: the loader's own fixed state — usable by
 * diagnostics WITHOUT constructing a `FedosWasmLoader` instance.
 * Fixed `"NotLoaded"`.
 */
export function loaderState(): FedosWasmLoaderState {
  return "NotLoaded";
}

/**
 * Pure, standalone: the loader's own fixed mode. Fixed
 * `"PlanningOnly"` — this stage only ever plans an operation, never
 * performs one.
 */
export function loaderMode(): FedosWasmLoaderMode {
  return "PlanningOnly";
}

/**
 * Pure, standalone: the loader's own fixed fail-safety policy. Fixed
 * `"FailClosed"` — every planned operation is denied by policy.
 */
export function loaderPolicy(): FedosWasmLoaderPolicy {
  return "FailClosed";
}

/**
 * Pure, standalone: the loader's own fixed coarse PLANNING state —
 * the same answer as `planningState().state`. Fixed `"Planning"` —
 * DELIBERATELY separate from `loaderState()` above, which answers a
 * different question (`"NotLoaded"`/`"Loaded"`, `status()`'s own
 * field). Usable by diagnostics WITHOUT constructing a
 * `FedosWasmLoader` instance.
 */
export function loaderPlanningState(): FedosWasmLoaderPlanningState {
  return "Planning";
}

/**
 * Pure, standalone: the decision `planLoad()` would resolve to,
 * without calling it — the same answer as
 * `planningState().decision`. Fixed `"BlockedByPolicy"` — no
 * parameter or override anywhere can flip it.
 */
export function loaderPlanningDecision(): FedosWasmLoaderDecisionState {
  return "BlockedByPolicy";
}

/**
 * Pure, standalone: whether anything has ever actually loaded — the
 * same answer as `planningState().loaded`. Fixed `false` — no module
 * is ever imported, fetched, or instantiated by this file.
 */
export function loaderLoaded(): boolean {
  return false;
}

/**
 * Pure, standalone: the loader's own fixed POLICY allowance — the
 * same answer as `policy().allowed`. Fixed `false`. Usable by
 * diagnostics WITHOUT constructing a `FedosWasmLoader` instance.
 */
export function loaderPolicyAllowed(): boolean {
  return false;
}

/**
 * Pure, standalone: the loader's own fixed POLICY decision — the
 * same answer as `policy().decision`. Fixed `"BlockedByPolicy"` — no
 * parameter or override anywhere can flip it.
 */
export function loaderPolicyDecision(): FedosWasmLoaderDecisionState {
  return "BlockedByPolicy";
}

/**
 * Pure, standalone: the loader's own fixed POLICY reason — the same
 * answer as `policy().reason`. Fixed `"PrototypePolicy"`.
 */
export function loaderPolicyReason(): string {
  return "PrototypePolicy";
}

/**
 * Pure, standalone: whether `planLoad()` structurally reaches
 * `policy()` — Stage 825. Fixed `true`: `planLoad()`'s own
 * `#reachLoaderPolicy()` helper DOES call `this.policy()` exactly
 * once every time `planLoad()` runs (verified via spy in
 * `test/runtime_wasm_loader_plan_policy_connection.test.ts`), even
 * though the result is always discarded and `planLoad()`'s own return
 * value never changes. NOT a claim that `planLoad()` obeys `policy()`
 * — only that the two are now connected by a real function call.
 */
export function loaderPlanReachedPolicy(): boolean {
  return true;
}

/**
 * Pure, standalone: whether `planLoad()` actually EVALUATES the
 * `policy()` answer it reaches (branches on `.allowed`), rather than
 * merely discarding it — Stage 833. Fixed `true`: `planLoad()`'s own
 * `if (!policy.allowed) { ... }` check DOES run every time `planLoad()`
 * executes, even though the branch it takes never varies (`allowed` is
 * permanently `false`) and `planLoad()`'s own return value never
 * changes. NOT a claim that a real Load ever proceeds — only that the
 * decision is now genuinely read and branched on, not merely reached.
 */
export function loaderPolicyEvaluated(): boolean {
  return true;
}

/**
 * Pure, standalone: whether `planLoad()` structurally creates a Load
 * Plan — Stage 841. Fixed `true`: `planLoad()`'s own `#createLoadPlan()`
 * call DOES run every time `policy.allowed` evaluates `false` (which
 * is always, today), even though the Load Plan's own fields are never
 * merged into `planLoad()`'s return value.
 */
export function loaderLoadPlanCreated(): boolean {
  return true;
}

/**
 * Pure, standalone: the loader's own fixed Load Plan `allowed` field —
 * the same answer as `FedosWasmLoaderLoadPlan.allowed`. Fixed `false`.
 */
export function loaderLoadPlanAllowed(): boolean {
  return false;
}

/**
 * Pure, standalone: the loader's own fixed Load Plan `shouldLoad`
 * field — the same answer as `FedosWasmLoaderLoadPlan.shouldLoad`.
 * Fixed `false` — no parameter or override anywhere can flip it.
 */
export function loaderLoadPlanShouldLoad(): boolean {
  return false;
}

/**
 * Pure, standalone: the loader's own fixed Load Plan `backend` field —
 * the same answer as `FedosWasmLoaderLoadPlan.backend`. Fixed
 * `"Wasm"` — the first (and, in this stage, only) candidate backend
 * this Loader's Load Plan ever names.
 */
export function loaderLoadPlanBackend(): "Wasm" {
  return "Wasm";
}

/**
 * Pure, standalone: whether `planLoad()` structurally creates a JS
 * Glue Access Plan — Stage 865. Fixed `true`: `planLoad()`'s own
 * `#createJsGlueAccessPlan()` call DOES run every time
 * `loadPlan.shouldLoad` evaluates `false` (which is always, today),
 * even though the JS Glue Access Plan's own fields are never merged
 * into `planLoad()`'s return value.
 */
export function loaderJsGlueAccessPlanCreated(): boolean {
  return true;
}

/**
 * Pure, standalone: the loader's own fixed JS Glue Access Plan
 * `shouldAccess` field — the same answer as
 * `FedosWasmLoaderJsGlueAccessPlan.shouldAccess`. Fixed `false` — no
 * parameter or override anywhere can flip it.
 */
export function loaderJsGlueAccessPlanShouldAccess(): boolean {
  return false;
}

/**
 * Pure, standalone: the loader's own fixed JS Glue Access Plan
 * `backend` field — the same answer as
 * `FedosWasmLoaderJsGlueAccessPlan.backend`. Fixed `"Wasm"`.
 */
export function loaderJsGlueAccessPlanBackend(): "Wasm" {
  return "Wasm";
}

/**
 * Pure, standalone: the loader's own fixed JS Glue Access Plan
 * `reason` field — the same answer as
 * `FedosWasmLoaderJsGlueAccessPlan.reason`. Fixed `"BlockedByLoadPlan"`
 * — the Load Plan one level up already said `shouldLoad: false`;
 * `"PrototypeDisabled"`/`"GeneratedArtifactUnchecked"` are the OTHER
 * two labels the type permits but this stage never produces.
 */
export function loaderJsGlueAccessPlanReason():
  | "BlockedByLoadPlan"
  | "PrototypeDisabled"
  | "GeneratedArtifactUnchecked" {
  return "BlockedByLoadPlan";
}

/**
 * Pure, standalone: the loader's own fixed JS Glue Access Plan
 * `currentStage` field — the same answer as
 * `FedosWasmLoaderJsGlueAccessPlan.currentStage`. Fixed
 * `"JsGlueAccessPlanning"`.
 */
export function loaderJsGlueAccessPlanCurrentStage(): "JsGlueAccessPlanning" {
  return "JsGlueAccessPlanning";
}

/**
 * Pure, standalone: the loader's own fixed JS Glue Access Plan
 * `nextRequiredCheck` field — the same answer as
 * `FedosWasmLoaderJsGlueAccessPlan.nextRequiredCheck`. Fixed
 * `"GeneratedArtifactCheck"` — NAMES, without PERFORMING, the very
 * next gate a future, separate, explicitly-reviewed stage (Phase
 * 016+) would need to add.
 */
export function loaderJsGlueAccessPlanNextRequiredCheck(): "GeneratedArtifactCheck" {
  return "GeneratedArtifactCheck";
}

/**
 * Pure, standalone: whether `planLoad()` structurally creates a
 * Generated Artifact Check Plan — Stage 873. Fixed `true`:
 * `planLoad()`'s own `#createGeneratedArtifactCheckPlan()` call DOES
 * run every time `jsGlueAccessPlan.shouldAccess` evaluates `false`
 * (which is always, today), even though the Plan's own fields are
 * never merged into `planLoad()`'s return value.
 */
export function loaderGeneratedArtifactCheckPlanCreated(): boolean {
  return true;
}

/**
 * Pure, standalone: the loader's own fixed Generated Artifact Check
 * Plan `shouldCheck` field — the same answer as
 * `FedosWasmLoaderGeneratedArtifactCheckPlan.shouldCheck`. Fixed
 * `false` — no parameter or override anywhere can flip it.
 */
export function loaderGeneratedArtifactCheckPlanShouldCheck(): boolean {
  return false;
}

/**
 * Pure, standalone: the loader's own fixed Generated Artifact Check
 * Plan `backend` field — the same answer as
 * `FedosWasmLoaderGeneratedArtifactCheckPlan.backend`. Fixed `"Wasm"`.
 */
export function loaderGeneratedArtifactCheckPlanBackend(): "Wasm" {
  return "Wasm";
}

/**
 * Pure, standalone: the loader's own fixed Generated Artifact Check
 * Plan `reason` field — the same answer as
 * `FedosWasmLoaderGeneratedArtifactCheckPlan.reason`. Fixed
 * `"BlockedByJsGlueAccessPlan"` — the JS Glue Access Plan one level up
 * already said `shouldAccess: false`; `"PrototypeDisabled"`/
 * `"FilesystemAccessUnavailable"` are the OTHER two labels the type
 * permits but this stage never produces.
 */
export function loaderGeneratedArtifactCheckPlanReason():
  | "BlockedByJsGlueAccessPlan"
  | "PrototypeDisabled"
  | "FilesystemAccessUnavailable" {
  return "BlockedByJsGlueAccessPlan";
}

/**
 * Pure, standalone: the loader's own fixed Generated Artifact Check
 * Plan `currentStage` field — the same answer as
 * `FedosWasmLoaderGeneratedArtifactCheckPlan.currentStage`. Fixed
 * `"GeneratedArtifactCheckPlanning"`.
 */
export function loaderGeneratedArtifactCheckPlanCurrentStage(): "GeneratedArtifactCheckPlanning" {
  return "GeneratedArtifactCheckPlanning";
}

/**
 * Pure, standalone: the loader's own fixed Generated Artifact Check
 * Plan `nextRequiredCheck` field — the same answer as
 * `FedosWasmLoaderGeneratedArtifactCheckPlan.nextRequiredCheck`. Fixed
 * `"DevOnlyGate"` — NAMES, without PERFORMING, the very next gate a
 * future, separate, explicitly-reviewed stage (Phase 017+) would need
 * to add.
 */
export function loaderGeneratedArtifactCheckPlanNextRequiredCheck(): "DevOnlyGate" {
  return "DevOnlyGate";
}

/**
 * Pure, standalone: whether `planLoad()` structurally creates a
 * Dev-only Gate Plan — Stage 881. Fixed `true`: `planLoad()`'s own
 * `#createDevOnlyGatePlan()` call DOES run every time
 * `artifactCheckPlan.shouldCheck` evaluates `false` (which is always,
 * today), even though the Plan's own fields are never merged into
 * `planLoad()`'s return value.
 */
export function loaderDevOnlyGatePlanCreated(): boolean {
  return true;
}

/**
 * Pure, standalone: the loader's own fixed Dev-only Gate Plan
 * `shouldEvaluate` field — the same answer as
 * `FedosWasmLoaderDevOnlyGatePlan.shouldEvaluate`. Fixed `false` — no
 * parameter or override anywhere can flip it; no environment variable
 * is ever read to compute it.
 */
export function loaderDevOnlyGatePlanShouldEvaluate(): boolean {
  return false;
}

/**
 * Pure, standalone: the loader's own fixed Dev-only Gate Plan
 * `backend` field — the same answer as
 * `FedosWasmLoaderDevOnlyGatePlan.backend`. Fixed `"Wasm"`.
 */
export function loaderDevOnlyGatePlanBackend(): "Wasm" {
  return "Wasm";
}

/**
 * Pure, standalone: the loader's own fixed Dev-only Gate Plan `reason`
 * field — the same answer as
 * `FedosWasmLoaderDevOnlyGatePlan.reason`. Fixed
 * `"BlockedByGeneratedArtifactCheckPlan"` — the Generated Artifact
 * Check Plan one level up already said `shouldCheck: false`;
 * `"PrototypeDisabled"`/`"DevelopmentGateUnavailable"` are the OTHER
 * two labels the type permits but this stage never produces.
 */
export function loaderDevOnlyGatePlanReason():
  | "BlockedByGeneratedArtifactCheckPlan"
  | "PrototypeDisabled"
  | "DevelopmentGateUnavailable" {
  return "BlockedByGeneratedArtifactCheckPlan";
}

/**
 * Pure, standalone: the loader's own fixed Dev-only Gate Plan
 * `currentStage` field — the same answer as
 * `FedosWasmLoaderDevOnlyGatePlan.currentStage`. Fixed
 * `"DevOnlyGatePlanning"`.
 */
export function loaderDevOnlyGatePlanCurrentStage(): "DevOnlyGatePlanning" {
  return "DevOnlyGatePlanning";
}

/**
 * Pure, standalone: the loader's own fixed Dev-only Gate Plan
 * `nextRequiredCheck` field — the same answer as
 * `FedosWasmLoaderDevOnlyGatePlan.nextRequiredCheck`. Fixed
 * `"ImportPlanning"` — NAMES, without PERFORMING, the very next gate a
 * future, separate, explicitly-reviewed stage (Phase 018+) would need
 * to add.
 */
export function loaderDevOnlyGatePlanNextRequiredCheck(): "ImportPlanning" {
  return "ImportPlanning";
}

/**
 * Pure, standalone: whether `planLoad()` structurally creates an
 * Import Plan — Stage 889. Fixed `true`: `planLoad()`'s own
 * `#createImportPlan()` call DOES run every time
 * `devOnlyGatePlan.shouldEvaluate` evaluates `false` (which is always,
 * today), even though the Plan's own fields are never merged into
 * `planLoad()`'s return value.
 */
export function loaderImportPlanCreated(): boolean {
  return true;
}

/**
 * Pure, standalone: the loader's own fixed Import Plan `shouldImport`
 * field — the same answer as `FedosWasmLoaderImportPlan.shouldImport`.
 * Fixed `false` — no parameter or override anywhere can flip it; no
 * `import()` of any kind is ever performed to compute it.
 */
export function loaderImportPlanShouldImport(): boolean {
  return false;
}

/**
 * Pure, standalone: the loader's own fixed Import Plan `backend`
 * field — the same answer as `FedosWasmLoaderImportPlan.backend`.
 * Fixed `"Wasm"`.
 */
export function loaderImportPlanBackend(): "Wasm" {
  return "Wasm";
}

/**
 * Pure, standalone: the loader's own fixed Import Plan `reason` field
 * — the same answer as `FedosWasmLoaderImportPlan.reason`. Fixed
 * `"BlockedByDevOnlyGatePlan"` — the Dev-only Gate Plan one level up
 * already said `shouldEvaluate: false`; `"PrototypeDisabled"`/
 * `"ImportUnavailable"` are the OTHER two labels the type permits but
 * this stage never produces.
 */
export function loaderImportPlanReason():
  | "BlockedByDevOnlyGatePlan"
  | "PrototypeDisabled"
  | "ImportUnavailable" {
  return "BlockedByDevOnlyGatePlan";
}

/**
 * Pure, standalone: the loader's own fixed Import Plan `currentStage`
 * field — the same answer as
 * `FedosWasmLoaderImportPlan.currentStage`. Fixed `"ImportPlanning"`.
 */
export function loaderImportPlanCurrentStage(): "ImportPlanning" {
  return "ImportPlanning";
}

/**
 * Pure, standalone: the loader's own fixed Import Plan
 * `nextRequiredCheck` field — the same answer as
 * `FedosWasmLoaderImportPlan.nextRequiredCheck`. Fixed
 * `"WebAssemblyPlanning"` — NAMES, without PERFORMING, the very next
 * gate a future, separate, explicitly-reviewed stage (Phase 019+)
 * would need to add.
 */
export function loaderImportPlanNextRequiredCheck(): "WebAssemblyPlanning" {
  return "WebAssemblyPlanning";
}

/**
 * Pure, standalone: whether `planLoad()` structurally creates a
 * WebAssembly Plan — Stage 897. Fixed `true`: `planLoad()`'s own
 * `#createWebAssemblyPlan()` call DOES run every time
 * `importPlan.shouldImport` evaluates `false` (which is always,
 * today), even though the Plan's own fields are never merged into
 * `planLoad()`'s return value.
 */
export function loaderWebAssemblyPlanCreated(): boolean {
  return true;
}

/**
 * Pure, standalone: the loader's own fixed WebAssembly Plan
 * `shouldInstantiate` field — the same answer as
 * `FedosWasmLoaderWebAssemblyPlan.shouldInstantiate`. Fixed `false` —
 * no parameter or override anywhere can flip it; no
 * `WebAssembly.instantiate`/`WebAssembly.compile` of any kind is ever
 * called to compute it.
 */
export function loaderWebAssemblyPlanShouldInstantiate(): boolean {
  return false;
}

/**
 * Pure, standalone: the loader's own fixed WebAssembly Plan `backend`
 * field — the same answer as
 * `FedosWasmLoaderWebAssemblyPlan.backend`. Fixed `"Wasm"`.
 */
export function loaderWebAssemblyPlanBackend(): "Wasm" {
  return "Wasm";
}

/**
 * Pure, standalone: the loader's own fixed WebAssembly Plan `reason`
 * field — the same answer as
 * `FedosWasmLoaderWebAssemblyPlan.reason`. Fixed
 * `"BlockedByImportPlan"` — the Import Plan one level up already said
 * `shouldImport: false`; `"PrototypeDisabled"`/
 * `"WebAssemblyUnavailable"` are the OTHER two labels the type permits
 * but this stage never produces.
 */
export function loaderWebAssemblyPlanReason():
  | "BlockedByImportPlan"
  | "PrototypeDisabled"
  | "WebAssemblyUnavailable" {
  return "BlockedByImportPlan";
}

/**
 * Pure, standalone: the loader's own fixed WebAssembly Plan
 * `currentStage` field — the same answer as
 * `FedosWasmLoaderWebAssemblyPlan.currentStage`. Fixed
 * `"WebAssemblyPlanning"`.
 */
export function loaderWebAssemblyPlanCurrentStage(): "WebAssemblyPlanning" {
  return "WebAssemblyPlanning";
}

/**
 * Pure, standalone: the loader's own fixed WebAssembly Plan
 * `nextRequiredCheck` field — the same answer as
 * `FedosWasmLoaderWebAssemblyPlan.nextRequiredCheck`. Fixed
 * `"RustApiCallPlanning"` — NAMES, without PERFORMING, the very next
 * gate a future, separate, explicitly-reviewed stage (Phase 020+)
 * would need to add.
 */
export function loaderWebAssemblyPlanNextRequiredCheck(): "RustApiCallPlanning" {
  return "RustApiCallPlanning";
}

/**
 * Pure, standalone: whether `planLoad()` structurally creates a Rust
 * API Call Plan — Stage 905. Fixed `true`: `planLoad()`'s own
 * `#createRustApiCallPlan()` call DOES run every time
 * `webAssemblyPlan.shouldInstantiate` evaluates `false` (which is
 * always, today), even though the Plan's own fields are never merged
 * into `planLoad()`'s return value.
 */
export function loaderRustApiCallPlanCreated(): boolean {
  return true;
}

/**
 * Pure, standalone: the loader's own fixed Rust API Call Plan
 * `shouldCall` field — the same answer as
 * `FedosWasmLoaderRustApiCallPlan.shouldCall`. Fixed `false` — no
 * parameter or override anywhere can flip it; no Rust public function
 * of any kind is ever called to compute it.
 */
export function loaderRustApiCallPlanShouldCall(): boolean {
  return false;
}

/**
 * Pure, standalone: the loader's own fixed Rust API Call Plan
 * `backend` field — the same answer as
 * `FedosWasmLoaderRustApiCallPlan.backend`. Fixed `"Wasm"`.
 */
export function loaderRustApiCallPlanBackend(): "Wasm" {
  return "Wasm";
}

/**
 * Pure, standalone: the loader's own fixed Rust API Call Plan
 * `reason` field — the same answer as
 * `FedosWasmLoaderRustApiCallPlan.reason`. Fixed
 * `"BlockedByWebAssemblyPlan"` — the WebAssembly Plan one level up
 * already said `shouldInstantiate: false`; `"PrototypeDisabled"`/
 * `"RustApiUnavailable"` are the OTHER two labels the type permits but
 * this stage never produces.
 */
export function loaderRustApiCallPlanReason():
  | "BlockedByWebAssemblyPlan"
  | "PrototypeDisabled"
  | "RustApiUnavailable" {
  return "BlockedByWebAssemblyPlan";
}

/**
 * Pure, standalone: the loader's own fixed Rust API Call Plan
 * `currentStage` field — the same answer as
 * `FedosWasmLoaderRustApiCallPlan.currentStage`. Fixed
 * `"RustApiCallPlanning"`.
 */
export function loaderRustApiCallPlanCurrentStage(): "RustApiCallPlanning" {
  return "RustApiCallPlanning";
}

/**
 * Pure, standalone: the loader's own fixed Rust API Call Plan
 * `nextRequiredCheck` field — the same answer as
 * `FedosWasmLoaderRustApiCallPlan.nextRequiredCheck`. Fixed
 * `"PrototypeExecutionReadiness"` — NAMES, without PERFORMING, a
 * REVIEW of the now-complete Planning Chain a future, separate,
 * explicitly-reviewed stage (Phase 021+) would need to perform — NOT
 * an eighth internal Plan.
 */
export function loaderRustApiCallPlanNextRequiredCheck(): "PrototypeExecutionReadiness" {
  return "PrototypeExecutionReadiness";
}
