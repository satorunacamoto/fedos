/**
 * Secure Runtime Alpha 5881-5960 (FedOS Signed Recipient Deletion Request
 * Private Transport and Local Policy Integration Arc) — Phases G/H: the
 * narrow recipient-side Acknowledgement Outbound Coordinator.
 *
 * Constructs a signed, encrypted acknowledgement bound to request id,
 * sender/recipient identities, recipient Device, Conversation, target
 * message (via `requestId` correlation — the ack record itself carries
 * no separate `targetEnvelopeId`, matching `5641-5720`'s own closed
 * `FedosDeletionAcknowledgementRecordV1` shape exactly), protocol
 * version, local outcome, applied/retained scopes, and evidence class.
 *
 * This coordinator NEVER decides the outcome/scopes itself — the CALLER
 * (the Runtime facade, `fedos_deletion_request_runtime.ts`, the one place
 * with full context: the real recipient-decision state, the real granted
 * scope, the real `b3b3a6d` execution outcome) supplies an
 * already-computed, already-honest `FedosDeletionAcknowledgementRecordV1`.
 * This keeps `isFedosDeletionAcknowledgementRecordHonest()`'s own
 * overclaim guard meaningful — a construction boundary that invented its
 * own mapping here could not be independently checked against it.
 *
 * Phase H ordering: persist the acknowledgement (Recipient's OWN durable
 * copy) BEFORE publish, select the explicit `"nostr-nip17-v1"` route
 * (never a fallback), retry the exact event (reuses the transport's own
 * Outbox/retry machinery verbatim), record the Relay ACK separately from
 * recipient-side truth (which this coordinator has none of — it is
 * itself the recipient).
 */
import type { FedosConversationId } from "../fedos_conversation_id.js";
import { isWellFormedFedosDeletionAcknowledgementRecordV1, type FedosDeletionAcknowledgementRecordV1 } from "./fedos_deletion_acknowledgement_record.js";
import { isFedosDeletionAcknowledgementRecordHonest } from "./fedos_deletion_acknowledgement_record.js";
import { signFedosDeletionAcknowledgementRecordV1, type FedosSignedDeletionAcknowledgementV1 } from "./fedos_deletion_acknowledgement_signing.js";
import type { FedosNostrSigningAuthority } from "../../adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import type { FedosDeletionAcknowledgementPersistence } from "./fedos_deletion_acknowledgement_persistence.js";
import type { FedosPersistedDeletionAcknowledgementRecordV1 } from "./fedos_persisted_deletion_acknowledgement_record_v1.js";
import { encodeFedosDeletionRequestControlPayload } from "./fedos_deletion_request_control_payload.js";

export interface FedosDeletionAcknowledgementOutboundSendResult {
  readonly outcome: string;
}

export interface FedosDeletionAcknowledgementOutboundDependencies {
  readonly signingAuthority: Pick<FedosNostrSigningAuthority, "signEvent">;
  readonly recipientAccountIndex: number;
  readonly acknowledgementPersistence: FedosDeletionAcknowledgementPersistence;
  readonly clock: () => number;
  readonly sendMailboxNip17Control: (
    controlId: string,
    conversationId: FedosConversationId,
    plaintext: Uint8Array,
    createdAt: number,
  ) => Promise<FedosDeletionAcknowledgementOutboundSendResult>;
}

export type FedosDeletionAcknowledgementOutboundOutcome =
  | { readonly outcome: "published"; readonly relayOutcome: string; readonly signed: FedosSignedDeletionAcknowledgementV1 }
  | { readonly outcome: "invalid-input" | "dishonest-outcome" | "signing-unavailable" | "persistence-failed" | "route-unavailable" };

export class FedosDeletionAcknowledgementOutboundCoordinator {
  readonly #deps: FedosDeletionAcknowledgementOutboundDependencies;

  constructor(deps: FedosDeletionAcknowledgementOutboundDependencies) {
    this.#deps = deps;
  }

  /** `record` and `conversationId` are already fully computed by the caller — this method only signs, persists, and publishes. */
  async publishAcknowledgement(record: FedosDeletionAcknowledgementRecordV1, conversationId: FedosConversationId): Promise<FedosDeletionAcknowledgementOutboundOutcome> {
    if (!isWellFormedFedosDeletionAcknowledgementRecordV1(record)) return { outcome: "invalid-input" };
    if (!isFedosDeletionAcknowledgementRecordHonest(record)) return { outcome: "dishonest-outcome" };

    const signed = await signFedosDeletionAcknowledgementRecordV1(record, {
      signingAuthority: this.#deps.signingAuthority,
      recipientAccountIndex: this.#deps.recipientAccountIndex,
    });
    if (signed === null) return { outcome: "signing-unavailable" };

    // Phase H — persist the Recipient's OWN durable acknowledgement fact BEFORE publish.
    const fact: FedosPersistedDeletionAcknowledgementRecordV1 = {
      schemaVersion: 1,
      requestId: record.requestId,
      acknowledgement: record,
      wireEventId: signed.wireEvent.id,
      recordedAt: this.#deps.clock(),
    };
    const writeResult = this.#deps.acknowledgementPersistence.putRecord(fact);
    if (writeResult === "conflict" || writeResult === "failed") return { outcome: "persistence-failed" };

    const plaintext = encodeFedosDeletionRequestControlPayload({ schemaVersion: 1, kind: "deletion-acknowledgement-v1", acknowledgement: signed });
    // Stable logical id (the request's own `requestId`) reused as the Outbox `controlId` —
    // exact-event retry, never a second logical send for the same acknowledgement.
    const sendResult = await this.#deps.sendMailboxNip17Control(`ack:${record.requestId}`, conversationId, plaintext, record.acknowledgedAt);
    if (sendResult.outcome === "route-unavailable") return { outcome: "route-unavailable" };

    return { outcome: "published", relayOutcome: sendResult.outcome, signed };
  }
}
