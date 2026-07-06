/**
 * Stage 419 — FedOS WASM Toolchain Readiness Model (standalone, unwired).
 * Updated Stage 428 with fixed, non-detecting PLAN labels. Updated
 * Stage 438 with fixed, non-detecting OBSERVATION labels recording
 * the Stage 435–436 result (see `docs/runtime_wasm_build_observation.md`).
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
 * Stage 438 adds TWO further fixed, non-detecting labels —
 * `wasmTargetCheckObserved`/`wasmBuildObserved` — recording the ONE,
 * already-completed Stage 435–436 observation (`cargo check
 * --target wasm32-unknown-unknown` / `cargo build --target
 * wasm32-unknown-unknown` both FAILED compiling the `getrandom`
 * dependency; see `docs/runtime_wasm_build_observation.md`). These are
 * NOT a live probe either — this file does not re-run `cargo` to
 * compute them; they are a hand-fixed record of a result already
 * observed and written down once.
 *
 * Stage 446 adds THREE more fixed, non-detecting labels —
 * `getrandomWasmPolicy` (always `"wasm_js"`),
 * `getrandomBackendCfgRequired` (always `true`), and
 * `wasmTargetCheckStatus` (always `"ObservedGreen"`) — recording the
 * Stage 441–444 result: `getrandom`'s `Cargo.toml` entry now enables
 * the `wasm_js` feature (Stage 442), and `RUSTFLAGS='--cfg
 * getrandom_backend="wasm_js"' cargo check`/`cargo build --target
 * wasm32-unknown-unknown` both SUCCEED (Stage 443–444; see
 * `docs/runtime_wasm_getrandom_policy.md` and
 * `docs/runtime_wasm_build_observation.md` §7). Stage 446 also updates
 * `wasmTargetCheckObserved`/`wasmBuildObserved` from `"Failed"` to
 * `"Succeeded"` to match this same, now-superseded result — still a
 * hand-fixed record, never a live re-run of `cargo`, and still no
 * claim that a `cdylib`/real `.wasm`/`wasm-bindgen` output exists.
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
 * Stage 438 — the fixed, non-detecting OBSERVATION outcome of a
 * `cargo check`/`cargo build` attempt against the target named by
 * `FedosWasmTargetTriple`. `"NotObserved"` is RESERVED (nothing in
 * this file produces it, since Stage 435–436 already ran the one
 * observation this file records). Stage 438 originally fixed both
 * `wasmTargetCheckObserved`/`wasmBuildObserved` to `"Failed"`,
 * matching the Stage 435–436 `getrandom` compile failure. Stage 446
 * updates both to `"Succeeded"`, matching the Stage 443–444
 * RE-OBSERVATION after `getrandom`'s `wasm_js` feature + `--cfg
 * getrandom_backend="wasm_js"` opt-in (`docs/runtime_wasm_getrandom_policy.md`,
 * `docs/runtime_wasm_build_observation.md` §7) — `"Failed"` remains a
 * valid value of this type (it is what Stage 435–436 actually
 * observed, and this file's historical doc comments still describe
 * that run accurately) but is no longer produced by any function in
 * this file.
 */
export type FedosWasmObservationResult = "NotObserved" | "Failed" | "Succeeded";

/**
 * Stage 477 — the fixed, non-detecting record of Stage 473–476:
 * `wasm-bindgen-cli` was upgraded to match the `wasm-bindgen` version
 * the crate's dependency graph resolves to
 * (`docs/runtime_wasm_bindgen_version_policy.md`), and a subsequent
 * `npm run build:wasm` re-run FULLY SUCCEEDED — the first real
 * `.wasm` + JS glue pair ever produced
 * (`docs/runtime_wasm_artifact_observation.md` §10). This file never
 * runs `wasm-bindgen --version` or `build:wasm` itself; these are a
 * hand-fixed record of a result already observed and written down
 * once, exactly like `FedosWasmObservationResult` above.
 */
export type FedosWasmBindgenCliVersion = "0.2.126";

