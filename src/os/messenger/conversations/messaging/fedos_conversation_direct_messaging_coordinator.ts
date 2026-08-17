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
 *
 * Secure Runtime Alpha 1841-1920 ("NIP-17 Standard Transport Integration
 * and Group Pairwise Delivery Arc") Phase C (Alpha 1842/1843/1844/1850)
 * -- THIS is the exact seam that Arc's own "Plaintext Ownership Decision"
 * names: `plaintext` (below, `new TextEncoder().encode(body)`) is still
 * in scope, right here, immediately after
 * `encryptionCoordinator.encrypt()` returns -- the ONE place in the
 * entire send path plaintext is ever held outside the frozen Encryption
 * Coordinator/Authority. The OPTIONAL `deps.delivery` (Alpha 1844's own
 * "application/Runtime config explicitly selects the route, no
 * heuristic, no fallback") hands that SAME plaintext, ONCE, to
 * `FedosPrivateTransport.sendMailboxNip17()` via a narrow accessor
 * function (never the whole Transport type, mirroring
 * `membershipsForConversation`'s own established discipline elsewhere in
 * this codebase) -- closing the Arc's own named blocker WITHOUT
 * decrypting stored ciphertext, exposing raw Conversation keys, or
 * duplicating Conversation encryption. Omitted `deps.delivery` -> ZERO
 * behavior change from before this Arc.
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
import type { FedosPrivateWireDeliveryQueueOutcome } from "../../adapters/nostr/transport/fedos_private_wire_prepared_delivery.js";
import type { FedosDirectRatchetSendOutcome } from "../ratchet/fedos_direct_ratchet_outbound_integration.js";
import { encodeFedosDirectConversationPlainMessagePayload } from "../../adapters/nostr/conversation_delivery/nip17/fedos_direct_conversation_plain_message_payload.js";
import {
  describeFedosForwardSecrecyRoute,
  type FedosDirectConversationForwardSecrecyRoute,
} from "../ratchet/fedos_direct_conversation_forward_secrecy_route.js";

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

/**
 * Secure Runtime Alpha 1841–1920 Phase C (Alpha 1843/1844) — the
 * narrowest possible accessor a caller supplies to opt a Direct send
 * into ALSO preparing + durably enqueuing a standard NIP-17 delivery.
 * `route` is a closed, explicit, single-value selection (Alpha 1844's
 * own "no heuristic, no fallback" rule) — today the ONLY value is
 * `"nostr-nip17-v1"`; `sendMailboxNip17` is a THUNK a production caller
 * binds to a real `FedosPrivateTransport` instance (never the whole
 * Transport type imported here), mirroring `membershipsForConversation`'s
 * own established "narrow accessor over the whole object" discipline.
 */
export interface FedosConversationDirectMessageDeliveryDependencies {
  readonly route: "nostr-nip17-v1";
  readonly sendMailboxNip17: (
    envelopeId: string,
    conversationId: string,
    plaintext: Uint8Array,
  ) => Promise<FedosPrivateWireDeliveryQueueOutcome>;
}

/**
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — the ratchet-route counterpart of
 * `FedosConversationDirectMessageDeliveryDependencies` above, ADDITIVE and
 * structurally SEPARATE (never a widened `route` union on the existing
 * frozen type — the two routes remain type-level distinguishable, never
 * conflated). `remoteDeviceRef` is explicit, caller/local-policy-selected
 * configuration (Phase B's own "explicit caller/local-policy selection"
 * requirement) — this coordinator never infers which remote Device to
 * target from a display name, array index, or Relay identity.
 * `sendRatchetMailboxNip17` performs the FULL Phase E pipeline (route
 * resolution, session-readiness gate, real Ratchet Core encrypt, durable
 * state commit, ratchet payload construction) internally, opaque to this
 * coordinator, exactly like the static route's own `sendMailboxNip17`
 * thunk is opaque to it.
 */
export interface FedosConversationDirectMessageRatchetDeliveryDependencies {
  readonly route: "nostr-nip17-v1-ratchet";
  readonly remoteDeviceRef: string;
  readonly sendRatchetMailboxNip17: (
    envelopeId: string,
    conversationId: string,
    plaintext: Uint8Array,
  ) => Promise<FedosDirectRatchetSendOutcome>;
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
  /** OPTIONAL — omitted, `sendDirectMessage()` behaves byte-for-byte as before this Arc (local storage only). See this file's own header. */
  readonly delivery?: FedosConversationDirectMessageDeliveryDependencies;
  /**
   * OPTIONAL, and MUTUALLY EXCLUSIVE in practice with `delivery` above —
   * omitted, zero behavior change (Phase M's own "keep existing Direct
   * messaging behavior unchanged unless an explicit ratchet route is
   * selected"). When BOTH are supplied, `ratchetDelivery` takes
   * precedence (the more specific, explicitly-selected route) — this is
   * a caller/local-policy construction-time choice, never a per-message
   * heuristic.
   */
  readonly ratchetDelivery?: FedosConversationDirectMessageRatchetDeliveryDependencies;
  /**
   * FedOS Conversation Forward Secrecy (Phase 1) — OPTIONAL, REPORTING-ONLY.
   *
   * Answers, per conversation and at send time, "did this message get
   * forward secrecy, and if not, exactly why". It NEVER changes which route
   * runs: routing stays governed by `ratchetDelivery`/`delivery` above,
   * byte-for-byte as before. Omitted, `sent-locally` carries no
   * `forwardSecrecy` field at all and every existing caller is unaffected.
   *
   * It exists because the honest answer for an ordinary packaged launch is
   * "no forward secrecy", and before this field that fact was invisible: a
   * legacy static-NIP-17 send and a forward-secret ratchet send produced
   * indistinguishable results. Reporting it is a precondition for fixing
   * it — see `../ratchet/fedos_direct_conversation_forward_secrecy_route.ts`.
   */
  readonly forwardSecrecySelector?: (conversationId: string) => FedosDirectConversationForwardSecrecyRoute;
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
    const result = this.#mapSendOutcome(encryption.outcome, encryption.outcome === "encrypted" ? encryption.envelope.id : undefined);

    // Secure Runtime Alpha 1841–1920 Phase C (Alpha 1842/1843/1850) — the
    // ONE place plaintext is handed to standard NIP-17 preparation,
    // still in scope from the `encrypt()` call above. Local storage
    // ("sent-locally") ALWAYS happens first and independently — a
    // delivery failure here is reported as a SEPARATE fact (Alpha 1851),
    // never downgrades or erases the local-storage outcome.
    //
    // Secure Runtime Alpha 5561–5640 Phase E — `ratchetDelivery`, when
    // configured, takes precedence over the static `delivery` (see this
    // file's own `FedosConversationDirectMessageRatchetDeliveryDependencies`
    // doc comment for why the two are mutually exclusive in practice,
    // never a per-message heuristic). Omitting BOTH leaves this method
    // byte-for-byte unchanged from before this Arc.
    // FedOS Conversation Forward Secrecy (Phase 1) — computed ONCE, before
    // any route runs, and attached to whichever result is returned below.
    // Reporting only: it never selects a route.
    const forwardSecrecy =
      result.outcome === "sent-locally" && this.#deps.forwardSecrecySelector !== undefined
        ? describeFedosForwardSecrecyRoute(this.#deps.forwardSecrecySelector(conversationId))
        : undefined;

    if (result.outcome === "sent-locally" && this.#deps.ratchetDelivery !== undefined) {
      const delivery = await this.#deps.ratchetDelivery.sendRatchetMailboxNip17(result.envelopeId, conversationId, plaintext);
      const route = "direct-ratchet" as const;
      return forwardSecrecy === undefined ? { ...result, delivery, route } : { ...result, delivery, route, forwardSecrecy };
    }
    if (result.outcome === "sent-locally" && this.#deps.delivery !== undefined) {
      // Secure Runtime Alpha 7401-7480 (FedOS Direct Conversation Route
      // Binding and NIP-17 Inbound Isolation Arc) -- the standard route's
      // own wire bytes now carry this Arc's own closed, versioned route
      // binding (`FedosDirectConversationPlainMessagePayloadV1`), never
      // the raw `plaintext` alone. Local storage above is COMPLETELY
      // UNCHANGED (that `plaintext` variable, and everything derived from
      // it before this point, is untouched) -- only the bytes handed to
      // the wire adapter change, mirroring the Ratchet route's own
      // established "structured payload in Rumor content" convention
      // (`fedos_direct_ratchet_nip17_payload.ts`, unmodified) rather than
      // inventing a new one. `recipientAccountRef` is the counterparty's
      // OWN already-real, already-validated Membership participant --
      // never a caller-supplied value.
      const counterpartyMember = this.#deps.membershipAuthority
        .listMemberships(conversationId)
        .find((member) => member.state === "active" && member.id !== localMembership.id);
      if (counterpartyMember === undefined) return { outcome: "unauthorized" };
      const wireBytes = new TextEncoder().encode(
        encodeFedosDirectConversationPlainMessagePayload({
          schemaVersion: 1,
          conversationId,
          senderAccountRef: { authority: identity.creator.authority, publicIdentifier: identity.creator.publicIdentifier, identityId: null },
          recipientAccountRef: {
            authority: counterpartyMember.participant.authority,
            publicIdentifier: counterpartyMember.participant.publicIdentifier,
            identityId: null,
          },
          body,
        }),
      );
      const delivery = await this.#deps.delivery.sendMailboxNip17(result.envelopeId, conversationId, wireBytes);
      const route = "legacy-nip17" as const;
      return forwardSecrecy === undefined ? { ...result, delivery, route } : { ...result, delivery, route, forwardSecrecy };
    }

    if (result.outcome === "sent-locally" && forwardSecrecy !== undefined) return { ...result, forwardSecrecy };
    return result;
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
