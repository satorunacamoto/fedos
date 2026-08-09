/**
 * Secure Runtime Alpha 108 ("Static Public Identity Source") — the
 * FIRST real (non-Null) `FedosNostrPublicIdentitySource`
 * (`src/identity/fedos_nostr_public_identity_source.ts`, Alpha 039)
 * implementation anywhere in this repository. `StaticNostrPublicIdentitySource`
 * wraps exactly ONE `FedosNostrPublicIdentitySnapshot`, supplied once
 * at construction, and returns it — unchanged, unvalidated, and
 * verbatim — from every `readPublicIdentity()` call. It performs NO
 * external communication of any kind: no Relay connection, no
 * WebSocket, no NIP logic, no event retrieval, and no network request
 * of any kind. This is the SAME "static, in-memory, no I/O" pattern
 * `NullNostrPublicIdentitySource` (Alpha 039) already established for
 * the zero-identity case — this Stage adds the one-fixed-identity
 * case alongside it, as a SECOND, independent implementation. This
 * file is added standalone at this Stage and wired into nothing —
 * Alpha 109's own deliverable.
 *
 * HARD GUARDRAILS:
 *   - `StaticNostrPublicIdentitySource` is the ONLY export.
 *   - The constructor takes exactly ONE argument, the
 *     `FedosNostrPublicIdentitySnapshot` to return, and performs NO
 *     validation, normalization, or transformation of it — held
 *     verbatim.
 *   - `readPublicIdentity()` ALWAYS resolves the SAME held snapshot,
 *     unchanged, on EVERY call — no branching, no state mutation, no
 *     counting, no expiry.
 *   - NO Relay, WebSocket, NIP, event, signing, secret-key, or DM
 *     reference of any kind — this class performs no I/O of any kind.
 *   - NOT wired into `createDesktopApplication()` or
 *     `DesktopApplication` by this Stage.
 */

import type {
  FedosNostrPublicIdentitySnapshot,
  FedosNostrPublicIdentitySource,
} from "../../../identity/fedos_nostr_public_identity_source.js";

export class StaticNostrPublicIdentitySource implements FedosNostrPublicIdentitySource {
  readonly #snapshot: FedosNostrPublicIdentitySnapshot;

  constructor(snapshot: FedosNostrPublicIdentitySnapshot) {
    this.#snapshot = snapshot;
  }

  async readPublicIdentity(): Promise<FedosNostrPublicIdentitySnapshot | null> {
    return this.#snapshot;
  }
}
