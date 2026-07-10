/**
 * Secure Runtime Alpha 024 — "Runtime Platform Authority".
 *
 * Alpha 022 (`docs/secure_runtime_alpha_022_storage_backend_selection_policy_review.md`)
 * §5 reviewed the relationship between a future backend-selection
 * classifier and Alpha 020's Runtime Mode Authority
 * (`fedos_runtime_mode_authority.ts`, `determineFedosRuntimeMode()`) and
 * concluded they answer COMPLETELY ORTHOGONAL questions — WHICH
 * platform vs. WHAT environment — and must never be collapsed into one
 * classifier. This file is that separately-named platform classifier,
 * used by the Storage Resolver (`fedos_runtime_storage_resolver.ts`) to
 * decide WHICH `RuntimeStorageBackend` implementation to construct.
 *
 * **This module is an ENVIRONMENT CLASSIFIER, not an authorization
 * gate** — the SAME discipline `fedos_runtime_mode_authority.ts` itself
 * already established (Alpha 020 §4). It answers exactly one question —
 * "does `process.platform` read `win32`, or something else?" — and
 * answers nothing else. It does NOT decide whether DPAPI may be used,
 * whether Storage is allowed, or anything else a caller might do with
 * the answer. There is deliberately no `isDpapiAllowed()`,
 * `isWindowsSecure()`, or `authorizePlatform()` here, mirroring Alpha
 * 020 §4's own forbidden-API-shape list exactly, extended to this new
 * axis.
 *
 * **Never reads, imports, or depends on `fedos_runtime_mode_authority.ts`/
 * `determineFedosRuntimeMode()`.** Platform identity and Runtime Mode
 * are two independent reads; a caller needing both (the Storage
 * Resolver does) calls both classifiers separately and combines their
 * two answers with its own plain `if` logic — this file itself never
 * merges the two.
 *
 * Fail Closed: any read failure (including `process`/`process.platform`
 * being unavailable at all) resolves `"Other"` — never thrown as an
 * exception. `"Other"` is also the genuine, correct answer for every
 * real non-Windows platform (macOS, Linux, etc.) — it is not merely a
 * fallback value.
 *
 * HARD GUARDRAILS:
 *   - `determineFedosRuntimePlatform()` is the ONLY export besides the
 *     `FedosRuntimePlatform` type it returns.
 *   - Reads ONLY `process.platform` — no environment variable, no
 *     `import.meta`, no filesystem, no Worker, no Rust, no new Storage
 *     or Crypto API of any kind.
 *   - Never throws — every failure path resolves `"Other"`.
 */

declare const process: { platform: string };

/**
 * The two platform buckets this module can observe. Per this Stage's
 * own mandate ("最低限 Windows / その他 だけで良い"), exactly two values
 * — no macOS/Linux-specific value is introduced yet; both currently
 * collapse into `"Other"`, exactly like `MemoryStorageBackend` already
 * handles every non-Windows platform identically.
 */
export type FedosRuntimePlatform = "Windows" | "Other";

/**
 * PUBLIC — the single Platform Authority the Storage Resolver delegates
 * to. Pure, synchronous, takes no argument. Mirrors
 * `determineFedosRuntimeMode()`'s own exact three-way-turned-two-way,
 * try/catch-wrapped, Fail-Closed-to-a-safe-default shape — a SEPARATE
 * function, on a SEPARATE axis, never merged with it.
 */
export function determineFedosRuntimePlatform(): FedosRuntimePlatform {
  try {
    return process.platform === "win32" ? "Windows" : "Other";
  } catch {
    return "Other";
  }
}
