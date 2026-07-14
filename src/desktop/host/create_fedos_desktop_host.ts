/**
 * Secure Runtime Alpha 334 ("Desktop Host Dependency Assembly") —
 * Stage 4 of the Alpha 331–340 Desktop Host Runtime Foundation Arc.
 *
 * `createFedosDesktopHost()` mirrors `createDesktopApplication()`'s
 * own naming and scoping discipline (`../create_desktop_application.ts`,
 * Alpha 099) and `createRuntime()`'s own before it
 * (`../../runtime/create_runtime.ts`, Alpha 051): ONE clearly-named
 * function, ONE clearly-scoped responsibility — assemble a
 * `FedosDesktopHostDependencies` object and construct exactly one
 * `FedosDesktopHost` from it. It does NOT call `start()` on the
 * instance it returns, exactly as `createDesktopApplication()` never
 * calls `bootstrap()`/`start()` on ITS own returned instance.
 *
 * Both dependencies default when omitted: `desktopApplication`
 * defaults to `createDesktopApplication()`'s own unmodified default
 * construction (Alpha 099), and `boardPersistence` defaults to a
 * FRESH `InMemoryFedosBoardPersistence()`
 * (`../../board/persistence/in_memory_fedos_board_persistence.js`,
 * Alpha 316) — this Arc's own explicitly-documented in-memory-only
 * default; see `docs/secure_runtime_alpha_334_desktop_host_dependency_assembly.md`
 * §3 for why NO durable backend is selected here (Alpha 329's own
 * Option E deferral stands unmodified by this Arc). Either dependency
 * may be overridden by an explicit caller — the ONLY way a test
 * injects a fake/throwing `DesktopApplication` or a pre-populated
 * `FedosBoardPersistence` (see this Stage's own test file).
 *
 * HARD GUARDRAILS:
 *   - `createFedosDesktopHost` is the ONLY export.
 *   - This function performs NO async work of any kind — it only
 *     resolves two defaults and constructs one `FedosDesktopHost`.
 *   - It does NOT call `start()`, `stop()`, `bootstrap()`, or any
 *     hydration function on anything it constructs.
 *   - NO module-level mutable singleton exists in this file — every
 *     call constructs fresh dependencies (unless the caller supplies
 *     its own, already-constructed instances).
 *   - NO `process.env` read of any kind — Runtime Mode Authority
 *     (`../../runtime/fedos_runtime_mode_authority.ts`) is never
 *     duplicated or bypassed here.
 *   - NO filesystem path selection, NO `p2p/` import, NO reference to
 *     `src/worker.ts` or `src/runtime/create_runtime.ts`.
 */

import { createDesktopApplication } from "../create_desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../../board/persistence/in_memory_fedos_board_persistence.js";
import { FedosDesktopHost, type FedosDesktopHostDependencies } from "./fedos_desktop_host.js";

export function createFedosDesktopHost(
  dependencies: Partial<FedosDesktopHostDependencies> = {},
): FedosDesktopHost {
  const desktopApplication = dependencies.desktopApplication ?? createDesktopApplication();
  const boardPersistence = dependencies.boardPersistence ?? new InMemoryFedosBoardPersistence();
  return new FedosDesktopHost({ desktopApplication, boardPersistence });
}
