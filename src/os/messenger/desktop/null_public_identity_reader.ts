/**
 * Secure Runtime Alpha 104 ("Null Reader") — a SECOND implementation
 * of `FedosPublicIdentityReader` (`fedos_public_identity_reader.ts`,
 * Alpha 101), alongside `NostrPublicIdentityReader` (Alpha 103).
 * `NullPublicIdentityReader` takes no argument, depends on no Source
 * of any kind, and always resolves `null` — mirroring the exact
 * relationship `NoopFedosIdentityProvider`
 * (`src/identity/fedos_noop_identity_provider.ts`, Alpha 033) already
 * has to `NostrIdentityProvider`: a simpler, dependency-free
 * alternative implementation of the SAME interface, existing
 * standalone and fully tested, but NOT wired into
 * `createDesktopApplication()` or `DesktopApplication`'s own default
 * parameter by this Stage. Adding this file changes NO existing
 * behavior — `createDesktopApplication()` continues constructing
 * `NostrPublicIdentityReader` exactly as Alpha 103 left it, which
 * itself already resolves `null` today via the shared
 * `NullNostrPublicIdentitySource` singleton (Alpha 048).
 *
 * HARD GUARDRAILS:
 *   - `NullPublicIdentityReader` is the ONLY export.
 *   - The constructor takes NO arguments and holds NO field of any
 *     kind.
 *   - `readPublicIdentity()` ALWAYS resolves `null` — no branching, no
 *     Source reference, no async work beyond the `Promise` wrapper
 *     itself.
 *   - NOT wired into `createDesktopApplication()` or
 *     `DesktopApplication`'s own constructor default by this Stage.
 *   - NO Relay, WebSocket, signing, or secret-key reference of any
 *     kind.
 */

import type { FedosIdentityDescriptor } from "../../core/identity/fedos_identity_descriptor.js";
import type { FedosPublicIdentityReader } from "./fedos_public_identity_reader.js";

export class NullPublicIdentityReader implements FedosPublicIdentityReader {
  async readPublicIdentity(): Promise<FedosIdentityDescriptor | null> {
    return null;
  }
}
