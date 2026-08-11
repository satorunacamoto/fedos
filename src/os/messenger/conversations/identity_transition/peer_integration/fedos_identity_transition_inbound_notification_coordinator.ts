/**
 * Secure Runtime Alpha 5961–6040 (FedOS Identity Transition Peer
 * Notification and Ratchet Reset Integration Arc) — Phase E: the narrow
 * Inbound Notification Coordinator.
 *
 * Mirrors `../../ratchet/peer_capability/fedos_ratchet_peer_capability_inbound_coordinator.ts`'s
 * own ordering exactly: classify -> strict schema validation -> real
 * account-signature verification (independent of any unsigned Rumor
 * `pubkey` claim — the caller passes only the already-classified
 * notification) -> recipient account/Device binding -> expiry -> replay/
 * conflict/rollback (via the append-only Peer Observation store's own key
 * discipline, Phase F) -> pure evidence evaluation (the Foundation's own
 * `evaluateFedosIdentityTransitionEvidence()`, reused verbatim) ->
 * durable record -> safe status exposed.
 *
 * NEVER mutates local account/profile identity, Device Registry, or
 * Conversation Membership. NEVER automatically accepts a replacement —
 * `evaluateFedosIdentityTransitionEvidence()`'s own closed outcome
 * (`manual-review-required` unless local policy/manual verification
 * already promotes it) is exposed as-is; promotion to `"accepted"`
 * requires a SEPARATE, explicit `recordLocalDecision()`-style call this
 * coordinator does not itself make.
 *
 * KNOWN, DISCLOSED SCOPE LIMITATION (documented per this Arc's own "Fail
 * Closed over fabrication" instruction, not silently narrowed): Device
 * corroboration evidence embedded in a notification can be
 * cryptographically well-formed (structural checks pass) but this
 * RECEIVING side has no access to the SENDER's own Device Registry, so it
 * cannot confirm the corroborating Device is actually `"trusted"`
 * and-not-revoked on the sender's side (`verifyFedosIdentityTransitionDeviceCorroboration()`
 * requires a `FedosDeviceBindingV1` this coordinator could only obtain
 * from a Registry it does not own). This coordinator therefore treats
 * embedded Device corroborations as INFORMATIONAL ONLY on the receiving
 * side — `deviceCorroborationStatuses` is always passed as `[]` to the
 * evaluator here, never silently upgraded to `"device-corroborated"`
 * purely from the sender's own unverifiable say-so. Cross-account Device
 * attestation is named as future work, not fabricated here.
 */
import type { FedosDeviceBindingAccountRef, FedosDeviceTrustState } from "../../../device/fedos_device_binding.js";
import { isFedosDeviceBindingRevoked } from "../../../device/fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../../../device/persistence/fedos_device_registry_persistence.js";
import { decodeFedosRatchetPeerCapabilityControlPayloadFromContent } from "../../ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.js";
import { verifyFedosRatchetPeerCapabilityAccountAuthorization } from "../../ratchet/peer_capability/fedos_ratchet_peer_capability_authentication.js";
import {
  canonicalSerializeFedosIdentityTransitionNotificationContent,
  reconstructFedosIdentityTransitionRecordFromNotification,
  type FedosIdentityTransitionNotificationV1,
} from "./fedos_identity_transition_notification.js";
import { verifyFedosIdentityTransitionNewKeyProof } from "../fedos_identity_transition_new_key_proof.js";
import { verifyFedosIdentityTransitionContinuityEvidence } from "../fedos_identity_transition_continuity_evidence.js";
import {
  evaluateFedosIdentityTransitionEvidence,
  FEDOS_IDENTITY_TRANSITION_DEFAULT_LOCAL_POLICY,
  type FedosIdentityTransitionEvidenceOutcome,
  type FedosIdentityTransitionLocalPolicy,
} from "../fedos_identity_transition_evidence_evaluation.js";
import { computeFedosIdentityTransitionAcceptanceState, type FedosIdentityTransitionAcceptanceState } from "../fedos_identity_transition_acceptance_state.js";
import type { FedosIdentityTransitionPeerObservationPersistence } from "./persistence/fedos_identity_transition_peer_observation_persistence.js";
import type { FedosIdentityTransitionPeerObservationV1 } from "./fedos_identity_transition_peer_observation.js";

function accountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier && a.identityId === b.identityId;
}

export interface FedosIdentityTransitionInboundDependencies {
  readonly deviceRegistry: FedosDeviceRegistryPersistence;
  readonly localAccountRef: FedosDeviceBindingAccountRef;
  readonly localDeviceRef: string;
  readonly clock: () => number;
  readonly observationPersistence: FedosIdentityTransitionPeerObservationPersistence;
  readonly localPolicy?: FedosIdentityTransitionLocalPolicy;
}

export type FedosIdentityTransitionInboundOutcome =
  | { readonly outcome: "not-identity-transition-payload" }
  | { readonly outcome: "wrong-recipient-account" | "wrong-recipient-device" }
  | { readonly outcome: "local-device-revoked" }
  | { readonly outcome: "bad-account-signature" }
  | { readonly outcome: "expired" }
  | { readonly outcome: "transition-body-mismatch" }
  | { readonly outcome: "persistence-failed" }
  | { readonly outcome: "duplicate" }
  | { readonly outcome: "conflicting-duplicate" }
  | { readonly outcome: "broken-predecessor" }
  | { readonly outcome: "rollback-detected" }
  | { readonly outcome: "cycle-detected" }
  | {
      readonly outcome: "recorded";
      readonly evidenceOutcome: FedosIdentityTransitionEvidenceOutcome;
      readonly acceptanceState: FedosIdentityTransitionAcceptanceState;
    };

