/**
 * Secure Runtime Alpha 1841–1920 ("NIP-17 Standard Transport Integration
 * and Group Pairwise Delivery Arc") Phase D (Alpha 1856–1861) — Direct
 * Inbound for the standard `nostr-nip17-v1` route.
 *
 * `receiveRumor()` is the ONE inbound entry point for an ALREADY fully
 * unwrapped, fully authenticated Rumor (`FedosPrivateWireParsedRumor`,
 * `../../../transport/fedos_private_wire_adapter.ts`) — the caller
 * (an inbound subscription dispatching through `NostrNip17V1WireAdapter.parse()`)
 * has already done Gift-Wrap-signature verification, NIP-44 Seal
 * decryption, and inner-Rumor structural validation (Alpha 1858: "no
 * TypeScript-side crypto beyond calling the reviewed Authority
 * boundary" — this file performs none either, beyond the SAME
 * `FedosConversationEncryptionAuthority.encrypt()` boundary Alpha 861
 * already reviewed).
 *
 * Modeled DIRECTLY on `FedosPrivateNostrInboundDeliveryCoordinator`
 * (`../fedos_private_nostr_inbound_delivery_coordinator.ts`, Alpha
 * 1419–1428) — the SAME pipeline shape, reusing its own Conversation
 * Resolution function (`resolveFedosPrivateNostrInboundDirectConversation()`,
 * UNCHANGED) verbatim. The ONE genuine difference: that proprietary
 * coordinator stores the received WIRE CIPHERTEXT verbatim (it already
 * IS FedOS AEAD ciphertext, decryptable later by the unmodified
 * `FedosConversationDecryptionAuthority`). A NIP-17 Rumor's own
 * `.content` is PLAIN TEXT (NIP-17's own requirement) — there is no
 * FedOS ciphertext form for it. Alpha 1860 ("import once into EXISTING
 * Envelope/Payload/Conversation stores") is satisfied here by calling
 * the SAME, already-reviewed `FedosConversationEncryptionAuthority.encrypt()`
 * (Alpha 861/863/870, UNCHANGED) directly — exactly the reviewed
 * boundary the proprietary coordinator's own header names for its
 * OUTBOUND analog — to re-seal the plaintext for LOCAL storage-at-rest
 * ONLY, attributed to the COUNTERPARTY as sender (an explicit,
 * caller-supplied `senderMembershipId`, never the local user's own).
 * This is NOT "duplicating Conversation encryption" (an absolute
 * prohibition this Arc names): it is the SAME local storage-at-rest
 * mechanism every OTHER Envelope in this Conversation already uses,
 * applied once, locally, to content this runtime has ALREADY verified
 * end-to-end over the wire via real NIP-44/NIP-59 crypto — the
 * resulting local envelope is transparently readable through the
 * EXISTING, UNMODIFIED `readDirectMessage()`/`decryptionCoordinator.decrypt()`
 * path with ZERO changes to either.
 *
 * Alpha 1861 (Dedup identity) — keyed by the Rumor's OWN NIP-01 `id`
 * (`rumor.envelopeId` — see `FedosPrivateWireParsedRumor`'s own doc
 * comment: "the Rumor's own id... even though the Rumor itself is
 * never signed"), NEVER the outer Gift Wrap's own event id. This is the
 * canonical dedup identity across: the same Gift Wrap from two Relays
 * (Multi-Relay fan-out + `FedosRelayEventDeduplicator` already collapse
 * this before this file is ever reached), a re-wrap of the identical
 * Rumor inside a DIFFERENT Gift Wrap (a different outer event id, a
 * different ephemeral key, but the SAME inner Rumor id) — the Rumor id
 * is the one thing invariant across every legitimate re-delivery of
 * "the same logical message."
 *
 * Alpha 1859 (Admission Gate) — NEVER auto-creates a Conversation or
 * Membership; an unmatched sender is quarantined/dropped
 * (`"unknown-sender"`), identically to the proprietary route.
 *
 * Secure Runtime Alpha 7401-7480 (FedOS Direct Conversation Route Binding
 * and NIP-17 Inbound Isolation Arc) — the admission gate above is now
 * PRIMARILY the route binding this Arc's own outbound wiring attaches
 * (`fedos_direct_conversation_plain_message_payload.ts`): the exact
 * Conversation is resolved DIRECTLY from the binding's own
 * `conversationId` (`resolveFedosDirectConversationByRouteBinding()`,
 * `../fedos_direct_conversation_route_binding_resolver.ts`), never from
 * sender pubkey alone. `resolveFedosPrivateNostrInboundDirectConversation()`
 * (Alpha 1424, UNCHANGED) is retained and reused ONLY for genuinely
 * legacy (undecodable) Rumor content, via
 * `countFedosPrivateNostrInboundLegacyCandidates()`
 * (`../fedos_private_nostr_inbound_legacy_candidate_count.ts`) — accepted
 * only when EXACTLY ONE candidate exists, else failing closed as
 * `"ambiguous-legacy-route"` — see this Arc's own Legacy and Migration
 * Policy doc. Real, fresh reproduction of the defect this closes:
 * `test/secure_runtime_alpha_7401_7480_route_binding_defect_reproduction.test.ts`.
 */

