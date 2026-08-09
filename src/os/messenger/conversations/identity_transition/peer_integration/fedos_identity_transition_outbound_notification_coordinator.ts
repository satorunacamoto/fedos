/**
 * Secure Runtime Alpha 5961–6040 (FedOS Identity Transition Peer
 * Notification and Ratchet Reset Integration Arc) — Phase D: the narrow
 * Outbound Notification Coordinator.
 *
 * Mirrors `../../ratchet/peer_capability/fedos_ratchet_peer_capability_outbound_coordinator.ts`'s
 * own ordering and dependency shape EXACTLY: preflight (stopped/local
 * Device revoked/recipient Device unknown) -> structurally+cryptographically
 * validate the caller-supplied transition and its evidence (this
 * coordinator never trusts unverified evidence onto the wire) -> build
 * canonical content -> sign via the SAME
 * `authorizeFedosRatchetPeerCapabilityContent()`/
 * `createFedosRatchetPeerCapabilityDeviceSignature()` primitives (no new
 * signing code) -> encode as the control payload's new
 * `"identity-transition-notification"` kind -> publish through the SAME
 * `sendMailboxNip17Control()` seam, reusing its Outbox/retry/Relay-ACK
 * machinery verbatim.
 *
 * This coordinator receives the transition record and its evidence
 * artifacts as PARAMETERS rather than reaching into
 * `FedosIdentityTransitionFacade`'s own private, process-memory-only
 * draft state (which the Foundation Arc deliberately never exposes via a
 * public getter — Absolute Prohibitions: no raw signature internals in
 * user DTOs) — the caller (this Arc's own Peer Runtime facade, Phase N)
 * already holds them from having just constructed/loaded the transition.
 *
 * Relay ACK (`relayOutcome`) is surfaced as its own field, never
 * conflated with peer import/verification/acceptance/reset — this
 * coordinator has no way to know whether the peer ever imports what it
 * publishes.
 */
import type { FedosDeviceBindingAccountRef } from "../../../../../device/fedos_device_binding.js";
import { isFedosDeviceBindingRevoked } from "../../../../../device/fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../../../../../device/persistence/fedos_device_registry_persistence.js";
import type { FedosConversationId } from "../../../../../conversation/fedos_conversation_id.js";
import type { FedosNostrSigningAuthority } from "../../../../../nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosDeviceSigningKeypair } from "../../../../../device/crypto/fedos_device_signing_keypair.js";
import {
  authorizeFedosRatchetPeerCapabilityContent,
  createFedosRatchetPeerCapabilityDeviceSignature,
} from "../../../../../conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_authentication.js";
import { encodeFedosRatchetPeerCapabilityControlPayload } from "../../../../../conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.js";
import { isWellFormedFedosIdentityTransitionRecordV1, type FedosIdentityTransitionRecordV1 } from "../../../../../conversation/identity_transition/fedos_identity_transition_record.js";
import { fedosIdentityTransitionBodyHash } from "../../../../../conversation/identity_transition/fedos_identity_transition_canonical.js";
import { verifyFedosIdentityTransitionNewKeyProof, type FedosIdentityTransitionNewKeyProofV1 } from "../../../../../conversation/identity_transition/fedos_identity_transition_new_key_proof.js";
import { verifyFedosIdentityTransitionContinuityEvidence, type FedosIdentityTransitionContinuityEvidenceV1 } from "../../../../../conversation/identity_transition/fedos_identity_transition_continuity_evidence.js";
import type { FedosIdentityTransitionDeviceCorroborationV1 } from "../../../../../conversation/identity_transition/fedos_identity_transition_device_corroboration.js";
import {
  FEDOS_IDENTITY_TRANSITION_NOTIFICATION_DEVICE_SIGNATURE_PREFIX,
  FEDOS_IDENTITY_TRANSITION_NOTIFICATION_MAX_DEVICE_CORROBORATIONS,
  canonicalSerializeFedosIdentityTransitionNotificationContent,
  isWellFormedFedosIdentityTransitionNotificationNonce,
  type FedosIdentityTransitionNotificationV1,
} from "../../../../../conversation/identity_transition/peer_integration/fedos_identity_transition_notification.js";

