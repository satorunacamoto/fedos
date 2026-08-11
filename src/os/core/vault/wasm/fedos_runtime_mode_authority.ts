/**
 * Secure Runtime Alpha 020 — "Runtime Mode Authority Consolidation".
 *
 * Alpha 006 (`docs/secure_runtime_alpha_006_mode_authority_review.md`)
 * found three independent, structurally-similar `process.env.NODE_ENV`
 * classifiers — `FedosWasmLoaderSkeleton#evaluateDevOnlyGate()`
 * (`fedos_wasm_loader.ts`), `determineRuntimeMode()`
 * (`fedos_runtime_prototype_execution.ts`), and (added later, Alpha 019)
 * `isDevelopmentRuntimeForCiphertextStorage()`
 * (`fedos_runtime_ciphertext_storage.ts`) — and deliberately kept them
 * separate, naming four conditions under which extraction (its own
 * "Option C") should happen instead. Alpha 019's Ciphertext Storage
 * Service branching a real Fail-Closed decision on its own `NODE_ENV`
 * read satisfied condition 4 ("before Secure Storage or any new Crypto
 * API branches on `runtimeMode` for a real decision") — this file is
 * that pre-committed extraction, and nothing more.
 *
 * **This module is an ENVIRONMENT CLASSIFIER, not an authorization
 * gate.** It answers exactly one question — "does `process.env.NODE_ENV`
 * read `development`, `production`, or neither?" — and answers nothing
 * else. It does NOT decide whether Production is allowed, whether a
 * Loader may import, whether Storage may persist, or anything else a
 * caller might do with the answer. There is deliberately no
 * `isProductionAllowed()`, `isSecure()`, `productionReady()`, or
 * `authorizeRuntime()` here, and there never should be — each caller
 * (`FedosWasmLoaderSkeleton#evaluateDevOnlyGate()`, `runtimeCapabilities()`,
 * the Ciphertext Storage Service) keeps making its OWN Fail-Closed
 * decision from this module's classification, exactly as before.
 *
 * Fail Closed: an unset `NODE_ENV`, any value other than `"development"`/
 * `"production"`, or a read failure (including `process`/`process.env`
 * being unavailable at all) all resolve `"Unknown"` — never thrown as an
 * exception.
 *
 * HARD GUARDRAILS:
 *   - `determineFedosRuntimeMode()` is the ONLY export besides the
 *     `FedosRuntimeMode` type it returns.
 *   - Reads ONLY `process.env.NODE_ENV` — no other environment variable,
 *     no `import.meta`, no filesystem, no Worker, no Rust, no new Storage
 *     or Crypto API of any kind.
 *   - Never throws — every failure path resolves `"Unknown"`.
 */

declare const process: { env?: { readonly NODE_ENV?: string } };

/**
 * The three environment buckets this module can observe. Byte-for-byte
 * the same union `fedos_runtime_prototype_execution.ts` already exported
 * as `FedosRuntimeMode` (Stage 1001, Secure Runtime Alpha 005) — moved
 * here, not redefined.
 */
export type FedosRuntimeMode = "Development" | "Production" | "Unknown";

/**
 * PUBLIC — the single Runtime Mode Authority every classifier in
 * `src/runtime/` now delegates to. Pure, synchronous, takes no argument.
 * Mirrors the exact three-way, try/catch-wrapped, Fail-Closed-to-`"Unknown"`
 * shape `#evaluateDevOnlyGate()`/`determineRuntimeMode()`/
 * `isDevelopmentRuntimeForCiphertextStorage()` each already used
 * independently — this is that shape, written once.
 */
export function determineFedosRuntimeMode(): FedosRuntimeMode {
  try {
    const nodeEnv = process.env?.NODE_ENV;
    if (nodeEnv === "development") {
      return "Development";
    }
    if (nodeEnv === "production") {
      return "Production";
    }
    return "Unknown";
  } catch {
    return "Unknown";
  }
}