import type { FedosConversationDraftPersistence } from "../../../../conversations/construction/fedos_conversation_draft_persistence.js";
import type { FedosConversationActivationPersistence } from "../../../../conversations/activation/fedos_conversation_activation_persistence.js";
import type { FedosConversationMembershipAuthority } from "../../../../conversations/membership/fedos_conversation_membership_authority.js";
import type { FedosConversationIdentityResolver } from "../../../../conversations/encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationEncryptionAuthority } from "../../../../conversations/encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationMessageEnvelopePersistence } from "../../../../conversations/envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import { serializeFedosConversationMessageEnvelope } from "../../../../conversations/envelope/persistence/fedos_conversation_message_envelope_codec.js";
import { validateFedosConversationMessageEnvelope } from "../../../../conversations/envelope/fedos_conversation_message_envelope_validator.js";
import {
  toFedosConversationEnvelopeId,
  type FedosConversationEnvelopeIdGenerator,
} from "../../../../conversations/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationPayloadStorage } from "../../../../conversations/payload_storage/fedos_conversation_payload_storage.js";
import { toFedosConversationPayloadId, type FedosConversationPayloadIdGenerator } from "../../../../conversations/payload_storage/fedos_conversation_payload_id.js";
import type { FedosConversationId } from "../../../../conversations/fedos_conversation_id.js";
import type { FedosConversationMembership } from "../../../../conversations/membership/fedos_conversation_membership.js";
import { FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH } from "../../../../conversations/encryption/fedos_conversation_membership_readiness.js";
import { resolveFedosDirectConversationByRouteBinding } from "../fedos_direct_conversation_route_binding_resolver.js";
import { countFedosPrivateNostrInboundLegacyCandidates } from "../fedos_private_nostr_inbound_legacy_candidate_count.js";
import { decodeFedosDirectConversationPlainMessagePayload } from "./fedos_direct_conversation_plain_message_payload.js";
import {
  createFedosPrivateNostrImportRecord,
  type FedosPrivateNostrImportRecordPersistence,
} from "../fedos_private_nostr_import_record.js";
import type { FedosPrivateWireParsedRumor } from "../../transport/fedos_private_wire_adapter.js";

export type FedosNip17InboundReceiveResult =
  | { readonly outcome: "imported"; readonly conversationId: string; readonly envelopeId: string }
  | { readonly outcome: "duplicate" }
  | { readonly outcome: "unknown-sender" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "invalid-rumor" }
  | { readonly outcome: "encryption-failed" }
  | { readonly outcome: "persistence-failed" }
  /** Secure Runtime Alpha 7401-7480 -- a well-formed JSON object was present but failed this Arc's own strict, closed route-binding shape validator. Fails closed; NEVER falls through to the legacy peer-only path (something was clearly attempted and is broken/tampered, unlike genuinely absent legacy plaintext). */
  | { readonly outcome: "malformed-binding" }
  /** Secure Runtime Alpha 7401-7480 -- the binding named a Conversation this Runtime has no active `direct` record for at all. */
  | { readonly outcome: "unknown-conversation" }
  /** Secure Runtime Alpha 7401-7480 -- the named Conversation exists and is active, but the sender is not a genuine active Member of THAT EXACT Conversation. */
  | { readonly outcome: "membership-denied" }
  /** Secure Runtime Alpha 7401-7480 -- no route binding was present (genuinely pre-existing legacy plaintext) AND two or more active Direct conversations with this sender exist locally -- fails closed rather than guessing among them (see the Legacy and Migration Policy doc). */
  | { readonly outcome: "ambiguous-legacy-route" };

