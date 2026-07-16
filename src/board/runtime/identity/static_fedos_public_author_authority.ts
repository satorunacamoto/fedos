/**
 * Secure Runtime Alpha 646 ("Public Author Authority Interface") —
 * Stage 6 of the Alpha 641–680 Public Identity, Conversation Policy &
 * Application Runtime Integration Arc.
 *
 * A fixed, injectable `FedosPublicAuthorAuthority` for tests and
 * explicit configuration — holds exactly one `FedosPublicAuthorResolution`,
 * supplied at construction, and returns it unchanged from every call.
 * Mirrors `StaticNostrPublicIdentitySource`'s own identical
 * "one fixed value, no I/O, no branching" shape
 * (`../../../desktop/static_nostr_public_identity_source.ts`, Alpha 108).
 *
 * NOT wired into any production default by this Arc — see
 * `fedos_desktop_public_author_authority.ts` for the one production
 * implementation `FedosBoardRuntime` defaults to.
 */

import type { FedosPublicAuthorAuthority, FedosPublicAuthorResolution } from "./fedos_public_author_authority.js";

export class StaticFedosPublicAuthorAuthority implements FedosPublicAuthorAuthority {
  readonly #resolution: FedosPublicAuthorResolution;

  constructor(resolution: FedosPublicAuthorResolution) {
    this.#resolution = resolution;
  }

  async resolvePublicAuthor(): Promise<FedosPublicAuthorResolution> {
    return this.#resolution;
  }
}
