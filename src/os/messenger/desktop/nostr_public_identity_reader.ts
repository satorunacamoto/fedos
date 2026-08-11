/**
 * Secure Runtime Alpha 103 ("Source Injection") — the FIRST concrete
 * implementation of `FedosPublicIdentityReader` (`fedos_public_identity_reader.ts`,
 * Alpha 101) anywhere in this repository. `NostrPublicIdentityReader`
 * wraps exactly ONE injected `FedosNostrPublicIdentitySource`
 * (`src/identity/fedos_nostr_public_identity_source.ts`, Alpha 039) and
 * maps its own Snapshot to the protocol-independent
 * `FedosIdentityDescriptor` shape `FedosPublicIdentityReader` itself
 * demands — the SAME validation and mapping
 * `NostrIdentityProvider.describeIdentity()`
 * (`src/identity/fedos_nostr_identity_provider.ts`, Alpha 035/039/046)
 * already performs, deliberately duplicated here rather than reused,
 * so this class stays entirely independent of the Identity Layer's own
 * internal Provider/Service/Registry pipeline — consistent with the
 * Alpha 102 Decision that a Reader is Desktop's own, separate concern,
 * never `FedosRuntimeIdentity`'s.
 *
 * HARD GUARDRAILS:
 *   - `NostrPublicIdentityReader` is the ONLY export.
 *   - The constructor takes exactly ONE argument, the injected Source,
 *     and performs NO async work of any kind.
 *   - `readPublicIdentity()` reads the injected Source EXACTLY ONCE
 *     per call, never throws (a thrown Source read resolves `null`
 *     instead), and returns `null` on any invalid or missing input.
 *   - `provider` is ALWAYS the fixed literal `"nostr"` on any returned
 *     Descriptor — mirroring `NostrIdentityProvider`'s own identical
 *     guarantee.
 *   - Empty-string `id`/`publicIdentifier` are treated identically to
 *     missing fields — both resolve `null`.
 *   - NO Relay, WebSocket, signing, or secret-key reference of any
 *     kind — this class only ever calls
 *     `source.readPublicIdentity()`, nothing else.
 *   - NO reference to `FedosIdentityProvider`, `FedosIdentityService`,
 *     `FedosIdentityRegistry`, `FedosIdentityResolver`, or
 *     `FedosRuntimeIdentity` — this class is entirely independent of
 *     the Identity Layer's own internal Bootstrap pipeline.
 */

import type { FedosIdentityDescriptor } from "../../core/identity/fedos_identity_descriptor.js";
import type {
  FedosNostrPublicIdentitySnapshot,
  FedosNostrPublicIdentitySource,
} from "../../core/identity/fedos_nostr_public_identity_source.js";
import type { FedosPublicIdentityReader } from "./fedos_public_identity_reader.js";

export class NostrPublicIdentityReader implements FedosPublicIdentityReader {
  readonly #source: FedosNostrPublicIdentitySource;

  constructor(source: FedosNostrPublicIdentitySource) {
    this.#source = source;
  }

  async readPublicIdentity(): Promise<FedosIdentityDescriptor | null> {
    let snapshot: FedosNostrPublicIdentitySnapshot | null;
    try {
      snapshot = await this.#source.readPublicIdentity();
    } catch {
      return null;
    }

    if (snapshot === null) {
      return null;
    }
    if (typeof snapshot.id !== "string" || snapshot.id.length === 0) {
      return null;
    }
    if (typeof snapshot.publicIdentifier !== "string" || snapshot.publicIdentifier.length === 0) {
      return null;
    }

    return {
      id: snapshot.id,
      provider: "nostr",
      publicIdentifier: snapshot.publicIdentifier,
      displayName: snapshot.displayName,
      avatar: snapshot.avatar,
    };
  }
}
