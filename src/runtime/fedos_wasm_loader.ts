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
    this.#reachLoaderPolicy(); // result discarded -- reads the fixed Policy answer, never obeys it
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
   * PRIVATE — Stage 825. Calls `this.policy()` exactly once and
   * discards the result in full: never merged into `planLoad()`'s own
   * return value, never branched on, never used to decide whether to
   * proceed. Mirrors `#reachLoaderPlan()`'s own "reach one link
   * deeper, discard the result" pattern.
   */
  #reachLoaderPolicy(): void {
    const policyDecision = this.policy();
    void policyDecision; // discarded -- read only, never merged, never branched on
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
