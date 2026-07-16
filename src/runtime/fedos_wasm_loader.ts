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
 *
 * Stage 921 (Prototype EXECUTION Phase 001) is the FIRST controlled
 * exception to this file's own Stage 489 HARD GUARDRAILS above ("None
 * ever inspects `packages/fedos-core-rust/pkg/`, `import.meta`, the
 * filesystem, or any environment variable") — narrowly and explicitly
 * SCOPED to a live, read-only EXISTENCE check of exactly the two named
 * Generated Artifact files
 * (`FedosWasmLoaderGeneratedArtifactName` — `"fedos_core_rust.js"`/
 * `"fedos_core_rust_bg.wasm"`, matching
 * `docs/runtime_wasm_js_glue_contract.md`'s own observed
 * `packages/fedos-core-rust/pkg/` shape). `docs/runtime_wasm_loader_execution_readiness_review.md`
 * (Stage 913, Prototype Phase 021) named this EXACT check as the
 * recommended first candidate for real execution — this stage
 * implements ONLY that one candidate, nothing further. A new PRIVATE
 * `#checkGeneratedArtifacts()` method calls `existsSync` (`node:fs`)
 * on each of the two target paths under `process.cwd()` — the FIRST
 * real (non-fixed-constant) computation this file has ever performed
 * — and returns `FedosWasmLoaderGeneratedArtifactCheckResult`
 * (`checkedArtifacts`/`missingArtifacts`/`artifactsExist`), wrapped in
 * a try/catch that treats ANY failure to check (including `process`/
 * `existsSync` being unavailable at all) as Fail Closed — a missing
 * artifact, never a thrown exception. `planLoad()`'s flow calls it
 * EXACTLY once, immediately after `artifactCheckPlan.shouldCheck` is
 * confirmed `false` (the SAME position the Planning Chain's own
 * `Generated Artifact Check Plan` already occupies) — the result is
 * stored on the instance (`this.#generatedArtifactCheckResult`,
 * readable via the new PUBLIC `generatedArtifactCheckResult()`
 * method) but is NEVER read by any `if` condition in `planLoad()`:
 * every pre-existing nested Plan (`Dev-only Gate Plan` through `Rust
 * API Call Plan`) still runs in EXACTLY the same order as before, and
 * `planLoad()` still ALWAYS returns the SAME `#blocked("load")`
 * answer — `{ operation: "load", state: "BlockedByPolicy", policy:
 * "FailClosed", reason: "..." }`, key order included — REGARDLESS of
 * whether the artifacts are found or missing.
 * `FedosWasmLoaderGeneratedArtifactCheckPlan.shouldCheck` (Stage 873)
 * and every other Plan's own `should*` field remain fixed `false`,
 * completely UNCHANGED and completely DECOUPLED from this real
 * result — an artifact existing does NOT flip `shouldImport`,
 * `shouldInstantiate`, or `shouldCall` to `true` anywhere in this
 * file. This is EXECUTION, but only of an existence check — `import()`
 * (static or dynamic), `require()`, reading or executing the
 * generated JS glue's own bytes, `WebAssembly.instantiate`/`compile`,
 * `new WebAssembly.Module`/`new WebAssembly.Instance`, `initSync`,
 * `__wbg_init`, and any Rust API call (including `version()`) remain
 * exactly as unimplemented and unreachable as every prior Prototype
 * stage — `import()` itself stays entirely within `Import Plan`'s own
 * (Stage 889) unchanged Planning territory.
 *
 * Stage 929 (Prototype EXECUTION Phase 002) is the SECOND controlled
 * exception to the Stage 489 HARD GUARDRAILS — one Planning Chain
 * link further, past the Stage 921 existence check. A new PRIVATE
 * `#evaluateDevOnlyGate()` method reads the SAME ambient `process.env`
 * this file's "Stage 929" extension of the Stage 921 `process`
 * declaration exposes (`NODE_ENV` only, nothing else), wrapped in a
 * try/catch that treats ANY failure to read (including `process`/
 * `process.env` being unavailable at all) as Fail Closed, and returns
 * `FedosWasmLoaderDevOnlyGateEvaluation`
 * (`evaluated`/`developmentAllowed`/`reason`) — the SECOND real
 * (non-fixed-constant) computation this file has ever performed.
 * `planLoad()`'s flow calls it EXACTLY once, immediately after
 * `devOnlyGatePlan.shouldEvaluate` is confirmed `false` (the SAME
 * position the Planning Chain's own `Dev-only Gate Plan` already
 * occupies) — the result is stored on the instance
 * (`this.#devOnlyGateEvaluation`, readable via the new PUBLIC
 * `devOnlyGateEvaluation()` method) but is NEVER read by any `if`
 * condition in `planLoad()`: `Import Plan`/`WebAssembly Plan`/`Rust
 * API Call Plan` still run in EXACTLY the same order as before, and
 * `planLoad()` still ALWAYS returns the SAME `#blocked("load")`
 * answer, REGARDLESS of whether the runtime evaluates as Development,
 * Production, or Unknown. **Evaluating Development Runtime is not
 * granting import permission.** `FedosWasmLoaderImportPlan.shouldImport`
 * (Stage 889) and every other Plan's own `should*` field remain fixed
 * `false`, completely UNCHANGED and completely DECOUPLED from this
 * real result — `developmentAllowed: true` does NOT flip
 * `shouldImport`, `shouldInstantiate`, or `shouldCall` to `true`
 * anywhere in this file. This is EXECUTION, but only of a read-only
 * runtime-kind evaluation — `import()` (static or dynamic),
 * `require()`, reading or executing the generated JS glue's own
 * bytes, `WebAssembly.instantiate`/`compile`, `new WebAssembly.Module`/
 * `new WebAssembly.Instance`, `initSync`, `__wbg_init`, and any Rust
 * API call (including `version()`) remain exactly as unimplemented
 * and unreachable as every prior Prototype stage.
 *
 * Stage 937 (Prototype EXECUTION Phase 003) is the THIRD controlled
 * exception to the Stage 489 HARD GUARDRAILS — one Planning Chain
 * link further, past the Stage 929 Dev-only Gate Evaluation. UNLIKE
 * Stage 921/929, this new step reads NO live external state of its
 * own — a new PRIVATE `#evaluateImportReadiness()` method is a PURE
 * combination of the two prior real results
 * (`this.#generatedArtifactCheckResult.artifactsExist`,
 * `this.#devOnlyGateEvaluation.developmentAllowed`), and returns
 * `FedosWasmLoaderImportReadiness`
 * (`evaluated`/`ready`/`reason`) — the THIRD real (non-fixed-constant)
 * computation this file has ever performed, though computed WITHOUT
 * any new filesystem/environment read. `planLoad()`'s flow calls it
 * EXACTLY once, immediately after `importPlan.shouldImport` is
 * confirmed `false` (the SAME position the Planning Chain's own
 * `Import Plan` already occupies) — the result is stored on the
 * instance (`this.#importReadiness`, readable via the new PUBLIC
 * `importReadiness()` method) but is NEVER read by any `if` condition
 * in `planLoad()`: `WebAssembly Plan`/`Rust API Call Plan` still run
 * in EXACTLY the same order as before, and `planLoad()` still ALWAYS
 * returns the SAME `#blocked("load")` answer, REGARDLESS of whether
 * `ready` evaluates `true` or `false`. **Import Readiness is not
 * import permission.** `FedosWasmLoaderImportPlan.shouldImport`
 * (Stage 889) and every other Plan's own `should*` field remain fixed
 * `false`, completely UNCHANGED and completely DECOUPLED from this
 * real result — `ready: true` (both the artifact AND the runtime
 * condition satisfied) does NOT flip `shouldImport`,
 * `shouldInstantiate`, or `shouldCall` to `true` anywhere in this
 * file; it only NAMES that the two conditions this Prototype knows
 * how to evaluate are satisfied. A new PUBLIC
 * `executionReadinessSummary()` method combines all three real
 * results recorded so far (`artifactsOk`/`runtimeOk`/`importReady`)
 * with three permanently-fixed `false` flags
 * (`importExecuted`/`webAssemblyExecuted`/`rustExecuted`) into one
 * readable snapshot — itself performing no new check, purely reading
 * what `planLoad()` already recorded. `import()` (static or dynamic),
 * `require()`, reading or executing the generated JS glue's own
 * bytes, `WebAssembly.instantiate`/`compile`, `new WebAssembly.Module`/
 * `new WebAssembly.Instance`, `initSync`, `__wbg_init`, and any Rust
 * API call (including `version()`) remain exactly as unimplemented
 * and unreachable as every prior Prototype stage.
 *
 * Stage 945 (Prototype EXECUTION Phase 004) is the FOURTH controlled
 * exception to the Stage 489 HARD GUARDRAILS — the FIRST stage this
 * whole arc ever actually calls `import()`. Real dynamic `import()` is
 * inherently asynchronous, but `planLoad()` itself is, and stays, a
 * SYNCHRONOUS method returning `FedosWasmLoaderDecision` directly (not
 * a `Promise`) — every prior stage's own test suite calls `planLoad()`
 * and asserts on its return value synchronously, so changing its
 * signature would be a breaking change far outside this stage's
 * "necessary minimum" scope. This stage therefore does NOT add any
 * call inside `planLoad()`'s own body; `planLoad()` is BYTE-FOR-BYTE
 * UNCHANGED by this stage. Instead, a NEW, separate, PUBLIC, ASYNC
 * method — `attemptDevOnlyJsGlueImport(): Promise<FedosWasmLoaderImportExecution>`
 * — reads `this.#importReadiness` (populated by the MOST RECENT
 * `planLoad()` call; `null` if `planLoad()` was never called) as its
 * ONLY gate: if `readiness` is `null` or `readiness.ready` is `false`,
 * `import()` is NEVER attempted at all (`attempted: false`,
 * `reason: "PrototypeStillClosed"`/`"NotReady"` respectively). ONLY
 * when `readiness.ready === true` does this method call real,
 * dynamic `import()` (via `pathToFileURL`, `node:url` — a THIRD
 * `@ts-expect-error`-suppressed Node built-in, alongside Stage 921's
 * `node:fs`/`node:path`) on the SAME single Generated JS Glue path
 * (`packages/fedos-core-rust/pkg/fedos_core_rust.js`, the SAME literal
 * name `FedosWasmLoaderGeneratedArtifactName`/`GENERATED_ARTIFACT_NAMES`
 * already name — NO new filesystem exploration, NO new artifact
 * discovery, and never the `.wasm` file) — wrapped in a `try`/`catch`
 * that Fails Closed to `reason: "ImportFailed"` on ANY thrown/rejected
 * error. **Even on success, this method touches nothing further**: the
 * imported module's own return value is immediately discarded (never
 * assigned to a field, never inspected, never called) — no
 * `__wbg_init`, no `initSync`, no `WebAssembly.instantiate`/`compile`,
 * no `new WebAssembly.Module`/`new WebAssembly.Instance`, and no Rust
 * API call (including `version()`) of any kind. The result —
 * `FedosWasmLoaderImportExecution`
 * (`attempted`/`succeeded`/`reason`) — is stored on the instance
 * (`this.#importExecution`, readable via the new PUBLIC
 * `importExecution()` method). This new method is called by NOTHING
 * else in this file, in `create_runtime.ts`, or in `src/worker.ts` —
 * it is exactly as unreached by any upstream layer as every other
 * Execution-stage capability in this arc, and `planLoad()` itself
 * still ALWAYS returns the SAME `#blocked("load")` answer whether or
 * not `attemptDevOnlyJsGlueImport()` has ever been called, or with
 * what result.
 *
 * The actual `import()` call is made through
 * `this.#importGeneratedJsGlue` — a private field defaulting to real,
 * native dynamic `import()`, optionally overridable via the
 * constructor's `FedosWasmLoaderSkeletonOptions.importGeneratedJsGlue`
 * — so tests can observe both the success and failure paths without
 * depending on a real Generated JS Glue file existing on disk.
 * `createFedosWasmLoader()` NEVER supplies this option, so every real
 * caller always gets real dynamic `import()`.
 *
 * Stage 961 (Prototype EXECUTION Phase 006) makes ONE change to
 * `attemptDevOnlyJsGlueImport()` (Stage 945): on a successful import,
 * the resolved module — previously discarded — is now RETAINED, as an
 * opaque value, on a new private field (`this.#jsGlueModule`), and
 * readable via a new PUBLIC `jsGlueModule()` method. This is the
 * SAME "import and WASM-init are separate responsibilities" design
 * `docs/runtime_wasm_loader_js_glue_import_result_review.md` (a
 * docs-only review with no `fedos_wasm_loader.ts` change) recommended
 * as Option B — retention is the FIRST half of what a future,
 * separate, explicitly-reviewed WASM-init stage would need; this
 * stage does NOT initialize anything with the retained module.
 * `#jsGlueModule` is NEVER inspected, NEVER destructured, and NEVER
 * called by this file — its own shape/exports are read by NOTHING
 * here; it is held ONLY so a future stage can pass it, unexamined, to
 * `initSync`/`__wbg_init` (whichever Stage a future review picks — see
 * `docs/runtime_wasm_loader_js_glue_import_result_review.md` §5,
 * explicitly deferred). On EVERY other outcome (`"NotReady"`,
 * `"PrototypeStillClosed"`, `"ImportFailed"`), `#jsGlueModule` is set
 * to `null`, Fail Closed — a stale RETAINED module from an EARLIER
 * successful call is never left behind by a LATER unsuccessful one.
 * `WebAssembly.instantiate`/`compile`, `new WebAssembly.Module`/
 * `new WebAssembly.Instance`, `initSync`, `__wbg_init`, and any Rust
 * API call (including `version()`) remain exactly as unimplemented
 * and unreachable as every prior Prototype stage — `planLoad()` itself
 * is UNTOUCHED by this stage, exactly as it was by Stage 945.
 *
 * Stage 969 (Prototype EXECUTION Phase 007) is the FIRST stage this
 * arc ever actually initializes WebAssembly — the FIFTH controlled
 * exception to the Stage 489 HARD GUARDRAILS. A Pre-check (built the
 * real artifact once via `npm run build:wasm`, inspected it, then
 * deleted `target/`/`Cargo.lock`/`pkg/`) confirmed the generated JS
 * glue is a `--target web` build exposing EXACTLY two init functions
 * — `initSync` (sync, named) and `default`/`__wbg_init` (async) — and
 * NO crate-specific export of any kind (no `version`, matching
 * `docs/runtime_wasm_js_glue_contract.md`'s own Stage 481
 * observation): neither init function can ever reach a Rust `pub fn`
 * regardless of outcome. A NEW, separate, PUBLIC, ASYNC method —
 * `attemptDevOnlyWasmInitialization(): Promise<FedosWasmLoaderWasmInitialization>`
 * — follows the SAME pattern as Stage 945's
 * `attemptDevOnlyJsGlueImport()`: `planLoad()` itself is NOT called
 * from, and does NOT call, this method — BYTE-FOR-BYTE UNCHANGED once
 * again. Its ONLY gate is ALL FOUR of: `this.#importReadiness.ready`,
 * `this.#devOnlyGateEvaluation.developmentAllowed`,
 * `this.#importExecution.succeeded`, and `this.#jsGlueModule !== null`
 * — every one populated by EARLIER method calls, never re-evaluated
 * here. The retained module (Stage 961) is checked, at runtime, for
 * WHICH of its two init functions is actually present
 * (`typeof module.initSync === "function"`, then `typeof
 * module.default === "function"`) — NEVER hand-picking one in source
 * code, and NEVER searching for anything beyond those two names.
 * `initSync` is preferred WHEN PRESENT, because `default`'s own
 * built-in no-argument fallback (`fetch(new URL(...,
 * import.meta.url))`) is a real risk under this project's Node/Vitest
 * runtime (a `file://` URL passed to `fetch` is not universally
 * supported); this stage NEVER calls `default()` with no argument
 * either way — it always passes the SAME `fedos_core_rust_bg.wasm`
 * bytes Stage 921 already named (via a NEW, injectable
 * `this.#readGeneratedWasmBytes` field, defaulting to real `node:fs`
 * `readFileSync` — a FOURTH `@ts-expect-error`-suppressed Node
 * built-in only in the sense of one more NAMED IMPORT from the SAME
 * already-suppressed `node:fs` line Stage 921 opened, not a new
 * module), so `WebAssembly.instantiateStreaming`'s own `Response`
 * expectation is never exercised either. The whole attempt is wrapped
 * in `try`/`catch` that Fails Closed to `reason: "InitializationFailed"`
 * on ANY thrown/rejected error (bytes-read failure included). The
 * result — `FedosWasmLoaderWasmInitialization`
 * (`attempted`/`succeeded`/`reason`) — is stored on the instance
 * (`this.#wasmInitialization`, readable via the new PUBLIC
 * `wasmInitialization()` method); the `InitOutput`/`memory`/instance
 * itself is NEVER retained, NEVER inspected, and NEVER read anywhere
 * in this file — this method only ever RECORDS whether initialization
 * happened, never what it produced. Even on success, NO Rust API call
 * of any kind (including `version()`) is ever made, because none is
 * exported by the JS glue to call in the first place.
 *
 * Stage 993 (Prototype EXECUTION Phase 012) — the FIRST time this arc
 * ever calls a real Rust API through the retained JS glue module.
 * Prototype EXECUTION Phase 010 added `#[wasm_bindgen] pub fn
 * version() -> String` to `src/lib.rs`; Phase 011's own real,
 * one-time `npm run build:wasm` run confirmed the generated JS glue
 * exports exactly `version`/`initSync`/`default`, and that `version()`
 * calls `wasm.version()` under the hood — see
 * `docs/runtime_wasm_js_glue_version_export_verification.md`. A NEW,
 * separate, PUBLIC, ASYNC method —
 * `attemptDevOnlyRustVersionCall(): Promise<FedosWasmLoaderRustVersionExecution>`
 * — follows the SAME pattern as Stage 945/969's own async methods:
 * `planLoad()` itself is NOT called from, and does NOT call, this
 * method — BYTE-FOR-BYTE UNCHANGED once again, and neither is
 * `initializeCrypto()`. Its gate is ALL SIX of:
 * `this.#generatedArtifactCheckResult.artifactsExist`,
 * `this.#devOnlyGateEvaluation.developmentAllowed`,
 * `this.#importReadiness.ready`, `this.#importExecution.succeeded`,
 * `this.#jsGlueModule !== null`, and
 * `this.#wasmInitialization.succeeded` — every one populated by an
 * EARLIER method call, never re-evaluated here. When satisfied, checks
 * ONLY `typeof module.version === "function"` — no export-list
 * enumeration or discovery of any kind, matching this Phase's own
 * "`module.version` only" scope. Calls `module.version()` with NO
 * argument, wrapped in `try`/`catch` that Fails Closed to
 * `reason: "CallFailed"` on ANY thrown/rejected error OR a non-`string`
 * return value — only a genuine `string` return resolves
 * `reason: "Succeeded"`. The result —
 * `FedosWasmLoaderRustVersionExecution`
 * (`attempted`/`succeeded`/`version`/`reason`) — is stored on the
 * instance (`this.#rustVersionExecution`, readable via the new PUBLIC
 * `rustVersionExecution()` method); the module and any raw Rust
 * object are NEVER retained — only the decoded `string` (or `null`)
 * itself. Never calls any Rust API other than `version()`. Not read
 * by `initializeCrypto()`, `runtime_crypto_diagnostics.ts`, or
 * `worker_crypto_diagnostics.ts` — all three are UNCHANGED by this
 * stage.
 */

