/**
 * Stage 394 — FedOS WASM Artifact Model (Provider-internal only).
 *
 * The ELEVENTH abstraction link in `FedosRuntimeCryptoProvider`'s
 * internal execution chain — `Provider → Operation
 * (fedos_runtime_operation.ts, Stage 313) → Opaque Request
 * (fedos_runtime_opaque_request.ts, Stage 314) → Opaque API
 * (fedos_opaque_api.ts, Stage 321) → Rust Boundary
 * (fedos_rust_boundary.ts, Stage 329) → Rust API (fedos_rust_api.ts,
 * Stage 337) → Execution Review (fedos_rust_execution_review.ts,
 * Stage 345) → Internal Rust Call (fedos_internal_rust_call.ts, Stage
 * 353) → Rust Invocation Adapter (fedos_rust_invocation_adapter.ts,
 * Stage 361) → WASM Boundary (fedos_wasm_boundary.ts, Stage 386) →
 * WASM Artifact (THIS FILE) → STOP`. This models the SHAPE of the
 * BUILD step `docs/runtime_wasm_build_plan.md` (Stage 393) describes
 * — turning the crate into a `wasm32` target and running bindgen —
 * but THIS stage's `FedosWasmArtifact` implementation never builds
 * anything, never runs `cargo build --target wasm32-*`, never runs
 * `wasm-bindgen`/`wasm-pack`, and never produces a `.wasm` file.
 *
 * "Internal only" means: this module is imported ONLY by
 * `fedos_wasm_boundary.ts` (Stage 395) — never by `AppRuntime`/
 * `create_runtime.ts`, never by `src/worker.ts`, never re-exported
 * through any public boundary. Every export here exists for that ONE
 * caller plus this codebase's own test suite (the established "export
 * for testability, wire nowhere" discipline already used throughout
 * every prior link in this chain).
 *
 * HARD GUARDRAILS:
 *   - `FedosWasmArtifactPlaceholder` NEVER invokes
 *     `cargo build --target wasm32-*`, never `wasm-bindgen`, never
 *     `wasm-pack`, never `packages/fedos-core-rust` (Rust crate or TS
 *     package boundary), never `WebAssembly.instantiate`/
 *     `WebAssembly.compile`, never FFI, never a Native Addon, never
 *     any cryptographic operation of any kind. It simply RECEIVES a
 *     build/load request and returns a decision — nothing is ever
 *     actually built or loaded.
 *   - NO `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value (all `pub(crate)`-private inside
 *     `packages/fedos-core-rust`, never exposed to TypeScript) is
 *     imported, referenced, or constructed anywhere in this file.
 *   - `planBuild()`/`planLoad()` ALWAYS resolve
 *     `"BlockedByImplementation"` in this stage — `"ReadyToBuild"`
 *     exists in `FedosWasmArtifactDecisionState` only as a RESERVED
 *     label for a future, separate, explicitly-reviewed stage; nothing
 *     in this file can ever produce it.
 *   - No `process.env`/`RuntimeEnv` reference. No network/storage/Relay/
 *     Nostr/NIP-17 reference. No Runtime/Worker activation of any kind.
 *   - Pure; every method here is synchronous, never throws, never
 *     mutates its argument, never touches a filesystem, network, or
 *     child process to "build" or "load" anything.
 *
 * Stage 452 adds a SECOND, independent status axis:
 * `generationState`/`FedosWasmArtifactGenerationState` (`"Generated"` /
 * `"NotGenerated"`, fixed `"NotGenerated"`) — see
 * `docs/runtime_wasm_generation.md` §2. This answers a DIFFERENT
 * question than the existing `state`/`FedosWasmArtifactState`
 * (`"NotBuilt"`): `state` asks whether this Provider-internal
 * abstraction's own `planBuild()` has ever resolved to something other
 * than `"BlockedByImplementation"` (it never has); `generationState`
 * asks whether a real `.wasm` file + `wasm-bindgen` JS glue pair
 * exists on disk anywhere (it never does — no filesystem check is
 * ever performed; this is a hand-fixed constant, exactly like every
 * other label in this file). `fedosWasmArtifactGenerated()`/
 * `fedosGeneratedArtifactPath()` expose the same fact as plain
 * standalone values (`false`/`null`) for diagnostics (Stage 453) to
 * read without constructing an instance.
 */

/**
 * Coarse status of the WASM Artifact abstraction itself. `"NotBuilt"`
 * is the ONLY value this stage's implementation produces — mirroring
 * `FedosWasmBoundaryState`'s own `"NotLoaded"` precedent
 * (`src/runtime/fedos_wasm_boundary.ts`), renamed to `"NotBuilt"`
 * because building (not loading) is this specific artifact's own
 * verb.
 */
export type FedosWasmArtifactState = "NotBuilt";

/**
 * Stage 452 — whether a real `.wasm` file + `wasm-bindgen` JS glue
 * pair has ever actually been generated on disk. `"NotGenerated"` is
 * the ONLY value this stage's implementation produces; `"Generated"`
 * is RESERVED for a future, separate, explicitly-reviewed stage that
 * actually runs `npm run build:wasm` (`package.json`, Stage 450) —
 * nothing in this file can ever produce it. Independent of
 * `FedosWasmArtifactState`: see this file's Stage 452 doc comment
 * above for the distinction.
 */
export type FedosWasmArtifactGenerationState = "Generated" | "NotGenerated";

