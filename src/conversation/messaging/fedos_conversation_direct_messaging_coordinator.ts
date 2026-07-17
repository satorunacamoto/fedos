/**
 * Secure Runtime Alpha 1126 ("Message Command Boundary") through Alpha
 * 1143 ("Retention Interaction") — Phases C/D of the Alpha 1111–1180
 * Private Conversation Activation and Direct Messaging Runtime Arc.
 *
 * `sendDirectMessage()`/`readDirectMessage()`/`listDirectMessages()` — the
 * MINIMUM direct-message command surface (Alpha 1126), composed entirely
 * over EXISTING, unmodified machinery:
 *
 *   - `FedosConversationEncryptionCoordinator`/`DecryptionCoordinator`
 *     (Alpha 943/946) own EVERY crypto/Envelope/Payload decision already
 *     — this file duplicates no encryption, no Envelope encoding, no
 *     crash-recovery coordination (the encryption coordinator's own
 *     `prepared -> payload-persisted -> envelope-persisted` log already
 *     satisfies Alpha 1131/1132/1166's "no duplicate send" requirement
 *     with zero new code here).
 *   - `resolveFedosConversationActiveConversation()`
 *     (`../activation/fedos_conversation_active_lookup.ts`) — the ONE
 *     shared "is this Conversation active" answer, never re-derived.
 *   - `FedosPayloadRetentionAuthority` (Alpha 796, unmodified) — enforces
 *     retention on READ (Alpha 1136/1138/1143), a gate the frozen
 *     `FedosConversationDecryptionCoordinator` itself never performs (see
 *     `docs/secure_runtime_alpha_1111_1180_integrated_inventory.md` §6);
 *     this facade closes that gap at the APPLICATION layer rather than
 *     editing that Coordinator's own frozen internals.
 *
 * Alpha 1127's own INPUT restriction is enforced structurally, not by
 * convention: `FedosConversationDirectMessageSendCommand` carries ONLY
 * `conversationId`/`body`/`replyToEnvelopeId` — no sender identity, no
 * Envelope/payload id, no nonce, no account index, no counterparty key,
 * no key epoch, no suite, no lifecycle state, no associated data, no
 * encryption result. `FIXED_DIRECT_MESSAGE_SUITE`/`FIXED_DIRECT_MESSAGE_KEY_EPOCH`
 * below are the ONLY suite/epoch this facade ever selects — resolved
 * internally, matching `FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH`'s
 * own already-adopted "Direct mode never advances past its initial epoch"
 * decision (Alpha 850, unmodified).
 */

import { deserializeFedosConversationMessageEnvelope } from "../envelope/persistence/fedos_conversation_message_envelope_codec.js";
import type { FedosConversationMessageEnvelopePersistence } from "../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationDraftPersistence } from "../construction/fedos_conversation_draft_persistence.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationIdentityResolver } from "../encryption/identity/fedos_conversation_identity_resolver.js";
import type {
  FedosConversationEncryptionCoordinator,
} from "../encryption/fedos_conversation_encryption_coordinator.js";
import type {
  FedosConversationDecryptionCoordinator,
} from "../encryption/fedos_conversation_decryption_coordinator.js";
import type { FedosConversationEnvelopeEncryptionSuite } from "../envelope/fedos_conversation_message_envelope.js";
import { FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH } from "../encryption/fedos_conversation_membership_readiness.js";
import { FedosPayloadRetentionAuthority } from "../retention/fedos_payload_retention_authority.js";
import { toFedosConversationPayloadId, type FedosConversationPayloadId } from "../payload_storage/fedos_conversation_payload_id.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationActivationPersistence } from "../activation/fedos_conversation_activation_persistence.js";
import { resolveFedosConversationActiveConversation } from "../activation/fedos_conversation_active_lookup.js";
import { validateFedosConversationDirectMessageBody } from "./fedos_conversation_direct_message_plaintext_policy.js";
import type { FedosConversationDirectMessageSendResult } from "./fedos_conversation_direct_message_send_result.js";
import type { FedosConversationDirectMessageReadResult } from "./fedos_conversation_direct_message_read_result.js";
import type { FedosConversationDirectMessageSummary } from "./fedos_conversation_direct_message_summary.js";

/** The ONE encryption suite this facade ever selects — never caller-chosen (Alpha 1127). */
export const FIXED_DIRECT_MESSAGE_SUITE: FedosConversationEnvelopeEncryptionSuite = "ChaCha20Poly1305";

export interface FedosConversationDirectMessageSendCommand {
  readonly conversationId: string;
  readonly body: string;
  readonly replyToEnvelopeId: string | null;
}