import { createFedosWasmLoaderPlan } from "./fedos_wasm_loader_plan.js";
// Secure Runtime Alpha 020 -- the single Runtime Mode Authority
// #evaluateDevOnlyGate() below now delegates to, instead of reading
// process.env.NODE_ENV directly. See fedos_runtime_mode_authority.ts's
// own top-of-file doc comment; this is a classifier import only, never
// an authorization one -- #evaluateDevOnlyGate() still makes its own
// Fail-Closed decision from the classification it returns.
import { determineFedosRuntimeMode } from "./fedos_runtime_mode_authority.js";
// Stage 921 (Prototype EXECUTION Phase 001) -- the FIRST real (live)
// filesystem read this file ever performs, narrowly scoped to a
// read-only existence check of the two Generated Artifact files named
// below. See this module's top-of-file "Stage 921" doc note.
//
// This project's tsconfig.json intentionally carries no `@types/node`
// (`package.json` is not to be changed for this stage). Both Node
// built-ins below resolve and run correctly under this project's
// actual Node/Vitest runtime; only their TYPE information is missing,
// so each import is individually suppressed the same way this
// project's own `?raw` imports already are (see any `test/*.test.ts`
// file's `// @ts-expect-error` comments for the established pattern).
// Stage 969 (Prototype EXECUTION Phase 007) adds `readFileSync` to
// this SAME import line -- no NEW `@ts-expect-error` suppression, no
// new module. Used ONLY to read the SAME `fedos_core_rust_bg.wasm`
// bytes Stage 921 already names, for WASM initialization input.
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync, readFileSync } from "node:fs";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
// Stage 945 (Prototype EXECUTION Phase 004) -- needed to turn the
// SAME `process.cwd()`-relative path Stage 921 already computes into
// a valid ESM `import()` specifier (Node's ESM resolver requires a
// `file://` URL for an absolute filesystem path).
// @ts-expect-error `node:url` has no type declarations without `@types/node` in this project's tsconfig.
import { pathToFileURL } from "node:url";
// Stage 929 (Prototype EXECUTION Phase 002) extends this SAME ambient
// declaration with `env` -- no NEW `@ts-expect-error` suppression is
// added, and no new Node/package dependency of any kind.
// Secure Runtime Alpha 020 narrows this ambient declaration back to
// `cwd()` only -- `env` moved to fedos_runtime_mode_authority.ts, the
// ONLY file in this project that still declares it.
declare const process: { cwd(): string };

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
 * Stage 921 (Prototype EXECUTION Phase 001) — the two Generated
 * Artifact filenames a `FedosWasmLoaderGeneratedArtifactCheckResult`
 * may name, matching `docs/runtime_wasm_js_glue_contract.md`'s own
 * observed `packages/fedos-core-rust/pkg/` shape. Fixed, closed union
 * — no other filename is ever checked.
 */
export type FedosWasmLoaderGeneratedArtifactName = "fedos_core_rust.js" | "fedos_core_rust_bg.wasm";

/**
 * Stage 921 (Prototype EXECUTION Phase 001) — the result of a REAL,
 * live existence check of the two `FedosWasmLoaderGeneratedArtifactName`
 * files. UNLIKE every Plan type above, this is NOT a hand-fixed
 * constant: `missingArtifacts`/`artifactsExist` genuinely reflect
 * `existsSync`'s own answer at the moment `#checkGeneratedArtifacts()`
 * ran. Still carries no module bytes, no secret material, and no
 * decision to import or instantiate anything — see this module's
 * top-of-file "Stage 921" doc note for the full scope of what this
 * check does and does not do.
 */
export interface FedosWasmLoaderGeneratedArtifactCheckResult {
  readonly checkedArtifacts: readonly FedosWasmLoaderGeneratedArtifactName[];
  readonly missingArtifacts: readonly FedosWasmLoaderGeneratedArtifactName[];
  readonly artifactsExist: boolean;
}

/**
 * Stage 921 (Prototype EXECUTION Phase 001) — the fixed, closed list
 * of artifact names `#checkGeneratedArtifacts()` checks, in the
 * SAME order every time. Pure, standalone, takes no argument; names
 * WHAT is checked without performing the check itself.
 */
const GENERATED_ARTIFACT_NAMES: readonly FedosWasmLoaderGeneratedArtifactName[] = [
  "fedos_core_rust.js",
  "fedos_core_rust_bg.wasm",
];

/**
 * Stage 929 (Prototype EXECUTION Phase 002) — the result of a REAL,
 * live Development Runtime evaluation. UNLIKE every Plan type above,
 * this is NOT a hand-fixed constant: `developmentAllowed`/`reason`
 * genuinely reflect `process.env.NODE_ENV`'s own value at the moment
 * `#evaluateDevOnlyGate()` ran. `developmentAllowed: true` NAMES the
 * evaluation's own finding — it is NEVER read by `planLoad()`'s `if`
 * conditions and NEVER grants import permission; see this module's
 * top-of-file "Stage 929" doc note.
 */
export interface FedosWasmLoaderDevOnlyGateEvaluation {
  readonly evaluated: true;
  readonly developmentAllowed: boolean;
  readonly reason: "DevelopmentRuntime" | "ProductionRuntime" | "UnknownRuntime" | "PrototypeStillClosed";
}

/**
 * Stage 937 (Prototype EXECUTION Phase 003) — the result of a REAL
 * (though purely combinational -- no new filesystem/environment read)
 * evaluation of whether an eventual `import()` would have its two
 * KNOWN preconditions satisfied: the Generated Artifact Check
 * (Stage 921) found both artifacts present, AND the Dev-only Gate
 * Evaluation (Stage 929) classified the runtime as Development.
 * `ready: true` NAMES that both conditions are satisfied — it is
 * NEVER read by `planLoad()`'s `if` conditions and NEVER grants
 * import permission; see this module's top-of-file "Stage 937" doc
 * note.
 */
export interface FedosWasmLoaderImportReadiness {
  readonly evaluated: true;
  readonly ready: boolean;
  readonly reason: "ReadyForImport" | "MissingArtifacts" | "NotDevelopmentRuntime" | "PrototypeStillClosed";
}

/**
 * Stage 937 (Prototype EXECUTION Phase 003) — one readable snapshot
 * combining the three REAL results this file has recorded so far
 * (`artifactsOk`/`runtimeOk`/`importReady`) with three
 * permanently-fixed `false` flags naming what this Prototype has
 * NEVER performed (`importExecuted`/`webAssemblyExecuted`/
 * `rustExecuted`). Computed purely from already-recorded state;
 * performs no check of its own.
 */
export interface FedosWasmLoaderExecutionReadinessSummary {
  readonly artifactsOk: boolean;
  readonly runtimeOk: boolean;
  readonly importReady: boolean;
  readonly importExecuted: false;
  readonly webAssemblyExecuted: false;
  readonly rustExecuted: false;
}

/**
 * Stage 945 (Prototype EXECUTION Phase 004) — the result of a REAL
 * attempt (or deliberate non-attempt) to `import()` the Generated JS
 * Glue. `attempted`/`succeeded` genuinely reflect what happened at
 * the moment `attemptDevOnlyJsGlueImport()` ran — `attempted` is
 * `false` whenever `import()` was never even called (`reason:
 * "NotReady"`/`"PrototypeStillClosed"`); `succeeded: true` NAMES that
 * the import resolved — it is NEVER read by `planLoad()`'s `if`
 * conditions (which this stage does not touch at all) and NEVER
 * triggers `WebAssembly`/Rust of any kind; see this module's
 * top-of-file "Stage 945" doc note.
 */
export interface FedosWasmLoaderImportExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly reason: "Imported" | "NotReady" | "ImportFailed" | "PrototypeStillClosed";
}

/**
 * Stage 969 (Prototype EXECUTION Phase 007) — the result of a REAL
 * attempt (or deliberate non-attempt) to initialize WebAssembly via
 * whichever init function the retained JS glue module (Stage 961)
 * actually exposes. `attempted`/`succeeded` genuinely reflect what
 * happened at the moment `attemptDevOnlyWasmInitialization()` ran.
 * `succeeded: true` NAMES that `initSync`/`default` resolved — it is
 * NEVER read by `planLoad()`'s `if` conditions (which this stage does
 * not touch at all) and NEVER triggers any Rust API call, because the
 * generated JS glue exposes none to call; see this module's
 * top-of-file "Stage 969" doc note. The `InitOutput`/`memory`/instance
 * itself is NEVER part of this type and NEVER retained anywhere.
 */
export interface FedosWasmLoaderWasmInitialization {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly reason: "Initialized" | "NotReady" | "InitializationUnavailable" | "InitializationFailed" | "PrototypeStillClosed";
}

/**
 * Stage 993 (Prototype EXECUTION Phase 012) — the result of a REAL
 * attempt (or deliberate non-attempt) to call the retained JS glue
 * module's own `version` property as a function, with NO argument.
 * `attempted`/`succeeded` genuinely reflect what happened at the
 * moment `attemptDevOnlyRustVersionCall()` ran. `version` is the
 * decoded `string` `module.version()` returned on success, or `null`
 * on every other outcome — NEVER any other value type, and NEVER the
 * module or any Rust object itself. `succeeded: true` NAMES that the
 * call resolved a `string` — it is NEVER read by `planLoad()`'s `if`
 * conditions (which this stage does not touch at all), never read by
 * `initializeCrypto()`, and never surfaced in Runtime/Worker
 * diagnostics; see this module's top-of-file "Stage 993" doc note.
 */
export interface FedosWasmLoaderRustVersionExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly version: string | null;
  readonly reason: "Succeeded" | "NotInitialized" | "VersionUnavailable" | "CallFailed" | "PrototypeStillClosed";
}

/**
 * Stage 1004 (Secure Runtime Alpha 008) — the result of a REAL attempt
 * (or deliberate non-attempt) to call the retained JS glue module's own
 * `random_bytes_32` property as a function, with NO argument.
 * `attempted`/`succeeded` genuinely reflect what happened at the moment
 * `attemptDevOnlyRandomBytesCall()` ran — mirrors
 * `FedosWasmLoaderRustVersionExecution` (Stage 993) exactly, one field
 * for one Rust Boundary export. `bytes` is the `Uint8Array` returned by
 * `module.random_bytes_32()` on success, or `null` on every other
 * outcome (including a genuine, in-bounds `undefined` return from Rust
 * itself, which maps to `reason: "EntropySourceUnavailable"` — Fail
 * Closed, not an error) — NEVER any other value type, and NEVER the
 * module or any Rust object itself. `succeeded: true` NAMES that the
 * call resolved a `Uint8Array` — it is NEVER read by `planLoad()`'s
 * `if` conditions (which this stage does not touch at all), never read
 * by `initializeCrypto()`/`runtimeCapabilities()`, and never surfaced
 * in Runtime/Worker diagnostics.
 */
export interface FedosWasmLoaderRandomBytesExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly bytes: Uint8Array | null;
  readonly reason:
    | "Succeeded"
    | "EntropySourceUnavailable"
    | "NotInitialized"
    | "RandomBytesUnavailable"
    | "CallFailed"
    | "PrototypeStillClosed";
}

/**
 * Stage 1008 (Secure Runtime Alpha 013) — the PUBLIC, OPAQUE shape every
 * layer above this file treats a genuine AEAD key handle as satisfying.
 * `kind` is a FIXED, non-secret label — never derived from key
 * material, never a byte of it — used ONLY so this file's own
 * `isAeadKeyHandleShape()` (below) can structurally confirm "this is
 * genuinely a handle" before ever passing a value upward. Deliberately
 * minimal: no `bytes`/`key`/`material`/`export*` field, no
 * `toJSON`/`toString` override, and no other property is declared here
 * — a caller relying on this type can observe nothing about a handle
 * beyond "it exists" and "kind === 'AeadKeyHandle'". The ACTUAL runtime
 * value crossing the WASM boundary is the real, wasm-bindgen-generated
 * `AeadKeyHandle` class instance (`lib.rs`) — this file never
 * constructs a synthetic substitute, unwraps it, or copies any field
 * out of it; the SAME reference is threaded, unchanged, through every
 * layer up to the Public Runtime API.
 */
export interface AeadKeyHandle {
  readonly kind: "AeadKeyHandle";
}

/**
 * PRIVATE — structural Fail-Closed validation for a candidate value
 * returned by `module.generate_aead_key_handle()`. Returns `true` only
 * when `value` is a non-null object whose own `kind` property is
 * EXACTLY the literal `"AeadKeyHandle"` — never `instanceof` (this file
 * never imports or references the generated JS glue's own class
 * constructor), never a deep inspection of any other property. A
 * `Uint8Array`, a plain `{}`, `null`, a number, or any other shape all
 * resolve `false` here, which `attemptDevOnlyAeadKeyGenerationCall()`
 * (below) Fails Closed on via `reason: "InvalidHandleShape"`.
 */
function isAeadKeyHandleShape(value: unknown): value is AeadKeyHandle {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "AeadKeyHandle"
  );
}

/**
 * Stage 1008 (Secure Runtime Alpha 013) — the result of a REAL attempt
 * (or deliberate non-attempt) to call the retained JS glue module's own
 * `generate_aead_key_handle` property as a function, with NO argument.
 * REPLACES Stage 1005's `keyBytes: Uint8Array | null` field with
 * `keyHandle: AeadKeyHandle | null`, per this arc's own Alpha 012 Key
 * Boundary Decision's deliberate breaking-change decision — otherwise
 * mirrors
 * `FedosWasmLoaderRandomBytesExecution` (Stage 1004) exactly, one field
 * for one Rust Boundary export. `keyHandle` is the value returned by
 * `module.generate_aead_key_handle()` on success, structurally verified
 * by `isAeadKeyHandleShape()` above, or `null` on every other outcome
 * (including a genuine, in-bounds `undefined` return from Rust itself,
 * which maps to `reason: "EntropySourceUnavailable"` — Fail Closed, not
 * an error, and a genuine but WRONGLY-shaped return, which maps to
 * `reason: "InvalidHandleShape"`) — NEVER any other value type, and
 * NEVER the module itself. `succeeded: true` NAMES that the call
 * resolved a genuine `AeadKeyHandle` — it is NEVER read by
 * `planLoad()`'s `if` conditions (which this stage does not touch at
 * all), never read by
 * `initializeCrypto()`/`runtimeCapabilities()`/`randomBytes()`, and
 * never surfaced in Runtime/Worker diagnostics.
 */
export interface FedosWasmLoaderAeadKeyGenerationExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly keyHandle: AeadKeyHandle | null;
  readonly reason:
    | "Succeeded"
    | "EntropySourceUnavailable"
    | "InvalidHandleShape"
    | "NotInitialized"
    | "KeyGenerationUnavailable"
    | "CallFailed"
    | "PrototypeStillClosed";
}

