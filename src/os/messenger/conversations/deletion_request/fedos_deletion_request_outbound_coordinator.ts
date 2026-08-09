/**
 * Secure Runtime Alpha 5881-5960 (FedOS Signed Recipient Deletion Request
 * Private Transport and Local Policy Integration Arc) — Phase C: the
 * narrow sender-side Outbound Request Coordinator.
 *
 * Required ordering (mission's own Phase C, restated):
 *   1-2. resolve Direct Conversation / target message — the CALLER
 *        supplies `conversationId`/`targetEnvelopeId`; this coordinator
 *        does not itself search for "the" message.
 *   3. verify requester is original author — reuses the EXISTING
 *      `assessFedosDeletionRequestAuthorization()` (`5641-5720`), run
 *      against the just-signed request BEFORE it is ever queued, so a
 *      caller can never accidentally publish a request this Arc's own
 *      later recipient-side evaluation would immediately reject anyway.
 *   4. resolve exact recipient Device/path — `deviceRegistry.getBinding()`,
 *      mirrors `FedosRatchetPeerCapabilityOutboundCoordinator`'s own
 *      `#preflight()` exactly (`d825aa0`).
 *   5. build canonical request / 6. sign with real account authority —
 *      reuses `signFedosDeletionRequestRecordV1()` (`5641-5720`)
 *      unmodified.
 *   7. persist request state — reuses `FedosDeletionRequestStatePersistence`
 *      (`5641-5720`) unmodified, draft -> signed -> pending-delivery.
 *   8-11. select the one explicit private route (`"nostr-nip17-v1"`,
 *      never a fallback) / construct the exact private event / persist
 *      the Outbox fact / publish — all delegated to the EXISTING
 *      `FedosPrivateTransport.sendMailboxNip17Control()` (`1841-1920`),
 *      reusing that seam's own durable Outbox, bounded retry, and
 *      Relay-ACK machinery verbatim, exactly like `d825aa0`'s own
 *      Outbound Coordinator.
 *   12. Relay ACK is surfaced as its own `relayOutcome`, never conflated
 *      with recipient processing (mission's own explicit instruction).
 *
 * Fails closed: denies publish when this coordinator has been
 * `stop()`ped, when the recipient Device has no Device Registry binding
 * on file at all (unknown recipient path), when the recipient Device is
 * known-revoked, when the local sending Device is known-revoked, or when
 * the just-signed request fails its own pre-publish authorship
 * self-check. No route fallback exists — a `"route-unavailable"` outcome
 * from the transport is surfaced as-is, never silently retried on a
 * different route.
 */
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationEnvelopeId } from "../envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationPersistence } from "../persistence/fedos_conversation_persistence.js";
import type { FedosConversationMessageEnvelopePersistence } from "../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantAuthority } from "../membership/fedos_conversation_participant_reference.js";
import type { FedosDeviceRegistryPersistence } from "../../device/persistence/fedos_device_registry_persistence.js";
import { isFedosDeviceBindingRevoked } from "../../device/fedos_device_binding.js";
import type { FedosNostrSigningAuthority } from "../../adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import { isWellFormedFedosDeletionRequestRecordV1, type FedosDeletionRequestRecordV1 } from "./fedos_deletion_request_record.js";
import type { FedosDeletionRequestScope } from "./fedos_deletion_request_scope.js";
import type { FedosDeletionRequestReasonCode } from "./fedos_deletion_request_reason_code.js";
import { generateFedosDeletionRequestId } from "./fedos_deletion_request_id.js";
import { signFedosDeletionRequestRecordV1, type FedosSignedDeletionRequestV1 } from "./fedos_deletion_request_signing.js";
import {
  assessFedosDeletionRequestAuthorization,
  type FedosDeletionRequestAuthorizationAssessmentDependencies,
} from "./fedos_deletion_request_authorization_assessment.js";
import type { FedosDeletionRequestStatePersistence } from "./fedos_deletion_request_state_persistence.js";
import { fedosDeletionRequestBodyHash, type FedosPersistedDeletionRequestStateRecordV1 } from "./fedos_persisted_deletion_request_state_record_v1.js";
import { encodeFedosDeletionRequestControlPayload } from "./fedos_deletion_request_control_payload.js";

