/**
 * Secure Runtime Alpha 7081-7160 — the narrow safe facade. Composes the
 * Outbound and Inbound (the mission's own "Acceptance Coordinator")
 * coordinators over one shared Membership authority / received-invitation
 * persistence / clock, mirroring `FedosRatchetPeerCapabilityRuntime`'s own
 * "safe facade over a narrow, injected dependency bundle" shape exactly,
 * as a SIBLING Runtime, never a merge into that frozen class.
 */
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import type { FedosConversationIdentityResolver } from "../encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationReactivationResult } from "../activation/fedos_conversation_reactivation_result.js";
import type { FedosNostrSigningAuthority } from "../../nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosPrivateWireDeliveryQueueOutcome } from "../transport/fedos_private_wire_prepared_delivery.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import {
  FedosConversationInvitationOutboundCoordinator,
  type FedosConversationInvitationIdGenerator,
  type FedosConversationInvitationOutboundOutcome,
} from "./fedos_conversation_invitation_outbound_coordinator.js";
import {
  FedosConversationInvitationInboundCoordinator,
  type FedosConversationInvitationInboundOutcome,
} from "./fedos_conversation_invitation_inbound_coordinator.js";
import type { FedosConversationInvitationReceivedPersistence } from "./persistence/fedos_conversation_invitation_received_persistence.js";

export interface FedosConversationInvitationRuntimeDependencies {
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly localDeviceRef: string;
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly accountIndex: number;
  readonly idGenerator: FedosConversationInvitationIdGenerator;
  readonly clock: () => number;
  readonly receivedPersistence: FedosConversationInvitationReceivedPersistence;
  readonly reactivateConversation: (conversationId: string) => Promise<FedosConversationReactivationResult>;
  readonly sendMailboxNip17Control: (
    controlId: string,
    conversationId: FedosConversationId,
    plaintext: Uint8Array,
    createdAt: number,
  ) => Promise<FedosPrivateWireDeliveryQueueOutcome>;
}

export class FedosConversationInvitationRuntime {
  readonly #outbound: FedosConversationInvitationOutboundCoordinator;
  readonly #inbound: FedosConversationInvitationInboundCoordinator;

  constructor(deps: FedosConversationInvitationRuntimeDependencies) {
    this.#outbound = new FedosConversationInvitationOutboundCoordinator({
      membershipAuthority: deps.membershipAuthority,
      identityResolver: deps.identityResolver,
      signingAuthority: deps.signingAuthority,
      accountIndex: deps.accountIndex,
      idGenerator: deps.idGenerator,
      clock: deps.clock,
      reactivateConversation: deps.reactivateConversation,
      sendMailboxNip17Control: deps.sendMailboxNip17Control,
    });
    this.#inbound = new FedosConversationInvitationInboundCoordinator({
      membershipAuthority: deps.membershipAuthority,
      identityResolver: deps.identityResolver,
      signingAuthority: deps.signingAuthority,
      accountIndex: deps.accountIndex,
      localDeviceRef: deps.localDeviceRef,
      clock: deps.clock,
      receivedPersistence: deps.receivedPersistence,
      reactivateConversation: deps.reactivateConversation,
    });
  }

  /** Creates a brand-new Direct conversation and sends the invitee a real, signed invitation. */
  async createAndSendInvitation(
    invitee: FedosConversationParticipantReference,
    expiresInMs?: number,
  ): Promise<FedosConversationInvitationOutboundOutcome> {
    return this.#outbound.createAndSendInvitation(invitee, expiresInMs);
  }

  /** `content` is the already-unwrapped Rumor's own `content: string` — the ONE inbound dispatch point. */
  async importInvitationPayload(content: string): Promise<FedosConversationInvitationInboundOutcome> {
    return this.#inbound.importRumorContent(content);
  }
}
