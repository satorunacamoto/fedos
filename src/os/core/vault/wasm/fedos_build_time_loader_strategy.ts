/**
 * Stage 562 — FedOS Build-Time Loader Strategy (pure data, fixed value
 * only).
 *
 * `docs/runtime_build_time_loader_strategy.md` (Stage 561) draws the
 * direct consequence of this repository's "never commit the generated
 * artifact" policy (`docs/runtime_generated_artifact_distribution_policy.md`,
 * Stage 553) for how the generated JS glue/`.wasm` could ever be
 * LOADED: no loader may assume the artifact is present, and static
 * import is unsafe (`docs/runtime_wasm_static_import_safety_review.md`,
 * Stage 525). It names THREE candidate future loading strategies —
 * (A) require a prebuild step, (B) an optional no-op loader, (C) a
 * dynamic loader with an explicit dev-only gate — and designates
 * Option C as the future candidate WITHOUT implementing it. THIS file
 * is the real, fixed-value implementation of that strategy DECISION
 * (not the strategy itself): `createBuildTimeLoaderStrategy()` always
 * resolves `{ strategy: "DynamicLoaderPlanned", requiresPrebuild:
 * true, staticImportAllowed: false, dynamicImportAllowed: false,
 * runtimeAttachAllowed: false }` — it never writes a dynamic
 * `import()`, never references the generated JS glue, and implements
 * no loader of any kind.
 *
 * Stage 563 wires `src/runtime/fedos_generated_artifact_distribution.ts`'s
 * `createGeneratedArtifactDistribution()` to CALL
 * `createBuildTimeLoaderStrategy()` — the result is DISCARDED, and
 * `createGeneratedArtifactDistribution()`'s own return value stays
 * UNCHANGED (`staticImportSafe: false`). That is one caller of this
 * file; neither `create_runtime.ts` nor `src/worker.ts` references it,
 * directly or indirectly.
 *
 * Stage 571 extends `createBuildTimeLoaderStrategy()` DOWNWARD only:
 * it now calls `createDynamicLoaderGate()`
 * (`fedos_dynamic_loader_gate.ts`, Stage 570) — then DISCARDS the
 * result and returns its OWN, unchanged `{ strategy:
 * "DynamicLoaderPlanned", requiresPrebuild: true, staticImportAllowed:
 * false, dynamicImportAllowed: false, runtimeAttachAllowed: false }`
 * answer. This mirrors the SAME "reach one link deeper, keep your own
 * answer" pattern Stage 503/511/519/527/535/539/547/555/563 already
 * established nine times over in this WASM arc.
 *
 * HARD GUARDRAILS:
 *   - `createBuildTimeLoaderStrategy()` is PURE, synchronous, takes no
 *     argument, and returns a hand-fixed constant. It NEVER inspects
 *     `packages/fedos-core-rust/pkg/`, `import.meta`, the filesystem,
 *     git state, or any environment variable.
 *   - NO `fs`/`node:fs`/`path`/`node:path`/`existsSync`/`statSync`/
 *     glob API of any kind.
 *   - NO `import`/`import()`/`require()` of `fedos_core_rust.js`/
 *     `fedos_core_rust_bg.wasm`, or any other generated artifact —
 *     the generated JS glue is never referenced by this file at all,
 *     and NO dynamic `import()` of any kind is written here, even
 *     though Option C names a future dynamic loader.
 *   - NO `WebAssembly.instantiate`/`WebAssembly.compile`/
 *     `WebAssembly.instantiateStreaming`/`fetch`/`initSync`/
 *     default-init reference of any kind.
 *   - NO `child_process`/`process.env` reference.
 *   - NO reference to `create_runtime.ts`/`AppRuntime`/`src/worker.ts`.
 *   - `createBuildTimeLoaderStrategy()` ALWAYS resolves
 *     `staticImportAllowed: false`/`dynamicImportAllowed: false`/
 *     `runtimeAttachAllowed: false` in this stage — `true` exists only
 *     as a RESERVED possibility for a future, separate,
 *     explicitly-reviewed stage; nothing in this file can ever produce
 *     it.
 *   - `strategy` is fixed `"DynamicLoaderPlanned"` — this file only
 *     ever records the DECISION to designate Option C as a future
 *     candidate; it never implements a loader, dynamic or otherwise.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { createDynamicLoaderGate } from "./fedos_dynamic_loader_gate.js";

/**
 * The Build-Time Loader Strategy's own fixed decision label.
 * `"DynamicLoaderPlanned"` (Option C, designated but not implemented)
 * is the ONLY value this stage's implementation ever produces;
 * `"PrebuildRequired"` (Option A) and `"OptionalLoader"` (Option B)
 * name the other two candidates from `docs/runtime_build_time_loader_strategy.md`
 * §2 and remain RESERVED, unreachable from this file.
 */
