/**
 * Secure Runtime Alpha 1391–1470 — Nostr Private Direct and Pairwise
 * Fanout Delivery Arc. The additive facade `FedosConversationRuntime`
 * exposes as `privateNostrDelivery()` — mirrors
 * `FedosConversationGroupRuntime`'s own "always constructible, safe
 * fail-closed default, never widens an existing method signature"
 * discipline (`../group/fedos_conversation_group_runtime.ts`, Alpha
 * 1365) exactly.
 *
 * Alpha 1440 ("Default Fail-Closed Runtime") — this runtime constructs
 * NO Signing Authority and NO Relay/Publisher of its own (mirrors the
 * Board delivery path's own `config.publisher` precedent, Alpha 610):
 * outbound delivery requires BOTH an injected `signingAuthority` and an
 * injected `publisher`; inbound reception requires only the
 * `signingAuthority` (it never publishes). Omitting either leaves the
 * corresponding method(s) `"unavailable"` — local Direct/Group messaging
 * itself is entirely unaffected (unchanged, frozen coordinators).
 */

import type { FedosConversationMembershipAuthority } from "../../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationIdentityResolver } from "../../encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationLocalAccountIndexAuthority } from "../../encryption/identity/fedos_conversation_local_account_index_authority.js";
import type { FedosConversationMessageEnvelopePersistence } from "../../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationPayloadStorage } from "../../payload_storage/fedos_conversation_payload_storage.js";
import type { FedosConversationDecryptionAuthority } from "../../encryption/fedos_conversation_decryption_authority.js";
import type { FedosConversationDraftPersistence } from "../../construction/fedos_conversation_draft_persistence.js";
import type { FedosConversationActivationPersistence } from "../../activation/fedos_conversation_activation_persistence.js";
import type { FedosConversationEnvelopeIdGenerator } from "../../envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationPayloadIdGenerator } from "../../payload_storage/fedos_conversation_payload_id.js";
import type { FedosGroupMessagePersistence } from "../../group/fedos_group_message.js";
import type { FedosGroupFanoutDeliveryPersistence } from "../../group/fedos_group_fanout_delivery.js";
import type { FedosGroupDirectPathPersistence } from "../../group/fedos_group_direct_path.js";
import type { FedosNostrSigningAuthority } from "../../../nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosValidatedNostrEvent } from "../../../desktop/fedos_validated_nostr_event.js";
import { FedosDeliveryObservationRepository } from "../../../board/observation/fedos_delivery_observation_repository.js";
import type { FedosPrivateNostrDeliveryMode } from "./fedos_private_nostr_delivery_mode.js";
import type { FedosPrivateNostrDeliveryRequestPersistence } from "./fedos_private_nostr_delivery_request.js";
import type { FedosPrivateNostrImportRecordPersistence } from "./fedos_private_nostr_import_record.js";
import type { FedosPrivateNostrDeliveryPublisher } from "./fedos_private_nostr_delivery_publisher.js";
import {
  FedosPrivateNostrOutboundDeliveryCoordinator,
  type FedosPrivateNostrOutboundDeliveryResult,
} from "./fedos_private_nostr_outbound_delivery_coordinator.js";
import {
  FedosPrivateNostrInboundDeliveryCoordinator,
  type FedosPrivateNostrInboundReceiveResult,
} from "./fedos_private_nostr_inbound_delivery_coordinator.js";
import {
  FedosPrivateNostrGroupDeliveryPlanner,
  type FedosPrivateNostrGroupDeliveryResult,
} from "./fedos_private_nostr_group_delivery_planner.js";

export interface FedosPrivateNostrDeliveryCallOptions {
  readonly relayUrls?: readonly string[];
  readonly mode?: FedosPrivateNostrDeliveryMode;
  readonly expiresAt?: number | null;
}

export type FedosPrivateNostrDeliveryUnavailableResult = { readonly outcome: "unavailable" };

export interface FedosConversationPrivateNostrDeliveryRuntimeDependencies {
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly accountIndexAuthority: FedosConversationLocalAccountIndexAuthority;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  readonly decryptionAuthority: FedosConversationDecryptionAuthority;
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly activationPersistence: FedosConversationActivationPersistence;
  readonly envelopeIdGenerator: FedosConversationEnvelopeIdGenerator;
  readonly payloadIdGenerator: FedosConversationPayloadIdGenerator;
  readonly groupMessagePersistence: FedosGroupMessagePersistence;
  readonly groupFanoutDeliveryPersistence: FedosGroupFanoutDeliveryPersistence;
  readonly groupDirectPathPersistence: FedosGroupDirectPathPersistence;
  readonly deliveryRequestPersistence: FedosPrivateNostrDeliveryRequestPersistence;
  readonly importRecordPersistence: FedosPrivateNostrImportRecordPersistence;
  readonly observationRepository: FedosDeliveryObservationRepository;
  /** Optional — omitted, EVERY method below is `"unavailable"` (Alpha 1440). This runtime constructs no Signing Authority of its own. */
  readonly signingAuthority?: FedosNostrSigningAuthority;
  /** Optional — omitted, outbound delivery is `"unavailable"` (inbound reception does not need a Publisher). This runtime constructs no Relay/Publisher of its own. */
  readonly publisher?: FedosPrivateNostrDeliveryPublisher;
  /** Alpha 1434 — the explicit, documented default mode a caller may omit at the call site. */
  readonly defaultMode: FedosPrivateNostrDeliveryMode;
  /** Explicit default Relay destination set a caller may omit at the call site. */
  readonly defaultRelayUrls: readonly string[];
  readonly clock: () => number;
}