/**
 * Stage 1009 (Secure Runtime Alpha 014) — the PUBLIC, OPAQUE shape every
 * layer above this file treats a genuine AEAD ciphertext handle as
 * satisfying. Mirrors `AeadKeyHandle` (Stage 1008) exactly, one field
 * for the same reason: `kind` is a FIXED, non-secret label — never
 * derived from ciphertext bytes — used ONLY so this file's own
 * `isAeadCiphertextHandleShape()` (below) can structurally confirm
 * "this is genuinely a handle" before ever passing a value upward.
 * Deliberately minimal: no `bytes`/`ciphertext`/`nonce`/`export*`/
 * `serialize*` field, no `toJSON`/`toString` override, and no other
 * property is declared here. The ACTUAL runtime value crossing the WASM
 * boundary is the real, wasm-bindgen-generated `AeadCiphertextHandle`
 * class instance (`lib.rs`) — this file never constructs a synthetic
 * substitute, unwraps it, or copies any field out of it. The Ciphertext
 * boundary's own final wire-format design remains a separate, later,
 * unresolved question — this type does not attempt to answer it.
 */
export interface AeadCiphertextHandle {
  readonly kind: "AeadCiphertextHandle";
}

/**
 * PRIVATE — structural Fail-Closed validation for a candidate value
 * returned by `module.encrypt_aead()`. Mirrors `isAeadKeyHandleShape()`
 * exactly: returns `true` only when `value` is a non-null object whose
 * own `kind` property is EXACTLY the literal `"AeadCiphertextHandle"` —
 * never `instanceof`, never a deep inspection of any other property.
 */
function isAeadCiphertextHandleShape(value: unknown): value is AeadCiphertextHandle {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "AeadCiphertextHandle"
  );
}

/**
 * Stage 1009 (Secure Runtime Alpha 014) — the PUBLIC label an `encrypt()`
 * caller selects an AEAD algorithm with. A hand-declared TS union,
 * deliberately NOT imported from any generated glue type (none is ever
 * committed to this repository) — `attemptDevOnlyEncryptCall()` (below)
 * maps each label to the exact numeric discriminant
 * `packages/fedos-core-rust/src/lib.rs`'s own `FedosAeadAlgorithm`
 * declares (`ChaCha20Poly1305 = 0`, `Aes256Gcm = 1`), verified against
 * the real generated `.d.ts` during this Stage's own build-and-inspect
 * step.
 */
export type AeadAlgorithm = "ChaCha20Poly1305" | "Aes256Gcm";

/**
 * Stage 1009 (Secure Runtime Alpha 014) — the PUBLIC label an `encrypt()`
 * caller selects a fixed AAD-binding domain with. Same discipline as
 * `AeadAlgorithm` above: a hand-declared TS union, mapped to
 * `FedosAeadAadDomain`'s own declaration-order discriminants
 * (`RootKey = 0`, `Identity = 1`, `Storage = 2`, `Conversation = 3`,
 * `TestOnly = 4`).
 */
export type AeadAadDomain = "RootKey" | "Identity" | "Storage" | "Conversation" | "TestOnly";

/** PRIVATE — `AeadAlgorithm` label to `lib.rs`'s own numeric discriminant. */
const AEAD_ALGORITHM_DISCRIMINANTS: Readonly<Record<AeadAlgorithm, number>> = {
  ChaCha20Poly1305: 0,
  Aes256Gcm: 1,
};

/** PRIVATE — `AeadAadDomain` label to `lib.rs`'s own numeric discriminant. */
const AEAD_AAD_DOMAIN_DISCRIMINANTS: Readonly<Record<AeadAadDomain, number>> = {
  RootKey: 0,
  Identity: 1,
  Storage: 2,
  Conversation: 3,
  TestOnly: 4,
};

/**
 * Stage 1011 (Secure Runtime Alpha 018) — the wire value
 * `exportCiphertext()` returns and `importCiphertext()` accepts, per
 * `docs/secure_runtime_alpha_017_ciphertext_wire_format_decision.md`
 * §3/§4. A `string` — never `Uint8Array`, never a parsed object — is
 * the canonical JSON + base64url text `serialize_aead_ciphertext()`
 * (via the EXISTING, byte-for-byte UNCHANGED
 * `encode_envelope_internal`, Stage 186) produces; the `__brand` field
 * is a COMPILE-TIME-ONLY marker, never present on any real runtime
 * value, and NEVER checked or enforced at this or any other boundary —
 * all real Fail-Closed validation of the ACTUAL string content happens
 * entirely inside Rust's `decode_envelope_internal`, regardless of
 * whether a caller obtained this type honestly or via an `as` cast. Its
 * only job is to stop a caller from accidentally passing an unrelated
 * `string` to `importCiphertext()` without an explicit, deliberate cast.
 */
export type AeadCiphertextWire = string & {
  readonly __brand: "AeadCiphertextWire";
};

/**
 * Stage 1009 (Secure Runtime Alpha 014) — the result of a REAL attempt
 * (or deliberate non-attempt) to call the retained JS glue module's own
 * `encrypt_aead` property as a function, with the caller's
 * `key`/`algorithm`/`aadDomain`/`plaintext`. Mirrors
 * `FedosWasmLoaderAeadKeyGenerationExecution` (Stage 1008) exactly, one
 * field for one Rust Boundary export. `ciphertextHandle` is the value
 * returned by `module.encrypt_aead()` on success, structurally verified
 * by `isAeadCiphertextHandleShape()` above, or `null` on every other
 * outcome — NEVER any other value type, and NEVER the module itself.
 * `reason: "InvalidKeyHandle"` is a NEW outcome this Stage adds, checked
 * BEFORE `module.encrypt_aead` is ever called: the caller's own `key`
 * argument is validated via `isAeadKeyHandleShape()` first, so an
 * obviously-wrong `key` (not a genuine `AeadKeyHandle`) never reaches
 * the WASM call at all. `succeeded: true` NAMES that the call resolved
 * a genuine `AeadCiphertextHandle` — it is NEVER read by `planLoad()`'s
 * `if` conditions, never read by
 * `initializeCrypto()`/`runtimeCapabilities()`/`randomBytes()`/
 * `generateAeadKey()`, and never surfaced in Runtime/Worker diagnostics.
 */
export interface FedosWasmLoaderEncryptExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly ciphertextHandle: AeadCiphertextHandle | null;
  readonly reason:
    | "Succeeded"
    | "InvalidKeyHandle"
    | "EncryptionFailed"
    | "InvalidCiphertextShape"
    | "NotInitialized"
    | "EncryptUnavailable"
    | "CallFailed"
    | "PrototypeStillClosed";
}

/**
 * Stage 1010 (Secure Runtime Alpha 015) — the result of a REAL attempt
 * (or deliberate non-attempt) to call the retained JS glue module's own
 * `decrypt_aead` property as a function, with the caller's
 * `key`/`algorithm`/`aadDomain`/`ciphertext`. Mirrors
 * `FedosWasmLoaderEncryptExecution` (Stage 1009) exactly, one field for
 * one Rust Boundary export. `plaintext` is the `Uint8Array` returned by
 * `module.decrypt_aead()` on success, or `null` on every other outcome —
 * NEVER any other value type, and NEVER the module itself.
 *
 * FOUR outcomes are checked BEFORE `module.decrypt_aead` is ever called,
 * mirroring `FedosWasmLoaderEncryptExecution`'s own `"InvalidKeyHandle"`
 * precedent:
 *   - `reason: "InvalidKeyHandle"` — `key` does not structurally satisfy
 *     `isAeadKeyHandleShape()`.
 *   - `reason: "InvalidCiphertextHandle"` — `ciphertext` does not
 *     structurally satisfy `isAeadCiphertextHandleShape()`.
 *   - `reason: "InvalidAlgorithm"` — `algorithm` is not one of the two
 *     known `AeadAlgorithm` labels (a runtime defense-in-depth check;
 *     TypeScript's own literal-union type does not survive an `as any`
 *     bypass at a public API boundary).
 *   - `reason: "InvalidAadDomain"` — same reasoning, for `aadDomain`.
 * An obviously-wrong argument of any of these four kinds never reaches
 * the WASM call at all.
 *
 * `reason: "DecryptionFailed"` is a genuine, in-bounds `undefined`
 * return from Rust — covering EVERY Rust-side semantic failure cause
 * uniformly (wrong key, an algorithm/AAD-domain that does not match
 * what was actually sealed into `ciphertext`, a tampered ciphertext, or
 * an internal failure) — deliberately NOT distinguished further, per
 * `FedosDecryptStatus::AuthenticationFailed`'s own "never distinguish
 * WHY" discipline (RFC 8439/NIST AEAD guidance: a distinguishable
 * failure reason is itself an oracle). `succeeded: true` NAMES that the
 * call resolved a genuine `Uint8Array` — it is NEVER read by
 * `planLoad()`'s `if` conditions, never read by
 * `initializeCrypto()`/`runtimeCapabilities()`/`randomBytes()`/
 * `generateAeadKey()`, and never surfaced in Runtime/Worker diagnostics.
 */
export interface FedosWasmLoaderDecryptExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly plaintext: Uint8Array | null;
  readonly reason:
    | "Succeeded"
    | "InvalidKeyHandle"
    | "InvalidCiphertextHandle"
    | "InvalidAlgorithm"
    | "InvalidAadDomain"
    | "DecryptionFailed"
    | "InvalidPlaintextShape"
    | "NotInitialized"
    | "DecryptUnavailable"
    | "CallFailed"
    | "PrototypeStillClosed";
}

/**
 * Stage 1011 (Secure Runtime Alpha 018) — the result of a REAL attempt
 * (or deliberate non-attempt) to call the retained JS glue module's own
 * `serialize_aead_ciphertext` property as a function, with the caller's
 * `ciphertext`. Mirrors `FedosWasmLoaderEncryptExecution`/
 * `DecryptExecution` (Stage 1009/1010) exactly, one field for one Rust
 * Boundary export. `wire` is the `AeadCiphertextWire` string returned by
 * `module.serialize_aead_ciphertext()` on success, or `null` on every
 * other outcome — NEVER any other value type.
 *
 * `reason: "InvalidCiphertextHandle"` is checked structurally, via
 * `isAeadCiphertextHandleShape()`, BEFORE `module.serialize_aead_ciphertext`
 * is ever called — an obviously-wrong `ciphertext` never reaches the
 * WASM call at all. This is a SHAPE check only: a hand-forged plain
 * object satisfying this shape (e.g. `{ kind: "AeadCiphertextHandle" }`
 * with no other property) still PASSES it — the REAL wasm-bindgen
 * runtime type check inside `serialize_aead_ciphertext` itself is what
 * then rejects a non-genuine value, surfacing as `reason: "CallFailed"`
 * (below), never as a false `"Succeeded"`.
 *
 * `reason: "SerializationFailed"` is a genuine, in-bounds `undefined`
 * return from Rust (`encode_envelope_internal`'s own ONE documented edge
 * case: a Stage 157–158 SKELETON placeholder envelope shorter than the
 * fixed AEAD tag length — never a real sealed envelope). `reason:
 * "InvalidWireOutputShape"` covers every other wrongly-shaped return,
 * INCLUDING an empty string (`encode_envelope_internal` never
 * legitimately produces one — its minimum output is the fixed
 * `{"v":...}` prefix).
 */
export interface FedosWasmLoaderExportCiphertextExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly wire: AeadCiphertextWire | null;
  readonly reason:
    | "Succeeded"
    | "InvalidCiphertextHandle"
    | "SerializationFailed"
    | "InvalidWireOutputShape"
    | "NotInitialized"
    | "ExportUnavailable"
    | "CallFailed"
    | "PrototypeStillClosed";
}

/**
 * Stage 1011 (Secure Runtime Alpha 018) — the result of a REAL attempt
 * (or deliberate non-attempt) to call the retained JS glue module's own
 * `deserialize_aead_ciphertext` property as a function, with the
 * caller's `serialized` candidate. Mirrors
 * `FedosWasmLoaderExportCiphertextExecution` above exactly, in reverse.
 * `ciphertextHandle` is the value returned by
 * `module.deserialize_aead_ciphertext()` on success, structurally
 * verified by `isAeadCiphertextHandleShape()`, or `null` on every other
 * outcome.
 *
 * `reason: "InvalidWireInputShape"` is checked BEFORE
 * `module.deserialize_aead_ciphertext` is ever called: `serialized` must
 * be a genuine `string` — an obviously-wrong candidate (not a string at
 * all) never reaches the WASM call. This is the ONLY pre-call check on
 * this side, deliberately: `serialized`'s CONTENT is untrusted by
 * construction (per
 * `docs/secure_runtime_alpha_017_ciphertext_wire_format_decision.md`
 * §8/§9) and is validated ENTIRELY by `decode_envelope_internal` inside
 * Rust — this Loader method adds NO duplicate content validation of its
 * own (no version/algorithm/AAD-domain/base64url check here).
 *
 * `reason: "DeserializationFailed"` is a genuine, in-bounds `undefined`
 * return from Rust — covering EVERY ONE of `decode_envelope_internal`'s
 * own seven internal rejection causes
 * (`InvalidVersion`/`InvalidAlgorithm`/`InvalidAadDomain`/
 * `InvalidBase64Url`/`MissingField`/`UnknownField`/`MalformedJson`),
 * collapsed into ONE Loader-level outcome — mirroring
 * `FedosWasmLoaderDecryptExecution`'s own `"DecryptionFailed"` collapsing
 * multiple Rust-internal causes into one reason. `reason:
 * "InvalidHandleOutputShape"` covers every other wrongly-shaped return —
 * a defensive check only; `decode_envelope_internal` itself never
 * produces one.
 */
export interface FedosWasmLoaderImportCiphertextExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly ciphertextHandle: AeadCiphertextHandle | null;
  readonly reason:
    | "Succeeded"
    | "InvalidWireInputShape"
    | "DeserializationFailed"
    | "InvalidHandleOutputShape"
    | "NotInitialized"
    | "ImportUnavailable"
    | "CallFailed"
    | "PrototypeStillClosed";
}

/**
 * Secure Runtime Alpha 436/438 — the opaque, PUBLIC shape a genuine
 * `FedosMasterSeedAuthority` WASM instance is treated as satisfying.
 * Unlike `AeadKeyHandle`/`AeadCiphertextHandle` above, the real Rust
 * struct (`packages/fedos-core-rust/src/lib.rs`,
 * `FedosMasterSeedAuthority`) deliberately carries NO `kind`
 * discriminant field or any other non-secret metadata — Alpha 436's own
 * design forbids adding any field/getter beyond its seven lifecycle
 * methods (no raw-byte getter of any kind is permitted). So this file's
 * own `isFedosMasterSeedAuthorityShape()` (below) validates by METHOD
 * PRESENCE instead of a discriminant field — an honest duck-type check
 * for a real wasm-bindgen class instance, not a synthetic marker this
 * struct will never actually carry.
 */
export interface FedosMasterSeedAuthorityHandle {
  readonly is_available: () => boolean;
  readonly is_cleared: () => boolean;
  readonly generate: () => boolean;
  readonly seal: (passphrase: Uint8Array) => string | undefined;
  readonly restore_sealed: (envelopeJson: string, passphrase: Uint8Array) => boolean;
  readonly clear: () => void;
  readonly sign_nostr_event: (
    accountIndex: number,
    createdAt: number,
    kind: number,
    tags: string[],
    content: string,
  ) => string | undefined;
  /** Secure Runtime Alpha 684/685 — derives the per-account Nostr public key without signing. */
  readonly public_key_hex_for_account: (accountIndex: number) => string | undefined;
}

/**
 * PRIVATE — structural Fail-Closed validation for a candidate value
 * returned by `new module.FedosMasterSeedAuthority()`. Returns `true`
 * only when `value` is a non-null object exposing all seven lifecycle
 * methods as functions. Never `instanceof` (this file never imports the
 * generated JS glue's own class constructor statically).
 */
function isFedosMasterSeedAuthorityShape(value: unknown): value is FedosMasterSeedAuthorityHandle {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.is_available === "function" &&
    typeof candidate.is_cleared === "function" &&
    typeof candidate.generate === "function" &&
    typeof candidate.seal === "function" &&
    typeof candidate.restore_sealed === "function" &&
    typeof candidate.clear === "function" &&
    typeof candidate.sign_nostr_event === "function" &&
    typeof candidate.public_key_hex_for_account === "function"
  );
}

/** Secure Runtime Alpha 436 — `attemptDevOnlyMasterSeedAuthorityConstructCall()`'s own result. No secret material of any kind. */
export interface FedosWasmLoaderMasterSeedAuthorityConstructExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly authority: FedosMasterSeedAuthorityHandle | null;
  readonly reason:
    | "Succeeded"
    | "ConstructorUnavailable"
    | "InvalidAuthorityShape"
    | "NotInitialized"
    | "CallFailed"
    | "PrototypeStillClosed";
}

/** Secure Runtime Alpha 436 — `attemptDevOnlyMasterSeedGenerateCall()`'s own result. No secret material of any kind. */
export interface FedosWasmLoaderMasterSeedGenerateExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly reason:
    | "Succeeded"
    | "GenerateFailed"
    | "InvalidAuthorityHandle"
    | "NotInitialized"
    | "CallFailed"
    | "PrototypeStillClosed";
}

