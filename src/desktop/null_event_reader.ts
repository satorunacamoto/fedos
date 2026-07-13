/**
 * Secure Runtime Alpha 203 ("Null Event Reader & Desktop Wiring
 * Decision") — a FIRST implementation of `FedosEventReader`
 * (`fedos_event_reader.ts`, Alpha 202), mirroring the exact
 * relationship `NullPublicIdentityReader`
 * (`src/desktop/null_public_identity_reader.ts`, Alpha 104) already
 * has to `FedosPublicIdentityReader`: a dependency-free implementation
 * that needs no Event source of its own, since no real Event source
 * exists yet anywhere reachable from Desktop (the Rust Event
 * Foundation remains `pub(crate)`-only, per Alpha 198/201). Adding
 * this file changes NO existing behavior — it is not wired into
 * `DesktopApplication` or `createDesktopApplication()` (Alpha 203's
 * own §3 records why: see `docs/secure_runtime_alpha_203_null_event_reader_and_desktop_wiring_decision.md`).
 *
 * HARD GUARDRAILS:
 *   - `NullEventReader` is the ONLY export.
 *   - The constructor takes NO arguments and holds NO field of any
 *     kind.
 *   - `readEvents()` ALWAYS resolves an empty, `readonly` array — no
 *     branching, no Event construction, no async work beyond the
 *     `Promise` wrapper itself.
 *   - NOT wired into `createDesktopApplication()` or
 *     `DesktopApplication` — neither file is modified by this Stage.
 *   - NO Relay, WebSocket, signing, or secret-key reference of any
 *     kind.
 */

import type { FedosEventDescriptor } from "./fedos_event_descriptor.js";
import type { FedosEventReader } from "./fedos_event_reader.js";

export class NullEventReader implements FedosEventReader {
  async readEvents(): Promise<readonly FedosEventDescriptor[]> {
    return [];
  }
}