export interface FedosDeletionRequestOutboundSendResult {
  readonly outcome: string;
}

export interface FedosDeletionRequestOutboundDependencies {
  readonly conversationPersistence: Pick<FedosConversationPersistence, "getConversation">;
  readonly envelopePersistence: Pick<FedosConversationMessageEnvelopePersistence, "getEnvelope">;
  readonly membershipAuthority: Pick<FedosConversationMembershipAuthority, "findMembership" | "listMemberships">;
  readonly deviceRegistry: FedosDeviceRegistryPersistence;
  readonly signingAuthority: Pick<FedosNostrSigningAuthority, "signEvent">;
  readonly requesterAccountIndex: number;
  /** This sending instance's own opaque, advisory local Device label — `null` if this build tracks no Device identity. */
  readonly localDeviceRef: string | null;
  readonly requestStatePersistence: FedosDeletionRequestStatePersistence;
  readonly clock: () => number;
  /** OPTIONAL — forwarded verbatim to `assessFedosDeletionRequestAuthorization()`'s own pre-publish self-check; omitted, defaults to `"fedos"` (see that file's own header). */
  readonly accountAuthority?: FedosConversationParticipantAuthority;
  readonly sendMailboxNip17Control: (
    controlId: string,
    conversationId: FedosConversationId,
    plaintext: Uint8Array,
    createdAt: number,
  ) => Promise<FedosDeletionRequestOutboundSendResult>;
  readonly idGenerator?: () => string;
}

export interface FedosDeletionRequestCreateParams {
  readonly requesterAccountRef: string;
  readonly recipientAccountRef: string;
  readonly recipientDeviceRef: string;
  readonly conversationId: FedosConversationId;
  readonly targetEnvelopeId: FedosConversationEnvelopeId;
  readonly scope: FedosDeletionRequestScope;
  readonly expiresInSeconds: number;
  readonly reasonCode: FedosDeletionRequestReasonCode | null;
}

export type FedosDeletionRequestOutboundOutcome =
  | { readonly outcome: "published"; readonly requestId: string; readonly relayOutcome: string }
  | {
      readonly outcome:
        | "runtime-stopped"
        | "signing-unavailable"
        | "recipient-device-unknown"
        | "recipient-device-revoked"
        | "local-device-revoked"
        | "not-author"
        | "invalid-input"
        | "persistence-failed"
        | "route-unavailable";
    };

export class FedosDeletionRequestOutboundCoordinator {
  readonly #deps: FedosDeletionRequestOutboundDependencies;
  #stopped = false;

  constructor(deps: FedosDeletionRequestOutboundDependencies) {
    this.#deps = deps;
  }

  /** Irreversible for this instance — mirrors `FedosRatchetPeerCapabilityOutboundCoordinator.stop()`'s own discipline. */
  stop(): void {
    this.#stopped = true;
  }

  #preflight(recipientDeviceRef: string): FedosDeletionRequestOutboundOutcome | null {
    if (this.#stopped) return { outcome: "runtime-stopped" };
    if (this.#deps.localDeviceRef !== null) {
      const localBinding = this.#deps.deviceRegistry.getBinding(this.#deps.localDeviceRef);
      if (localBinding !== null && isFedosDeviceBindingRevoked(localBinding)) return { outcome: "local-device-revoked" };
    }
    const recipientBinding = this.#deps.deviceRegistry.getBinding(recipientDeviceRef);
    if (recipientBinding === null) return { outcome: "recipient-device-unknown" };
    if (isFedosDeviceBindingRevoked(recipientBinding)) return { outcome: "recipient-device-revoked" };
    return null;
  }

