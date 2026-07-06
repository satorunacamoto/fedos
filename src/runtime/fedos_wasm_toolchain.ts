/**
 * Stage 419 — FedOS WASM Toolchain Readiness Model (standalone, unwired).
 * Updated Stage 428 with fixed, non-detecting PLAN labels.
 *
 * Models the SHAPE of the toolchain-readiness question
 * `docs/runtime_wasm_toolchain_readiness.md` (Stage 417, updated
 * 425–426) and `docs/runtime_wasm_build_contract.md` (Stage 418,
 * updated 427) describe in writing — whether the `wasm32`
 * target/`wasm-bindgen-cli`/`wasm-pack` toolchain is installed,
 * buildable, bindgen-able, and verifiable — WITHOUT ever installing,
 * invoking, or checking for any of it. This file is deliberately
 * UNWIRED: it is not imported by `fedos_wasm_artifact.ts`,
 * `fedos_wasm_boundary.ts`, `fedos_execution_backend.ts`,
 * `AppRuntime`/`create_runtime.ts`, or `src/worker.ts` — only
 * `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts`
 * (Stage 420) read its pure, standalone status functions for DISPLAY,
 * and this codebase's own test suite exercises it directly.
 *
 * Stage 425 performed a REAL, minimal toolchain PREFLIGHT on the
 * development machine this stage was authored on: `rustup target add
 * wasm32-unknown-unknown` and `cargo install wasm-bindgen-cli` were
 * run (see `docs/runtime_wasm_toolchain_readiness.md` §2),
 * deliberately NOT installing `wasm-pack`. Stage 428 adds FOUR new,
 * FIXED, non-detecting diagnostic labels reflecting the resulting
 * ADOPTION PLAN — `toolchainPlanStatus`/`wasmTargetExpected`/
 * `bindgenExpected`/`wasmPackExpected` — but this file still NEVER
 * inspects the real machine to compute them: they are hand-fixed
 * constants describing WHAT THE PLAN IS, not a live probe of what is
 * actually installed. `installed`/`verified` (and the standalone
 * `fedosWasmToolchainInstalled()`/`fedosWasmToolchainVerified()`/
 * `fedosWasmBuildReady()` functions) remain fixed `false` — this file
 * still makes no claim that a real WASM build has ever been attempted
 * or would succeed, regardless of what is or is not installed on any
 * given machine.
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
 *   - Stage 428's `wasmTargetExpected`/`bindgenExpected` labels NAME
 *     the `wasm32-unknown-unknown` target and a future `wasm-bindgen`
 *     step as PLAN facts — fixed string/boolean literals, never a
 *     `rustup`/`cargo`/filesystem probe of what is actually present on
 *     any given machine. `wasmPackExpected` is fixed `false`: this
 *     file's plan never names `wasm-pack` as an expected component,
 *     mirroring the Stage 425 decision to not adopt it.
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

/**
 * Stage 428 — the fixed, non-detecting ADOPTION PLAN status. `"Planned"`
 * is the ONLY value this stage's implementation ever produces: the
 * `wasm32`/`wasm-bindgen` adoption named in
 * `docs/runtime_wasm_toolchain_readiness.md` has been decided and
 * (on the authoring machine) preflighted, but that decision is a PLAN
 * label, never a live probe of any particular machine's actual state.
 */
export type FedosWasmToolchainPlanStatus = "Planned";

/**
 * The single Rust target triple this plan expects a future WASM build
 * to target. Fixed — never derived from `rustup target list` or any
 * other real inspection.
 */
export type FedosWasmTargetTriple = "wasm32-unknown-unknown";

/**
 * A non-sensitive snapshot of a `FedosWasmToolchain`. `reason` is
 * human-readable and non-sensitive. Stage 428 adds four fixed,
 * non-detecting PLAN fields: `toolchainPlanStatus` (always
 * `"Planned"`), `wasmTargetExpected` (always
 * `FedosWasmTargetTriple`'s one value), `bindgenExpected` (always
 * `true` — the plan expects a future bindgen step), and
 * `wasmPackExpected` (always `false` — the plan never expects the
 * pack-style bundler tool this stage's adoption deliberately excludes,
 * per `docs/runtime_wasm_toolchain_readiness.md`).
 */
export interface FedosWasmToolchainStatus {
  readonly installed: boolean;
  readonly verified: boolean;
  readonly reason: string;
  readonly toolchainPlanStatus: FedosWasmToolchainPlanStatus;
  readonly wasmTargetExpected: FedosWasmTargetTriple;
  readonly bindgenExpected: boolean;
  readonly wasmPackExpected: boolean;
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
      toolchainPlanStatus: "Planned",
      wasmTargetExpected: "wasm32-unknown-unknown",
      bindgenExpected: true,
      wasmPackExpected: false,
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

/**
 * Pure, standalone: the fixed adoption-plan status (Stage 428) —
 * usable by diagnostics WITHOUT constructing a `FedosWasmToolchain`
 * instance. Fixed `"Planned"` — never derived from any real
 * inspection of this or any other machine.
 */
export function fedosWasmToolchainPlanStatus(): FedosWasmToolchainPlanStatus {
  return "Planned";
}

/**
 * Pure, standalone: the single target triple this plan expects a
 * future WASM build to target (Stage 428). Fixed
 * `"wasm32-unknown-unknown"`.
 */
export function fedosWasmTargetExpected(): FedosWasmTargetTriple {
  return "wasm32-unknown-unknown";
}

/**
 * Pure, standalone: whether the plan expects a future `wasm-bindgen`
 * step (Stage 428). Fixed `true` — this is a PLAN fact, not a claim
 * that `wasm-bindgen` has ever been run against this crate.
 */
export function fedosWasmBindgenExpected(): boolean {
  return true;
}

/**
 * Pure, standalone: whether the plan expects `wasm-pack` to ever be
 * adopted (Stage 428). Fixed `false` — mirrors the Stage 425 decision
 * to install `wasm-bindgen-cli` without `wasm-pack`.
 */
export function fedosWasmPackExpected(): boolean {
  return false;
}
