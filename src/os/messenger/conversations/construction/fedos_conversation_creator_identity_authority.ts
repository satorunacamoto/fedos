/**
 * Secure Runtime Alpha 904 ("Creator Identity Authority") — Phase B of
 * the Alpha 891–930 Private Conversation Draft Construction and Readiness
 * Runtime Arc.
 *
 * The narrow seam the construction coordinator consults to learn WHO the
 * creator is — the caller never supplies a creator identity on the
 * command (Alpha 901), exactly as `FedosBoardRuntime.createPublicThread()`
 * resolves its author via `FedosPublicAuthorAuthority` rather than
 * accepting one. A caller therefore cannot impersonate the creator: the
 * only identity a draft can carry is whatever THIS authority resolves.
 *
 * `FedosConversationCreatorIdentityResolution` is a CLOSED vocabulary
 * mirroring `FedosPublicAuthorResolution`'s own shape (Alpha 643):
 *   - `"resolved"`        — a real, durable local identity.
 *   - `"anonymous-local"` — no identity configured; a stable,
 *                           restart-consistent local pseudo-identity.
 *   - `"unavailable"`     — the authority cannot be consulted right now.
 *
 * Alpha 904's own questions, answered explicitly for V1:
 *   - MAY anonymous-local create a local private draft? — YES by default
 *     (a draft is unlisted, federation `"local-only"`, so a local
 *     pseudo-identity is a sufficient OWNER for it). The coordinator
 *     accepts a `requireResolvedCreatorIdentity` flag (default `false`)
 *     that flips this to fail-closed for a deployment that demands a real
 *     resolved identity before any private draft.
 *   - MAY it invite others? — the join Capability it may issue carries a
 *     bearer secret shared out-of-band; the identity readiness axis
 *     surfaces whether the creator is resolved vs anonymous-local so a
 *     caller is never misled about identity durability.
 *   - Stable across restart? — YES: the anonymous-local participant has a
 *     FIXED `publicIdentifier`, so its deterministic Membership id
 *     (`toFedosConversationMembershipId`) is identical on every restart —
 *     recovery re-derives the same creator Membership, never a duplicate.
 *
 * A display pseudonym is NEVER used as identity here — the resolved value
 * is a `FedosConversationParticipantReference` (`authority`/
 * `publicIdentifier`/`identityId`), never a display name (Alpha 904).
 */

import type { FedosConversationParticipantReference } from "../../../../conversation/membership/fedos_conversation_participant_reference.js";

export type FedosConversationCreatorIdentityResolution =
  | { readonly outcome: "resolved"; readonly creator: FedosConversationParticipantReference }
  | { readonly outcome: "anonymous-local"; readonly creator: FedosConversationParticipantReference }
  | { readonly outcome: "unavailable" };

export interface FedosConversationCreatorIdentityAuthority {
  /** Total, never throws. Resolved before any durable write is attempted (Alpha 915). */
  resolveCreator(): FedosConversationCreatorIdentityResolution;
}

/** The stable local pseudo-identity used when no real identity is configured. Fixed, so its Membership id is restart-stable. */
export const FEDOS_ANONYMOUS_LOCAL_CREATOR: FedosConversationParticipantReference = Object.freeze({
  authority: "fedos",
  publicIdentifier: "anonymous-local",
  identityId: null,
});

/** The default authority — always `"anonymous-local"`, the safe V1 default (mirrors `FedosPublicAuthorAuthority`'s own anonymous-local fallback). */
export class AnonymousLocalFedosConversationCreatorIdentityAuthority
  implements FedosConversationCreatorIdentityAuthority
{
  resolveCreator(): FedosConversationCreatorIdentityResolution {
    return { outcome: "anonymous-local", creator: FEDOS_ANONYMOUS_LOCAL_CREATOR };
  }
}

/** A test/production convenience wrapping an already-resolved local identity. Never accepts a display name. */
export class StaticFedosConversationCreatorIdentityAuthority implements FedosConversationCreatorIdentityAuthority {
  readonly #creator: FedosConversationParticipantReference;

  constructor(creator: FedosConversationParticipantReference) {
    this.#creator = creator;
  }

  resolveCreator(): FedosConversationCreatorIdentityResolution {
    return { outcome: "resolved", creator: this.#creator };
  }
}