  #authorizationDeps(): FedosDeletionRequestAuthorizationAssessmentDependencies {
    return {
      conversationPersistence: this.#deps.conversationPersistence,
      envelopePersistence: this.#deps.envelopePersistence,
      membershipAuthority: this.#deps.membershipAuthority,
      clock: this.#deps.clock,
      // The pre-publish self-check never fails on the OUTBOUND side's own recipientDeviceRef claim
      // — Device binding is the RECIPIENT's own job to assess on import, never the sender's.
      localDeviceRef: null,
      accountAuthority: this.#deps.accountAuthority,
    };
  }

  /** Builds, signs, self-checks, durably persists, and publishes one new logical deletion request. One call = one new `requestId`. */
  async createSignPublishRequest(params: FedosDeletionRequestCreateParams): Promise<FedosDeletionRequestOutboundOutcome & { readonly signed?: FedosSignedDeletionRequestV1 }> {
    const preflightFailure = this.#preflight(params.recipientDeviceRef);
    if (preflightFailure !== null) return preflightFailure;

    const now = this.#deps.clock();
    const requestId = (this.#deps.idGenerator ?? generateFedosDeletionRequestId)();
    const record: FedosDeletionRequestRecordV1 = {
      schemaVersion: 1,
      requestId,
      requesterAccountRef: params.requesterAccountRef,
      requesterDeviceRef: this.#deps.localDeviceRef,
      recipientAccountRef: params.recipientAccountRef,
      recipientDeviceRef: params.recipientDeviceRef,
      conversationId: params.conversationId,
      targetEnvelopeId: params.targetEnvelopeId,
      scope: params.scope,
      issuedAt: now,
      expiresAt: now + params.expiresInSeconds,
      nonce: bytesToHex(randomBytes(16)),
      capabilityVersion: 1,
      reasonCode: params.reasonCode,
    };
    if (!isWellFormedFedosDeletionRequestRecordV1(record)) return { outcome: "invalid-input" };

    const signed = await signFedosDeletionRequestRecordV1(record, {
      signingAuthority: this.#deps.signingAuthority,
      requesterAccountIndex: this.#deps.requesterAccountIndex,
    });
    if (signed === null) return { outcome: "signing-unavailable" };

    // Step 3 — pre-publish authorship self-check, reusing the EXISTING assessment rather than
    // re-deriving authorship logic. Any oracle-prone detail collapses identically for a
    // self-check as it would for a real recipient (this coordinator never publishes a request
    // its own future recipient-side evaluation would immediately reject as "unauthorized").
    const selfAssessment = assessFedosDeletionRequestAuthorization(signed, this.#authorizationDeps());
    if (
      selfAssessment === "requester-not-author" ||
      selfAssessment === "requester-not-member" ||
      selfAssessment === "target-unavailable" ||
      selfAssessment === "conversation-unavailable" ||
      selfAssessment === "recipient-mismatch"
    ) {
      return { outcome: "not-author" };
    }

    const bodyHash = fedosDeletionRequestBodyHash(record);
    const draftSnapshot: FedosPersistedDeletionRequestStateRecordV1 = {
      schemaVersion: 1,
      requestId,
      bodyHash,
      requesterAccountRef: record.requesterAccountRef,
      recipientAccountRef: record.recipientAccountRef,
      recipientDeviceRef: record.recipientDeviceRef,
      conversationId: record.conversationId,
      targetEnvelopeId: record.targetEnvelopeId,
      scope: record.scope,
      lifecycleState: "draft",
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
      retryCount: 0,
      acknowledgementCorrelationId: null,
      recordedAt: now,
    };
    if (this.#deps.requestStatePersistence.putRecord(draftSnapshot) === "failed") return { outcome: "persistence-failed" };
    const signedSnapshot: FedosPersistedDeletionRequestStateRecordV1 = { ...draftSnapshot, lifecycleState: "signed", recordedAt: now };
    if (this.#deps.requestStatePersistence.putRecord(signedSnapshot) === "failed") return { outcome: "persistence-failed" };

    const plaintext = encodeFedosDeletionRequestControlPayload({ schemaVersion: 1, kind: "deletion-request-v1", request: signed });
    // Stable logical request id reused verbatim as the Outbox `controlId` — exact-event retry
    // never mints a second logical send for the same request (mirrors `d825aa0`'s own
    // `publishDeviceLifecycleNotification()` discipline).
    const sendResult = await this.#deps.sendMailboxNip17Control(requestId, params.conversationId, plaintext, now);
    if (sendResult.outcome === "route-unavailable") return { outcome: "route-unavailable" };

    const pendingSnapshot: FedosPersistedDeletionRequestStateRecordV1 = { ...signedSnapshot, lifecycleState: "pending-delivery", recordedAt: now };
    this.#deps.requestStatePersistence.putRecord(pendingSnapshot);

    return { outcome: "published", requestId, relayOutcome: sendResult.outcome, signed };
  }
}
