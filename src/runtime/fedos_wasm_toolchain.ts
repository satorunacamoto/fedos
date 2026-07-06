/**
 * Stage 419 — FedOS WASM Toolchain Readiness Model (standalone, unwired).
 *
 * Models the SHAPE of the toolchain-readiness question
 * `docs/runtime_wasm_toolchain_readiness.md` (Stage 417) and
 * `docs/runtime_wasm_build_contract.md` (Stage 418) describe in
 * writing — whether the `wasm32` target/`wasm-bindgen-cli`/`wasm-pack`
 * toolchain is installed, buildable, bindgen-able, and verifiable —
 * WITHOUT ever installing, invoking, or checking for any of it. This
 * file is deliberately UNWIRED: it is not imported by
 * `fedos_wasm_artifact.ts`, `fedos_wasm_boundary.ts`,
 * `fedos_execution_backend.ts`, `AppRuntime`/`create_runtime.ts`, or
 * `src/worker.ts` — only `runtime_crypto_diagnostics.ts`/
 * `worker_crypto_diagnostics.ts` (Stage 420) read its pure, standalone
 * status functions for DISPLAY, and this codebase's own test suite
 * exercises it directly.
 *
 * HARD GUARDRAILS:
 *   - `FedosWasmToolchainPlaceholder` NEVER installs, downloads, or
 *     verifies any real toolchain component. It never runs `rustup
 *     target add`, `cargo install wasm-bindgen-cli`, `cargo build
 *     --target wasm32-*`, `wasm-bindgen`, or `wasm-pack`. It simply
 *     RECEIVES an install/build/bindgen/verify request and returns a
 *     decision — nothing is ever actually installed, built, bound, or
 *     verified.
 *   - NO `child_process` import or reference of any kind (`spawn`,
 *     `exec`, `execFile`, `fork`) — this file never shells out to a
 *     real toolchain.
 *   - NO `WebAssembly.instantiate`/`WebAssembly.compile` call, and no
 *     reference to a `.wasm` file, generated JS glue, or any compiled
 *     artifact.
 *   - NO `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 *   - `planInstall()`/`planBuild()`/`planBindgen()`/`planVerify()`
 *     ALWAYS resolve `"Planning"` in this stage — `"Ready"` exists in
 *     `FedosWasmToolchainState` only as a RESERVED label for a future,
 *     separate, explicitly-reviewed stage; nothing in this file can
 *     ever produce it.
 *   - No `process.env`/`RuntimeEnv` reference. No network/filesystem
 *     access of any kind. No Runtime/Worker activation of any kind.
 *   - Pure; every method here is synchronous, never throws, never
 *     mutates its argument, never touches a filesystem, network, or
 *     child process to "install", "build", "bind", or "verify"
 *     anything.
 */

/**
 * Which toolchain operation a `FedosWasmToolchainDecision` describes.
 * `"install"` names adding the `wasm32` target/`wasm-bindgen-cli`/
 * `wasm-pack`; `"build"` names a `cargo build --target wasm32-*` run;
 * `"bindgen"` names running `wasm-bindgen` against the build output;
 * `"verify"` names confirming all of the above actually succeeded.
 * None of the four is ever performed by this stage's implementation.
 */
export type FedosWasmToolchainOperation = "install" | "build" | "bindgen" | "verify";

/**
 * The outcome of any `FedosWasmToolchain` method. `"Planning"` is the
 * ONLY value this stage's implementation ever produces; `"Ready"` is
 * RESERVED for a future, separate, explicitly-reviewed stage —
 * nothing in this file can ever produce it.
 */
export type FedosWasmToolchainState = "Planning" | "Ready";

/** A non-sensitive snapshot of a `FedosWasmToolchain`. `reason` is human-readable and non-sensitive. */
export interface FedosWasmToolchainStatus {
  readonly installed: boolean;
  readonly verified: boolean;
  readonly reason: string;
}

/** The result of any `FedosWasmToolchain.plan*()` call. No binary, artifact, or byte of any kind. */
export interface FedosWasmToolchainDecision {
  readonly operation: FedosWasmToolchainOperation;
  readonly state: FedosWasmToolchainState;
  readonly reason: string;
}

/**
 * The standalone, unwired WASM Toolchain readiness model. Receives an
 * install/build/bindgen/verify request and returns a decision — never
 * installs, builds, binds, or verifies a real toolchain component of
 * any kind. `FedosWasmToolchainPlaceholder` is the one implementation
 * this stage provides.
 */
export interface FedosWasmToolchain {
  status(): FedosWasmToolchainStatus;
  planInstall(): FedosWasmToolchainDecision;
  planBuild(): FedosWasmToolchainDecision;
  planBindgen(): FedosWasmToolchainDecision;
  planVerify(): FedosWasmToolchainDecision;
}

/**
 * The placeholder `FedosWasmToolchain` — always plans, never
 * installs, builds, binds, or verifies. Constructing an instance does
 * nothing: no target added, no binary downloaded, no command spawned.
 */
export class FedosWasmToolchainPlaceholder implements FedosWasmToolchain {
  constructor() {
    // Does nothing: no target added, no binary downloaded, no command spawned.
  }

  status(): FedosWasmToolchainStatus {
    return {
      installed: false,
      verified: false,
      reason: "FedOS WASM toolchain is not installed",
    };
  }

  planInstall(): FedosWasmToolchainDecision {
    return this.#planning("install");
  }

  planBuild(): FedosWasmToolchainDecision {
    return this.#planning("build");
  }

  planBindgen(): FedosWasmToolchainDecision {
    return this.#planning("bindgen");
  }

  planVerify(): FedosWasmToolchainDecision {
    return this.#planning("verify");
  }

  #planning(operation: FedosWasmToolchainOperation): FedosWasmToolchainDecision {
    return {
      operation,
      state: "Planning",
      reason: `FedOS WASM toolchain does not perform ${operation} in this stage: no toolchain component is ever installed, built, bound, or verified`,
    };
  }
}

/**
 * Build a `FedosWasmToolchain`. Unlike every prior link in the
 * Runtime -> Rust chain, no other module in this repository calls
 * this function yet — it exists for direct construction by this
 * codebase's own test suite and for the pure, standalone functions
 * below. Pure; never throws.
 */
export function createFedosWasmToolchain(): FedosWasmToolchain {
  return new FedosWasmToolchainPlaceholder();
}

/**
 * Pure, standalone: whether the WASM toolchain has ever actually been
 * installed — usable by diagnostics (Stage 420) WITHOUT constructing
 * a `FedosWasmToolchain` instance. Fixed `false` in this stage — no
 * parameter or override anywhere can flip it.
 */
export function fedosWasmToolchainInstalled(): boolean {
  return false;
}

/**
 * Pure, standalone: whether the WASM toolchain has ever actually been
 * verified (a real `planVerify()` succeeding). Fixed `false` in this
 * stage.
 */
export function fedosWasmToolchainVerified(): boolean {
  return false;
}

/**
 * Pure, standalone: whether a real WASM build is ready to be attempted
 * — i.e. installed AND verified AND bindgen-able. Fixed `false` in
 * this stage; this is a diagnostics-only convenience, not a new
 * source of truth independent of the two functions above.
 */
export function fedosWasmBuildReady(): boolean {
  return false;
}