export interface FedosIdentityTransitionNotificationSendResult {
  readonly outcome: "delivered" | "rejected" | "failed" | "later";
}

export interface FedosIdentityTransitionOutboundDependencies {
  readonly deviceRegistry: FedosDeviceRegistryPersistence;
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly accountIndex: number;
  readonly localAccountRef: FedosDeviceBindingAccountRef;
  readonly localDeviceRef: string;
  readonly clock: () => number;
  readonly nonceGenerator: () => string;
  readonly sendMailboxNip17Control: (
    controlId: string,
    conversationId: FedosConversationId,
    plaintext: Uint8Array,
    createdAt: number,
  ) => Promise<FedosIdentityTransitionNotificationSendResult | { readonly outcome: string }>;
}

export type FedosIdentityTransitionOutboundOutcome =
  | { readonly outcome: "published"; readonly relayOutcome: string; readonly notification: FedosIdentityTransitionNotificationV1 }
  | {
      readonly outcome:
        | "runtime-stopped"
        | "local-device-revoked"
        | "recipient-device-unknown"
        | "signing-unavailable"
        | "invalid-input"
        | "transition-invalid"
        | "new-key-proof-invalid"
        | "continuity-evidence-invalid"
        | "too-many-device-corroborations";
    };

export interface FedosIdentityTransitionNotifyParams {
  readonly notificationId: string;
  readonly transitionRecord: FedosIdentityTransitionRecordV1;
  readonly newKeyProof: FedosIdentityTransitionNewKeyProofV1;
  readonly continuityEvidence: FedosIdentityTransitionContinuityEvidenceV1 | null;
  readonly deviceCorroborations: readonly FedosIdentityTransitionDeviceCorroborationV1[];
  readonly recipientAccountRef: FedosDeviceBindingAccountRef;
  readonly recipientDeviceRef: string;
  readonly conversationId: FedosConversationId;
  readonly deviceSigningKeypair?: FedosDeviceSigningKeypair;
}

export class FedosIdentityTransitionOutboundNotificationCoordinator {
  readonly #deps: FedosIdentityTransitionOutboundDependencies;
  #stopped = false;

  constructor(deps: FedosIdentityTransitionOutboundDependencies) {
    this.#deps = deps;
  }

  /** Irreversible — mirrors the peer-capability Outbound Coordinator's own discipline exactly. */
  stop(): void {
    this.#stopped = true;
  }

  #preflight(recipientDeviceRef: string): FedosIdentityTransitionOutboundOutcome | null {
    if (this.#stopped) return { outcome: "runtime-stopped" };
    const localBinding = this.#deps.deviceRegistry.getBinding(this.#deps.localDeviceRef);
    if (localBinding !== null && isFedosDeviceBindingRevoked(localBinding)) return { outcome: "local-device-revoked" };
    const recipientBinding = this.#deps.deviceRegistry.getBinding(recipientDeviceRef);
    if (recipientBinding === null) return { outcome: "recipient-device-unknown" };
    return null;
  }