export class FedosConversationPrivateNostrDeliveryRuntime {
  readonly #outbound: FedosPrivateNostrOutboundDeliveryCoordinator | null;
  readonly #inbound: FedosPrivateNostrInboundDeliveryCoordinator | null;
  readonly #groupPlanner: FedosPrivateNostrGroupDeliveryPlanner | null;
  readonly #defaultMode: FedosPrivateNostrDeliveryMode;
  readonly #defaultRelayUrls: readonly string[];

  constructor(deps: FedosConversationPrivateNostrDeliveryRuntimeDependencies) {
    this.#defaultMode = deps.defaultMode;
    this.#defaultRelayUrls = deps.defaultRelayUrls;

    if (deps.signingAuthority !== undefined && deps.publisher !== undefined) {
      this.#outbound = new FedosPrivateNostrOutboundDeliveryCoordinator({
        membershipAuthority: deps.membershipAuthority,
        envelopePersistence: deps.envelopePersistence,
        payloadStorage: deps.payloadStorage,
        accountIndexAuthority: deps.accountIndexAuthority,
        signingAuthority: deps.signingAuthority,
        deliveryRequestPersistence: deps.deliveryRequestPersistence,
        observationRepository: deps.observationRepository,
        publisher: deps.publisher,
        clock: deps.clock,
      });
      this.#groupPlanner = new FedosPrivateNostrGroupDeliveryPlanner({
        membershipAuthority: deps.membershipAuthority,
        identityResolver: deps.identityResolver,
        groupMessagePersistence: deps.groupMessagePersistence,
        groupFanoutDeliveryPersistence: deps.groupFanoutDeliveryPersistence,
        groupDirectPathPersistence: deps.groupDirectPathPersistence,
        outboundCoordinator: this.#outbound,
      });
    } else {
      this.#outbound = null;
      this.#groupPlanner = null;
    }

    this.#inbound =
      deps.signingAuthority !== undefined
        ? new FedosPrivateNostrInboundDeliveryCoordinator({
            draftPersistence: deps.draftPersistence,
            activationPersistence: deps.activationPersistence,
            membershipAuthority: deps.membershipAuthority,
            identityResolver: deps.identityResolver,
            accountIndexAuthority: deps.accountIndexAuthority,
            signingAuthority: deps.signingAuthority,
            decryptionAuthority: deps.decryptionAuthority,
            envelopePersistence: deps.envelopePersistence,
            payloadStorage: deps.payloadStorage,
            envelopeIdGenerator: deps.envelopeIdGenerator,
            payloadIdGenerator: deps.payloadIdGenerator,
            importRecordPersistence: deps.importRecordPersistence,
            clock: deps.clock,
          })
        : null;
  }

  async deliverDirectMessage(
    conversationId: string,
    envelopeId: string,
    recipientMembershipId: string,
    options?: FedosPrivateNostrDeliveryCallOptions,
  ): Promise<FedosPrivateNostrOutboundDeliveryResult | FedosPrivateNostrDeliveryUnavailableResult> {
    if (this.#outbound === null) return { outcome: "unavailable" };
    return this.#outbound.deliverEnvelope(conversationId, envelopeId, {
      recipientMembershipId,
      relayUrls: options?.relayUrls ?? this.#defaultRelayUrls,
      mode: options?.mode ?? this.#defaultMode,
      expiresAt: options?.expiresAt ?? null,
    });
  }

  async deliverGroupMessage(
    groupMessageId: string,
    options?: FedosPrivateNostrDeliveryCallOptions,
  ): Promise<FedosPrivateNostrGroupDeliveryResult | FedosPrivateNostrDeliveryUnavailableResult> {
    if (this.#groupPlanner === null) return { outcome: "unavailable" };
    return this.#groupPlanner.deliverGroupMessage(groupMessageId, {
      relayUrls: options?.relayUrls ?? this.#defaultRelayUrls,
      mode: options?.mode ?? this.#defaultMode,
      expiresAt: options?.expiresAt ?? null,
    });
  }

  async receiveInboundEvent(
    event: FedosValidatedNostrEvent,
    relaySource: string | null,
  ): Promise<FedosPrivateNostrInboundReceiveResult | FedosPrivateNostrDeliveryUnavailableResult> {
    if (this.#inbound === null) return { outcome: "unavailable" };
    return this.#inbound.receivePrivateEvent(event, relaySource);
  }
}