/** Secure Runtime Alpha 437 — `attemptDevOnlyMasterSeedSealCall()`'s own result. `envelope` is a sealed (Argon2id + AEAD) ciphertext, never plaintext seed material. */
export interface FedosWasmLoaderMasterSeedSealExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly envelope: string | null;
  readonly reason:
    | "Succeeded"
    | "SealFailed"
    | "InvalidAuthorityHandle"
    | "NotInitialized"
    | "CallFailed"
    | "PrototypeStillClosed";
}

/** Secure Runtime Alpha 437 — `attemptDevOnlyMasterSeedRestoreSealedCall()`'s own result. */
export interface FedosWasmLoaderMasterSeedRestoreSealedExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly reason:
    | "Succeeded"
    | "RestoreFailed"
    | "InvalidAuthorityHandle"
    | "NotInitialized"
    | "CallFailed"
    | "PrototypeStillClosed";
}

/** Secure Runtime Alpha 434 — `attemptDevOnlyMasterSeedClearCall()`'s own result. `clear()` itself is `void`/infallible on a genuine handle. */
export interface FedosWasmLoaderMasterSeedClearExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly reason: "Succeeded" | "InvalidAuthorityHandle" | "NotInitialized" | "CallFailed" | "PrototypeStillClosed";
}

/** Secure Runtime Alpha 444 — `attemptDevOnlyNostrSignEventCall()`'s own result. `signedEventJson` is the complete seven-field NIP-01 wire event as a JSON string, never a secret Handle. */
export interface FedosWasmLoaderNostrSignEventExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly signedEventJson: string | null;
  readonly reason:
    | "Succeeded"
    | "SigningFailed"
    | "InvalidAuthorityHandle"
    | "NotInitialized"
    | "CallFailed"
    | "PrototypeStillClosed";
}

/** Secure Runtime Alpha 684/685 — `attemptDevOnlyNostrPublicIdentityForAccountCall()`'s own result. `publicKeyHex` is the canonical 64-character lowercase hex public key, never a secret Handle. */
export interface FedosWasmLoaderNostrPublicIdentityExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly publicKeyHex: string | null;
  readonly reason:
    | "Succeeded"
    | "DerivationFailed"
    | "InvalidAuthorityHandle"
    | "NotInitialized"
    | "CallFailed"
    | "PrototypeStillClosed";
}

/**
 * Stage 945 (Prototype EXECUTION Phase 004) — optional constructor
 * options for `FedosWasmLoaderSkeleton`. `importGeneratedJsGlue` lets
 * a TEST observe `attemptDevOnlyJsGlueImport()`'s success/failure
 * paths without depending on a real Generated JS Glue file existing
 * on disk; `createFedosWasmLoader()` never supplies it, so real usage
 * always gets real, native dynamic `import()`. Stage 969 (Prototype
 * EXECUTION Phase 007) adds `readGeneratedWasmBytes` for the SAME
 * reason, this time for `attemptDevOnlyWasmInitialization()`'s own
 * `fedos_core_rust_bg.wasm` bytes read — `createFedosWasmLoader()`
 * never supplies it either, so real usage always gets real
 * `node:fs` `readFileSync`.
 */
export interface FedosWasmLoaderSkeletonOptions {
  readonly importGeneratedJsGlue?: (specifier: string) => Promise<unknown>;
  readonly readGeneratedWasmBytes?: (path: string) => Uint8Array;
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
  /**
   * Stage 921 (Prototype EXECUTION Phase 001) — holds the most recent
   * REAL Generated Artifact Check result `planLoad()` recorded, or
   * `null` before `planLoad()` has ever been called on this instance.
   * Read via `generatedArtifactCheckResult()`; never read by
   * `planLoad()` itself once written.
   */
  #generatedArtifactCheckResult: FedosWasmLoaderGeneratedArtifactCheckResult | null = null;

  /**
   * Stage 929 (Prototype EXECUTION Phase 002) — holds the most recent
   * REAL Dev-only Gate Evaluation `planLoad()` recorded, or `null`
   * before `planLoad()` has ever been called on this instance. Read
   * via `devOnlyGateEvaluation()`; never read by `planLoad()` itself
   * once written.
   */
  #devOnlyGateEvaluation: FedosWasmLoaderDevOnlyGateEvaluation | null = null;

  /**
   * Stage 937 (Prototype EXECUTION Phase 003) — holds the most recent
   * REAL Import Readiness evaluation `planLoad()` recorded, or `null`
   * before `planLoad()` has ever been called on this instance. Read
   * via `importReadiness()`; never read by `planLoad()` itself once
   * written.
   */
  #importReadiness: FedosWasmLoaderImportReadiness | null = null;

  /**
   * Stage 945 (Prototype EXECUTION Phase 004) — holds the most recent
   * REAL import attempt result recorded by
   * `attemptDevOnlyJsGlueImport()`, or `null` before that method has
   * ever been called on this instance. Read via `importExecution()`;
   * NEVER read by `planLoad()`, which does not reference this field at
   * all.
   */
  #importExecution: FedosWasmLoaderImportExecution | null = null;

  /**
   * Stage 961 (Prototype EXECUTION Phase 006) — holds the JS module
   * `import()` resolved on the MOST RECENT successful
   * `attemptDevOnlyJsGlueImport()` call, as an opaque, NEVER-inspected
   * value, or `null` after any non-`"Imported"` outcome (or before
   * `attemptDevOnlyJsGlueImport()` has ever been called). Read via
   * `jsGlueModule()`; NEVER destructured, NEVER read for its exports,
   * and NEVER called anywhere in this file. NEVER read by `planLoad()`,
   * which does not reference this field at all.
   */
  #jsGlueModule: object | null = null;

  /**
   * Stage 969 (Prototype EXECUTION Phase 007) — holds the most recent
   * REAL WASM initialization attempt result recorded by
   * `attemptDevOnlyWasmInitialization()`, or `null` before that method
   * has ever been called on this instance. Read via
   * `wasmInitialization()`; NEVER read by `planLoad()`, which does not
   * reference this field at all.
   */
  #wasmInitialization: FedosWasmLoaderWasmInitialization | null = null;

  /**
   * Stage 993 (Prototype EXECUTION Phase 012) — holds the most recent
   * REAL Rust `version()` call result recorded by
   * `attemptDevOnlyRustVersionCall()`, or `null` before that method
   * has ever been called on this instance. Read via
   * `rustVersionExecution()`; NEVER read by `planLoad()`, which does
   * not reference this field at all.
   */
  #rustVersionExecution: FedosWasmLoaderRustVersionExecution | null = null;

  /**
   * Stage 1004 (Secure Runtime Alpha 008) — holds the most recent REAL
   * Rust `random_bytes_32()` call result recorded by
   * `attemptDevOnlyRandomBytesCall()`, or `null` before that method has
   * ever been called on this instance. Read via
   * `randomBytesExecution()`; NEVER read by `planLoad()`, which does
   * not reference this field at all.
   */
  #randomBytesExecution: FedosWasmLoaderRandomBytesExecution | null = null;

  /**
   * Stage 1005 (Secure Runtime Alpha 010), reshaped Stage 1008 (Secure
   * Runtime Alpha 013) — holds the most recent REAL Rust
   * `generate_aead_key_handle()` call result recorded by
   * `attemptDevOnlyAeadKeyGenerationCall()`, or `null` before that
   * method has ever been called on this instance. Read via
   * `aeadKeyGenerationExecution()`; NEVER read by `planLoad()`, which
   * does not reference this field at all.
   */
  #aeadKeyGenerationExecution: FedosWasmLoaderAeadKeyGenerationExecution | null = null;

  /**
   * Stage 1009 (Secure Runtime Alpha 014) — holds the most recent REAL
   * Rust `encrypt_aead()` call result recorded by
   * `attemptDevOnlyEncryptCall()`, or `null` before that method has
   * ever been called on this instance. Read via `encryptExecution()`;
   * NEVER read by `planLoad()`, which does not reference this field at
   * all.
   */
  #encryptExecution: FedosWasmLoaderEncryptExecution | null = null;

  /**
   * Stage 1010 (Secure Runtime Alpha 015) — holds the most recent REAL
   * Rust `decrypt_aead()` call result recorded by
   * `attemptDevOnlyDecryptCall()`, or `null` before that method has ever
   * been called on this instance. Read via `decryptExecution()`; NEVER
   * read by `planLoad()`, which does not reference this field at all.
   */
  #decryptExecution: FedosWasmLoaderDecryptExecution | null = null;

  /**
   * Stage 1011 (Secure Runtime Alpha 018) — holds the most recent REAL
   * Rust `serialize_aead_ciphertext()` call result recorded by
   * `attemptDevOnlyExportCiphertextCall()`, or `null` before that method
   * has ever been called on this instance. Read via
   * `exportCiphertextExecution()`; NEVER read by `planLoad()`, which
   * does not reference this field at all.
   */
  #exportCiphertextExecution: FedosWasmLoaderExportCiphertextExecution | null = null;

  /**
   * Stage 1011 (Secure Runtime Alpha 018) — holds the most recent REAL
   * Rust `deserialize_aead_ciphertext()` call result recorded by
   * `attemptDevOnlyImportCiphertextCall()`, or `null` before that method
   * has ever been called on this instance. Read via
   * `importCiphertextExecution()`; NEVER read by `planLoad()`, which
   * does not reference this field at all.
   */
  #importCiphertextExecution: FedosWasmLoaderImportCiphertextExecution | null = null;

  /** Secure Runtime Alpha 436 — most recent `attemptDevOnlyMasterSeedAuthorityConstructCall()` result, or `null` before it has ever been called. Read via `masterSeedAuthorityConstructExecution()`. */
  #masterSeedAuthorityConstructExecution: FedosWasmLoaderMasterSeedAuthorityConstructExecution | null = null;

  /** Secure Runtime Alpha 436 — most recent `attemptDevOnlyMasterSeedGenerateCall()` result, or `null` before it has ever been called. Read via `masterSeedGenerateExecution()`. */
  #masterSeedGenerateExecution: FedosWasmLoaderMasterSeedGenerateExecution | null = null;

  /** Secure Runtime Alpha 437 — most recent `attemptDevOnlyMasterSeedSealCall()` result, or `null` before it has ever been called. Read via `masterSeedSealExecution()`. */
  #masterSeedSealExecution: FedosWasmLoaderMasterSeedSealExecution | null = null;

  /** Secure Runtime Alpha 437 — most recent `attemptDevOnlyMasterSeedRestoreSealedCall()` result, or `null` before it has ever been called. Read via `masterSeedRestoreSealedExecution()`. */
  #masterSeedRestoreSealedExecution: FedosWasmLoaderMasterSeedRestoreSealedExecution | null = null;

  /** Secure Runtime Alpha 434 — most recent `attemptDevOnlyMasterSeedClearCall()` result, or `null` before it has ever been called. Read via `masterSeedClearExecution()`. */
  #masterSeedClearExecution: FedosWasmLoaderMasterSeedClearExecution | null = null;

  /** Secure Runtime Alpha 444 — most recent `attemptDevOnlyNostrSignEventCall()` result, or `null` before it has ever been called. Read via `nostrSignEventExecution()`. */
  #nostrSignEventExecution: FedosWasmLoaderNostrSignEventExecution | null = null;

  /** Secure Runtime Alpha 684/685 — most recent `attemptDevOnlyNostrPublicIdentityForAccountCall()` result, or `null` before it has ever been called. Read via `nostrPublicIdentityExecution()`. */
  #nostrPublicIdentityExecution: FedosWasmLoaderNostrPublicIdentityExecution | null = null;

  /**
   * Stage 945 (Prototype EXECUTION Phase 004) — the function
   * `attemptDevOnlyJsGlueImport()` calls to perform the actual
   * `import()`. Defaults to real, native dynamic `import()`; a test
   * MAY override it via the constructor's `importGeneratedJsGlue`
   * option to observe the success/failure paths without depending on
   * a real Generated JS Glue file on disk. `createFedosWasmLoader()`
   * never overrides it.
   */
  #importGeneratedJsGlue: (specifier: string) => Promise<unknown>;

  /**
   * Stage 969 (Prototype EXECUTION Phase 007) — the function
   * `attemptDevOnlyWasmInitialization()` calls to read the
   * `fedos_core_rust_bg.wasm` bytes it passes to `initSync`/`default`.
   * Defaults to real `node:fs` `readFileSync`; a test MAY override it
   * via the constructor's `readGeneratedWasmBytes` option to observe
   * the success/failure paths without depending on a real Generated
   * WASM file on disk. `createFedosWasmLoader()` never overrides it.
   */
  #readGeneratedWasmBytes: (path: string) => Uint8Array;

