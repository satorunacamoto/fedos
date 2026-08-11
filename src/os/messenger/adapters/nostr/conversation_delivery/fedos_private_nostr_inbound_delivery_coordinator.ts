/**
 * Secure Runtime Alpha 1419–1428 (Phase D — Inbound Private Delivery) of
 * the Alpha 1391–1470 Nostr Private Direct and Pairwise Fanout Delivery
 * Arc.
 *
 * `receivePrivateEvent()` is the ONE inbound entry point — an adapter
 * ABOVE the existing, unmodified `validateInboundNostrEvent()`
 * (`../../../desktop/combined_inbound_event_validator.ts`, Alpha 245):
 * this file receives an already-signature-verified `FedosValidatedNostrEvent`,
 * never a raw wire event, and performs no Event ID/signature verification
 * of its own (Alpha 1419's own "do not modify Relay parsing/validation").
 *
 * Pipeline, exactly Alpha 1419 through Alpha 1428 in order:
 *   1. classify by kind (Alpha 1419) — unsupported kind fails closed silently.
 *   2. recipient ownership gate (Alpha 1420) — the event's `p` tag must
 *      name THIS runtime's own resolved signing pubkey; no scan across
 *      unbounded accounts (this coordinator is constructed with exactly
 *      one fixed `localAccountIndex` boundary, mirroring every other
 *      Authority in this codebase's own "fixed, injected, never
 *      inferred" account-index discipline, Alpha 933).
 *   3. duplicate detection (Alpha 1427) — keyed by the event's own
 *      intrinsic NIP-01 `id`, BEFORE any decrypt is attempted.
 *   4. outer wrap validation (Alpha 1421) — `decodeFedosPrivateNostrWirePayload()`;
 *      `content`/tags/timestamp are never trusted as canonical facts.
 *   5. Conversation Resolution (Alpha 1424) — reused,
 *      `fedos_private_nostr_inbound_conversation_resolver.ts`; unmatched
 *      sender is Alpha 1425's own quarantine/drop.
 *   6. unwrap/decrypt (Alpha 1422) — the EXISTING, real
 *      `FedosConversationDecryptionAuthority.decrypt()`, called DIRECTLY
 *      with the wire ciphertext (no cryptography in this file); the wire
 *      payload's own `envelopeId`/`conversationId`/`senderMembershipId`/
 *      `keyEpoch`/`createdAt`/`replyToEnvelopeId`/`suite` are passed
 *      through VERBATIM (the sender's own foreign, opaque values) since
 *      the Alpha 856 associated-data header re-derivation requires
 *      byte-identical inputs to what the sender originally sealed with —
 *      see `fedos_private_nostr_wire_payload.ts`'s own header.
 *   7. Local Import Record + Local Canonical History (Alpha 1426/1428) —
 *      on success, a FRESH local Envelope/Payload pair is written through
 *      the EXISTING `FedosConversationMessageEnvelopePersistence`/
 *      `FedosConversationPayloadStorage` ports (never the sender's
 *      foreign ids) — the received message becomes readable through the
 *      UNMODIFIED `readDirectMessage()`/`listDirectMessages()` exactly
 *      like a locally-sent one. `replyToEnvelopeId` is always `null` on
 *      import (V1 simplification, explicitly documented): the sender's
 *      own `replyToEnvelopeId` inside the wire payload is a FOREIGN id
 *      meaningless in this runtime's own local Envelope-id namespace.
 */

