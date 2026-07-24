/**
 * Secure Runtime Alpha 7081-7160 — the "Acceptance Coordinator" the
 * mission names. Receives an already-unwrapped Rumor's own
 * `content: string` (the ONE inbound entry point,
 * `FedosConversationRuntime.receiveNip17Rumor()`), classifies it, runs
 * strict schema validation, verifies the real account signature
 * (independent of the Rumor's own UNSIGNED `pubkey` claim — a NIP-59
 * Rumor cannot be authenticated, `rumor.pubkey` is never trusted here,
 * mirroring Peer Capability's own established discipline), checks the
 * invitee identity, checks expiry, checks for a duplicate delivery via
 * the append-only received-invitation store's own idempotent key, admits
 * BOTH parties' memberships locally, and bootstraps the local Draft via
 * the EXISTING, unmodified `reactivateRestoredConversation()`.
 */
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import type { FedosConversationIdentityResolver } from "../encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationReactivationResult } from "../activation/fedos_conversation_reactivation_result.js";
import type { FedosNostrSigningAuthority } from "../../nostr/sign/fedos_nostr_signing_authority.js";
import {
  canonicalSerializeFedosConversationInvitationContent,
  type FedosConversationInvitationAdvertisementV1,
} from "./fedos_conversation_invitation_advertisement.js";
import { decodeFedosConversationInvitationControlPayloadFromContent } from "./fedos_conversation_invitation_control_payload.js";
import { verifyFedosConversationInvitationAccountAuthorization } from "./fedos_conversation_invitation_authentication.js";
import type { FedosConversationInvitationReceivedPersistence } from "./persistence/fedos_conversation_invitation_received_persistence.js";
import type { FedosConversationInvitationReceivedRecordV1 } from "./fedos_conversation_invitation_received_record.js";

export interface FedosConversationInvitationInboundDependencies {
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly accountIndex: number;
  readonly localDeviceRef: string;
  readonly clock: () => number;
  readonly receivedPersistence: FedosConversationInvitationReceivedPersistence;
  /** Narrow callback, never the whole Runtime — see the outbound coordinator's own identical discipline. */
  readonly reactivateConversation: (conversationId: string) => Promise<FedosConversationReactivationResult>;
}

export type FedosConversationInvitationInboundOutcome =
  | { readonly outcome: "not-invitation-payload" }
  | { readonly outcome: "wrong-recipient" }
  | { readonly outcome: "bad-signature" }
  | { readonly outcome: "expired" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "duplicate" }
  | { readonly outcome: "conflicting-duplicate" }
  | { readonly outcome: "membership-admission-failed" }
  | { readonly outcome: "bootstrap-failed"; readonly detail: string }
  | { readonly outcome: "persistence-failed" }
  /** See `FedosConversationInvitationOutboundOutcome`'s own doc comment for exactly what `activated: false` means and why. */
  | { readonly outcome: "accepted"; readonly conversationId: string; readonly activated: boolean };

function participantsEqual(a: FedosConversationParticipantReference, b: FedosConversationParticipantReference): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier;
}

export class FedosConversationInvitationInboundCoordinator {
  readonly #deps: FedosConversationInvitationInboundDependencies;

  constructor(deps: FedosConversationInvitationInboundDependencies) {
    this.#deps = deps;
  }

  /** `"not-invitation-payload"` signals the caller (`FedosConversationRuntime.receiveNip17Rumor()`) to fall through to the next handler. */
  async importRumorContent(content: string): Promise<FedosConversationInvitationInboundOutcome> {
    const payload = decodeFedosConversationInvitationControlPayloadFromContent(content);
    if (payload === null) return { outcome: "not-invitation-payload" };
    return this.#importInvitation(payload.invitation);
  }