  async publishTransitionNotification(params: FedosIdentityTransitionNotifyParams): Promise<FedosIdentityTransitionOutboundOutcome> {
    if (typeof params.notificationId !== "string" || params.notificationId.length === 0) return { outcome: "invalid-input" };
    const preflightFailure = this.#preflight(params.recipientDeviceRef);
    if (preflightFailure !== null) return preflightFailure;

    if (!isWellFormedFedosIdentityTransitionRecordV1(params.transitionRecord)) return { outcome: "transition-invalid" };
    if (!verifyFedosIdentityTransitionNewKeyProof(params.transitionRecord, params.newKeyProof)) return { outcome: "new-key-proof-invalid" };
    if (
      params.continuityEvidence !== null &&
      verifyFedosIdentityTransitionContinuityEvidence(params.transitionRecord, params.continuityEvidence) !== "cryptographically-valid"
    ) {
      return { outcome: "continuity-evidence-invalid" };
    }
    if (params.deviceCorroborations.length > FEDOS_IDENTITY_TRANSITION_NOTIFICATION_MAX_DEVICE_CORROBORATIONS) {
      return { outcome: "too-many-device-corroborations" };
    }

    const sentAt = this.#deps.clock();
    const nonce = this.#deps.nonceGenerator();
    if (!isWellFormedFedosIdentityTransitionNotificationNonce(nonce)) return { outcome: "invalid-input" };

    const content = {
      notificationId: params.notificationId,
      transitionId: params.transitionRecord.transitionId,
      oldAccountIdentity: params.transitionRecord.oldAccountIdentity,
      newAccountIdentity: params.transitionRecord.newAccountIdentity,
      oldNostrIdentity: params.transitionRecord.oldNostrIdentity,
      newNostrIdentity: params.transitionRecord.newNostrIdentity,
      reasonCategory: params.transitionRecord.reasonCategory,
      revision: params.transitionRecord.revision,
      previousTransitionId: params.transitionRecord.previousTransitionId,
      transitionBodyHash: fedosIdentityTransitionBodyHash(params.transitionRecord),
      senderAccountRef: this.#deps.localAccountRef,
      senderDeviceRef: this.#deps.localDeviceRef,
      recipientAccountRef: params.recipientAccountRef,
      recipientDeviceRef: params.recipientDeviceRef,
      // These MUST be the transition body's OWN issuedAt/expiresAt
      // (never a fresh message-delivery timestamp) — the receiver
      // reconstructs an equivalent `FedosIdentityTransitionRecordV1` from
      // these exact fields and checks its bodyHash matches
      // `transitionBodyHash`; using any other timestamp here would make
      // that reconstruction, and therefore every evidence verification
      // depending on it, impossible. Message-level delivery timing is
      // `sentAt`, handled entirely by the underlying transport
      // (`sendMailboxNip17Control`'s own `createdAt` parameter below).
      issuedAt: params.transitionRecord.issuedAt,
      expiresAt: params.transitionRecord.expiresAt,
      nonce,
      evidence: {
        newKeyProof: params.newKeyProof,
        continuityEvidence: params.continuityEvidence,
        deviceCorroborations: params.deviceCorroborations,
      },
    };
    const canonicalContent = canonicalSerializeFedosIdentityTransitionNotificationContent(content);
    const accountAuthorization = await authorizeFedosRatchetPeerCapabilityContent(
      this.#deps.signingAuthority,
      this.#deps.accountIndex,
      sentAt,
      canonicalContent,
    );
    if (accountAuthorization === null) return { outcome: "signing-unavailable" };

    const deviceSignatureHex =
      params.deviceSigningKeypair !== undefined
        ? createFedosRatchetPeerCapabilityDeviceSignature(
            params.deviceSigningKeypair,
            FEDOS_IDENTITY_TRANSITION_NOTIFICATION_DEVICE_SIGNATURE_PREFIX,
            canonicalContent,
          )
        : null;

    const notification: FedosIdentityTransitionNotificationV1 = {
      schemaVersion: 1,
      ...content,
      accountAuthorization,
      deviceSignatureHex,
      capabilityVersion: 1,
    };

    const plaintext = encodeFedosRatchetPeerCapabilityControlPayload({
      schemaVersion: 1,
      kind: "identity-transition-notification",
      notification,
    });
    // Stable logical id: the caller-supplied `notificationId` is reused
    // verbatim as the Outbox `controlId` — mirrors the lifecycle
    // notification's own "exact-event retry never mints a second logical
    // send for the same fact" convention.
    const sendResult = await this.#deps.sendMailboxNip17Control(params.notificationId, params.conversationId, plaintext, sentAt);
    return { outcome: "published", relayOutcome: sendResult.outcome, notification };
  }
}