/** A non-sensitive snapshot of a `FedosWasmArtifact`. `reason` is human-readable and non-sensitive. */
export interface FedosWasmArtifactStatus {
  readonly state: FedosWasmArtifactState;
  readonly reason: string;
  /** Stage 452 — see `FedosWasmArtifactGenerationState`'s own doc comment. Fixed `"NotGenerated"`. */
  readonly generationState: FedosWasmArtifactGenerationState;
}

/**
 * The outcome of `FedosWasmArtifact.planBuild()`/`planLoad()`.
 * `"BlockedByImplementation"` is the ONLY value this stage's
 * implementation ever produces; `"ReadyToBuild"` is RESERVED.
 */
export type FedosWasmArtifactDecisionState = "BlockedByImplementation" | "ReadyToBuild";

/** Which operation a `FedosWasmArtifactDecision` describes. */
export type FedosWasmArtifactOperation = "build" | "load";

/** The result of a `FedosWasmArtifact.planBuild()`/`planLoad()` call. No compiled bytes, module, or byte of any kind. */
export interface FedosWasmArtifactDecision {
  readonly operation: FedosWasmArtifactOperation;
  readonly state: FedosWasmArtifactDecisionState;
  readonly reason: string;
}

/**
 * The Provider-internal WASM Artifact. Receives a build/load request
 * and returns a decision — never invokes `cargo build --target
 * wasm32-*`, `wasm-bindgen`, `wasm-pack`, `packages/fedos-core-rust`,
 * WASM, or FFI. `FedosWasmArtifactPlaceholder` is the one
 * implementation this stage provides.
 */
export interface FedosWasmArtifact {
  status(): FedosWasmArtifactStatus;
  planBuild(): FedosWasmArtifactDecision;
  planLoad(): FedosWasmArtifactDecision;
}

/**
 * The placeholder `FedosWasmArtifact` — always denies, never builds,
 * never loads. Constructing an instance does nothing: no target
 * compiled, no bindgen run, no file written.
 */
export class FedosWasmArtifactPlaceholder implements FedosWasmArtifact {
  constructor() {
    // Does nothing: no target compiled, no bindgen run, no file written.
  }

  status(): FedosWasmArtifactStatus {
    return {
      state: "NotBuilt",
      reason: "FedOS WASM artifact has not been built",
      generationState: "NotGenerated",
    };
  }

  planBuild(): FedosWasmArtifactDecision {
    return this.#blocked("build");
  }

  planLoad(): FedosWasmArtifactDecision {
    return this.#blocked("load");
  }

  #blocked(operation: FedosWasmArtifactOperation): FedosWasmArtifactDecision {
    return {
      operation,
      state: "BlockedByImplementation",
      reason: `FedOS WASM artifact does not perform ${operation} in this stage: no WASM artifact is ever produced`,
    };
  }
}

/**
 * Build a `FedosWasmArtifact`. `FedosWasmBoundary`'s own placeholder
 * (Stage 395) is the ONLY caller of this function in this repository.
 * Pure; never throws.
 */
export function createFedosWasmArtifact(): FedosWasmArtifact {
  return new FedosWasmArtifactPlaceholder();
}

/**
 * Pure, standalone: the WASM Artifact's own `FedosWasmArtifactState` —
 * usable by diagnostics WITHOUT constructing a `FedosWasmArtifact`
 * instance (Stage 396). Fixed `"NotBuilt"` in this stage, mirroring
 * `FedosWasmArtifactPlaceholder.status()` exactly.
 */
export function fedosWasmArtifactState(): FedosWasmArtifactState {
  return "NotBuilt";
}

/**
 * Pure, standalone: whether the WASM Artifact is structurally
 * reachable from the WASM Boundary's own internal chain (Stage 395
 * wires it) — NOT whether a real artifact is ever built. Fixed `true`
 * in this stage: the code path exists and is called, but every call
 * still resolves `"BlockedByImplementation"`.
 */
export function fedosWasmArtifactReachable(): boolean {
  return true;
}

/**
 * Pure, standalone: whether a real WASM artifact has ever actually
 * been built. Fixed `false` in this stage — no parameter or override
 * anywhere can flip it.
 */
export function fedosWasmArtifactBuilt(): boolean {
  return false;
}

/**
 * Pure, standalone: the WASM Artifact's own `FedosWasmArtifactGenerationState`
 * (Stage 452) — usable by diagnostics WITHOUT constructing a
 * `FedosWasmArtifact` instance. Fixed `"NotGenerated"`, mirroring
 * `FedosWasmArtifactPlaceholder.status()` exactly. Never performs a
 * filesystem check.
 */
export function fedosWasmArtifactGenerationState(): FedosWasmArtifactGenerationState {
  return "NotGenerated";
}

/**
 * Pure, standalone: whether a real `.wasm` + JS glue pair has ever
 * actually been generated (Stage 453 diagnostics label). Fixed
 * `false` in this stage — no parameter, override, or filesystem check
 * anywhere can flip it.
 */
export function fedosWasmArtifactGenerated(): boolean {
  return false;
}

/**
 * Pure, standalone: the filesystem path a generated artifact would
 * live at, IF one had ever been generated (Stage 453 diagnostics
 * label). Fixed `null` in this stage — no artifact has ever been
 * generated, so there is no real path to report.
 */
export function fedosGeneratedArtifactPath(): string | null {
  return null;
}