  async #importInvitation(record: FedosConversationInvitationAdvertisementV1): Promise<FedosConversationInvitationInboundOutcome> {
    // Secure Runtime Alpha 7081-7160 — see the outbound coordinator's own
    // identical doc comment for exactly why TWO distinct "local identity"
    // sources are used here, deliberately: the REAL, per-account pubkey
    // (`signingAuthority.publicIdentityForAccount()`) is what genuinely
    // proves "this invitation is addressed to ME" — a disclosed,
    // pre-existing gap means `identityResolver` cannot answer that
    // question meaningfully in the current production wiring. The SAME
    // `identityResolver`-derived identity is still used below, separately,
    // ONLY for the local "member" Membership admission, to stay
    // self-consistent with `reactivateRestoredConversation()`'s OWN
    // internal, frozen, `identityResolver`-based membership lookup.
    const realIdentity = await this.#deps.signingAuthority.publicIdentityForAccount(this.#deps.accountIndex);
    if (realIdentity === null) return { outcome: "identity-unavailable" };
    const realLocalParticipant: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: realIdentity.publicKeyHex, identityId: null };
    if (!participantsEqual(record.invitee, realLocalParticipant)) return { outcome: "wrong-recipient" };

    const identity = this.#deps.identityResolver.resolveLocalParticipant();
    if (identity.outcome === "unavailable") return { outcome: "identity-unavailable" };
    const localParticipant = identity.creator;

    const canonicalContent = canonicalSerializeFedosConversationInvitationContent(record);
    const verification = await verifyFedosConversationInvitationAccountAuthorization(record.accountAuthorization, canonicalContent);
    if (verification.outcome !== "valid" || verification.accountPublicKeyHex !== record.inviter.publicIdentifier) {
      return { outcome: "bad-signature" };
    }

    const now = this.#deps.clock();
    if (now >= record.expiresAt) return { outcome: "expired" };

    const receivedRecord: FedosConversationInvitationReceivedRecordV1 = {
      schemaVersion: 1,
      localDeviceRef: this.#deps.localDeviceRef,
      conversationId: record.conversationId,
      inviter: record.inviter,
      invitee: record.invitee,
      nonce: record.nonce,
      acceptedAt: now,
    };
    const writeResult = this.#deps.receivedPersistence.putReceived(receivedRecord);
    if (writeResult === "failed") return { outcome: "persistence-failed" };
    if (writeResult === "conflict") return { outcome: "conflicting-duplicate" };
    if (writeResult === "already-present") return { outcome: "duplicate" };

    const inviterAdmission = this.#deps.membershipAuthority.admit(record.conversationId as never, record.inviter, "owner", record.issuedAt);
    if (inviterAdmission.outcome !== "admitted" && inviterAdmission.outcome !== "already-present") return { outcome: "membership-admission-failed" };
    // Admits the LOCAL (`identityResolver`-derived) identity, NOT
    // `record.invitee` (the real pubkey) -- see this method's own header
    // comment for why: `reactivateRestoredConversation()`'s own internal
    // Step 4b looks up the LOCAL participant via `identityResolver`, so
    // the local "member" Membership row must match that SAME identity for
    // the bootstrap below to find it. The addressing/authenticity check
    // above already proved `record.invitee` really does name this local
    // account's own real pubkey before this point is ever reached.
    const inviteeAdmission = this.#deps.membershipAuthority.admit(record.conversationId as never, localParticipant, "member", record.issuedAt);
    if (inviteeAdmission.outcome !== "admitted" && inviteeAdmission.outcome !== "already-present") return { outcome: "membership-admission-failed" };

    const bootstrap = await this.#deps.reactivateConversation(record.conversationId);
    // See the outbound coordinator's own identical handling/doc comment
    // for exactly why `"activation-failed"` is a disclosed, out-of-scope
    // gap rather than a bootstrap failure -- the Draft and both
    // Memberships are already durably persisted by this point regardless.
    const activated = bootstrap.outcome === "reactivated" || bootstrap.outcome === "already-active";
    if (!activated && bootstrap.outcome !== "activation-failed") {
      return { outcome: "bootstrap-failed", detail: bootstrap.outcome };
    }

    return { outcome: "accepted", conversationId: record.conversationId, activated };
  }
}
