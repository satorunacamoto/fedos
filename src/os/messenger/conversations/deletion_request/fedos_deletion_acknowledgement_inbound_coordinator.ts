/**
 * Secure Runtime Alpha 5881-5960 (FedOS Signed Recipient Deletion Request
 * Private Transport and Local Policy Integration Arc) — Phase H
 * (requester side): the narrow Acknowledgement Inbound Coordinator.
 *
 * Required checks, in order:
 *   1. classify (control-payload decode, fail closed on unknown
 *      discriminator/malformed shape).
 *   2. validate/decrypt — signature/content-binding via the EXISTING
 *      `verifyFedosSignedDeletionAcknowledgementV1()` (`5641-5720`,
 *      unmodified): real NIP-01 id self-consistency, real BIP-340
 *      signature validity, and the verified event's own `content` is
 *      byte-identical to the claimed acknowledgement record's own
 *      canonical bytes.
 *   3. correlate exact request id — `FedosDeletionRequestStatePersistence.getRecord()`,
 *      `"unknown-request"` if none exists (never a target-existence
 *      oracle beyond what the requester's own local state already proves
 *      it sent). `FedosDeletionAcknowledgementRecordV1` (`5641-5720`)
 *      carries NO `conversationId` of its own — `requestId` correlation
 *      against the durable OUTBOUND request snapshot IS this file's own
 *      Conversation-binding proof, never a second, wire-supplied claim.
 *   4. reject wrong target/Device — recipient-account mismatch and
 *      (advisory) recipient-Device mismatch against the persisted
 *      request snapshot's own `recipientAccountRef`/`recipientDeviceRef`
 *      (`5881-5960`'s own additive field — see that file's header). No
 *      deeper Nostr-pubkey-to-account binding is attempted, per
 *      `5641-5720`'s own documented, unrevised modeling choice
 *      (`fedos_deletion_request_authorization_assessment.ts`'s own
 *      header) — applied identically on the acknowledgement side for
 *      consistency, never invented fresh here.
 *   5. persist durable acknowledgement state — reuses
 *      `FedosDeletionAcknowledgementPersistence` (`5641-5720`) unmodified.
 *   6. expose safe aggregate status — `safeStatusForFedosDeletionRequestLifecycle()`
 *      (`5641-5720`) unmodified.
 *
 * Never marks remote deletion successful from Relay ACK alone — Relay
 * ACK is this Coordinator's caller's own separate concern
 * (`FedosPrivateTransport`'s own Outbox/observation machinery); this file
 * only ever runs on an actually-received, actually-verified
 * acknowledgement payload.
 */
import { decodeFedosDeletionRequestControlPayloadFromContent } from "../../../../conversation/deletion_request/fedos_deletion_request_control_payload.js";
import { verifyFedosSignedDeletionAcknowledgementV1 } from "../../../../conversation/deletion_request/fedos_deletion_acknowledgement_signing.js";
import type { FedosDeletionAcknowledgementPersistence } from "../../../../conversation/deletion_request/fedos_deletion_acknowledgement_persistence.js";
import type { FedosPersistedDeletionAcknowledgementRecordV1 } from "../../../../conversation/deletion_request/fedos_persisted_deletion_acknowledgement_record_v1.js";
import type { FedosDeletionRequestStatePersistence } from "../../../../conversation/deletion_request/fedos_deletion_request_state_persistence.js";
import type { FedosPersistedDeletionRequestStateRecordV1 } from "../../../../conversation/deletion_request/fedos_persisted_deletion_request_state_record_v1.js";
import type { FedosDeletionRequestLifecycleState } from "../../../../conversation/deletion_request/fedos_deletion_request_lifecycle_state.js";
import { safeStatusForFedosDeletionRequestLifecycle, type FedosDeletionRequestSafeStatus } from "../../../../conversation/deletion_request/fedos_deletion_request_safe_status.js";

export interface FedosDeletionAcknowledgementInboundDependencies {
  readonly requestStatePersistence: FedosDeletionRequestStatePersistence;
  readonly acknowledgementPersistence: FedosDeletionAcknowledgementPersistence;
  readonly clock: () => number;
}