export class FedosIdentityTransitionInboundNotificationCoordinator {
  readonly #deps: FedosIdentityTransitionInboundDependencies;

  constructor(deps: FedosIdentityTransitionInboundDependencies) {
    this.#deps = deps;
  }

  /** The ONE inbound entry point for this domain — mirrors the peer-capability Inbound Coordinator's own `importRumorContent()` convention exactly. */
  async importRumorContent(content: string): Promise<FedosIdentityTransitionInboundOutcome> {
    const payload = decodeFedosRatchetPeerCapabilityControlPayloadFromContent(content);
    if (payload === null || payload.kind !== "identity-transition-notification") return { outcome: "not-identity-transition-payload" };
    return this.#importNotification(payload.notification);
  }

  async #importNotification(notification: FedosIdentityTransitionNotificationV1): Promise<FedosIdentityTransitionInboundOutcome> {
    if (!accountRefsEqual(notification.recipientAccountRef, this.#deps.localAccountRef)) return { outcome: "wrong-recipient-account" };
    if (notification.recipientDeviceRef !== this.#deps.localDeviceRef) return { outcome: "wrong-recipient-device" };

    const localBinding = this.#deps.deviceRegistry.getBinding(this.#deps.localDeviceRef);
    if (localBinding !== null && isFedosDeviceBindingRevoked(localBinding)) return { outcome: "local-device-revoked" };

    const canonicalContent = canonicalSerializeFedosIdentityTransitionNotificationContent(notification);
    const verification = await verifyFedosRatchetPeerCapabilityAccountAuthorization(notification.accountAuthorization, canonicalContent);
    if (verification.outcome !== "valid") return { outcome: "bad-account-signature" };
    // The cryptographically-verified signer becomes the authoritative
    // sender identity — `notification.senderAccountRef` is never trusted
    // blind; it must agree with what was actually verified.
    if (verification.accountPublicKeyHex !== notification.senderAccountRef.publicIdentifier) return { outcome: "bad-account-signature" };

    const now = this.#deps.clock();
    if (notification.expiresAt <= now) return { outcome: "expired" };

    const record = reconstructFedosIdentityTransitionRecordFromNotification(notification);
    if (record === null) return { outcome: "transition-body-mismatch" };

    const newKeyProofValid = verifyFedosIdentityTransitionNewKeyProof(record, notification.evidence.newKeyProof);
    const continuityEvidenceStatus =
      notification.evidence.continuityEvidence === null
        ? ("absent" as const)
        : verifyFedosIdentityTransitionContinuityEvidence(record, notification.evidence.continuityEvidence);

    const evidenceOutcome = evaluateFedosIdentityTransitionEvidence({
      structurallyValid: true,
      transitionType: record.transitionType,
      reasonCategory: record.reasonCategory,
      timestampCheck: "ok",
      historyOutcome: "none",
      newKeyProofValid,
      continuityEvidenceStatus,
      // See this file's own header — Device corroboration is
      // informational only on the receiving side.
      deviceCorroborationStatuses: [],
      manualVerificationConfirmed: false,
      localPolicy: this.#deps.localPolicy ?? FEDOS_IDENTITY_TRANSITION_DEFAULT_LOCAL_POLICY,
    });
    const acceptanceStateBeforePersistence = computeFedosIdentityTransitionAcceptanceState(evidenceOutcome, "none");

    const observation: FedosIdentityTransitionPeerObservationV1 = {
      schemaVersion: 1,
      localDeviceRef: this.#deps.localDeviceRef,
      peerAccountRef: notification.senderAccountRef,
      peerDeviceRef: notification.senderDeviceRef,
      transitionId: notification.transitionId,
      oldAccountIdentity: notification.oldAccountIdentity,
      newAccountIdentity: notification.newAccountIdentity,
      oldNostrIdentity: notification.oldNostrIdentity,
      newNostrIdentity: notification.newNostrIdentity,
      revision: notification.revision,
      previousTransitionId: notification.previousTransitionId,
      sourceNotificationId: notification.notificationId,
      evidenceOutcome,
      acceptanceState: acceptanceStateBeforePersistence,
      conflictState: "none",
      observedAt: now,
      expiresAt: notification.expiresAt,
      supersededByTransitionId: null,
    };
    const writeResult = this.#deps.observationPersistence.putObservation(observation);
    if (writeResult === "failed") return { outcome: "persistence-failed" };
    if (writeResult === "already-present") return { outcome: "duplicate" };
    if (writeResult === "conflict") return { outcome: "conflicting-duplicate" };
    if (writeResult === "broken-predecessor") return { outcome: "broken-predecessor" };
    if (writeResult === "rollback-detected") return { outcome: "rollback-detected" };
    if (writeResult === "cycle-detected") return { outcome: "cycle-detected" };

    return { outcome: "recorded", evidenceOutcome, acceptanceState: acceptanceStateBeforePersistence };
  }
}