export interface FedosNip17InboundImportCoordinatorDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly activationPersistence: FedosConversationActivationPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly localAccountIndex: number;
  readonly encryptionAuthority: FedosConversationEncryptionAuthority;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  readonly envelopeIdGenerator: FedosConversationEnvelopeIdGenerator;
  readonly payloadIdGenerator: FedosConversationPayloadIdGenerator;
  readonly importRecordPersistence: FedosPrivateNostrImportRecordPersistence;
  readonly clock: () => number;
}

export class FedosNip17InboundImportCoordinator {
  readonly #deps: FedosNip17InboundImportCoordinatorDependencies;

  constructor(deps: FedosNip17InboundImportCoordinatorDependencies) {
    this.#deps = deps;
  }

  async receiveRumor(rumor: FedosPrivateWireParsedRumor, relaySource: string | null): Promise<FedosNip17InboundReceiveResult> {
    if (typeof rumor.envelopeId !== "string" || rumor.envelopeId.length === 0) return { outcome: "invalid-rumor" };
    if (typeof rumor.senderPublicKeyHex !== "string" || rumor.senderPublicKeyHex.length === 0) return { outcome: "invalid-rumor" };
    if (typeof rumor.content !== "string") return { outcome: "invalid-rumor" };

    // Alpha 1861 -- dedup BEFORE any decrypt/re-encrypt, keyed by the
    // Rumor's OWN id -- stable across re-wraps in a different Gift Wrap.
    const existingImport = this.#deps.importRecordPersistence.getImport(rumor.envelopeId);
    if (existingImport !== null) return { outcome: "duplicate" };

    // Secure Runtime Alpha 7401-7480 -- Phase H: the route binding is now
    // the PRIMARY admission gate. A well-formed binding (produced by
    // this Arc's own outbound wiring, `fedos_conversation_direct_messaging_coordinator.ts`)
    // resolves the exact Conversation DIRECTLY -- never a peer-only scan.
    // A malformed (but present) binding fails closed WITHOUT ever falling
    // through to the legacy path (Phase I). Only genuinely ABSENT binding
    // content (pre-existing, unbound plaintext) reaches the bounded
    // legacy fallback below.
    const decoded = decodeFedosDirectConversationPlainMessagePayload(rumor.content);
    if (decoded.outcome === "malformed") return { outcome: "malformed-binding" };

    let resolvedConversationId: string;
    let counterpartyMembership: FedosConversationMembership;
    let bodyText: string;

    if (decoded.outcome === "ok") {
      const binding = resolveFedosDirectConversationByRouteBinding(
        {
          draftPersistence: this.#deps.draftPersistence,
          activationPersistence: this.#deps.activationPersistence,
          membershipAuthority: this.#deps.membershipAuthority,
          identityResolver: this.#deps.identityResolver,
        },
        decoded.payload.conversationId,
        rumor.senderPublicKeyHex,
      );
      if (binding.outcome === "identity-unavailable") return { outcome: "identity-unavailable" };
      if (binding.outcome === "unknown-conversation") return { outcome: "unknown-conversation" };
      if (binding.outcome === "membership-denied") return { outcome: "membership-denied" };
      resolvedConversationId = binding.conversationId;
      counterpartyMembership = binding.counterpartyMembership;
      bodyText = decoded.payload.body;
    } else {
      // Alpha 1859 -- the ORIGINAL admission gate, UNMODIFIED, reused
      // verbatim ONLY for this Arc's own bounded Legacy Policy (see the
      // Legacy and Migration Policy doc): zero candidates -> unknown
      // sender; exactly one -> legacy-unambiguous, accepted; two or more
      // -> fails closed as ambiguous, NEVER a first-match guess.
      const counted = countFedosPrivateNostrInboundLegacyCandidates(
        {
          draftPersistence: this.#deps.draftPersistence,
          activationPersistence: this.#deps.activationPersistence,
          membershipAuthority: this.#deps.membershipAuthority,
          identityResolver: this.#deps.identityResolver,
        },
        rumor.senderPublicKeyHex,
      );
      if (counted.outcome === "identity-unavailable") return { outcome: "identity-unavailable" };
      if (counted.candidates.length === 0) return { outcome: "unknown-sender" };
      if (counted.candidates.length > 1) return { outcome: "ambiguous-legacy-route" };
      resolvedConversationId = counted.candidates[0]!.conversationId;
      counterpartyMembership = counted.candidates[0]!.counterpartyMembership;
      bodyText = rumor.content;
    }

    const now = this.#deps.clock();
    const localEnvelopeIdRaw = this.#deps.envelopeIdGenerator.generateEnvelopeId();
    const localEnvelopeId = toFedosConversationEnvelopeId(localEnvelopeIdRaw);
    const localPayloadId = toFedosConversationPayloadId(this.#deps.payloadIdGenerator.generatePayloadId());
    if (localEnvelopeId === null || localPayloadId === null) return { outcome: "persistence-failed" };

    // Alpha 1860 -- local storage-at-rest, via the SAME already-reviewed
    // Authority boundary (Alpha 861/863/870), never a new crypto path.
    // `senderMembershipId` is the COUNTERPARTY's (this is THEIR message),
    // never the local participant's own.
    const plaintext = new TextEncoder().encode(bodyText);
    const conversationId = resolvedConversationId as FedosConversationId;
    const encryption = await this.#deps.encryptionAuthority.encrypt({
      envelopeId: localEnvelopeId,
      conversationId,
      senderMembershipId: counterpartyMembership.id,
      keyEpoch: FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH,
      createdAt: now,
      replyToEnvelopeId: null,
      suite: "ChaCha20Poly1305",
      plaintext,
      localAccountIndex: this.#deps.localAccountIndex,
      counterpartyPublicKeyHex: rumor.senderPublicKeyHex,
    });
    if (encryption.outcome !== "encrypted") return { outcome: "encryption-failed" };