export interface FedosConversationDirectMessageReadCommand {
  readonly conversationId: string;
  readonly envelopeId: string;
}

export interface FedosConversationDirectMessagingCoordinatorDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly activationPersistence: FedosConversationActivationPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly retentionAuthority: FedosPayloadRetentionAuthority;
  readonly encryptionCoordinator: FedosConversationEncryptionCoordinator;
  readonly decryptionCoordinator: FedosConversationDecryptionCoordinator;
}

export class FedosConversationDirectMessagingCoordinator {
  readonly #deps: FedosConversationDirectMessagingCoordinatorDependencies;

  constructor(deps: FedosConversationDirectMessagingCoordinatorDependencies) {
    this.#deps = deps;
  }

  async sendDirectMessage(command: FedosConversationDirectMessageSendCommand): Promise<FedosConversationDirectMessageSendResult> {
    if (command === null || typeof command !== "object") return { outcome: "invalid-input" };
    if (typeof command.conversationId !== "string" || command.conversationId.length === 0) return { outcome: "invalid-input" };
    const body = validateFedosConversationDirectMessageBody(command.body);
    if (body === null) return { outcome: "invalid-input" };
    if (command.replyToEnvelopeId !== null && (typeof command.replyToEnvelopeId !== "string" || command.replyToEnvelopeId.length === 0)) {
      return { outcome: "invalid-input" };
    }

    const conversationId = command.conversationId as FedosConversationId;
    const active = resolveFedosConversationActiveConversation(this.#deps.draftPersistence, this.#deps.activationPersistence, conversationId);
    if (active.outcome === "not-found") return { outcome: "conversation-not-found" };
    if (active.outcome === "not-active") return { outcome: "conversation-not-active" };

    // Alpha 1130 -- sender authorization: active local Membership required. A
    // caller-supplied identity is never accepted; the local participant is
    // always resolved internally (matching every other coordinator's own
    // "the caller never asserts who they are" discipline).
    const identity = this.#deps.identityResolver.resolveLocalParticipant();
    if (identity.outcome === "unavailable") return { outcome: "identity-unavailable" };
    const localMembership = this.#deps.membershipAuthority.findMembership(conversationId, identity.creator);
    if (localMembership === null || localMembership.state !== "active") return { outcome: "unauthorized" };

    const plaintext = new TextEncoder().encode(body);
    const encryption = await this.#deps.encryptionCoordinator.encrypt({
      conversationId,
      plaintext,
      suite: FIXED_DIRECT_MESSAGE_SUITE,
      replyToEnvelopeId: command.replyToEnvelopeId,
    });
    return this.#mapSendOutcome(encryption.outcome, encryption.outcome === "encrypted" ? encryption.envelope.id : undefined);
  }

  async readDirectMessage(command: FedosConversationDirectMessageReadCommand): Promise<FedosConversationDirectMessageReadResult> {
    if (command === null || typeof command !== "object") return { outcome: "invalid-envelope" };
    if (typeof command.conversationId !== "string" || command.conversationId.length === 0) return { outcome: "invalid-envelope" };
    if (typeof command.envelopeId !== "string" || command.envelopeId.length === 0) return { outcome: "invalid-envelope" };

    const conversationId = command.conversationId as FedosConversationId;
    const active = resolveFedosConversationActiveConversation(this.#deps.draftPersistence, this.#deps.activationPersistence, conversationId);
    if (active.outcome === "not-found") return { outcome: "not-found" };
    if (active.outcome === "not-active") return { outcome: "conversation-not-active" };

    // Alpha 1136 -- read authorization: active local Membership required.
    const identity = this.#deps.identityResolver.resolveLocalParticipant();
    if (identity.outcome === "unavailable") return { outcome: "unauthorized" };
    const localMembership = this.#deps.membershipAuthority.findMembership(conversationId, identity.creator);
    if (localMembership === null || localMembership.state !== "active") return { outcome: "unauthorized" };

    // Alpha 1136/1141 -- the Envelope must genuinely belong to THIS
    // Conversation; a wrong-Conversation lookup is denied identically to a
    // missing one (no cross-Conversation existence oracle).
    const persistedEnvelope = this.#deps.envelopePersistence.getEnvelope(command.envelopeId);
    if (persistedEnvelope === null) return { outcome: "not-found" };
    const envelope = deserializeFedosConversationMessageEnvelope(persistedEnvelope);
    if (envelope === null) return { outcome: "invalid-envelope" };
    if (envelope.conversationId !== conversationId) return { outcome: "not-found" };

    // Alpha 1138 step 3 / Alpha 1143 -- retention is enforced HERE, BEFORE
    // any decrypt attempt -- the frozen DecryptionCoordinator itself never
    // performs this check (see this file's own header).
    const payloadId = toFedosConversationPayloadId(envelope.payloadId);
    if (payloadId === null) return { outcome: "invalid-envelope" };
    const access = this.#deps.retentionAuthority.evaluatePayloadAccess(payloadId);
    if (access.outcome === "not-found") return { outcome: "payload-unavailable" };
    if (access.outcome === "denied") return { outcome: "tombstoned" };

    const decryption = await this.#deps.decryptionCoordinator.decrypt({ conversationId, envelopeId: command.envelopeId });
    return this.#mapReadOutcome(decryption);
  }

  /** Alpha 1139 -- safe metadata only; never decrypts. `[]` for an unknown or non-active Conversation. */
  listDirectMessages(conversationId: string): readonly FedosConversationDirectMessageSummary[] {
    if (typeof conversationId !== "string" || conversationId.length === 0) return [];
    const id = conversationId as FedosConversationId;
    const active = resolveFedosConversationActiveConversation(this.#deps.draftPersistence, this.#deps.activationPersistence, id);
    if (active.outcome !== "active") return [];

    const envelopes = [...this.#deps.envelopePersistence.listConversationEnvelopes(id)];
    // Alpha 1133 -- deterministic LOCAL ordering only: createdAt ascending,
    // stable Envelope id tie-break. Never implies protocol/global ordering.
    envelopes.sort((a, b) => (a.createdAt !== b.createdAt ? a.createdAt - b.createdAt : a.id.localeCompare(b.id)));

    return envelopes.map((record) => {
      const payloadId = toFedosConversationPayloadId(record.payloadId);
      const retentionState = payloadId === null ? "active" : this.#retentionStateFor(payloadId);
      return Object.freeze({
        envelopeId: record.id,
        senderMembershipId: record.senderMembershipId,
        createdAt: record.createdAt,
        replyToEnvelopeId: record.replyToEnvelopeId,
        retentionState,
      });
    });
  }

  #retentionStateFor(payloadId: FedosConversationPayloadId): "active" | "tombstoned" | "payload-removed" {
    const access = this.#deps.retentionAuthority.evaluatePayloadAccess(payloadId);
    if (access.outcome === "allowed") return "active";
    if (access.outcome === "denied") return access.state;
    return "active";
  }

  #mapSendOutcome(outcome: string, envelopeId: string | undefined): FedosConversationDirectMessageSendResult {
    switch (outcome) {
      case "encrypted":
        return { outcome: "sent-locally", envelopeId: envelopeId! };
      case "invalid-command":
        return { outcome: "invalid-input" };
      case "conversation-not-found":
        return { outcome: "conversation-not-found" };
      case "conversation-not-active":
        return { outcome: "conversation-not-active" };
      case "not-member":
        return { outcome: "unauthorized" };
      case "identity-unavailable":
        return { outcome: "identity-unavailable" };
      case "no-counterparty":
      case "ambiguous-counterparty":
      case "unsupported-counterparty-authority":
      case "invalid-counterparty-public-key":
      case "identity-binding-unavailable":
      case "identity-binding-mismatch":
        return { outcome: "unauthorized" };
      case "key-unavailable":
        return { outcome: "encryption-unavailable" };
      case "persistence-failed":
        return { outcome: "persistence-failed" };
      default:
        return { outcome: "failed" };
    }
  }

  #mapReadOutcome(
    decryption: Awaited<ReturnType<FedosConversationDecryptionCoordinator["decrypt"]>>,
  ): FedosConversationDirectMessageReadResult {
    switch (decryption.outcome) {
      case "decrypted":
        return { outcome: "decrypted", plaintext: decryption.plaintext };
      case "invalid-command":
      case "unsupported-suite":
      case "unsupported-epoch":
        return { outcome: "invalid-envelope" };
      case "envelope-not-found":
      case "conversation-not-found":
        return { outcome: "not-found" };
      case "conversation-not-active":
        return { outcome: "conversation-not-active" };
      case "payload-not-found":
        return { outcome: "payload-unavailable" };
      case "not-member":
      case "identity-unavailable":
        return { outcome: "unauthorized" };
      case "no-counterparty":
      case "ambiguous-counterparty":
      case "unsupported-counterparty-authority":
      case "invalid-counterparty-public-key":
      case "identity-binding-unavailable":
      case "identity-binding-mismatch":
      case "key-unavailable":
        return { outcome: "key-unavailable" };
      default:
        return { outcome: "failed" };
    }
  }
}

/** Re-exported for callers that need to reason about the fixed epoch this facade always uses. */
export const FIXED_DIRECT_MESSAGE_KEY_EPOCH = FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH;
