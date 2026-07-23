/**
 * Secure Runtime Alpha 7081-7160 — Phase C/G ("Acceptance coordinator" is
 * the mission's own naming for the inbound half; this is its outbound
 * counterpart, mirroring `fedos_ratchet_peer_capability_outbound_coordinator.ts`'s
 * own structure).
 *
 * Solves the real circular dependency the reconciliation report names:
 * `resolveFedosConversationTransportRoute()` requires 2 ACTIVE local
 * memberships before ANY NIP-17 send can be routed, but the invitee is
 * not a member until the invitation is accepted. This coordinator breaks
 * the cycle by admitting BOTH parties' memberships locally (inviter as
 * `"owner"`, invitee as `"member"`) BEFORE sending — local-only
 * bookkeeping, never shared, never implying the invitee has agreed to
 * anything — then reconstructs+activates the inviter's own local Draft
 * via the EXISTING, unmodified `reactivateRestoredConversation()`
 * (Alpha 2041-2120), and only then sends the real, signed invitation.
 */
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import type { FedosConversationIdentityResolver } from "../encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationReactivationResult } from "../activation/fedos_conversation_reactivation_result.js";
import type { FedosNostrSigningAuthority } from "../../nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosPrivateWireDeliveryQueueOutcome } from "../transport/fedos_private_wire_prepared_delivery.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import { toFedosPrivateConversationId } from "../construction/fedos_private_conversation_id.js";
import { authorizeFedosConversationInvitationContent } from "./fedos_conversation_invitation_authentication.js";
import {
  canonicalSerializeFedosConversationInvitationContent,
  type FedosConversationInvitationAdvertisementV1,
} from "./fedos_conversation_invitation_advertisement.js";
import { encodeFedosConversationInvitationControlPayload } from "./fedos_conversation_invitation_control_payload.js";

export interface FedosConversationInvitationIdGenerator {
  generateRequestId(): string;
  /** A fresh 16-byte hex nonce, distinct from `generateRequestId()`'s own value space (no shared counter/seed). */
  generateNonce(): string;
}

export interface FedosConversationInvitationOutboundDependencies {
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly accountIndex: number;
  readonly idGenerator: FedosConversationInvitationIdGenerator;
  readonly clock: () => number;
  /** Narrow callback, never the whole Runtime — mirrors this codebase's own established "inject a function, not an object" discipline for cross-domain calls. */
  readonly reactivateConversation: (conversationId: string) => Promise<FedosConversationReactivationResult>;
  readonly sendMailboxNip17Control: (
    controlId: string,
    conversationId: FedosConversationId,
    plaintext: Uint8Array,
    createdAt: number,
  ) => Promise<FedosPrivateWireDeliveryQueueOutcome>;
}

const DEFAULT_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000;

export type FedosConversationInvitationOutboundOutcome =
  | {
      readonly outcome: "sent";
      readonly conversationId: string;
      readonly invitation: FedosConversationInvitationAdvertisementV1;
      readonly relayOutcome: FedosPrivateWireDeliveryQueueOutcome["outcome"];
      /**
       * `true` when `reactivateConversation()` reports the conversation
       * genuinely `"reactivated"`/`"already-active"`. `false` when it
       * reports `"activation-failed"` — a REAL, disclosed, pre-existing
       * gap this Arc did not create: `FedosConversationDirectActivationCoordinator`
       * requires a real, non-placeholder `FedosConversationEncryptionAuthority`/
       * `FedosConversationDecryptionAuthority` (the legacy static-message-route
       * crypto authorities, unrelated to Direct Ratchet), and no
       * production-safe implementation of either has ever been built in
       * this codebase (confirmed: only `FedosWasmConversationEncryptionAuthority`,
       * dev/`NODE_ENV`-gated, and the `Unavailable*` placeholder exist).
       * `false` does NOT mean the invitation/Membership/Draft bootstrap
       * itself failed — `#ensureDraft()` durably persists the Draft AND
       * both Memberships BEFORE `activateDirectConversation()` is even
       * attempted (confirmed by direct source read of
       * `fedos_conversation_reactivation_coordinator.ts`), so this
       * Arc's own actual scope (Draft/Membership/conversationId/restart-
       * safety) is unaffected either way.
       */
      readonly activated: boolean;
    }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "membership-admission-failed" }
  | { readonly outcome: "bootstrap-failed"; readonly detail: string }
  | { readonly outcome: "signing-unavailable" };

export class FedosConversationInvitationOutboundCoordinator {
  readonly #deps: FedosConversationInvitationOutboundDependencies;

  constructor(deps: FedosConversationInvitationOutboundDependencies) {
    this.#deps = deps;
  }

