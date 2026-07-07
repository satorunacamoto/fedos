/**
 * Stage 586 — FedOS Explicit Crypto Initialization (pure data, fixed
 * value only).
 *
 * `docs/runtime_explicit_crypto_initialization.md` (Stage 585) fixes
 * SIX permanent rules for how the generated JS glue/WASM may ever be
 * loaded — no auto-load at startup, no implicit load on `encrypt`/
 * `decrypt`, only a future `initCrypto()`-style explicit call may ever
 * load anything, Runtime never knows WASM/JS Glue directly, everything
 * routes through Loader/Backend, Worker out of scope. THIS file is the
 * real, fixed-value implementation of that design's collapsed answer:
 * `createExplicitCryptoInitialization()` always resolves `{ mode:
 * "ExplicitInitialization", initializationAllowed: false, initialized:
 * false, reason: "InitializationApprovalPending" }` — it never
 * references the generated JS glue and has NO side effects.
 *
 * Stage 587 wires `src/runtime/fedos_dynamic_loader_dev_approval.ts`'s
 * `createDynamicLoaderDevApproval()` to CALL
 * `createExplicitCryptoInitialization()` — the result is DISCARDED,
 * and `createDynamicLoaderDevApproval()`'s own return value stays
 * UNCHANGED (`approved: false`). That is one caller of this file;
 * neither `create_runtime.ts` nor `src/worker.ts` references it,
 * directly or indirectly.
 *
 * Stage 595 extends `createExplicitCryptoInitialization()` DOWNWARD
 * only: it now calls `createCryptoLoaderFacade()`
 * (`fedos_crypto_loader_facade.ts`, Stage 594) — then DISCARDS the
 * result and returns its OWN, unchanged `{ mode:
 * "ExplicitInitialization", initializationAllowed: false, initialized:
 * false, reason: "InitializationApprovalPending" }` answer. This
 * mirrors the SAME "reach one link deeper, keep your own answer"
 * pattern Stage 503/511/519/527/535/539/547/555/563/571/579/587
 * already established twelve times over in this WASM arc.
 *
 * HARD GUARDRAILS:
 *   - `createExplicitCryptoInitialization()` is PURE, synchronous,
 *     takes no argument, and returns a hand-fixed constant. It NEVER
 *     inspects `packages/fedos-core-rust/pkg/`, `import.meta`, the
 *     filesystem, build mode, or any environment variable. NO SIDE
 *     EFFECTS of any kind.
 *   - NO `fs`/`node:fs`/`path`/`node:path`/`existsSync`/`statSync`/
 *     glob API of any kind.
 *   - NO `import`/`import()`/`require()` of `fedos_core_rust.js`/
 *     `fedos_core_rust_bg.wasm`, or any other generated artifact —
 *     the generated JS glue is never referenced by this file at all,
 *     and NO `import()` of any kind (static or dynamic) is written
 *     here.
 *   - NO `WebAssembly.instantiate`/`WebAssembly.compile`/
 *     `WebAssembly.instantiateStreaming`/`fetch`/`initSync`/
 *     default-init reference of any kind.
 *   - NO `child_process`/`process.env` reference — no build-mode/
 *     dev-only flag is defined or consulted anywhere in this file.
 *   - NO reference to `create_runtime.ts`/`AppRuntime`/`src/worker.ts`
 *     — no Runtime or Worker connection of any kind exists yet, not
 *     even a dev-only one.
 *   - `createExplicitCryptoInitialization()` ALWAYS resolves
 *     `initializationAllowed: false`/`initialized: false` in this
 *     stage — `true` exists only as a RESERVED possibility for a
 *     future, separate, explicitly-reviewed stage; nothing in this
 *     file can ever produce it.
 *   - `mode` is fixed `"ExplicitInitialization"` — this document
 *     permanently rules out any auto/implicit-load design; there is
 *     no reachable alternative mode anywhere in this arc.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { createCryptoLoaderFacade } from "./fedos_crypto_loader_facade.js";

/**
 * The crypto initialization design's own fixed operating mode.
 * `"ExplicitInitialization"` is the ONLY value this file ever
 * produces — there is no reachable auto/implicit-load alternative
 * anywhere in this arc (`docs/runtime_explicit_crypto_initialization.md`
 * rule #1/#2/#3).
 */
export type FedosCryptoInitializationMode = "ExplicitInitialization";

/**
 * Every reason `createExplicitCryptoInitialization()` can name.
 * `"InitializationApprovalPending"` is the ONLY value this stage's
 * implementation ever produces. `"Allowed"` is RESERVED for a future,
 * separate, explicitly-reviewed stage; nothing in this file can ever
 * produce it.
 */
export type FedosCryptoInitializationReason = "InitializationApprovalPending" | "Allowed";

/** The result of a `createExplicitCryptoInitialization()` call. No module bytes or secret material of any kind. */
export interface FedosExplicitCryptoInitialization {
  readonly mode: FedosCryptoInitializationMode;
  readonly initializationAllowed: boolean;
  readonly initialized: boolean;
  readonly reason: FedosCryptoInitializationReason;
}

/**
 * Evaluate the Explicit Crypto Initialization design
 * (`docs/runtime_explicit_crypto_initialization.md`) — whether a
 * (future) explicit initialization call is currently permitted, and
 * whether one has ever run. Always resolves `{ mode:
 * "ExplicitInitialization", initializationAllowed: false, initialized:
 * false, reason: "InitializationApprovalPending" }` in this stage.
 * Pure; never throws; takes no argument, reads no `process.env`/
 * filesystem/`import.meta`. Never references the generated JS glue,
 * and never writes `import()` of any kind.
 */
export function createExplicitCryptoInitialization(): FedosExplicitCryptoInitialization {
  reachCryptoLoaderFacade(); // result discarded -- the generated JS glue is never imported
  return {
    mode: "ExplicitInitialization",
    initializationAllowed: false,
    initialized: false,
    reason: "InitializationApprovalPending",
  };
}

/**
 * PRIVATE (module-scoped) — calls `createCryptoLoaderFacade()`. The
 * result is discarded; it is never passed to
 * `WebAssembly.instantiate`/`compile`, `initSync`/the default init
 * export, `packages/fedos-core-rust`, Runtime, or Worker. The Crypto
 * Loader Facade itself never references the generated JS glue or
 * writes `import()` of any kind either.
 */
function reachCryptoLoaderFacade(): void {
  createCryptoLoaderFacade();
}

/**
 * Pure, standalone: the design's own fixed operating mode — usable by
 * diagnostics WITHOUT calling `createExplicitCryptoInitialization()`.
 * Fixed `"ExplicitInitialization"`.
 */
export function cryptoInitializationMode(): FedosCryptoInitializationMode {
  return "ExplicitInitialization";
}

/**
 * Pure, standalone: whether a (future) explicit initialization call is
 * currently allowed — the same answer as
 * `createExplicitCryptoInitialization().initializationAllowed`. Fixed
 * `false` — no parameter or override anywhere can flip it.
 */
export function cryptoInitializationAllowed(): boolean {
  return false;
}

/**
 * Pure, standalone: whether an explicit initialization call has ever
 * actually run — the same answer as
 * `createExplicitCryptoInitialization().initialized`. Fixed `false` —
 * no parameter or override anywhere can flip it.
 */
export function cryptoInitialized(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY a (future) explicit initialization call is not
 * currently allowed — the same answer as
 * `createExplicitCryptoInitialization().reason`. Fixed
 * `"InitializationApprovalPending"`.
 */
export function cryptoInitializationReason(): FedosCryptoInitializationReason {
  return "InitializationApprovalPending";
}