    const localPayloadDescriptor = {
      id: localPayloadId,
      conversationId,
      mediaType: "application/octet-stream" as const,
      byteLength: encryption.ciphertext.length,
      createdAt: now,
    };
    const payloadWrite = this.#deps.payloadStorage.putPayload(localPayloadDescriptor, encryption.ciphertext);
    if (payloadWrite === "failed" || payloadWrite === "conflict") return { outcome: "persistence-failed" };

    const localEnvelope = validateFedosConversationMessageEnvelope({
      id: localEnvelopeId,
      conversationId: resolvedConversationId,
      senderMembershipId: counterpartyMembership.id as unknown as string,
      payloadId: localPayloadId,
      encryptionSuite: "ChaCha20Poly1305",
      keyEpoch: FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH,
      createdAt: now,
      replyToEnvelopeId: null,
    });
    if (localEnvelope === null) return { outcome: "invalid-rumor" };
    const envelopeWrite = this.#deps.envelopePersistence.putEnvelope(serializeFedosConversationMessageEnvelope(localEnvelope));
    if (envelopeWrite === "failed" || envelopeWrite === "conflict") return { outcome: "persistence-failed" };

    const importRecord = createFedosPrivateNostrImportRecord({
      nostrEventId: rumor.envelopeId,
      conversationId: resolvedConversationId,
      envelopeId: localEnvelopeId,
      relaySource,
      receivedAt: now,
      importResult: "imported",
    });
    if (importRecord === null) return { outcome: "persistence-failed" };
    this.#deps.importRecordPersistence.putImportFact(importRecord);

    return { outcome: "imported", conversationId: resolvedConversationId, envelopeId: localEnvelopeId };
  }
}