import type { FedosValidatedNostrEvent } from "../../../desktop/fedos_validated_nostr_event.js";
import type { FedosConversationDraftPersistence } from "../../../conversations/construction/fedos_conversation_draft_persistence.js";
import type { FedosConversationActivationPersistence } from "../../../conversations/activation/fedos_conversation_activation_persistence.js";
import type { FedosConversationMembershipAuthority } from "../../../conversations/membership/fedos_conversation_membership_authority.js";
import type { FedosConversationIdentityResolver } from "../../../conversations/encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationLocalAccountIndexAuthority } from "../../../conversations/encryption/identity/fedos_conversation_local_account_index_authority.js";
import type { FedosNostrSigningAuthority } from "../protocol/sign/fedos_nostr_signing_authority.js";
import type { FedosConversationDecryptionAuthority } from "../../../conversations/encryption/fedos_conversation_decryption_authority.js";
import type { FedosConversationMessageEnvelopePersistence } from "../../../conversations/envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import { serializeFedosConversationMessageEnvelope } from "../../../conversations/envelope/persistence/fedos_conversation_message_envelope_codec.js";
import { validateFedosConversationMessageEnvelope } from "../../../conversations/envelope/fedos_conversation_message_envelope_validator.js";
import type { FedosConversationEnvelopeIdGenerator } from "../../../conversations/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationPayloadStorage } from "../../../conversations/payload_storage/fedos_conversation_payload_storage.js";
import { toFedosConversationPayloadId, type FedosConversationPayloadIdGenerator } from "../../../conversations/payload_storage/fedos_conversation_payload_id.js";
import type { FedosConversationId } from "../../../conversations/fedos_conversation_id.js";
import { FEDOS_PRIVATE_NOSTR_DELIVERY_KIND } from "./fedos_private_nostr_delivery_mode.js";
import { decodeFedosPrivateNostrWirePayload } from "./fedos_private_nostr_wire_payload.js";
import { resolveFedosPrivateNostrInboundDirectConversation } from "./fedos_private_nostr_inbound_conversation_resolver.js";
import {
  createFedosPrivateNostrImportRecord,
  type FedosPrivateNostrImportRecordPersistence,
} from "./fedos_private_nostr_import_record.js";

// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";

export type FedosPrivateNostrInboundReceiveResult =
  | { readonly outcome: "imported"; readonly conversationId: string; readonly envelopeId: string }
  | { readonly outcome: "duplicate" }
  | { readonly outcome: "not-private-kind" }
  | { readonly outcome: "not-for-local-identity" }
  | { readonly outcome: "invalid-wire-payload" }
  | { readonly outcome: "unknown-sender" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "decryption-failed" }
  | { readonly outcome: "persistence-failed" };

export interface FedosPrivateNostrInboundDeliveryCoordinatorDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly activationPersistence: FedosConversationActivationPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly accountIndexAuthority: FedosConversationLocalAccountIndexAuthority;
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly decryptionAuthority: FedosConversationDecryptionAuthority;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  readonly envelopeIdGenerator: FedosConversationEnvelopeIdGenerator;
  readonly payloadIdGenerator: FedosConversationPayloadIdGenerator;
  readonly importRecordPersistence: FedosPrivateNostrImportRecordPersistence;
  readonly clock: () => number;
}

export class FedosPrivateNostrInboundDeliveryCoordinator {
  readonly #deps: FedosPrivateNostrInboundDeliveryCoordinatorDependencies;

  constructor(deps: FedosPrivateNostrInboundDeliveryCoordinatorDependencies) {
    this.#deps = deps;
  }