  constructor(options?: FedosWasmLoaderSkeletonOptions) {
    // Does nothing but store the (optional, test-only) hooks: no file
    // read, no module imported, no WASM instantiated.
    this.#importGeneratedJsGlue =
      options?.importGeneratedJsGlue ?? ((specifier) => import(/* @vite-ignore */ specifier));
    this.#readGeneratedWasmBytes = options?.readGeneratedWasmBytes ?? ((path) => readFileSync(path));
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
            // 10a. Stage 921 (Prototype EXECUTION Phase 001) -- the FIRST
            // real (non-fixed-constant) check this file ever performs:
            // a live, read-only existsSync() presence check of the two
            // Generated Artifact files. The result is recorded on the
            // instance for later inspection (generatedArtifactCheckResult())
            // but is NEVER read by the `if` below or by any branch past
            // it -- every remaining Plan still runs in the SAME order as
            // before, and this call can never change which value
            // planLoad() returns.
            this.#generatedArtifactCheckResult = this.#checkGeneratedArtifacts();
            const devOnlyGatePlan = this.#createDevOnlyGatePlan(); // 12. Dev-only Gate Plan generated
            if (!devOnlyGatePlan.shouldEvaluate) {
              // 13. Dev-only Gate Plan's own result confirmed -- ALWAYS false today
              // 13a. Stage 929 (Prototype EXECUTION Phase 002) -- the SECOND
              // real (non-fixed-constant) check this file ever performs:
              // classifies the current runtime via the shared Runtime Mode
              // Authority (Secure Runtime Alpha 020), which reads
              // process.env.NODE_ENV. The result is recorded on the instance for later inspection
              // (devOnlyGateEvaluation()) but is NEVER read by the `if`
              // below or by any branch past it -- Import Plan/WebAssembly
              // Plan/Rust API Call Plan still run in the SAME order as
              // before, and this call can never change which value
              // planLoad() returns. Evaluating Development Runtime is NOT
              // import permission.
              this.#devOnlyGateEvaluation = this.#evaluateDevOnlyGate();
              const importPlan = this.#createImportPlan(); // 15. Import Plan generated
              if (!importPlan.shouldImport) {
                // 16. Import Plan's own result confirmed -- ALWAYS false today
                // 16a. Stage 937 (Prototype EXECUTION Phase 003) -- the THIRD
                // real (non-fixed-constant) check this file ever performs,
                // though computed WITHOUT any new filesystem/environment
                // read: a PURE combination of the Generated Artifact Check
                // and Dev-only Gate Evaluation results already recorded
                // above. The result is recorded on the instance for later
                // inspection (importReadiness()) but is NEVER read by the
                // `if` below or by any branch past it -- WebAssembly
                // Plan/Rust API Call Plan still run in the SAME order as
                // before, and this call can never change which value
                // planLoad() returns. Import Readiness is NOT import
                // permission.
                this.#importReadiness = this.#evaluateImportReadiness();
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
   * Stage 921 (Prototype EXECUTION Phase 001) — returns the most
   * recent REAL Generated Artifact Check result recorded by
   * `planLoad()`, or `null` if `planLoad()` has never been called on
   * this instance. Reading this value NEVER triggers a new check —
   * only `planLoad()`'s own call to `#checkGeneratedArtifacts()` ever
   * does. Not part of the `FedosWasmLoader` interface.
   */
  generatedArtifactCheckResult(): FedosWasmLoaderGeneratedArtifactCheckResult | null {
    return this.#generatedArtifactCheckResult;
  }

  /**
   * Stage 929 (Prototype EXECUTION Phase 002) — returns the most
   * recent REAL Dev-only Gate Evaluation recorded by `planLoad()`, or
   * `null` if `planLoad()` has never been called on this instance.
   * Reading this value NEVER triggers a new evaluation — only
   * `planLoad()`'s own call to `#evaluateDevOnlyGate()` ever does. Not
   * part of the `FedosWasmLoader` interface.
   */
  devOnlyGateEvaluation(): FedosWasmLoaderDevOnlyGateEvaluation | null {
    return this.#devOnlyGateEvaluation;
  }

  /**
   * Stage 937 (Prototype EXECUTION Phase 003) — returns the most
   * recent REAL Import Readiness evaluation recorded by `planLoad()`,
   * or `null` if `planLoad()` has never been called on this instance.
   * Reading this value NEVER triggers a new evaluation — only
   * `planLoad()`'s own call to `#evaluateImportReadiness()` ever does.
   * Not part of the `FedosWasmLoader` interface.
   */
  importReadiness(): FedosWasmLoaderImportReadiness | null {
    return this.#importReadiness;
  }

  /**
   * Stage 937 (Prototype EXECUTION Phase 003) — returns one readable
   * snapshot combining the three REAL results this instance has
   * recorded so far, or `null` if `planLoad()` has never been called.
   * Reading this value triggers NO new check of any kind — it purely
   * reads `#generatedArtifactCheckResult`/`#devOnlyGateEvaluation`/
   * `#importReadiness`. Not part of the `FedosWasmLoader` interface.
   */
  executionReadinessSummary(): FedosWasmLoaderExecutionReadinessSummary | null {
    if (!this.#generatedArtifactCheckResult || !this.#devOnlyGateEvaluation || !this.#importReadiness) {
      return null;
    }
    return {
      artifactsOk: this.#generatedArtifactCheckResult.artifactsExist,
      runtimeOk: this.#devOnlyGateEvaluation.developmentAllowed,
      importReady: this.#importReadiness.ready,
      importExecuted: false,
      webAssemblyExecuted: false,
      rustExecuted: false,
    };
  }

  /**
   * Stage 945 (Prototype EXECUTION Phase 004) — returns the most
   * recent REAL import attempt result recorded by
   * `attemptDevOnlyJsGlueImport()`, or `null` if that method has never
   * been called on this instance. Reading this value NEVER triggers a
   * new import attempt. Not part of the `FedosWasmLoader` interface.
   */
  importExecution(): FedosWasmLoaderImportExecution | null {
    return this.#importExecution;
  }

  /**
   * Stage 961 (Prototype EXECUTION Phase 006) — returns the JS module
   * retained from the most recent successful `attemptDevOnlyJsGlueImport()`
   * call, or `null` on any other outcome (or before that method has
   * ever been called). Reading this value NEVER inspects, destructures,
   * or calls anything on the module — it is returned exactly as
   * `import()` resolved it. Not part of the `FedosWasmLoader` interface.
   */
  jsGlueModule(): object | null {
    return this.#jsGlueModule;
  }

  /**
   * Stage 969 (Prototype EXECUTION Phase 007) — returns the most
   * recent REAL WASM initialization attempt result recorded by
   * `attemptDevOnlyWasmInitialization()`, or `null` if that method has
   * never been called on this instance. Reading this value NEVER
   * triggers a new initialization attempt. Not part of the
   * `FedosWasmLoader` interface.
   */
  wasmInitialization(): FedosWasmLoaderWasmInitialization | null {
    return this.#wasmInitialization;
  }

  /**
   * Stage 993 (Prototype EXECUTION Phase 012) — returns the most
   * recent REAL Rust `version()` call result recorded by
   * `attemptDevOnlyRustVersionCall()`, or `null` if that method has
   * never been called on this instance. Reading this value NEVER
   * triggers a new call. Not part of the `FedosWasmLoader` interface.
   */
  rustVersionExecution(): FedosWasmLoaderRustVersionExecution | null {
    return this.#rustVersionExecution;
  }

  /**
   * Stage 1004 (Secure Runtime Alpha 008) — returns the most recent
   * REAL Rust `random_bytes_32()` call result recorded by
   * `attemptDevOnlyRandomBytesCall()`, or `null` if that method has
   * never been called on this instance. Reading this value NEVER
   * triggers a new call. Not part of the `FedosWasmLoader` interface.
   */
  randomBytesExecution(): FedosWasmLoaderRandomBytesExecution | null {
    return this.#randomBytesExecution;
  }

  /**
   * Stage 1005 (Secure Runtime Alpha 010), reshaped Stage 1008 (Secure
   * Runtime Alpha 013) — returns the most recent REAL Rust
   * `generate_aead_key_handle()` call result recorded by
   * `attemptDevOnlyAeadKeyGenerationCall()`, or `null` if that method
   * has never been called on this instance. Reading this value NEVER
   * triggers a new call. Not part of the `FedosWasmLoader` interface.
   */
  aeadKeyGenerationExecution(): FedosWasmLoaderAeadKeyGenerationExecution | null {
    return this.#aeadKeyGenerationExecution;
  }

  /**
   * Stage 1009 (Secure Runtime Alpha 014) — returns the most recent REAL
   * Rust `encrypt_aead()` call result recorded by
   * `attemptDevOnlyEncryptCall()`, or `null` if that method has never
   * been called on this instance. Reading this value NEVER triggers a
   * new call. Not part of the `FedosWasmLoader` interface.
   */
  encryptExecution(): FedosWasmLoaderEncryptExecution | null {
    return this.#encryptExecution;
  }

  /**
   * Stage 1010 (Secure Runtime Alpha 015) — returns the most recent REAL
   * Rust `decrypt_aead()` call result recorded by
   * `attemptDevOnlyDecryptCall()`, or `null` if that method has never
   * been called on this instance. Reading this value NEVER triggers a
   * new call. Not part of the `FedosWasmLoader` interface.
   */
  decryptExecution(): FedosWasmLoaderDecryptExecution | null {
    return this.#decryptExecution;
  }

  /**
   * Stage 1011 (Secure Runtime Alpha 018) — returns the most recent REAL
   * Rust `serialize_aead_ciphertext()` call result recorded by
   * `attemptDevOnlyExportCiphertextCall()`, or `null` if that method has
   * never been called on this instance. Reading this value NEVER
   * triggers a new call. Not part of the `FedosWasmLoader` interface.
   */
  exportCiphertextExecution(): FedosWasmLoaderExportCiphertextExecution | null {
    return this.#exportCiphertextExecution;
  }

  /**
   * Stage 1011 (Secure Runtime Alpha 018) — returns the most recent REAL
   * Rust `deserialize_aead_ciphertext()` call result recorded by
   * `attemptDevOnlyImportCiphertextCall()`, or `null` if that method has
   * never been called on this instance. Reading this value NEVER
   * triggers a new call. Not part of the `FedosWasmLoader` interface.
   */
  importCiphertextExecution(): FedosWasmLoaderImportCiphertextExecution | null {
    return this.#importCiphertextExecution;
  }

  /** Secure Runtime Alpha 436 — read-only accessor for `#masterSeedAuthorityConstructExecution`. */
  masterSeedAuthorityConstructExecution(): FedosWasmLoaderMasterSeedAuthorityConstructExecution | null {
    return this.#masterSeedAuthorityConstructExecution;
  }

  /** Secure Runtime Alpha 436 — read-only accessor for `#masterSeedGenerateExecution`. */
  masterSeedGenerateExecution(): FedosWasmLoaderMasterSeedGenerateExecution | null {
    return this.#masterSeedGenerateExecution;
  }

  /** Secure Runtime Alpha 437 — read-only accessor for `#masterSeedSealExecution`. */
  masterSeedSealExecution(): FedosWasmLoaderMasterSeedSealExecution | null {
    return this.#masterSeedSealExecution;
  }

  /** Secure Runtime Alpha 437 — read-only accessor for `#masterSeedRestoreSealedExecution`. */
  masterSeedRestoreSealedExecution(): FedosWasmLoaderMasterSeedRestoreSealedExecution | null {
    return this.#masterSeedRestoreSealedExecution;
  }

  /** Secure Runtime Alpha 434 — read-only accessor for `#masterSeedClearExecution`. */
  masterSeedClearExecution(): FedosWasmLoaderMasterSeedClearExecution | null {
    return this.#masterSeedClearExecution;
  }

  /** Secure Runtime Alpha 444 — read-only accessor for `#nostrSignEventExecution`. */
  nostrSignEventExecution(): FedosWasmLoaderNostrSignEventExecution | null {
    return this.#nostrSignEventExecution;
  }

  /** Secure Runtime Alpha 684/685 — read-only accessor for `#nostrPublicIdentityExecution`. */
  nostrPublicIdentityExecution(): FedosWasmLoaderNostrPublicIdentityExecution | null {
    return this.#nostrPublicIdentityExecution;
  }

  /**
   * Stage 945 (Prototype EXECUTION Phase 004) — PUBLIC, ASYNC (the
   * FIRST async method this class exposes; `planLoad()` itself is
   * UNCHANGED and does NOT call this method). Reads
   * `this.#importReadiness` — populated by the MOST RECENT `planLoad()`
   * call — as its ONLY gate:
   *   - `this.#importReadiness` is `null` (`planLoad()` never called):
   *     `import()` is NEVER attempted; resolves
   *     `{ attempted: false, succeeded: false, reason: "PrototypeStillClosed" }`.
   *   - `this.#importReadiness.ready` is `false`: `import()` is NEVER
   *     attempted; resolves
   *     `{ attempted: false, succeeded: false, reason: "NotReady" }`.
   *   - `this.#importReadiness.ready` is `true`: calls real, dynamic
   *     `import()` (via `pathToFileURL`) on the SAME single Generated
   *     JS Glue path Stage 921 already names
   *     (`packages/fedos-core-rust/pkg/fedos_core_rust.js` — never the
   *     `.wasm` file, and no new artifact discovery), wrapped in a
   *     `try`/`catch` that Fails Closed to
   *     `{ attempted: true, succeeded: false, reason: "ImportFailed" }`
   *     on ANY thrown/rejected error (and `#jsGlueModule` set to
   *     `null`). On success (Stage 961), the imported module's own
   *     return value is RETAINED, unexamined, on `this.#jsGlueModule`
   *     — never inspected, never destructured, never called — resolving
   *     `{ attempted: true, succeeded: true, reason: "Imported" }`.
   *     On EVERY other outcome, `this.#jsGlueModule` is set to `null`.
   * Never references `__wbg_init`/`initSync`/`WebAssembly`/any Rust
   * API, even on success. Called by NOTHING else in this file, in
   * `create_runtime.ts`, or in `src/worker.ts`.
   */
  async attemptDevOnlyJsGlueImport(): Promise<FedosWasmLoaderImportExecution> {
    const readiness = this.#importReadiness;
    let result: FedosWasmLoaderImportExecution;
    let module: object | null = null;
    if (!readiness) {
      result = { attempted: false, succeeded: false, reason: "PrototypeStillClosed" };
    } else if (!readiness.ready) {
      result = { attempted: false, succeeded: false, reason: "NotReady" };
    } else {
      try {
        const jsGluePath = join(process.cwd(), "packages", "fedos-core-rust", "pkg", "fedos_core_rust.js");
        module = (await this.#importGeneratedJsGlue(pathToFileURL(jsGluePath).href)) as object;
        result = { attempted: true, succeeded: true, reason: "Imported" };
      } catch {
        module = null;
        result = { attempted: true, succeeded: false, reason: "ImportFailed" };
      }
    }
    this.#importExecution = result;
    this.#jsGlueModule = module;
    return result;
  }

  /**
   * Stage 969 (Prototype EXECUTION Phase 007) — PUBLIC, ASYNC (like
   * Stage 945's `attemptDevOnlyJsGlueImport()`; `planLoad()` itself is
   * UNCHANGED and does NOT call this method). Its ONLY gate is ALL
   * FOUR of `this.#importReadiness.ready`,
   * `this.#devOnlyGateEvaluation.developmentAllowed`,
   * `this.#importExecution.succeeded`, and `this.#jsGlueModule !==
   * null` — every one populated by an EARLIER method call, never
   * re-evaluated here:
   *   - Any of the four missing/`null`/`false`: `initSync`/`default`
   *     is NEVER called; resolves `{ attempted: false, succeeded:
   *     false, reason: "PrototypeStillClosed" }` (prior state
   *     entirely missing) or `"NotReady"` (prior state present but
   *     one of the four conditions unmet).
   *   - All four satisfied: checks, AT RUNTIME, which of EXACTLY two
   *     named functions the retained module exposes
   *     (`typeof module.initSync === "function"`, then `typeof
   *     module.default === "function"`) — NEVER hand-picking one in
   *     source code, and NEVER searching for anything beyond those
   *     two names. Neither present: resolves
   *     `{ attempted: true, succeeded: false, reason:
   *     "InitializationUnavailable" }`. `initSync` is PREFERRED when
   *     present (this project's Node/Vitest runtime makes `default`'s
   *     own no-argument `fetch(new URL(..., import.meta.url))`
   *     fallback risky); EITHER way, the SAME
   *     `fedos_core_rust_bg.wasm` bytes Stage 921 already names are
   *     read (via `this.#readGeneratedWasmBytes`) and passed
   *     EXPLICITLY — `default()` is NEVER called with no argument.
   *     Wrapped in `try`/`catch` that Fails Closed to
   *     `{ attempted: true, succeeded: false, reason:
   *     "InitializationFailed" }` on ANY thrown/rejected error
   *     (including a bytes-read failure). On success, resolves
   *     `{ attempted: true, succeeded: true, reason: "Initialized" }`
   *     — the init function's own return value (`InitOutput`/
   *     `memory`/instance) is NEVER retained, NEVER inspected, and
   *     NEVER read anywhere in this file.
   * Never calls any Rust API, including `version()` — the generated JS
   * glue exposes none to call, regardless of outcome. Called by
   * NOTHING else in this file, in `create_runtime.ts`, or in
   * `src/worker.ts`.
   */
  async attemptDevOnlyWasmInitialization(): Promise<FedosWasmLoaderWasmInitialization> {
    const readiness = this.#importReadiness;
    const devGate = this.#devOnlyGateEvaluation;
    const importResult = this.#importExecution;
    const module = this.#jsGlueModule;

    let result: FedosWasmLoaderWasmInitialization;
    if (!readiness || !devGate || !importResult) {
      result = { attempted: false, succeeded: false, reason: "PrototypeStillClosed" };
    } else if (!readiness.ready || !devGate.developmentAllowed || !importResult.succeeded || !module) {
      result = { attempted: false, succeeded: false, reason: "NotReady" };
    } else {
      const candidate = module as { initSync?: unknown; default?: unknown };
      const hasInitSync = typeof candidate.initSync === "function";
      const hasDefault = typeof candidate.default === "function";
      if (!hasInitSync && !hasDefault) {
        result = { attempted: true, succeeded: false, reason: "InitializationUnavailable" };
      } else {
        try {
          const wasmBytes = this.#readGeneratedWasmBytes(
            join(process.cwd(), "packages", "fedos-core-rust", "pkg", "fedos_core_rust_bg.wasm"),
          );
          if (hasInitSync) {
            (candidate.initSync as (input: { module: Uint8Array }) => unknown)({ module: wasmBytes });
          } else {
            await (candidate.default as (input: { module_or_path: Uint8Array }) => Promise<unknown>)({
              module_or_path: wasmBytes,
            });
          }
          result = { attempted: true, succeeded: true, reason: "Initialized" };
        } catch {
          result = { attempted: true, succeeded: false, reason: "InitializationFailed" };
        }
      }
    }
    this.#wasmInitialization = result;
    return result;
  }

  /**
   * Stage 993 (Prototype EXECUTION Phase 012) — PUBLIC, ASYNC (the
   * SAME pattern as Stage 945/969's own async methods; `planLoad()`
   * itself is UNCHANGED and does NOT call this method, and neither
   * does `initializeCrypto()`). The FIRST time this arc ever calls a
   * real Rust API through the retained module. Its ONLY gate is ALL
   * SIX of: `this.#generatedArtifactCheckResult.artifactsExist`,
   * `this.#devOnlyGateEvaluation.developmentAllowed`,
   * `this.#importReadiness.ready`, `this.#importExecution.succeeded`,
   * `this.#jsGlueModule !== null`, and
   * `this.#wasmInitialization.succeeded` — every one populated by an
   * EARLIER method call, never re-evaluated here:
   *   - Any of the six missing entirely (`null`): `module.version` is
   *     NEVER read; resolves
   *     `{ attempted: false, succeeded: false, version: null, reason:
   *     "PrototypeStillClosed" }`.
   *   - All six present but at least one condition unmet: `module.version`
   *     is NEVER read; resolves
   *     `{ attempted: false, succeeded: false, version: null, reason:
   *     "NotInitialized" }`.
   *   - All six satisfied: checks, AT RUNTIME, ONLY
   *     `typeof module.version === "function"` — no export-list
   *     enumeration or discovery of any kind. Absent: resolves
   *     `{ attempted: true, succeeded: false, version: null, reason:
   *     "VersionUnavailable" }`. Present: calls `module.version()`
   *     with NO argument, wrapped in `try`/`catch` that Fails Closed
   *     to `{ attempted: true, succeeded: false, version: null,
   *     reason: "CallFailed" }` on ANY thrown/rejected error OR a
   *     non-`string` return value. On a genuine `string` return:
   *     resolves `{ attempted: true, succeeded: true, version:
   *     <string>, reason: "Succeeded" }`.
   * Never inspects, destructures, or retains the module or any other
   * Rust object — only the decoded `string` (or `null`) is ever
   * stored, on `this.#rustVersionExecution`, readable via the new
   * PUBLIC `rustVersionExecution()` method. Never calls any Rust API
   * other than `version()` — no `encrypt`/`decrypt`/`randomBytes`/
   * `deriveKey`/any other export. Called by NOTHING else in this
   * file, in `create_runtime.ts`, or in `src/worker.ts`; not read by
   * `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts`.
   */
  async attemptDevOnlyRustVersionCall(): Promise<FedosWasmLoaderRustVersionExecution> {
    const artifactCheck = this.#generatedArtifactCheckResult;
    const devGate = this.#devOnlyGateEvaluation;
    const readiness = this.#importReadiness;
    const importResult = this.#importExecution;
    const module = this.#jsGlueModule;
    const wasmInit = this.#wasmInitialization;

    let result: FedosWasmLoaderRustVersionExecution;
    if (!artifactCheck || !devGate || !readiness || !importResult || !wasmInit) {
      result = { attempted: false, succeeded: false, version: null, reason: "PrototypeStillClosed" };
    } else if (
      !artifactCheck.artifactsExist ||
      !devGate.developmentAllowed ||
      !readiness.ready ||
      !importResult.succeeded ||
      !module ||
      !wasmInit.succeeded
    ) {
      result = { attempted: false, succeeded: false, version: null, reason: "NotInitialized" };
    } else {
      const candidate = module as { version?: unknown };
      if (typeof candidate.version !== "function") {
        result = { attempted: true, succeeded: false, version: null, reason: "VersionUnavailable" };
      } else {
        try {
          const value: unknown = (candidate.version as () => unknown)();
          if (typeof value === "string") {
            result = { attempted: true, succeeded: true, version: value, reason: "Succeeded" };
          } else {
            result = { attempted: true, succeeded: false, version: null, reason: "CallFailed" };
          }
        } catch {
          result = { attempted: true, succeeded: false, version: null, reason: "CallFailed" };
        }
      }
    }
    this.#rustVersionExecution = result;
    return result;
  }

  /**
   * Stage 1004 (Secure Runtime Alpha 008) — PUBLIC, ASYNC. Mirrors
   * `attemptDevOnlyRustVersionCall()` (Stage 993) exactly, gated on the
   * SAME six previously-recorded conditions
   * (`this.#generatedArtifactCheckResult`, `this.#devOnlyGateEvaluation`,
   * `this.#importReadiness`, `this.#importExecution`,
   * `this.#jsGlueModule !== null`, and
   * `this.#wasmInitialization.succeeded`) — every one populated by an
   * EARLIER method call, never re-evaluated here:
   *   - Any of the six missing entirely (`null`): `module.random_bytes_32`
   *     is NEVER read; resolves
   *     `{ attempted: false, succeeded: false, bytes: null, reason:
   *     "PrototypeStillClosed" }`.
   *   - All six present but at least one condition unmet:
   *     `module.random_bytes_32` is NEVER read; resolves
   *     `{ attempted: false, succeeded: false, bytes: null, reason:
   *     "NotInitialized" }`.
   *   - All six satisfied: checks, AT RUNTIME, ONLY
   *     `typeof module.random_bytes_32 === "function"` — no export-list
   *     enumeration or discovery of any kind. Absent: resolves
   *     `{ attempted: true, succeeded: false, bytes: null, reason:
   *     "RandomBytesUnavailable" }`. Present: calls
   *     `module.random_bytes_32()` with NO argument, wrapped in
   *     `try`/`catch` that Fails Closed to `{ attempted: true,
   *     succeeded: false, bytes: null, reason: "CallFailed" }` on ANY
   *     thrown/rejected error OR a non-`Uint8Array`/non-`undefined`
   *     return value. A genuine `undefined` return (Rust's own Fail
   *     Closed on `EntropySourceUnavailable`, per Stage 1004's
   *     `random_bytes_32()` doc comment in `lib.rs`) resolves
   *     `{ attempted: true, succeeded: false, bytes: null, reason:
   *     "EntropySourceUnavailable" }` — NOT `"CallFailed"`, since
   *     nothing threw. On a genuine `Uint8Array` return: resolves
   *     `{ attempted: true, succeeded: true, bytes: <Uint8Array>,
   *     reason: "Succeeded" }`.
   * Never inspects, destructures, or retains the module or any other
   * Rust object — only the returned `Uint8Array` (or `null`) is ever
   * stored, on `this.#randomBytesExecution`, readable via the new
   * PUBLIC `randomBytesExecution()` method. Never calls any Rust API
   * other than `random_bytes_32()` — no `encrypt`/`decrypt`/
   * `deriveKey`/any other export. Called by NOTHING else in this file.
   */
  async attemptDevOnlyRandomBytesCall(): Promise<FedosWasmLoaderRandomBytesExecution> {
    const artifactCheck = this.#generatedArtifactCheckResult;
    const devGate = this.#devOnlyGateEvaluation;
    const readiness = this.#importReadiness;
    const importResult = this.#importExecution;
    const module = this.#jsGlueModule;
    const wasmInit = this.#wasmInitialization;

    let result: FedosWasmLoaderRandomBytesExecution;
    if (!artifactCheck || !devGate || !readiness || !importResult || !wasmInit) {
      result = { attempted: false, succeeded: false, bytes: null, reason: "PrototypeStillClosed" };
    } else if (
      !artifactCheck.artifactsExist ||
      !devGate.developmentAllowed ||
      !readiness.ready ||
      !importResult.succeeded ||
      !module ||
      !wasmInit.succeeded
    ) {
      result = { attempted: false, succeeded: false, bytes: null, reason: "NotInitialized" };
    } else {
      const candidate = module as { random_bytes_32?: unknown };
      if (typeof candidate.random_bytes_32 !== "function") {
        result = { attempted: true, succeeded: false, bytes: null, reason: "RandomBytesUnavailable" };
      } else {
        try {
          const value: unknown = (candidate.random_bytes_32 as () => unknown)();
          if (value instanceof Uint8Array) {
            result = { attempted: true, succeeded: true, bytes: value, reason: "Succeeded" };
          } else if (value === undefined) {
            result = { attempted: true, succeeded: false, bytes: null, reason: "EntropySourceUnavailable" };
          } else {
            result = { attempted: true, succeeded: false, bytes: null, reason: "CallFailed" };
          }
        } catch {
          result = { attempted: true, succeeded: false, bytes: null, reason: "CallFailed" };
        }
      }
    }
    this.#randomBytesExecution = result;
    return result;
  }

  /**
   * Stage 1008 (Secure Runtime Alpha 013) — PUBLIC, ASYNC. REPLACES
   * Stage 1005's `module.generate_aead_key_32` reach (Secure Runtime
   * Alpha 010) with `module.generate_aead_key_handle`, per this arc's
   * own Alpha 012 Key Boundary Decision's deliberate breaking-change
   * decision — otherwise mirrors
   * `attemptDevOnlyRandomBytesCall()` (Stage 1004) exactly, gated on
   * the SAME six previously-recorded conditions
   * (`this.#generatedArtifactCheckResult`, `this.#devOnlyGateEvaluation`,
   * `this.#importReadiness`, `this.#importExecution`,
   * `this.#jsGlueModule !== null`, and
   * `this.#wasmInitialization.succeeded`) — every one populated by an
   * EARLIER method call, never re-evaluated here:
   *   - Any of the six missing entirely (`null`): `module.generate_aead_key_handle`
   *     is NEVER read; resolves
   *     `{ attempted: false, succeeded: false, keyHandle: null, reason:
   *     "PrototypeStillClosed" }`.
   *   - All six present but at least one condition unmet:
   *     `module.generate_aead_key_handle` is NEVER read; resolves
   *     `{ attempted: false, succeeded: false, keyHandle: null, reason:
   *     "NotInitialized" }`.
   *   - All six satisfied: checks, AT RUNTIME, ONLY
   *     `typeof module.generate_aead_key_handle === "function"` — no
   *     export-list enumeration or discovery of any kind. Absent:
   *     resolves `{ attempted: true, succeeded: false, keyHandle: null,
   *     reason: "KeyGenerationUnavailable" }`. Present: calls
   *     `module.generate_aead_key_handle()` with NO argument, wrapped in
   *     `try`/`catch` that Fails Closed to `{ attempted: true,
   *     succeeded: false, keyHandle: null, reason: "CallFailed" }` on
   *     ANY thrown/rejected error. A genuine `undefined` return (Rust's
   *     own Fail Closed on `EntropySourceUnavailable`) resolves
   *     `{ attempted: true, succeeded: false, keyHandle: null, reason:
   *     "EntropySourceUnavailable" }` — NOT `"CallFailed"`, since
   *     nothing threw. A genuine return that is NEITHER `undefined` NOR
   *     structurally a real handle (per `isAeadKeyHandleShape()` above —
   *     e.g. a raw `Uint8Array`, a plain `{}`, or any other value)
   *     resolves `{ attempted: true, succeeded: false, keyHandle: null,
   *     reason: "InvalidHandleShape" }` — a DISTINCT Fail-Closed reason
   *     from `"CallFailed"`, since nothing threw either. On a
   *     structurally genuine handle: resolves `{ attempted: true,
   *     succeeded: true, keyHandle: <AeadKeyHandle>, reason: "Succeeded"
   *     }`.
   * Never inspects, destructures, or retains the module itself — only
   * the returned `AeadKeyHandle` (or `null`) is ever stored, on
   * `this.#aeadKeyGenerationExecution`, readable via the new PUBLIC
   * `aeadKeyGenerationExecution()` method, and NEVER unwrapped, copied,
   * or read into raw bytes anywhere in this method. Never calls any
   * Rust API other than `generate_aead_key_handle()` — no
   * `encrypt`/`decrypt`/`deriveKey`/`randomBytes`/any other export.
   * Called by NOTHING else in this file.
   */
  async attemptDevOnlyAeadKeyGenerationCall(): Promise<FedosWasmLoaderAeadKeyGenerationExecution> {
    const artifactCheck = this.#generatedArtifactCheckResult;
    const devGate = this.#devOnlyGateEvaluation;
    const readiness = this.#importReadiness;
    const importResult = this.#importExecution;
    const module = this.#jsGlueModule;
    const wasmInit = this.#wasmInitialization;

    let result: FedosWasmLoaderAeadKeyGenerationExecution;
    if (!artifactCheck || !devGate || !readiness || !importResult || !wasmInit) {
      result = { attempted: false, succeeded: false, keyHandle: null, reason: "PrototypeStillClosed" };
    } else if (
      !artifactCheck.artifactsExist ||
      !devGate.developmentAllowed ||
      !readiness.ready ||
      !importResult.succeeded ||
      !module ||
      !wasmInit.succeeded
    ) {
      result = { attempted: false, succeeded: false, keyHandle: null, reason: "NotInitialized" };
    } else {
      const candidate = module as { generate_aead_key_handle?: unknown };
      if (typeof candidate.generate_aead_key_handle !== "function") {
        result = { attempted: true, succeeded: false, keyHandle: null, reason: "KeyGenerationUnavailable" };
      } else {
        try {
          const value: unknown = (candidate.generate_aead_key_handle as () => unknown)();
          if (isAeadKeyHandleShape(value)) {
            result = { attempted: true, succeeded: true, keyHandle: value, reason: "Succeeded" };
          } else if (value === undefined) {
            result = { attempted: true, succeeded: false, keyHandle: null, reason: "EntropySourceUnavailable" };
          } else {
            result = { attempted: true, succeeded: false, keyHandle: null, reason: "InvalidHandleShape" };
          }
        } catch {
          result = { attempted: true, succeeded: false, keyHandle: null, reason: "CallFailed" };
        }
      }
    }
    this.#aeadKeyGenerationExecution = result;
    return result;
  }

  /**
   * Stage 1009 (Secure Runtime Alpha 014) — PUBLIC, ASYNC. The Rust
   * Boundary reach for `AppRuntime.encrypt()`, gated on the SAME six
   * previously-recorded conditions
   * (`this.#generatedArtifactCheckResult`, `this.#devOnlyGateEvaluation`,
   * `this.#importReadiness`, `this.#importExecution`,
   * `this.#jsGlueModule !== null`, and
   * `this.#wasmInitialization.succeeded`) every other Rust Boundary
   * reach method already uses:
   *   - Any of the six missing entirely (`null`): `module.encrypt_aead`
   *     is NEVER read; resolves `{ attempted: false, succeeded: false,
   *     ciphertextHandle: null, reason: "PrototypeStillClosed" }`.
   *   - All six present but at least one condition unmet:
   *     `module.encrypt_aead` is NEVER read; resolves
   *     `{ attempted: false, succeeded: false, ciphertextHandle: null,
   *     reason: "NotInitialized" }`.
   *   - All six satisfied, but `key` does NOT structurally satisfy
   *     `isAeadKeyHandleShape()`: `module.encrypt_aead` is NEVER called
   *     at all — resolves `{ attempted: true, succeeded: false,
   *     ciphertextHandle: null, reason: "InvalidKeyHandle" }`. This
   *     check runs BEFORE the export-presence check below, so an
   *     obviously-wrong `key` never reaches the WASM call regardless of
   *     whether the export itself exists.
   *   - All six satisfied and `key` is structurally valid: checks, AT
   *     RUNTIME, ONLY `typeof module.encrypt_aead === "function"` — no
   *     export-list enumeration or discovery of any kind. Absent:
   *     resolves `{ attempted: true, succeeded: false, ciphertextHandle:
   *     null, reason: "EncryptUnavailable" }`. Present: calls
   *     `module.encrypt_aead(key, algorithm, aadDomain, plaintext)` —
   *     `algorithm`/`aadDomain` translated from their PUBLIC string
   *     labels to `lib.rs`'s own numeric discriminants via
   *     `AEAD_ALGORITHM_DISCRIMINANTS`/`AEAD_AAD_DOMAIN_DISCRIMINANTS`
   *     above — wrapped in `try`/`catch` that Fails Closed to
   *     `{ attempted: true, succeeded: false, ciphertextHandle: null,
   *     reason: "CallFailed" }` on ANY thrown/rejected error. A genuine
   *     `undefined` return (Rust's own `InvalidKey`/`NonceUnavailable`/
   *     `InternalFailure`, all collapsed by `encrypt_aead()` itself)
   *     resolves `{ attempted: true, succeeded: false, ciphertextHandle:
   *     null, reason: "EncryptionFailed" }` — NOT `"CallFailed"`, since
   *     nothing threw. A genuine return that is NEITHER `undefined` NOR
   *     structurally a real ciphertext handle (per
   *     `isAeadCiphertextHandleShape()` above) resolves
   *     `{ attempted: true, succeeded: false, ciphertextHandle: null,
   *     reason: "InvalidCiphertextShape" }`. On a structurally genuine
   *     handle: resolves `{ attempted: true, succeeded: true,
   *     ciphertextHandle: <AeadCiphertextHandle>, reason: "Succeeded" }`.
   * Never inspects, destructures, or retains the module itself, and
   * never reads a byte out of `key` or the returned ciphertext handle —
   * only the returned `AeadCiphertextHandle` (or `null`) is ever stored,
   * on `this.#encryptExecution`, readable via the new PUBLIC
   * `encryptExecution()` method. Never calls any Rust API other than
   * `encrypt_aead()` — no `decrypt`/`importKey`/`exportKey`/any other
   * export. Called by NOTHING else in this file.
   */
  async attemptDevOnlyEncryptCall(
    key: unknown,
    algorithm: AeadAlgorithm,
    aadDomain: AeadAadDomain,
    plaintext: Uint8Array,
  ): Promise<FedosWasmLoaderEncryptExecution> {
    const artifactCheck = this.#generatedArtifactCheckResult;
    const devGate = this.#devOnlyGateEvaluation;
    const readiness = this.#importReadiness;
    const importResult = this.#importExecution;
    const module = this.#jsGlueModule;
    const wasmInit = this.#wasmInitialization;

    let result: FedosWasmLoaderEncryptExecution;
    if (!artifactCheck || !devGate || !readiness || !importResult || !wasmInit) {
      result = { attempted: false, succeeded: false, ciphertextHandle: null, reason: "PrototypeStillClosed" };
    } else if (
      !artifactCheck.artifactsExist ||
      !devGate.developmentAllowed ||
      !readiness.ready ||
      !importResult.succeeded ||
      !module ||
      !wasmInit.succeeded
    ) {
      result = { attempted: false, succeeded: false, ciphertextHandle: null, reason: "NotInitialized" };
    } else if (!isAeadKeyHandleShape(key)) {
      result = { attempted: true, succeeded: false, ciphertextHandle: null, reason: "InvalidKeyHandle" };
    } else {
      const candidate = module as { encrypt_aead?: unknown };
      if (typeof candidate.encrypt_aead !== "function") {
        result = { attempted: true, succeeded: false, ciphertextHandle: null, reason: "EncryptUnavailable" };
      } else {
        try {
          const value: unknown = (
            candidate.encrypt_aead as (
              key: unknown,
              algorithm: number,
              aadDomain: number,
              plaintext: Uint8Array,
            ) => unknown
          )(key, AEAD_ALGORITHM_DISCRIMINANTS[algorithm], AEAD_AAD_DOMAIN_DISCRIMINANTS[aadDomain], plaintext);
          if (isAeadCiphertextHandleShape(value)) {
            result = { attempted: true, succeeded: true, ciphertextHandle: value, reason: "Succeeded" };
          } else if (value === undefined) {
            result = { attempted: true, succeeded: false, ciphertextHandle: null, reason: "EncryptionFailed" };
          } else {
            result = { attempted: true, succeeded: false, ciphertextHandle: null, reason: "InvalidCiphertextShape" };
          }
        } catch {
          result = { attempted: true, succeeded: false, ciphertextHandle: null, reason: "CallFailed" };
        }
      }
    }
    this.#encryptExecution = result;
    return result;
  }

  /**
   * Stage 1010 (Secure Runtime Alpha 015) — PUBLIC, ASYNC. The Rust
   * Boundary reach for `AppRuntime.decrypt()`, gated on the SAME six
   * previously-recorded conditions every other Rust Boundary reach
   * method uses. Mirrors `attemptDevOnlyEncryptCall()`'s own shape, with
   * FOUR structural checks (not one) run BEFORE `module.decrypt_aead` is
   * ever read or called:
   *   - Any of the six missing/unmet: resolves `"PrototypeStillClosed"`/
   *     `"NotInitialized"` — `module.decrypt_aead` is NEVER read.
   *   - `key` does not structurally satisfy `isAeadKeyHandleShape()`:
   *     resolves `"InvalidKeyHandle"`.
   *   - `ciphertext` does not structurally satisfy
   *     `isAeadCiphertextHandleShape()`: resolves
   *     `"InvalidCiphertextHandle"`.
   *   - `algorithm` is not a known key of `AEAD_ALGORITHM_DISCRIMINANTS`:
   *     resolves `"InvalidAlgorithm"` — a runtime defense-in-depth check,
   *     since TypeScript's own literal-union type does not survive an
   *     `as any` bypass at a public API boundary.
   *   - `aadDomain` is not a known key of
   *     `AEAD_AAD_DOMAIN_DISCRIMINANTS`: resolves `"InvalidAadDomain"`.
   * All four checks pass: checks, AT RUNTIME, ONLY
   * `typeof module.decrypt_aead === "function"`. Absent: resolves
   * `"DecryptUnavailable"`. Present: calls
   * `module.decrypt_aead(key, algorithm, aadDomain, ciphertext)` —
   * `algorithm`/`aadDomain` translated to `lib.rs`'s own numeric
   * discriminants via the SAME two lookup tables
   * `attemptDevOnlyEncryptCall()` already uses — wrapped in `try`/`catch`
   * that Fails Closed to `"CallFailed"` on ANY thrown/rejected error. A
   * genuine `undefined` return (Rust's own `decrypt_aead()` — EVERY
   * semantic failure cause collapsed uniformly: wrong key, an
   * algorithm/AAD-domain that does not match what was actually sealed
   * into `ciphertext`, a tampered ciphertext, or an internal failure)
   * resolves `"DecryptionFailed"` — NOT `"CallFailed"`, since nothing
   * threw. A genuine return that is NEITHER `undefined` NOR a real
   * `Uint8Array` resolves `"InvalidPlaintextShape"`. On a genuine
   * `Uint8Array`: resolves `{ attempted: true, succeeded: true,
   * plaintext: <Uint8Array>, reason: "Succeeded" }`.
   * Never inspects, destructures, or retains the module itself, and
   * never reads a byte out of `key`/`ciphertext` beyond what
   * `decrypt_aead()` itself returns as recovered plaintext — only that
   * `Uint8Array` (or `null`) is ever stored, on
   * `this.#decryptExecution`, readable via the new PUBLIC
   * `decryptExecution()` method. Never calls any Rust API other than
   * `decrypt_aead()` — no `importKey`/`exportKey`/any other export.
   * Called by NOTHING else in this file.
   */
  async attemptDevOnlyDecryptCall(
    key: unknown,
    algorithm: AeadAlgorithm,
    aadDomain: AeadAadDomain,
    ciphertext: unknown,
  ): Promise<FedosWasmLoaderDecryptExecution> {
    const artifactCheck = this.#generatedArtifactCheckResult;
    const devGate = this.#devOnlyGateEvaluation;
    const readiness = this.#importReadiness;
    const importResult = this.#importExecution;
    const module = this.#jsGlueModule;
    const wasmInit = this.#wasmInitialization;

    let result: FedosWasmLoaderDecryptExecution;
    if (!artifactCheck || !devGate || !readiness || !importResult || !wasmInit) {
      result = { attempted: false, succeeded: false, plaintext: null, reason: "PrototypeStillClosed" };
    } else if (
      !artifactCheck.artifactsExist ||
      !devGate.developmentAllowed ||
      !readiness.ready ||
      !importResult.succeeded ||
      !module ||
      !wasmInit.succeeded
    ) {
      result = { attempted: false, succeeded: false, plaintext: null, reason: "NotInitialized" };
    } else if (!isAeadKeyHandleShape(key)) {
      result = { attempted: true, succeeded: false, plaintext: null, reason: "InvalidKeyHandle" };
    } else if (!isAeadCiphertextHandleShape(ciphertext)) {
      result = { attempted: true, succeeded: false, plaintext: null, reason: "InvalidCiphertextHandle" };
    } else if (!(algorithm in AEAD_ALGORITHM_DISCRIMINANTS)) {
      result = { attempted: true, succeeded: false, plaintext: null, reason: "InvalidAlgorithm" };
    } else if (!(aadDomain in AEAD_AAD_DOMAIN_DISCRIMINANTS)) {
      result = { attempted: true, succeeded: false, plaintext: null, reason: "InvalidAadDomain" };
    } else {
      const candidate = module as { decrypt_aead?: unknown };
      if (typeof candidate.decrypt_aead !== "function") {
        result = { attempted: true, succeeded: false, plaintext: null, reason: "DecryptUnavailable" };
      } else {
        try {
          const value: unknown = (
            candidate.decrypt_aead as (
              key: unknown,
              algorithm: number,
              aadDomain: number,
              ciphertext: unknown,
            ) => unknown
          )(key, AEAD_ALGORITHM_DISCRIMINANTS[algorithm], AEAD_AAD_DOMAIN_DISCRIMINANTS[aadDomain], ciphertext);
          if (value instanceof Uint8Array) {
            result = { attempted: true, succeeded: true, plaintext: value, reason: "Succeeded" };
          } else if (value === undefined) {
            result = { attempted: true, succeeded: false, plaintext: null, reason: "DecryptionFailed" };
          } else {
            result = { attempted: true, succeeded: false, plaintext: null, reason: "InvalidPlaintextShape" };
          }
        } catch {
          result = { attempted: true, succeeded: false, plaintext: null, reason: "CallFailed" };
        }
      }
    }
    this.#decryptExecution = result;
    return result;
  }

  /**
   * Stage 1011 (Secure Runtime Alpha 018) — the result of this call is
   * recorded in `this.#exportCiphertextExecution`, readable via the new
   * PUBLIC `exportCiphertextExecution()` method. Never calls any Rust
   * API other than the retained module's own `serialize_aead_ciphertext`
   * property, and only ever calls it ONCE per invocation of this method.
   *
   * Gate order, mirroring `attemptDevOnlyDecryptCall()` exactly:
   *   - `reason: "PrototypeStillClosed"` — the six-condition Loader
   *     chain never ran (`attempted: false`).
   *   - `reason: "NotInitialized"` — it ran, but one of the six
   *     conditions failed (`attempted: false`).
   *   - `reason: "InvalidCiphertextHandle"` — `ciphertext` does not
   *     structurally satisfy `isAeadCiphertextHandleShape()`: the WASM
   *     call is never attempted (`attempted: true`, `succeeded: false`).
   *   - `reason: "ExportUnavailable"` — the retained module has no
   *     `serialize_aead_ciphertext` function property.
   *   - `reason: "CallFailed"` — the call THREW (including a
   *     structurally-shaped but non-genuine `ciphertext` object that
   *     wasm-bindgen's own runtime type check rejects).
   *   - `reason: "SerializationFailed"` — a genuine, in-bounds
   *     `undefined` return from Rust.
   *   - `reason: "InvalidWireOutputShape"` — any other wrongly-shaped
   *     return, including an empty string.
   *   - `reason: "Succeeded"` — a non-empty `string`, recorded as
   *     `wire`.
   */
  async attemptDevOnlyExportCiphertextCall(
    ciphertext: unknown,
  ): Promise<FedosWasmLoaderExportCiphertextExecution> {
    const artifactCheck = this.#generatedArtifactCheckResult;
    const devGate = this.#devOnlyGateEvaluation;
    const readiness = this.#importReadiness;
    const importResult = this.#importExecution;
    const module = this.#jsGlueModule;
    const wasmInit = this.#wasmInitialization;

    let result: FedosWasmLoaderExportCiphertextExecution;
    if (!artifactCheck || !devGate || !readiness || !importResult || !wasmInit) {
      result = { attempted: false, succeeded: false, wire: null, reason: "PrototypeStillClosed" };
    } else if (
      !artifactCheck.artifactsExist ||
      !devGate.developmentAllowed ||
      !readiness.ready ||
      !importResult.succeeded ||
      !module ||
      !wasmInit.succeeded
    ) {
      result = { attempted: false, succeeded: false, wire: null, reason: "NotInitialized" };
    } else if (!isAeadCiphertextHandleShape(ciphertext)) {
      result = { attempted: true, succeeded: false, wire: null, reason: "InvalidCiphertextHandle" };
    } else {
      const candidate = module as { serialize_aead_ciphertext?: unknown };
      if (typeof candidate.serialize_aead_ciphertext !== "function") {
        result = { attempted: true, succeeded: false, wire: null, reason: "ExportUnavailable" };
      } else {
        try {
          const value: unknown = (
            candidate.serialize_aead_ciphertext as (ciphertext: unknown) => unknown
          )(ciphertext);
          if (typeof value === "string" && value.length > 0) {
            result = {
              attempted: true,
              succeeded: true,
              wire: value as AeadCiphertextWire,
              reason: "Succeeded",
            };
          } else if (value === undefined) {
            result = { attempted: true, succeeded: false, wire: null, reason: "SerializationFailed" };
          } else {
            result = { attempted: true, succeeded: false, wire: null, reason: "InvalidWireOutputShape" };
          }
        } catch {
          result = { attempted: true, succeeded: false, wire: null, reason: "CallFailed" };
        }
      }
    }
    this.#exportCiphertextExecution = result;
    return result;
  }

  /**
   * Stage 1011 (Secure Runtime Alpha 018) — the result of this call is
   * recorded in `this.#importCiphertextExecution`, readable via the new
   * PUBLIC `importCiphertextExecution()` method. Never calls any Rust
   * API other than the retained module's own
   * `deserialize_aead_ciphertext` property, and only ever calls it ONCE
   * per invocation of this method.
   *
   * `reason: "InvalidWireInputShape"` is the ONLY pre-call check on this
   * side — `serialized` must be a genuine `string`. Deliberately, this
   * method does NOT attempt to validate `serialized`'s own CONTENT
   * (version/algorithm/AAD-domain/base64url) itself — `serialized` is
   * untrusted by construction
   * (`docs/secure_runtime_alpha_017_ciphertext_wire_format_decision.md`
   * §8/§9), and content validation is `decode_envelope_internal`'s own,
   * already-reviewed, already-`cargo test`-verified job. `reason:
   * "DeserializationFailed"` folds EVERY ONE of that function's seven
   * internal rejection causes into one outcome, mirroring
   * `attemptDevOnlyDecryptCall()`'s own `"DecryptionFailed"` collapse.
   */
  async attemptDevOnlyImportCiphertextCall(
    serialized: unknown,
  ): Promise<FedosWasmLoaderImportCiphertextExecution> {
    const artifactCheck = this.#generatedArtifactCheckResult;
    const devGate = this.#devOnlyGateEvaluation;
    const readiness = this.#importReadiness;
    const importResult = this.#importExecution;
    const module = this.#jsGlueModule;
    const wasmInit = this.#wasmInitialization;

    let result: FedosWasmLoaderImportCiphertextExecution;
    if (!artifactCheck || !devGate || !readiness || !importResult || !wasmInit) {
      result = { attempted: false, succeeded: false, ciphertextHandle: null, reason: "PrototypeStillClosed" };
    } else if (
      !artifactCheck.artifactsExist ||
      !devGate.developmentAllowed ||
      !readiness.ready ||
      !importResult.succeeded ||
      !module ||
      !wasmInit.succeeded
    ) {
      result = { attempted: false, succeeded: false, ciphertextHandle: null, reason: "NotInitialized" };
    } else if (typeof serialized !== "string") {
      result = { attempted: true, succeeded: false, ciphertextHandle: null, reason: "InvalidWireInputShape" };
    } else {
      const candidate = module as { deserialize_aead_ciphertext?: unknown };
      if (typeof candidate.deserialize_aead_ciphertext !== "function") {
        result = { attempted: true, succeeded: false, ciphertextHandle: null, reason: "ImportUnavailable" };
      } else {
        try {
          const value: unknown = (
            candidate.deserialize_aead_ciphertext as (serialized: string) => unknown
          )(serialized);
          if (isAeadCiphertextHandleShape(value)) {
            result = { attempted: true, succeeded: true, ciphertextHandle: value, reason: "Succeeded" };
          } else if (value === undefined) {
            result = {
              attempted: true,
              succeeded: false,
              ciphertextHandle: null,
              reason: "DeserializationFailed",
            };
          } else {
            result = {
              attempted: true,
              succeeded: false,
              ciphertextHandle: null,
              reason: "InvalidHandleOutputShape",
            };
          }
        } catch {
          result = { attempted: true, succeeded: false, ciphertextHandle: null, reason: "CallFailed" };
        }
      }
    }
    this.#importCiphertextExecution = result;
    return result;
  }

  /**
   * Secure Runtime Alpha 436 — PUBLIC, ASYNC. Constructs a new
   * `FedosMasterSeedAuthority` WASM instance via
   * `new module.FedosMasterSeedAuthority()`, gated on the SAME six
   * previously-recorded conditions every other Rust Boundary reach
   * method uses. Never generates or restores a seed itself — the
   * returned handle starts `Empty` (Alpha 434's own lifecycle); the
   * caller must follow up with `attemptDevOnlyMasterSeedGenerateCall()`
   * or `attemptDevOnlyMasterSeedRestoreSealedCall()`.
   */
  async attemptDevOnlyMasterSeedAuthorityConstructCall(): Promise<FedosWasmLoaderMasterSeedAuthorityConstructExecution> {
    const artifactCheck = this.#generatedArtifactCheckResult;
    const devGate = this.#devOnlyGateEvaluation;
    const readiness = this.#importReadiness;
    const importResult = this.#importExecution;
    const module = this.#jsGlueModule;
    const wasmInit = this.#wasmInitialization;

    let result: FedosWasmLoaderMasterSeedAuthorityConstructExecution;
    if (!artifactCheck || !devGate || !readiness || !importResult || !wasmInit) {
      result = { attempted: false, succeeded: false, authority: null, reason: "PrototypeStillClosed" };
    } else if (
      !artifactCheck.artifactsExist ||
      !devGate.developmentAllowed ||
      !readiness.ready ||
      !importResult.succeeded ||
      !module ||
      !wasmInit.succeeded
    ) {
      result = { attempted: false, succeeded: false, authority: null, reason: "NotInitialized" };
    } else {
      const candidate = module as { FedosMasterSeedAuthority?: unknown };
      if (typeof candidate.FedosMasterSeedAuthority !== "function") {
        result = { attempted: true, succeeded: false, authority: null, reason: "ConstructorUnavailable" };
      } else {
        try {
          const Ctor = candidate.FedosMasterSeedAuthority as new () => unknown;
          const value: unknown = new Ctor();
          if (isFedosMasterSeedAuthorityShape(value)) {
            result = { attempted: true, succeeded: true, authority: value, reason: "Succeeded" };
          } else {
            result = { attempted: true, succeeded: false, authority: null, reason: "InvalidAuthorityShape" };
          }
        } catch {
          result = { attempted: true, succeeded: false, authority: null, reason: "CallFailed" };
        }
      }
    }
    this.#masterSeedAuthorityConstructExecution = result;
    return result;
  }

  /**
   * Secure Runtime Alpha 436 — PUBLIC, ASYNC. Calls `authority.generate()`
   * on a previously-constructed, structurally-validated handle. `authority`
   * is re-validated via `isFedosMasterSeedAuthorityShape()` before use —
   * mirroring `attemptDevOnlyEncryptCall()`'s own `key` validation — so an
   * obviously-wrong handle never reaches the WASM call.
   */
  async attemptDevOnlyMasterSeedGenerateCall(authority: unknown): Promise<FedosWasmLoaderMasterSeedGenerateExecution> {
    const artifactCheck = this.#generatedArtifactCheckResult;
    const devGate = this.#devOnlyGateEvaluation;
    const readiness = this.#importReadiness;
    const importResult = this.#importExecution;
    const module = this.#jsGlueModule;
    const wasmInit = this.#wasmInitialization;

    let result: FedosWasmLoaderMasterSeedGenerateExecution;
    if (!artifactCheck || !devGate || !readiness || !importResult || !wasmInit) {
      result = { attempted: false, succeeded: false, reason: "PrototypeStillClosed" };
    } else if (
      !artifactCheck.artifactsExist ||
      !devGate.developmentAllowed ||
      !readiness.ready ||
      !importResult.succeeded ||
      !module ||
      !wasmInit.succeeded
    ) {
      result = { attempted: false, succeeded: false, reason: "NotInitialized" };
    } else if (!isFedosMasterSeedAuthorityShape(authority)) {
      result = { attempted: true, succeeded: false, reason: "InvalidAuthorityHandle" };
    } else {
      try {
        const succeeded = authority.generate();
        result = { attempted: true, succeeded, reason: succeeded ? "Succeeded" : "GenerateFailed" };
      } catch {
        result = { attempted: true, succeeded: false, reason: "CallFailed" };
      }
    }
    this.#masterSeedGenerateExecution = result;
    return result;
  }

  /**
   * Secure Runtime Alpha 437 — PUBLIC, ASYNC. Calls `authority.seal(passphrase)`.
   * `passphrase` crosses the boundary as `Uint8Array` only — this file never
   * accepts/stores a `string` passphrase, and never logs `passphrase` or the
   * returned `envelope`. The returned `envelope` is a sealed (Argon2id +
   * ChaCha20-Poly1305) ciphertext string, never plaintext seed material.
   */
  async attemptDevOnlyMasterSeedSealCall(
    authority: unknown,
    passphrase: Uint8Array,
  ): Promise<FedosWasmLoaderMasterSeedSealExecution> {
    const artifactCheck = this.#generatedArtifactCheckResult;
    const devGate = this.#devOnlyGateEvaluation;
    const readiness = this.#importReadiness;
    const importResult = this.#importExecution;
    const module = this.#jsGlueModule;
    const wasmInit = this.#wasmInitialization;

    let result: FedosWasmLoaderMasterSeedSealExecution;
    if (!artifactCheck || !devGate || !readiness || !importResult || !wasmInit) {
      result = { attempted: false, succeeded: false, envelope: null, reason: "PrototypeStillClosed" };
    } else if (
      !artifactCheck.artifactsExist ||
      !devGate.developmentAllowed ||
      !readiness.ready ||
      !importResult.succeeded ||
      !module ||
      !wasmInit.succeeded
    ) {
      result = { attempted: false, succeeded: false, envelope: null, reason: "NotInitialized" };
    } else if (!isFedosMasterSeedAuthorityShape(authority)) {
      result = { attempted: true, succeeded: false, envelope: null, reason: "InvalidAuthorityHandle" };
    } else {
      try {
        const value = authority.seal(passphrase);
        if (typeof value === "string") {
          result = { attempted: true, succeeded: true, envelope: value, reason: "Succeeded" };
        } else {
          result = { attempted: true, succeeded: false, envelope: null, reason: "SealFailed" };
        }
      } catch {
        result = { attempted: true, succeeded: false, envelope: null, reason: "CallFailed" };
      }
    }
    this.#masterSeedSealExecution = result;
    return result;
  }

  /**
   * Secure Runtime Alpha 437 — PUBLIC, ASYNC. Calls
   * `authority.restore_sealed(envelopeJson, passphrase)` on an `Empty`
   * handle. Returns `succeeded: false` (never throws upward) on a wrong
   * passphrase, a corrupted/tampered envelope, or an authority that is
   * not currently `Empty` — Rust's own fail-closed `restore_sealed()`
   * never distinguishes which, matching AEAD guidance already applied
   * elsewhere in this file.
   */
  async attemptDevOnlyMasterSeedRestoreSealedCall(
    authority: unknown,
    envelopeJson: string,
    passphrase: Uint8Array,
  ): Promise<FedosWasmLoaderMasterSeedRestoreSealedExecution> {
    const artifactCheck = this.#generatedArtifactCheckResult;
    const devGate = this.#devOnlyGateEvaluation;
    const readiness = this.#importReadiness;
    const importResult = this.#importExecution;
    const module = this.#jsGlueModule;
    const wasmInit = this.#wasmInitialization;

    let result: FedosWasmLoaderMasterSeedRestoreSealedExecution;
    if (!artifactCheck || !devGate || !readiness || !importResult || !wasmInit) {
      result = { attempted: false, succeeded: false, reason: "PrototypeStillClosed" };
    } else if (
      !artifactCheck.artifactsExist ||
      !devGate.developmentAllowed ||
      !readiness.ready ||
      !importResult.succeeded ||
      !module ||
      !wasmInit.succeeded
    ) {
      result = { attempted: false, succeeded: false, reason: "NotInitialized" };
    } else if (!isFedosMasterSeedAuthorityShape(authority)) {
      result = { attempted: true, succeeded: false, reason: "InvalidAuthorityHandle" };
    } else {
      try {
        const succeeded = authority.restore_sealed(envelopeJson, passphrase);
        result = { attempted: true, succeeded, reason: succeeded ? "Succeeded" : "RestoreFailed" };
      } catch {
        result = { attempted: true, succeeded: false, reason: "CallFailed" };
      }
    }
    this.#masterSeedRestoreSealedExecution = result;
    return result;
  }

  /**
   * Secure Runtime Alpha 434 — PUBLIC, ASYNC. Calls `authority.clear()` —
   * `void`/infallible on a genuine handle, so `succeeded` is `true`
   * whenever the call itself does not throw.
   */
  async attemptDevOnlyMasterSeedClearCall(authority: unknown): Promise<FedosWasmLoaderMasterSeedClearExecution> {
    const artifactCheck = this.#generatedArtifactCheckResult;
    const devGate = this.#devOnlyGateEvaluation;
    const readiness = this.#importReadiness;
    const importResult = this.#importExecution;
    const module = this.#jsGlueModule;
    const wasmInit = this.#wasmInitialization;

    let result: FedosWasmLoaderMasterSeedClearExecution;
    if (!artifactCheck || !devGate || !readiness || !importResult || !wasmInit) {
      result = { attempted: false, succeeded: false, reason: "PrototypeStillClosed" };
    } else if (
      !artifactCheck.artifactsExist ||
      !devGate.developmentAllowed ||
      !readiness.ready ||
      !importResult.succeeded ||
      !module ||
      !wasmInit.succeeded
    ) {
      result = { attempted: false, succeeded: false, reason: "NotInitialized" };
    } else if (!isFedosMasterSeedAuthorityShape(authority)) {
      result = { attempted: true, succeeded: false, reason: "InvalidAuthorityHandle" };
    } else {
      try {
        authority.clear();
        result = { attempted: true, succeeded: true, reason: "Succeeded" };
      } catch {
        result = { attempted: true, succeeded: false, reason: "CallFailed" };
      }
    }
    this.#masterSeedClearExecution = result;
    return result;
  }

  /**
   * Secure Runtime Alpha 444 — PUBLIC, ASYNC. Calls
   * `authority.sign_nostr_event(accountIndex, createdAt, kind, tags, content)`.
   * `tags` here is ALREADY this Arc's own flattened wire format (Secure
   * Runtime Alpha 442, each element one NIP-01 tag with fields joined by
   * U+0001) — flattening itself is `FedosWasmNostrSigningAuthority`'s own
   * concern (`src/nostr/sign/fedos_wasm_nostr_signing_authority.ts`), kept
   * out of this generic loader so this file stays free of Nostr-specific
   * wire-format knowledge, matching its own existing `encrypt_aead`/
   * `decrypt_aead` methods (which likewise receive already-translated
   * arguments, never raw caller input). Returns the complete signed NIP-01
   * event as a JSON string on success, never a secret Handle.
   */
  async attemptDevOnlyNostrSignEventCall(
    authority: unknown,
    accountIndex: number,
    createdAt: number,
    kind: number,
    tags: string[],
    content: string,
  ): Promise<FedosWasmLoaderNostrSignEventExecution> {
    const artifactCheck = this.#generatedArtifactCheckResult;
    const devGate = this.#devOnlyGateEvaluation;
    const readiness = this.#importReadiness;
    const importResult = this.#importExecution;
    const module = this.#jsGlueModule;
    const wasmInit = this.#wasmInitialization;

    let result: FedosWasmLoaderNostrSignEventExecution;
    if (!artifactCheck || !devGate || !readiness || !importResult || !wasmInit) {
      result = { attempted: false, succeeded: false, signedEventJson: null, reason: "PrototypeStillClosed" };
    } else if (
      !artifactCheck.artifactsExist ||
      !devGate.developmentAllowed ||
      !readiness.ready ||
      !importResult.succeeded ||
      !module ||
      !wasmInit.succeeded
    ) {
      result = { attempted: false, succeeded: false, signedEventJson: null, reason: "NotInitialized" };
    } else if (!isFedosMasterSeedAuthorityShape(authority)) {
      result = { attempted: true, succeeded: false, signedEventJson: null, reason: "InvalidAuthorityHandle" };
    } else {
      try {
        const value = authority.sign_nostr_event(accountIndex, createdAt, kind, tags, content);
        if (typeof value === "string") {
          result = { attempted: true, succeeded: true, signedEventJson: value, reason: "Succeeded" };
        } else {
          result = { attempted: true, succeeded: false, signedEventJson: null, reason: "SigningFailed" };
        }
      } catch {
        result = { attempted: true, succeeded: false, signedEventJson: null, reason: "CallFailed" };
      }
    }
    this.#nostrSignEventExecution = result;
    return result;
  }

  /**
   * Secure Runtime Alpha 684/685 — PUBLIC, ASYNC. Calls
   * `authority.public_key_hex_for_account(accountIndex)` — derives the
   * per-account Nostr public key WITHOUT signing. Mirrors
   * `attemptDevOnlyNostrSignEventCall()`'s own gating exactly (same
   * artifact/dev-gate/readiness/import/init checks, same
   * `isFedosMasterSeedAuthorityShape()` validation), returning the
   * canonical hex string on success, never a secret Handle.
   */
  async attemptDevOnlyNostrPublicIdentityForAccountCall(
    authority: unknown,
    accountIndex: number,
  ): Promise<FedosWasmLoaderNostrPublicIdentityExecution> {
    const artifactCheck = this.#generatedArtifactCheckResult;
    const devGate = this.#devOnlyGateEvaluation;
    const readiness = this.#importReadiness;
    const importResult = this.#importExecution;
    const module = this.#jsGlueModule;
    const wasmInit = this.#wasmInitialization;

    let result: FedosWasmLoaderNostrPublicIdentityExecution;
    if (!artifactCheck || !devGate || !readiness || !importResult || !wasmInit) {
      result = { attempted: false, succeeded: false, publicKeyHex: null, reason: "PrototypeStillClosed" };
    } else if (
      !artifactCheck.artifactsExist ||
      !devGate.developmentAllowed ||
      !readiness.ready ||
      !importResult.succeeded ||
      !module ||
      !wasmInit.succeeded
    ) {
      result = { attempted: false, succeeded: false, publicKeyHex: null, reason: "NotInitialized" };
    } else if (!isFedosMasterSeedAuthorityShape(authority)) {
      result = { attempted: true, succeeded: false, publicKeyHex: null, reason: "InvalidAuthorityHandle" };
    } else {
      try {
        const value = authority.public_key_hex_for_account(accountIndex);
        if (typeof value === "string") {
          result = { attempted: true, succeeded: true, publicKeyHex: value, reason: "Succeeded" };
        } else {
          result = { attempted: true, succeeded: false, publicKeyHex: null, reason: "DerivationFailed" };
        }
      } catch {
        result = { attempted: true, succeeded: false, publicKeyHex: null, reason: "CallFailed" };
      }
    }
    this.#nostrPublicIdentityExecution = result;
    return result;
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
   * `planLoad()`), and returns a hand-fixed constant. THIS method
   * itself never touches the filesystem and does not check whether
   * the generated artifact exists -- `shouldCheck` stays fixed `false`
   * regardless. Stage 921 (Prototype EXECUTION Phase 001) adds the
   * REAL check as a separate step, `#checkGeneratedArtifacts()`,
   * called by `planLoad()` immediately after THIS Plan is confirmed —
   * see this module's top-of-file "Stage 921" doc note.
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
   * PRIVATE — Stage 921 (Prototype EXECUTION Phase 001). The FIRST
   * real (non-fixed-constant) computation this file ever performs:
   * checks whether each `GENERATED_ARTIFACT_NAMES` file exists under
   * `packages/fedos-core-rust/pkg/` via `#artifactFileExists()`. Never
   * reads a file's own bytes, never imports, never instantiates
   * anything, never calls Rust. The RESULT of this check is recorded
   * by the caller (`planLoad()`) but NEVER changes `shouldCheck`/
   * `shouldEvaluate`/`shouldImport`/`shouldInstantiate`/`shouldCall`
   * on any Plan above -- every one of those stays fixed `false`
   * regardless of what this method finds.
   */
  #checkGeneratedArtifacts(): FedosWasmLoaderGeneratedArtifactCheckResult {
    const checkedArtifacts = GENERATED_ARTIFACT_NAMES;
    const missingArtifacts = checkedArtifacts.filter((name) => !this.#artifactFileExists(name));
    return {
      checkedArtifacts,
      missingArtifacts,
      artifactsExist: missingArtifacts.length === 0,
    };
  }

  /**
   * PRIVATE — Stage 921 (Prototype EXECUTION Phase 001). A single,
   * read-only `existsSync` check of ONE Generated Artifact file, under
   * `process.cwd()`. Never reads the file's own bytes (no
   * `readFileSync`/`statSync`), never opens a handle, never writes.
   * Fail Closed: ANY failure to check -- including `existsSync` or
   * `process` being unavailable at all -- is treated as "not present",
   * never thrown as an exception.
   */
  #artifactFileExists(name: FedosWasmLoaderGeneratedArtifactName): boolean {
    try {
      return existsSync(join(process.cwd(), "packages", "fedos-core-rust", "pkg", name));
    } catch {
      return false;
    }
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
   * PRIVATE — Stage 929 (Prototype EXECUTION Phase 002); delegated to
   * the shared Runtime Mode Authority by Secure Runtime Alpha 020
   * (`fedos_runtime_mode_authority.ts`). Classifies the current runtime
   * as Development/Production/Unknown via `determineFedosRuntimeMode()`
   * — the ONLY environment classification this method performs; it
   * never reads `process.env` directly anymore, never reads
   * `import.meta`, never touches the filesystem, never imports, never
   * instantiates anything, never calls Rust. This method's OWN result
   * type/reason set (`FedosWasmLoaderDevOnlyGateEvaluation`) is
   * unchanged — the shared Authority only classifies, it does NOT
   * decide `developmentAllowed`; THIS method still makes that Fail-Closed
   * decision itself, one `FedosRuntimeMode` value at a time. The RESULT
   * of this evaluation is recorded by the caller (`planLoad()`) but
   * NEVER changes `shouldEvaluate`/`shouldImport`/`shouldInstantiate`/
   * `shouldCall` on any Plan above -- every one of those stays fixed
   * `false` regardless of what this method finds. Fail Closed: ANY
   * failure to evaluate -- including the Authority call itself somehow
   * throwing -- resolves as `"PrototypeStillClosed"`/
   * `developmentAllowed: false`, never thrown as an exception.
   */
  #evaluateDevOnlyGate(): FedosWasmLoaderDevOnlyGateEvaluation {
    try {
      const mode = determineFedosRuntimeMode();
      if (mode === "Development") {
        return { evaluated: true, developmentAllowed: true, reason: "DevelopmentRuntime" };
      }
      if (mode === "Production") {
        return { evaluated: true, developmentAllowed: false, reason: "ProductionRuntime" };
      }
      return { evaluated: true, developmentAllowed: false, reason: "UnknownRuntime" };
    } catch {
      return { evaluated: true, developmentAllowed: false, reason: "PrototypeStillClosed" };
    }
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
   * PRIVATE — Stage 937 (Prototype EXECUTION Phase 003). The THIRD
   * real (non-fixed-constant) computation this file ever performs,
   * though it reads NO new filesystem/environment state of its own --
   * a PURE combination of the two prior real results
   * (`this.#generatedArtifactCheckResult`/`this.#devOnlyGateEvaluation`,
   * both already recorded earlier in this SAME `planLoad()` call).
   * `ready: true` NAMES that both known preconditions for an eventual
   * `import()` are satisfied -- it NEVER performs `import()`, never
   * loads the generated JS glue, never references `WebAssembly`, never
   * calls Rust. Defensive Fail Closed: if either prior result is
   * somehow missing (`null`), resolves `"PrototypeStillClosed"`/
   * `ready: false` rather than throwing -- this never actually happens
   * given `planLoad()`'s own fixed call order, but the fallback keeps
   * this method total.
   */
  #evaluateImportReadiness(): FedosWasmLoaderImportReadiness {
    const artifactCheck = this.#generatedArtifactCheckResult;
    const devOnlyGate = this.#devOnlyGateEvaluation;
    if (!artifactCheck || !devOnlyGate) {
      return { evaluated: true, ready: false, reason: "PrototypeStillClosed" };
    }
    if (!artifactCheck.artifactsExist) {
      return { evaluated: true, ready: false, reason: "MissingArtifacts" };
    }
    if (!devOnlyGate.developmentAllowed) {
      return { evaluated: true, ready: false, reason: "NotDevelopmentRuntime" };
    }
    return { evaluated: true, ready: true, reason: "ReadyForImport" };
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

/**
 * Pure, standalone: Stage 921 (Prototype EXECUTION Phase 001) — the
 * fixed, closed list of Generated Artifact filenames
 * `#checkGeneratedArtifacts()` checks the existence of, in the SAME
 * order every time. Names WHAT is checked; performs no check itself
 * and reads no filesystem state.
 */
export function loaderGeneratedArtifactCheckTargets(): readonly FedosWasmLoaderGeneratedArtifactName[] {
  return GENERATED_ARTIFACT_NAMES;
}

/**
 * Pure, standalone: Stage 929 (Prototype EXECUTION Phase 002) — the
 * fixed, single environment variable key `#evaluateDevOnlyGate()`
 * reads (`"NODE_ENV"`, and nothing else). Names WHAT is read;
 * performs no read itself.
 */
export function loaderDevOnlyGateEvaluationEnvKey(): "NODE_ENV" {
  return "NODE_ENV";
}
