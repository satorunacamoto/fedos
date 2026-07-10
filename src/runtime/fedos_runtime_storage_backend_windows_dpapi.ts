/**
 * Secure Runtime Alpha 023 — "Windows DPAPI Storage Backend".
 *
 * Alpha 021 (`fedos_runtime_storage_backend.ts`) defined
 * `RuntimeStorageBackend` (the Backend Interface) with exactly one
 * implementation, `MemoryStorageBackend`. Alpha 022
 * (`docs/secure_runtime_alpha_022_storage_backend_selection_policy_review.md`)
 * recommended Windows DPAPI as the first real OS-backed backend to
 * build. This file is that backend: `WindowsDpapiStorageBackend`, a
 * SECOND `RuntimeStorageBackend` implementation, standing alongside
 * `MemoryStorageBackend` — NOT replacing it.
 *
 * **Same in-process, non-persistent-across-restart contract as
 * `MemoryStorageBackend`.** Like `MemoryStorageBackend`, this class
 * holds its entries in a plain in-process `Map` — data does NOT survive
 * an actual process restart, and NOTHING is ever written to disk, the
 * registry, or any other persistent location. What DPAPI adds here is
 * real protection of the VALUE held in that `Map`: `store()` protects
 * `wire` via Windows DPAPI (`fedos_windows_dpapi_helper.ts`,
 * `CurrentUser`-scoped) BEFORE holding it, and `load()` unprotects it
 * back. A future, separately-reviewed Stage may add real
 * cross-process-restart persistence (e.g. writing the already-DPAPI-protected
 * blob to a file); this Stage does not — see Alpha 022 §2's own
 * Backup-criterion finding that DPAPI protection and durable persistence
 * are two separate concerns.
 *
 * **This class is NOT wired into `resolveRuntimeStorageBackend()`.**
 * The Storage Resolver (`fedos_runtime_storage_resolver.ts`) remains
 * hardcoded to `MemoryStorageBackend` only, exactly as Alpha 021 left
 * it — completing this Backend is this Stage's ONLY objective, per its
 * own mandate. `WindowsDpapiStorageBackend` is constructed directly by
 * tests today (mirroring how `MemoryStorageBackend` itself is
 * constructed directly and passed as `storeCiphertext()`/
 * `loadCiphertext()`/`deleteCiphertext()`'s optional `storage`
 * parameter, Alpha 019/021); a FUTURE, separately-reviewed Stage would
 * change ONLY `fedos_runtime_storage_resolver.ts` to make it the active
 * backend under some condition.
 *
 * HARD GUARDRAILS:
 *   - `WindowsDpapiStorageBackend` is the ONLY export.
 *   - `store()`/`delete()` return plain `boolean` (never `null`,
 *     matching `RuntimeStorageBackend`'s own interface exactly);
 *     `load()` returns `AeadCiphertextWire | null`. No exception ever
 *     escapes any of the three methods.
 *   - Fail Closed to `false`/`null`: not Windows; DPAPI protect/unprotect
 *     failure; `powershell.exe` unavailable; or any exception — the SAME
 *     four conditions `fedos_windows_dpapi_helper.ts` already Fail
 *     Closed on, simply read through.
 *   - NO filesystem, SQLite, IndexedDB, macOS Keychain, or Linux Secret
 *     Service reference of any kind.
 *   - NO reference to `src/worker.ts`, and this file is not referenced
 *     BY `src/worker.ts` — Worker remains fully unconnected.
 *   - NO Development/Production gate of its own — that Fail-Closed
 *     decision remains entirely the Runtime Storage Service's own
 *     responsibility (`isDevelopmentRuntimeForCiphertextStorage()`,
 *     `fedos_runtime_ciphertext_storage.ts`, unchanged by this Stage),
 *     exactly as `MemoryStorageBackend` already never gates on Runtime
 *     Mode either — this class answers "can DPAPI store this," never
 *     "is storage currently allowed."
 *   - Stores `AeadCiphertextWire` ONLY — NEVER an `AeadKeyHandle` or any
 *     raw key byte — enforced at the type level, exactly as
 *     `MemoryStorageBackend` already established.
 *   - NO call to `randomBytes()`/`generateAeadKey()`/`encrypt()`/
 *     `decrypt()`/`exportCiphertext()`/`importCiphertext()`/
 *     `runtimeCapabilities()`/`determineFedosRuntimeMode()`.
 */

import type { AeadCiphertextWire } from "./fedos_wasm_loader.js";
import type { RuntimeStorageBackend } from "./fedos_runtime_storage_backend.js";
import {
  protectWithWindowsDpapi,
  unprotectWithWindowsDpapi,
  type WindowsDpapiHelperOptions,
} from "./fedos_windows_dpapi_helper.js";

/**
 * The SECOND `RuntimeStorageBackend` implementation this arc ships,
 * alongside `MemoryStorageBackend` (unchanged). Entries are held in a
 * plain in-process `Map<string, string>` keyed by caller-supplied `id`,
 * where the VALUE is the DPAPI-protected (base64) form of the stored
 * `AeadCiphertextWire` — never the plaintext wire itself.
 *
 * Accepts an OPTIONAL `WindowsDpapiHelperOptions`, purely for
 * testability (mirroring `fedos_windows_dpapi_helper.ts`'s own reason
 * for exposing it) — every REAL call site omits it, always getting the
 * real `process.platform`/real `powershell.exe` invocation.
 */
export class WindowsDpapiStorageBackend implements RuntimeStorageBackend {
  #entries = new Map<string, string>();
  #options: WindowsDpapiHelperOptions;

  constructor(options: WindowsDpapiHelperOptions = {}) {
    this.#options = options;
  }

  async store(id: string, wire: AeadCiphertextWire): Promise<boolean> {
    try {
      const protectedValue = await protectWithWindowsDpapi(wire, this.#options);
      if (protectedValue === null) {
        return false;
      }
      this.#entries.set(id, protectedValue);
      return true;
    } catch {
      return false;
    }
  }

  async load(id: string): Promise<AeadCiphertextWire | null> {
    const protectedValue = this.#entries.get(id);
    if (protectedValue === undefined) {
      return null;
    }
    try {
      const plaintext = await unprotectWithWindowsDpapi(protectedValue, this.#options);
      // `AeadCiphertextWire` is a branded `string` (fedos_wasm_loader.ts) —
      // the SAME "no content validation at this boundary, an explicit cast
      // only stops accidental unrelated-string use" discipline that type
      // already documents applies here: this cast reconstructs the brand
      // for a value that WAS a genuine AeadCiphertextWire before store()
      // protected it (never a caller-supplied unrelated string).
      return plaintext === null ? null : (plaintext as AeadCiphertextWire);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    return this.#entries.delete(id);
  }
}
