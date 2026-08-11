/**
 * Secure Runtime Alpha 039 — "Nostr Public Identity Source Boundary".
 *
 * The first (and, as of this Stage, only) concrete implementation of
 * `FedosNostrPublicIdentitySource` (this Stage's own new interface).
 * See `docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md`
 * for the full design rationale, including why a Null Source is
 * injected as the Resolver's own default rather than a fixed npub, a
 * randomly-generated identity, or any environment/filesystem read.
 *
 * This file defines a SINGLE CLASS and nothing else — no constructor,
 * no configuration, no internal state, no thrown exception, no Relay
 * reference, no Runtime reference, and no wiring into any other
 * module in this repository beyond being constructed and injected by
 * the Resolver. `readPublicIdentity()` always resolves `null`.
 */

import type { FedosNostrPublicIdentitySnapshot, FedosNostrPublicIdentitySource } from "./fedos_nostr_public_identity_source.js";

export class NullNostrPublicIdentitySource implements FedosNostrPublicIdentitySource {
  async readPublicIdentity(): Promise<FedosNostrPublicIdentitySnapshot | null> {
    return null;
  }
}