/**
 * Stage 446 — the fixed, non-detecting name of the `getrandom` 0.3.x
 * WASM entropy backend this crate's `Cargo.toml` opts into (Stage 442).
 * `"wasm_js"` is the ONLY value this stage's implementation ever
 * produces, matching `docs/runtime_wasm_getrandom_policy.md`'s policy
 * and `getrandom`'s own Cargo feature name.
 */
export type FedosGetrandomWasmPolicy = "wasm_js";

/**
 * Stage 446 — the fixed, non-detecting OUTCOME of a `cargo check`/
 * `cargo build --target wasm32-unknown-unknown` attempt, phrased as a
 * human-readable status rather than the boolean-ish
 * `FedosWasmObservationResult`. `"ObservedGreen"` is the ONLY value
 * this stage's implementation ever produces, matching the Stage
 * 443–444 SUCCESS recorded in `docs/runtime_wasm_build_observation.md`
 * §7; `"ObservedBlocked"` is RESERVED — nothing in this file produces
 * it, since the one observation this file records already went green.
 */
export type FedosWasmTargetCheckStatus = "ObservedGreen" | "ObservedBlocked";

/**
 * A non-sensitive snapshot of a `FedosWasmToolchain`. `reason` is
 * human-readable and non-sensitive. Stage 428 adds four fixed,
 * non-detecting PLAN fields: `toolchainPlanStatus` (always
 * `"Planned"`), `wasmTargetExpected` (always
 * `FedosWasmTargetTriple`'s one value), `bindgenExpected` (always
 * `true` — the plan expects a future bindgen step), and
 * `wasmPackExpected` (always `false` — the plan never expects the
 * pack-style bundler tool this stage's adoption deliberately excludes,
 * per `docs/runtime_wasm_toolchain_readiness.md`). Stage 438 adds two
 * more fixed fields: `wasmTargetCheckObserved`/`wasmBuildObserved`,
 * updated by Stage 446 from `"Failed"` to `"Succeeded"` — recording
 * the Stage 441–444 result (`getrandom`'s `wasm_js` feature + `--cfg
 * getrandom_backend="wasm_js"` now compile clean for
 * `wasm32-unknown-unknown`). Stage 446 adds three more fixed fields:
 * `getrandomWasmPolicy` (always `"wasm_js"`),
 * `getrandomBackendCfgRequired` (always `true` — the `--cfg` flag is
 * mandatory in addition to the feature, per
 * `docs/runtime_wasm_getrandom_policy.md` §3), and
 * `wasmTargetCheckStatus` (always `"ObservedGreen"`).
 */
