/**
 * Secure Runtime Alpha 1471–1540 ("Private Transport Boundary and
 * Multi-Relay Delivery Arc").
 *
 * Resolves the still-open "Alpha 890 blocker" named in
 * `../encryption/fedos_conversation_encryption_authority.ts` /
 * `fedos_conversation_decryption_authority.ts` — `localAccountIndex` /
 * `counterpartyPublicKeyHex`, ALREADY RESOLVED, for a live
 * `FedosConversationId`. This file does not invent a new identity
 * concept: it applies the EXACT verification idiom
 * `FedosSigningAuthorityNostrAuthorBinding`
 * (`../../board/runtime/identity/fedos_nostr_author_binding_authority.ts`,
 * Alpha 688) already established for Board Authors — compare a
 * `signingAuthority.publicIdentityForAccount(accountIndex).publicKeyHex`
 * against a `FedosConversationParticipantReference.publicIdentifier` — to
 * Conversation Membership instead.
 *
 * V1 scope, matching the Alpha 851–8XX Direct-mode precedent this arc
 * reuses: resolves routing for a Direct conversation (exactly two
 * `"active"` memberships) ONLY. A group conversation fails closed to
 * `"not-direct"` — this file invents no group-routing/fan-out-to-multiple-
 * counterparties design; that remains a separate, future decision.
 *
 * HARD GUARDRAILS:
 *   - Never calls `signEvent()` — only `publicIdentityForAccount()`, the
 *     same non-signing read `FedosSigningAuthorityNostrAuthorBinding`
 *     itself is limited to.
 *   - Never returns a raw key, never throws for a normal resolution
 *     failure — every outcome is a returned, closed-vocabulary token.
 */

import type { FedosConversationMembership } from "../../../conversations/membership/fedos_conversation_membership.js";
import type { FedosNostrSigningAuthority } from "../protocol/sign/fedos_nostr_signing_authority.js";

const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

export type FedosConversationTransportRouteResolution =
  | {
      readonly outcome: "resolved";
      readonly localAccountIndex: number;
      readonly counterpartyPublicKeyHex: string;
    }
  | { readonly outcome: "not-direct" }
  | { readonly outcome: "local-membership-unresolved" }
  | { readonly outcome: "counterparty-not-nostr" }
  | { readonly outcome: "invalid-counterparty-key" };

export interface FedosConversationTransportRouteRequest {
  readonly memberships: readonly FedosConversationMembership[];
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly localAccountIndex: number;
}

/**
 * Direct-mode routing resolution. Exactly two `"active"` memberships are
 * required; anything else (a group conversation, a not-yet-admitted or
 * already-ended Direct conversation) fails closed to `"not-direct"`
 * without further inspection.
 */
export async function resolveFedosConversationTransportRoute(
  request: FedosConversationTransportRouteRequest,
): Promise<FedosConversationTransportRouteResolution> {
  const active = request.memberships.filter((membership) => membership.state === "active");
  if (active.length !== 2) {
    return { outcome: "not-direct" };
  }

  const identity = await request.signingAuthority.publicIdentityForAccount(request.localAccountIndex);
  if (identity === null) {
    return { outcome: "local-membership-unresolved" };
  }

  const localMembership = active.find(
    (membership) =>
      membership.participant.authority === "nostr" && membership.participant.publicIdentifier === identity.publicKeyHex,
  );
  if (localMembership === undefined) {
    return { outcome: "local-membership-unresolved" };
  }

  const counterpartyMembership = active.find((membership) => membership.id !== localMembership.id);
  if (counterpartyMembership === undefined) {
    return { outcome: "local-membership-unresolved" };
  }

  if (counterpartyMembership.participant.authority !== "nostr") {
    return { outcome: "counterparty-not-nostr" };
  }
  if (!NOSTR_PUBLIC_KEY_HEX_PATTERN.test(counterpartyMembership.participant.publicIdentifier)) {
    return { outcome: "invalid-counterparty-key" };
  }

  return {
    outcome: "resolved",
    localAccountIndex: request.localAccountIndex,
    counterpartyPublicKeyHex: counterpartyMembership.participant.publicIdentifier,
  };
}