  async receivePrivateEvent(
    event: FedosValidatedNostrEvent,
    relaySource: string | null,
  ): Promise<FedosPrivateNostrInboundReceiveResult> {
    // Alpha 1419 -- classify. Unrecognized kind drops fail closed, silently.
    if (event.kind !== FEDOS_PRIVATE_NOSTR_DELIVERY_KIND) return { outcome: "not-private-kind" };

    // Alpha 1420 -- recipient ownership gate BEFORE any decrypt. Exactly one
    // fixed, injected local account index is ever consulted -- no scan.
    const localAccountIndex = this.#deps.accountIndexAuthority.localAccountIndex();
    const localIdentity = await this.#deps.signingAuthority.publicIdentityForAccount(localAccountIndex);
    if (localIdentity === null) return { outcome: "identity-unavailable" };
    const targetsLocal = event.tags.some((tag) => tag.length >= 2 && tag[0] === "p" && tag[1] === localIdentity.publicKeyHex);
    if (!targetsLocal) return { outcome: "not-for-local-identity" };

    // Alpha 1427 -- duplicate detection BEFORE any decrypt, keyed by the
    // event's own intrinsic, already-signature-verified NIP-01 id.
    const existingImport = this.#deps.importRecordPersistence.getImport(event.id);
    if (existingImport !== null) return { outcome: "duplicate" };

    // Alpha 1421 -- outer wrap validation. content/tags/timestamp are never
    // trusted as canonical Conversation facts beyond this structural check.
    const wirePayload = decodeFedosPrivateNostrWirePayload(event.content);
    if (wirePayload === null) return { outcome: "invalid-wire-payload" };

    // Alpha 1424 -- Conversation Resolution. Never auto-creates a Conversation.
    const resolution = resolveFedosPrivateNostrInboundDirectConversation(
      {
        draftPersistence: this.#deps.draftPersistence,
        activationPersistence: this.#deps.activationPersistence,
        membershipAuthority: this.#deps.membershipAuthority,
        identityResolver: this.#deps.identityResolver,
      },
      event.pubkey,
    );
    if (resolution.outcome === "identity-unavailable") return { outcome: "identity-unavailable" };
    if (resolution.outcome === "unknown-sender") return { outcome: "unknown-sender" }; // Alpha 1425 -- quarantine/drop.

    // Alpha 1422 -- unwrap/decrypt via the EXISTING real Authority; no
    // cryptography in this file. Every field below is the SENDER's own
    // foreign, opaque, verbatim value -- required for AEAD re-derivation
    // (see this file's own header).
    let ciphertext: Uint8Array;
    try {
      ciphertext = Buffer.from(wirePayload.ciphertextBase64, "base64");
    } catch {
      return { outcome: "invalid-wire-payload" };
    }
    const decryption = await this.#deps.decryptionAuthority.decrypt({
      envelopeId: wirePayload.envelopeId as unknown as Parameters<FedosConversationDecryptionAuthority["decrypt"]>[0]["envelopeId"],
      conversationId: wirePayload.conversationId as unknown as FedosConversationId,
      senderMembershipId: wirePayload.senderMembershipId as unknown as Parameters<
        FedosConversationDecryptionAuthority["decrypt"]
      >[0]["senderMembershipId"],
      keyEpoch: wirePayload.keyEpoch,
      createdAt: wirePayload.createdAt,
      replyToEnvelopeId: wirePayload.replyToEnvelopeId as unknown as Parameters<
        FedosConversationDecryptionAuthority["decrypt"]
      >[0]["replyToEnvelopeId"],
      suite: wirePayload.suite,
      ciphertext,
      localAccountIndex,
      counterpartyPublicKeyHex: event.pubkey,
    });
    if (decryption.outcome !== "decrypted") return { outcome: "decryption-failed" };

    // Alpha 1426/1428 -- Local Import Record + Local Canonical History.
    // FRESH local ids -- never the sender's foreign envelopeId/conversationId.
    const localEnvelopeId = this.#deps.envelopeIdGenerator.generateEnvelopeId();
    const localPayloadId = toFedosConversationPayloadId(this.#deps.payloadIdGenerator.generatePayloadId());
    if (localPayloadId === null) return { outcome: "persistence-failed" };
    const now = this.#deps.clock();

    const localPayloadDescriptor = {
      id: localPayloadId,
      conversationId: resolution.conversationId as unknown as FedosConversationId,
      mediaType: "application/octet-stream" as const,
      byteLength: ciphertext.length,
      createdAt: now,
    };
    // NOTE: the payload port stores the DECRYPTED-then-RE-ENCRYPTED-nowhere
    // opaque bytes it is handed; this coordinator hands it the ORIGINAL
    // received ciphertext bytes (never plaintext) -- the local canonical
    // Envelope/Payload pair remains ciphertext-at-rest exactly like a
    // locally-sent message (Alpha 1428's own "persist through existing
    // Envelope/payload boundaries").
    const payloadWrite = this.#deps.payloadStorage.putPayload(localPayloadDescriptor, ciphertext);
    if (payloadWrite === "failed" || payloadWrite === "conflict") return { outcome: "persistence-failed" };

    const localEnvelope = validateFedosConversationMessageEnvelope({
      id: localEnvelopeId,
      conversationId: resolution.conversationId,
      senderMembershipId: resolution.counterpartyMembership.id as unknown as string,
      payloadId: localPayloadId,
      encryptionSuite: wirePayload.suite,
      keyEpoch: wirePayload.keyEpoch,
      createdAt: now,
      replyToEnvelopeId: null,
    });
    if (localEnvelope === null) return { outcome: "invalid-wire-payload" };
    const envelopeWrite = this.#deps.envelopePersistence.putEnvelope(serializeFedosConversationMessageEnvelope(localEnvelope));
    if (envelopeWrite === "failed" || envelopeWrite === "conflict") return { outcome: "persistence-failed" };

    const importRecord = createFedosPrivateNostrImportRecord({
      nostrEventId: event.id,
      conversationId: resolution.conversationId,
      envelopeId: localEnvelopeId,
      relaySource,
      receivedAt: now,
      importResult: "imported",
    });
    if (importRecord === null) return { outcome: "persistence-failed" };
    this.#deps.importRecordPersistence.putImportFact(importRecord);

    return { outcome: "imported", conversationId: resolution.conversationId, envelopeId: localEnvelopeId };
  }
}