export interface FedosWasmToolchainStatus {
  readonly installed: boolean;
  readonly verified: boolean;
  readonly reason: string;
  readonly toolchainPlanStatus: FedosWasmToolchainPlanStatus;
  readonly wasmTargetExpected: FedosWasmTargetTriple;
  readonly bindgenExpected: boolean;
  readonly wasmPackExpected: boolean;
  readonly wasmTargetCheckObserved: FedosWasmObservationResult;
  readonly wasmBuildObserved: FedosWasmObservationResult;
  readonly getrandomWasmPolicy: FedosGetrandomWasmPolicy;
  readonly getrandomBackendCfgRequired: boolean;
  readonly wasmTargetCheckStatus: FedosWasmTargetCheckStatus;
  /** Stage 477 — see `FedosWasmBindgenCliVersion`'s own doc comment. Fixed `"0.2.126"`. */
  readonly wasmBindgenCliExpectedVersion: FedosWasmBindgenCliVersion;
  /** Stage 477 — whether the local CLI is expected to match the crate-resolved version. Fixed `true`. */
  readonly wasmBindgenVersionAligned: boolean;
  /** Stage 477 — whether a real JS glue generation has ever been observed. Fixed `true`. */
  readonly wasmGlueGenerationObserved: boolean;
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
      wasmTargetCheckObserved: "Succeeded",
      wasmBuildObserved: "Succeeded",
      getrandomWasmPolicy: "wasm_js",
      getrandomBackendCfgRequired: true,
      wasmTargetCheckStatus: "ObservedGreen",
      wasmBindgenCliExpectedVersion: "0.2.126",
      wasmBindgenVersionAligned: true,
      wasmGlueGenerationObserved: true,
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

/**
 * Pure, standalone: the fixed, recorded outcome of the Stage 435/443
 * `cargo check --target wasm32-unknown-unknown` observation — usable
 * by diagnostics WITHOUT constructing a `FedosWasmToolchain` instance.
 * Fixed `"Succeeded"` (updated Stage 446): Stage 443 re-ran this
 * command with `getrandom`'s `wasm_js` feature (Stage 442) and
 * `RUSTFLAGS='--cfg getrandom_backend="wasm_js"'`, and it compiled
 * clean — superseding the Stage 435 `"Failed"` result recorded before
 * that opt-in existed. Per `docs/runtime_wasm_build_observation.md`
 * §7. Never re-runs `cargo`.
 */
export function fedosWasmTargetCheckObserved(): FedosWasmObservationResult {
  return "Succeeded";
}

/**
 * Pure, standalone: the fixed, recorded outcome of the Stage 436/444
 * `cargo build --target wasm32-unknown-unknown` observation. Fixed
 * `"Succeeded"` (updated Stage 446), identically to
 * `fedosWasmTargetCheckObserved()` — the same `wasm_js`/`--cfg`
 * opt-in result, per `docs/runtime_wasm_build_observation.md` §7.
 * Never re-runs `cargo`.
 */
export function fedosWasmBuildObserved(): FedosWasmObservationResult {
  return "Succeeded";
}

/**
 * Pure, standalone: the fixed name of the `getrandom` WASM entropy
 * backend this crate's `Cargo.toml` opts into (Stage 442, Stage 446
 * label). Fixed `"wasm_js"` — never derived from any real inspection
 * of `Cargo.toml`.
 */
export function fedosGetrandomWasmPolicy(): FedosGetrandomWasmPolicy {
  return "wasm_js";
}

/**
 * Pure, standalone: whether a `--cfg getrandom_backend="wasm_js"`
 * compiler flag is required IN ADDITION to the `wasm_js` Cargo
 * feature (Stage 446 label). Fixed `true` — per
 * `docs/runtime_wasm_getrandom_policy.md` §3, the feature alone is
 * documented by `getrandom` itself as insufficient.
 */
export function fedosGetrandomBackendCfgRequired(): boolean {
  return true;
}

/**
 * Pure, standalone: the fixed, human-readable status of the
 * `wasm32-unknown-unknown` `cargo check`/`cargo build` observation
 * (Stage 446 label). Fixed `"ObservedGreen"` — matching the Stage
 * 443–444 SUCCESS recorded in
 * `docs/runtime_wasm_build_observation.md` §7. Never re-runs `cargo`.
 */
export function fedosWasmTargetCheckStatus(): FedosWasmTargetCheckStatus {
  return "ObservedGreen";
}

/**
 * Pure, standalone: the fixed `wasm-bindgen-cli` version the local
 * CLI is expected to be aligned to (Stage 477 label). Fixed
 * `"0.2.126"` — matching the version installed at Stage 474
 * (`cargo install wasm-bindgen-cli --version 0.2.126 --force`). Never
 * runs `wasm-bindgen --version`.
 */
export function fedosWasmBindgenCliExpectedVersion(): FedosWasmBindgenCliVersion {
  return "0.2.126";
}

/**
 * Pure, standalone: whether the local `wasm-bindgen-cli` binary is
 * expected to be aligned with the crate-resolved `wasm-bindgen`
 * version (Stage 477 label,
 * `docs/runtime_wasm_bindgen_version_policy.md`). Fixed `true` — a
 * policy/record fact, never a live comparison of an installed binary
 * against `Cargo.lock`.
 */
export function fedosWasmBindgenVersionAligned(): boolean {
  return true;
}

/**
 * Pure, standalone: whether a real `wasm-bindgen` JS glue generation
 * has ever been observed (Stage 477 label). Fixed `true` — recording
 * Stage 475's `npm run build:wasm` full success
 * (`docs/runtime_wasm_artifact_observation.md` §10), never a live
 * filesystem check for `packages/fedos-core-rust/pkg/` contents.
 */
export function fedosWasmGlueGenerationObserved(): boolean {
  return true;
}