export type FedosDeletionAcknowledgementInboundOutcome =
  | { readonly outcome: "not-deletion-acknowledgement-payload" }
  | { readonly outcome: "bad-signature" | "unknown-request" | "wrong-recipient-account" | "wrong-recipient-device" }
  | { readonly outcome: "duplicate" | "conflicting-duplicate" | "persistence-failed" }
  | { readonly outcome: "recorded"; readonly requestId: string; readonly safeStatus: FedosDeletionRequestSafeStatus };

/** Advances a request snapshot through every intermediate live-transport state a real receive implies, one valid transition at a time — never a single illegal jump straight to `"acknowledged"`. */
function advanceThroughLiveStates(
  persistence: FedosDeletionRequestStatePersistence,
  latest: FedosPersistedDeletionRequestStateRecordV1,
  clock: () => number,
): FedosPersistedDeletionRequestStateRecordV1 {
  const chain: readonly { readonly from: FedosDeletionRequestLifecycleState; readonly to: FedosDeletionRequestLifecycleState }[] = [
    { from: "signed", to: "pending-delivery" },
    { from: "pending-delivery", to: "delivered" },
    { from: "delivered", to: "recipient-evaluating" },
  ];
  let current = latest;
  for (const step of chain) {
    if (current.lifecycleState !== step.from) continue;
    const snapshot: FedosPersistedDeletionRequestStateRecordV1 = { ...current, lifecycleState: step.to, recordedAt: clock() };
    const result = persistence.putRecord(snapshot);
    if (result === "inserted" || result === "already-present") current = persistence.getRecord(current.requestId) ?? current;
  }
  return current;
}

export class FedosDeletionAcknowledgementInboundCoordinator {
  readonly #deps: FedosDeletionAcknowledgementInboundDependencies;

  constructor(deps: FedosDeletionAcknowledgementInboundDependencies) {
    this.#deps = deps;
  }

  /** `content` is the already-unwrapped Rumor's own `content: string` — the ONE inbound dispatch point. */
  async importAcknowledgementPayload(content: string): Promise<FedosDeletionAcknowledgementInboundOutcome> {
    const payload = decodeFedosDeletionRequestControlPayloadFromContent(content);
    if (payload === null || payload.kind !== "deletion-acknowledgement-v1") return { outcome: "not-deletion-acknowledgement-payload" };
    const signed = payload.acknowledgement;

    if (!verifyFedosSignedDeletionAcknowledgementV1(signed)) return { outcome: "bad-signature" };

    const requestId = signed.record.requestId;
    const requestState = this.#deps.requestStatePersistence.getRecord(requestId);
    if (requestState === null) return { outcome: "unknown-request" };
    if (requestState.recipientAccountRef !== signed.record.recipientAccountRef) return { outcome: "wrong-recipient-account" };
    if (
      requestState.recipientDeviceRef !== null &&
      signed.record.recipientDeviceRef !== null &&
      requestState.recipientDeviceRef !== signed.record.recipientDeviceRef
    ) {
      return { outcome: "wrong-recipient-device" };
    }

    const fact: FedosPersistedDeletionAcknowledgementRecordV1 = {
      schemaVersion: 1,
      requestId,
      acknowledgement: signed.record,
      wireEventId: signed.wireEvent.id,
      recordedAt: this.#deps.clock(),
    };
    const writeResult = this.#deps.acknowledgementPersistence.putRecord(fact);
    if (writeResult === "already-present") return { outcome: "duplicate" };
    if (writeResult === "conflict") return { outcome: "conflicting-duplicate" };
    if (writeResult === "failed") return { outcome: "persistence-failed" };

    const advanced = advanceThroughLiveStates(this.#deps.requestStatePersistence, requestState, this.#deps.clock);
    if (advanced.lifecycleState === "recipient-evaluating") {
      const acknowledgedSnapshot: FedosPersistedDeletionRequestStateRecordV1 = {
        ...advanced,
        lifecycleState: "acknowledged",
        acknowledgementCorrelationId: signed.wireEvent.id,
        recordedAt: this.#deps.clock(),
      };
      this.#deps.requestStatePersistence.putRecord(acknowledgedSnapshot);
    }

    const safeStatus = safeStatusForFedosDeletionRequestLifecycle("acknowledged", signed.record.outcome);
    return { outcome: "recorded", requestId, safeStatus };
  }
}
