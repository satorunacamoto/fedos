/**
 * Secure Runtime Alpha 021 — "Storage Resolver". Secure Runtime
 * Alpha 024 — "DPAPI Resolver Integration" (this revision).
 *
 * The single seam between the Runtime Storage Service
 * (`fedos_runtime_ciphertext_storage.ts`) and WHICH
 * `RuntimeStorageBackend` (`fedos_runtime_storage_backend.ts`) it
 * actually uses. Alpha 021 left `resolveRuntimeStorageBackend()`
 * hardcoded to `MemoryStorageBackend` only. Alpha 022
 * (`docs/secure_runtime_alpha_022_storage_backend_selection_policy_review.md`)
 * decided the switch condition belongs HERE, in the Resolver, and
 * recommended Windows DPAPI as the first real backend. Alpha 023
 * (`fedos_runtime_storage_backend_windows_dpapi.ts`) built and verified
 * that backend without wiring it in. THIS Stage is that wiring:
 *
 *   Development Runtime AND Windows platform  ->  WindowsDpapiStorageBackend
 *   everything else (Production/Unknown Runtime, OR any non-Windows platform)  ->  MemoryStorageBackend
 *
 * **`MemoryStorageBackend` is NOT removed, NOT deprecated, and is
 * still fully reachable** — every real caller off Windows, and every
 * caller outside Development Runtime regardless of platform, gets
 * EXACTLY the same `MemoryStorageBackend` singleton this file always
 * returned before this Stage. `MemoryStorageBackend`'s own file
 * (`fedos_runtime_storage_backend.ts`) is untouched.
 *
 * **Two independent classifiers, read separately, combined with plain
 * `if` logic — never merged into one.** This file calls BOTH Alpha
 * 020's Runtime Mode Authority (`determineFedosRuntimeMode()`,
 * `fedos_runtime_mode_authority.ts`) AND this Stage's own new Platform
 * Authority (`determineFedosRuntimePlatform()`,
 * `fedos_runtime_platform_authority.ts`) — two SEPARATE reads on two
 * SEPARATE axes (WHAT environment × WHICH platform), exactly as Alpha
 * 022 §5/this Stage's own mandate requires. This file does NOT define
 * its own environment or platform classification logic — it only
 * delegates to the two existing, separately-reviewed Authorities and
 * combines their answers.
 *
 * **This Resolver is a classifier-driven backend PICKER, not a second
 * authorization gate.** The Runtime Storage Service's own
 * `isDevelopmentRuntimeForCiphertextStorage()` gate (unchanged) remains
 * the TRUE Fail-Closed decision for "is storage allowed at all" —
 * called independently, before `storage.store()`/`load()`/`delete()`
 * is ever reached, regardless of what this Resolver returns. This
 * file's own Development-Runtime check is a SEPARATE, defense-in-depth
 * precaution — it exists so that even a direct construction path that
 * bypassed the Service's own gate could never cause a real
 * `powershell.exe` invocation outside Development — not a replacement
 * for that gate, and not itself a new place where "is this allowed"
 * gets decided for any OTHER caller.
 *
 * **No fallback from DPAPI failure to Memory, ever.** This file picks
 * exactly ONE backend object per call and returns it directly — it
 * never wraps, chains, or retries across backends. If
 * `WindowsDpapiStorageBackend`'s own `store()`/`load()`/`delete()`
 * fails for any reason (DPAPI call failure, `powershell.exe`
 * unavailable, etc.), that failure propagates to the caller exactly as
 * `fedos_runtime_storage_backend_windows_dpapi.ts` already documents
 * (`false`/`null`, per each method's own `RuntimeStorageBackend`
 * signature) — the Resolver does NOT catch that failure and silently
 * retry against `MemoryStorageBackend` instead. See
 * `docs/secure_runtime_alpha_024_dpapi_resolver_integration.md` §4 for
 * the full reasoning.
 *
 * **Singleton, not fresh-per-call, for EACH backend.** Two separate
 * shared instances exist — one `MemoryStorageBackend`, one
 * `WindowsDpapiStorageBackend` — each constructed once at module load
 * and reused for every call that resolves to it. `storeCiphertext()`
 * now and `loadCiphertext()` later must observe the SAME data, and
 * platform never changes mid-process, so within one stable Runtime
 * Mode this still returns the exact same object across repeated calls.
 *
 * HARD GUARDRAILS:
 *   - `resolveRuntimeStorageBackend()` is the ONLY export.
 *   - NO reference to `src/worker.ts`, and this file is not referenced
 *     BY `src/worker.ts` — Worker remains fully unconnected.
 *   - NO filesystem, SQLite, IndexedDB, macOS Keychain, or Linux Secret
 *     Service reference of any kind.
 *   - NO fallback from a failed backend call to a different backend —
 *     this file only ever SELECTS a backend before any call is made; it
 *     never inspects or reacts to a call's own result.
 *   - NO new environment or platform classification logic of its own —
 *     delegates entirely to `determineFedosRuntimeMode()`/
 *     `determineFedosRuntimePlatform()`.
 */

import { MemoryStorageBackend, type RuntimeStorageBackend } from "./fedos_runtime_storage_backend.js";
import { WindowsDpapiStorageBackend } from "./fedos_runtime_storage_backend_windows_dpapi.js";
import { determineFedosRuntimeMode } from "./fedos_runtime_mode_authority.js";
import { determineFedosRuntimePlatform } from "./fedos_runtime_platform_authority.js";

/**
 * PRIVATE (module-scoped) — the ONE shared `MemoryStorageBackend`
 * instance, returned for every non-Windows platform and for every
 * non-Development Runtime Mode, regardless of platform. Byte-for-byte
 * the SAME singleton this file has always held since Alpha 021.
 */
const sharedMemoryBackend: RuntimeStorageBackend = new MemoryStorageBackend();

/**
 * PRIVATE (module-scoped) — the ONE shared `WindowsDpapiStorageBackend`
 * instance, returned ONLY when both Development Runtime and Windows
 * platform hold. See this file's own top-of-file "Singleton, not
 * fresh-per-call, for EACH backend" note.
 */
const sharedWindowsDpapiBackend: RuntimeStorageBackend = new WindowsDpapiStorageBackend();

/**
 * PUBLIC — resolves which `RuntimeStorageBackend` the Runtime Storage
 * Service should use for THIS call. `WindowsDpapiStorageBackend` is
 * returned ONLY when `determineFedosRuntimeMode() === "Development"`
 * AND `determineFedosRuntimePlatform() === "Windows"` both hold —
 * `MemoryStorageBackend` in every other case (Production/Unknown
 * Runtime of any platform, or Development Runtime on a non-Windows
 * platform). Any failure reading either Authority (including either
 * call itself somehow throwing) resolves the safe default,
 * `MemoryStorageBackend` — never a thrown exception, and never an
 * attempt to reach DPAPI on an uncertain classification.
 */
export function resolveRuntimeStorageBackend(): RuntimeStorageBackend {
  try {
    if (determineFedosRuntimeMode() !== "Development") {
      return sharedMemoryBackend;
    }
    if (determineFedosRuntimePlatform() === "Windows") {
      return sharedWindowsDpapiBackend;
    }
    return sharedMemoryBackend;
  } catch {
    return sharedMemoryBackend;
  }
}