export type FedosBuildTimeLoaderStrategyKind =
  | "DynamicLoaderPlanned"
  | "PrebuildRequired"
  | "OptionalLoader";

/** The result of a `createBuildTimeLoaderStrategy()` call. No module bytes or secret material of any kind. */
export interface FedosBuildTimeLoaderStrategy {
  readonly strategy: FedosBuildTimeLoaderStrategyKind;
  readonly requiresPrebuild: boolean;
  readonly staticImportAllowed: boolean;
  readonly dynamicImportAllowed: boolean;
  readonly runtimeAttachAllowed: boolean;
}

/**
 * Report this repository's standing Build-Time Loader Strategy
 * decision — which of the three candidate future loading strategies
 * (`docs/runtime_build_time_loader_strategy.md` §2) is designated,
 * and whether static import, dynamic import, or Runtime attach are
 * currently allowed. Always resolves `{ strategy:
 * "DynamicLoaderPlanned", requiresPrebuild: true, staticImportAllowed:
 * false, dynamicImportAllowed: false, runtimeAttachAllowed: false }`
 * in this stage. Pure; never throws; takes no argument, reads no
 * `process.env`/filesystem/`import.meta`. Never references the
 * generated JS glue, and never writes a dynamic `import()`.
 */
export function createBuildTimeLoaderStrategy(): FedosBuildTimeLoaderStrategy {
  reachDynamicLoaderGate(); // result discarded -- the generated JS glue is never imported
  return {
    strategy: "DynamicLoaderPlanned",
    requiresPrebuild: true,
    staticImportAllowed: false,
    dynamicImportAllowed: false,
    runtimeAttachAllowed: false,
  };
}

/**
 * PRIVATE (module-scoped) — calls `createDynamicLoaderGate()`. The
 * result is discarded; it is never passed to
 * `WebAssembly.instantiate`/`compile`, `initSync`/the default init
 * export, `packages/fedos-core-rust`, Runtime, or Worker. The Dynamic
 * Loader Gate itself never references the generated JS glue or writes
 * a dynamic `import()` either.
 */
function reachDynamicLoaderGate(): void {
  createDynamicLoaderGate();
}

/**
 * Pure, standalone: the strategy's own fixed decision label — usable
 * by diagnostics WITHOUT calling `createBuildTimeLoaderStrategy()`.
 * Fixed `"DynamicLoaderPlanned"`.
 */
export function buildTimeLoaderStrategy(): FedosBuildTimeLoaderStrategyKind {
  return "DynamicLoaderPlanned";
}

/**
 * Pure, standalone: whether a prebuild step (`npm run build:wasm`) is
 * required before the generated artifact could ever be loaded — the
 * same answer as `createBuildTimeLoaderStrategy().requiresPrebuild`.
 * Fixed `true` — no parameter or override anywhere can flip it.
 */
export function buildTimeLoaderRequiresPrebuild(): boolean {
  return true;
}

/**
 * Pure, standalone: whether Runtime may currently attach to this
 * loader strategy — the same answer as
 * `createBuildTimeLoaderStrategy().runtimeAttachAllowed`. Fixed
 * `false`.
 */
export function buildTimeLoaderRuntimeAttachAllowed(): boolean {
  return false;
}