  /** Creates a brand-new Direct conversation and sends the invitee a real, signed invitation. `expiresInMs` optional, defaults to 7 days. */
  async createAndSendInvitation(
    invitee: FedosConversationParticipantReference,
    expiresInMs: number = DEFAULT_EXPIRES_IN_MS,
  ): Promise<FedosConversationInvitationOutboundOutcome> {
    if (!Number.isFinite(expiresInMs) || expiresInMs <= 0) return { outcome: "invalid-input" };

    // Secure Runtime Alpha 7081-7160 — a REAL, disclosed, pre-existing gap
    // (see `docs/secure_runtime_alpha_7081_7160_deep_production_gap_report.md`):
    // `FedosConversationIdentityResolver`/`resolveLocalParticipant()` resolves
    // to `AnonymousLocalFedosConversationCreatorIdentityAuthority`'s own
    // GENERIC, non-per-account `{authority:"fedos", publicIdentifier:
    // "anonymous-local"}` placeholder in the real production Coordinator/
    // packaged-Electron path today (confirmed: no caller anywhere in this
    // codebase supplies a real `conversationCreatorIdentityAuthority`).
    // `Membership admission for the LOCAL "owner" role below MUST still use
    // THIS (degraded) identity, to stay self-consistent with
    // `reactivateRestoredConversation()`'s OWN internal, frozen,
    // `identityResolver`-based membership lookup (Alpha 2041-2120, not
    // touched by this Arc). The invitation's own `inviter` field, however,
    // uses the REAL account pubkey (`signingAuthority.publicIdentityForAccount()`
    // — the SAME proven-working mechanism `resolveFedosConversationTransportRoute()`
    // itself already uses) — real, per-account, cryptographically
    // verifiable identity is what actually matters for a genuine
    // cross-profile invitation's own authenticity, independent of the
    // separate, disclosed Membership-layer degradation.
    const identity = this.#deps.identityResolver.resolveLocalParticipant();
    if (identity.outcome === "unavailable") return { outcome: "identity-unavailable" };
    const localParticipant = identity.creator;

    const realIdentity = await this.#deps.signingAuthority.publicIdentityForAccount(this.#deps.accountIndex);
    if (realIdentity === null) return { outcome: "identity-unavailable" };
    const realLocalParticipant: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: realIdentity.publicKeyHex, identityId: null };

    const requestId = this.#deps.idGenerator.generateRequestId();
    const conversationId = toFedosPrivateConversationId("direct", requestId);
    const now = this.#deps.clock();

    const ownerAdmission = this.#deps.membershipAuthority.admit(conversationId, localParticipant, "owner", now);
    if (ownerAdmission.outcome !== "admitted" && ownerAdmission.outcome !== "already-present") return { outcome: "membership-admission-failed" };
    const inviteeAdmission = this.#deps.membershipAuthority.admit(conversationId, invitee, "member", now);
    if (inviteeAdmission.outcome !== "admitted" && inviteeAdmission.outcome !== "already-present") return { outcome: "membership-admission-failed" };

    const bootstrap = await this.#deps.reactivateConversation(conversationId);
    // `"activation-failed"` is a disclosed, pre-existing, out-of-scope gap
    // (see `FedosConversationInvitationOutboundOutcome`'s own doc comment)
    // -- NOT a bootstrap failure, since the Draft and both Memberships are
    // already durably persisted by this point regardless. Every OTHER
    // non-success outcome (`conversation-not-found`/`identity-unavailable`/
    // `unauthorized`/`creator-unresolvable`/`invalid-restored-state`/
    // `persistence-failed`) means the bootstrap itself genuinely failed.
    const activated = bootstrap.outcome === "reactivated" || bootstrap.outcome === "already-active";
    if (!activated && bootstrap.outcome !== "activation-failed") {
      return { outcome: "bootstrap-failed", detail: bootstrap.outcome };
    }

    const issuedAt = now;
    const content = {
      conversationId: conversationId as string,
      inviter: realLocalParticipant,
      invitee,
      issuedAt,
      expiresAt: issuedAt + expiresInMs,
      nonce: this.#deps.idGenerator.generateNonce(),
    };
    const canonicalContent = canonicalSerializeFedosConversationInvitationContent(content);
    const accountAuthorization = await authorizeFedosConversationInvitationContent(
      this.#deps.signingAuthority,
      this.#deps.accountIndex,
      issuedAt,
      canonicalContent,
    );
    if (accountAuthorization === null) return { outcome: "signing-unavailable" };

    const invitation: FedosConversationInvitationAdvertisementV1 = { schemaVersion: 1, ...content, accountAuthorization };
    const plaintext = encodeFedosConversationInvitationControlPayload({ schemaVersion: 1, kind: "conversation-invitation", invitation });
    const controlId = `conversation-invitation:${content.nonce}`;
    const sendResult = await this.#deps.sendMailboxNip17Control(controlId, conversationId, plaintext, issuedAt);

    return { outcome: "sent", conversationId, invitation, relayOutcome: sendResult.outcome, activated };
  }
}
