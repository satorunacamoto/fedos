/**
 * Secure Runtime Alpha 5721–5800 — Phase H: the narrow Inbound
 * Coordinator. Receives an already-unwrapped Rumor's own `content: string`
 * (the ONE inbound entry point Phase A identified,
 * `FedosConversationRuntime.receiveNip17Rumor()`), classifies it, runs
 * strict schema validation (Phase F's codec), verifies the real account
 * signature (Phase E — independent of the Rumor's own UNSIGNED `pubkey`
 * claim, per NIP-59's own "a Rumor cannot be authenticated" design;
 * `rumor.pubkey` is never trusted here), checks identity/Device binding,
 * expiry/replay, revision ordering and conflict (via the append-only
 * Observation store's own key discipline), runs the pure Phase J policy,
 * and durably records the observation. It NEVER mutates the Device
 * Registry, NEVER activates a route, and NEVER reveals detailed local
 * capability state to an unauthorized sender (this file emits only a
 * closed outcome enum, never the local `locallySupportedCapabilities`
 * list itself, to the caller of `importRumorContent()`).
 *
 * Known, disclosed scoping simplification: unlike the Ratchet's own
 * `receiveRumor()` attempt, this coordinator does not itself dedup on the
 * Rumor's own envelope id before processing (Phase A's "inherits this
 * exact dedup for free" would require threading the shared
 * `FedosPrivateNostrImportRecordPersistence` through a third call site —
 * deferred, not silently skipped: see this Arc's own completion
 * declaration). A duplicate Relay redelivery of the SAME control payload
 * still re-verifies but always terminates in `"duplicate"` via the
 * Observation store's own idempotent `"already-present"` write result —
 * safe, merely not free.
 */
import type { FedosDeviceBindingAccountRef, FedosDeviceTrustState } from "../../../device/fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../../../device/persistence/fedos_device_registry_persistence.js";
import {
  canonicalSerializeFedosRatchetPeerCapabilityAdvertisementContent,
  FEDOS_RATCHET_PEER_CAPABILITY_ADVERTISEMENT_DEVICE_SIGNATURE_PREFIX,
  type FedosRatchetPeerCapabilityAdvertisementV1,
} from "./fedos_ratchet_peer_capability_advertisement.js";
import {
  canonicalSerializeFedosRatchetPeerLifecycleNotificationContent,
  FEDOS_RATCHET_PEER_LIFECYCLE_NOTIFICATION_DEVICE_SIGNATURE_PREFIX,
  type FedosRatchetPeerLifecycleNotificationV1,
} from "./fedos_ratchet_peer_lifecycle_notification.js";
import { decodeFedosRatchetPeerCapabilityControlPayloadFromContent } from "./fedos_ratchet_peer_capability_control_payload.js";
import {
  evaluateFedosRatchetPeerCapabilityEvidence,
  verifyFedosRatchetPeerCapabilityAccountAuthorization,
  verifyFedosRatchetPeerCapabilityDeviceSignature,
} from "./fedos_ratchet_peer_capability_authentication.js";
import {
  evaluateFedosRatchetPeerCapabilityAcceptance,
  type FedosRatchetPeerCapabilityPriorAcceptedSummary,
} from "./fedos_ratchet_peer_capability_acceptance_policy.js";
import type { FedosRatchetPeerCapabilityAcceptanceOutcome } from "./fedos_ratchet_peer_capability_acceptance_outcome.js";
import {
  recommendFedosRatchetPeerSessionAction,
  type FedosRatchetPeerSessionActionRecommendation,
} from "./fedos_ratchet_peer_capability_session_action_recommendation.js";
import { entriesOfKindRoutes, type FedosRatchetPeerCapabilityEntry, type FedosRatchetPeerCapabilityRoute } from "./fedos_ratchet_peer_capability_vocabulary.js";
import type { FedosRatchetPeerCapabilityObservationPersistence } from "./persistence/fedos_ratchet_peer_capability_observation_persistence.js";
import type { FedosRatchetPeerCapabilityObservationV1 } from "./fedos_ratchet_peer_capability_observation.js";

export interface FedosRatchetPeerCapabilityInboundDependencies {
  readonly deviceRegistry: FedosDeviceRegistryPersistence;
  readonly localAccountRef: FedosDeviceBindingAccountRef;
  readonly localDeviceRef: string;
  readonly clock: () => number;
  readonly observationPersistence: FedosRatchetPeerCapabilityObservationPersistence;
  readonly locallySupportedCapabilities: readonly FedosRatchetPeerCapabilityEntry[];
}

export type FedosRatchetPeerCapabilityInboundOutcome =
  | { readonly outcome: "not-peer-capability-payload" }
  | { readonly outcome: "wrong-recipient-account" | "wrong-recipient-device" }
  | { readonly outcome: "bad-account-signature" }
  | { readonly outcome: "bad-device-proof" }
  | { readonly outcome: "persistence-failed" }
  | { readonly outcome: "duplicate" }
  | { readonly outcome: "conflicting-duplicate" }
  | {
      readonly outcome: "recorded";
      readonly acceptanceOutcome: FedosRatchetPeerCapabilityAcceptanceOutcome;
      readonly recommendation: FedosRatchetPeerSessionActionRecommendation;
    };

function accountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier && a.identityId === b.identityId;
}

export class FedosRatchetPeerCapabilityInboundCoordinator {
  readonly #deps: FedosRatchetPeerCapabilityInboundDependencies;

  constructor(deps: FedosRatchetPeerCapabilityInboundDependencies) {
    this.#deps = deps;
  }

  #trustStateFor(deviceRef: string): { readonly trustState: FedosDeviceTrustState | "unknown"; readonly devicePublicKeyRef: string | null } {
    const binding = this.#deps.deviceRegistry.getBinding(deviceRef);
    if (binding === null) return { trustState: "unknown", devicePublicKeyRef: null };
    return { trustState: binding.trustState, devicePublicKeyRef: binding.devicePublicKeyRef };
  }

  /**
   * Scoped to `sourceKind` -- an advertisement's `revision` and a
   * lifecycle notification's `revision` are INDEPENDENT counters (Phase
   * D's own notifications never share the Advertisement's revision
   * sequence). Mixing them would make an unrelated notification's
   * revision spuriously satisfy (or fail) the Advertisement's own
   * stale/rollback check, and vice versa.
   */
  #priorAccepted(
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
    sourceKind: "advertisement" | "lifecycle-notification",
  ): FedosRatchetPeerCapabilityPriorAcceptedSummary | null {
    const observed = this.#deps.observationPersistence.listObservationsForPeerDevice(this.#deps.localDeviceRef, peerAccountRef, peerDeviceRef);
    let best: FedosRatchetPeerCapabilityObservationV1 | null = null;
    for (const record of observed) {
      if (record.sourceKind !== sourceKind) continue;
      if (record.acceptanceOutcome !== "accepted") continue;
      if (best === null || record.revision > best.revision) best = record;
    }
    return best === null ? null : { revision: best.revision, claimedRoutes: best.claimedRoutes };
  }

  #hasConflictingDuplicateAtSameRevision(
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
    sourceKind: "advertisement" | "lifecycle-notification",
    revision: number,
    sourceId: string,
  ): boolean {
    const observed = this.#deps.observationPersistence.listObservationsForPeerDevice(this.#deps.localDeviceRef, peerAccountRef, peerDeviceRef);
    return observed.some((r) => r.sourceKind === sourceKind && r.revision === revision && r.sourceId !== sourceId);
  }

  /**
   * Exact-nonce replay short-circuit (Phase H's own "expiry/replay check"
   * phase, run BEFORE revision ordering/conflict detection): a resubmission
   * of the SAME `sourceId` (nonce/notificationId) for the SAME subject is
   * always `"duplicate"`, never re-decided by the acceptance policy —
   * mirrors `FedosDirectRatchetSessionResetRecordV1`'s own "keyed by nonce
   * alone, doubles as audit trail and replay ledger" discipline. Without
   * this, replaying the fact a SECOND time would see its own prior
   * acceptance as `priorAccepted` and be re-evaluated as `"stale"`,
   * producing a spurious `"conflict"` write (different `acceptanceOutcome`
   * for the identical, already-recorded fact) instead of a safe no-op.
   */
  #existingObservationForSource(
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
    sourceKind: "advertisement" | "lifecycle-notification",
    sourceId: string,
  ): FedosRatchetPeerCapabilityObservationV1 | null {
    const observed = this.#deps.observationPersistence.listObservationsForPeerDevice(this.#deps.localDeviceRef, peerAccountRef, peerDeviceRef);
    return observed.find((r) => r.sourceKind === sourceKind && r.sourceId === sourceId) ?? null;
  }

  async #importAdvertisement(record: FedosRatchetPeerCapabilityAdvertisementV1): Promise<FedosRatchetPeerCapabilityInboundOutcome> {
    if (!accountRefsEqual(record.recipientAccountRef, this.#deps.localAccountRef)) return { outcome: "wrong-recipient-account" };
    if (record.recipientDeviceRef !== this.#deps.localDeviceRef) return { outcome: "wrong-recipient-device" };

    const canonicalContent = canonicalSerializeFedosRatchetPeerCapabilityAdvertisementContent(record);
    const verification = await verifyFedosRatchetPeerCapabilityAccountAuthorization(record.accountAuthorization, canonicalContent);
    if (verification.outcome !== "valid" || verification.accountPublicKeyHex !== record.senderAccountRef.publicIdentifier) {
      return { outcome: "bad-account-signature" };
    }

    const { trustState, devicePublicKeyRef } = this.#trustStateFor(record.senderDeviceRef);
    let deviceSignatureVerified = false;
    if (record.deviceSignatureHex !== null && devicePublicKeyRef !== null) {
      deviceSignatureVerified = verifyFedosRatchetPeerCapabilityDeviceSignature(
        devicePublicKeyRef,
        FEDOS_RATCHET_PEER_CAPABILITY_ADVERTISEMENT_DEVICE_SIGNATURE_PREFIX,
        canonicalContent,
        record.deviceSignatureHex,
      );
      if (!deviceSignatureVerified) return { outcome: "bad-device-proof" };
    }
    const evidenceLevel = evaluateFedosRatchetPeerCapabilityEvidence(record.deviceSignatureHex, devicePublicKeyRef, deviceSignatureVerified);

    if (this.#existingObservationForSource(record.senderAccountRef, record.senderDeviceRef, "advertisement", record.nonce) !== null) {
      return { outcome: "duplicate" };
    }

    const priorAccepted = this.#priorAccepted(record.senderAccountRef, record.senderDeviceRef, "advertisement");
    const conflicting = this.#hasConflictingDuplicateAtSameRevision(
      record.senderAccountRef,
      record.senderDeviceRef,
      "advertisement",
      record.revision,
      record.nonce,
    );
    const acceptanceOutcome = evaluateFedosRatchetPeerCapabilityAcceptance({
      now: this.#deps.clock(),
      expiresAt: record.expiresAt,
      revision: record.revision,
      evidenceLevel,
      peerDeviceTrustState: trustState,
      claimedCapabilities: record.capabilities,
      locallySupportedCapabilities: this.#deps.locallySupportedCapabilities,
      priorAccepted,
      conflictingDuplicateAtSameRevision: conflicting,
    });

    const observation: FedosRatchetPeerCapabilityObservationV1 = {
      schemaVersion: 1,
      localDeviceRef: this.#deps.localDeviceRef,
      peerAccountRef: record.senderAccountRef,
      peerDeviceRef: record.senderDeviceRef,
      sourceKind: "advertisement",
      sourceId: record.nonce,
      revision: record.revision,
      evidenceLevel,
      acceptanceOutcome,
      supersededSourceId: null,
      observedAt: this.#deps.clock(),
      expiresAt: record.expiresAt,
      claimedRoutes: entriesOfKindRoutes(record.capabilities),
      factKind: null,
    };
    const writeResult = this.#deps.observationPersistence.putObservation(observation);
    if (writeResult === "failed") return { outcome: "persistence-failed" };
    if (writeResult === "conflict") return { outcome: "conflicting-duplicate" };
    if (writeResult === "already-present") return { outcome: "duplicate" };

    return { outcome: "recorded", acceptanceOutcome, recommendation: recommendFedosRatchetPeerSessionAction(acceptanceOutcome, null) };
  }

  async #importNotification(record: FedosRatchetPeerLifecycleNotificationV1): Promise<FedosRatchetPeerCapabilityInboundOutcome> {
    if (!accountRefsEqual(record.targetAccountRef, this.#deps.localAccountRef)) return { outcome: "wrong-recipient-account" };
    if (record.targetDeviceRef !== this.#deps.localDeviceRef) return { outcome: "wrong-recipient-device" };

    const canonicalContent = canonicalSerializeFedosRatchetPeerLifecycleNotificationContent(record);
    const verification = await verifyFedosRatchetPeerCapabilityAccountAuthorization(record.accountAuthorization, canonicalContent);
    if (verification.outcome !== "valid" || verification.accountPublicKeyHex !== record.issuerAccountRef.publicIdentifier) {
      return { outcome: "bad-account-signature" };
    }

    const { trustState, devicePublicKeyRef } = this.#trustStateFor(record.issuerDeviceRef);
    let deviceSignatureVerified = false;
    if (record.deviceSignatureHex !== null && devicePublicKeyRef !== null) {
      deviceSignatureVerified = verifyFedosRatchetPeerCapabilityDeviceSignature(
        devicePublicKeyRef,
        FEDOS_RATCHET_PEER_LIFECYCLE_NOTIFICATION_DEVICE_SIGNATURE_PREFIX,
        canonicalContent,
        record.deviceSignatureHex,
      );
      if (!deviceSignatureVerified) return { outcome: "bad-device-proof" };
    }
    const evidenceLevel = evaluateFedosRatchetPeerCapabilityEvidence(record.deviceSignatureHex, devicePublicKeyRef, deviceSignatureVerified);

    // The observation's own SUBJECT is the AFFECTED Device (what the fact
    // is ABOUT), never the issuer -- an already-trusted Device of an
    // account may announce a fact about a DIFFERENT Device of that SAME
    // account (e.g. Alice's desktop announcing Alice's brand-new tablet,
    // which by definition has no local binding of its own yet). Trust is
    // still gated on the ISSUER's own binding (`trustState` above) --
    // never the affected Device's, which would make every genuine
    // "device-added" fact about a truly new Device unconditionally
    // "untrusted-device".
    if (this.#existingObservationForSource(record.issuerAccountRef, record.affectedDeviceRef, "lifecycle-notification", record.notificationId) !== null) {
      return { outcome: "duplicate" };
    }

    const priorAccepted = this.#priorAccepted(record.issuerAccountRef, record.affectedDeviceRef, "lifecycle-notification");
    const conflicting = this.#hasConflictingDuplicateAtSameRevision(
      record.issuerAccountRef,
      record.affectedDeviceRef,
      "lifecycle-notification",
      record.revision,
      record.notificationId,
    );
    const acceptanceOutcome = evaluateFedosRatchetPeerCapabilityAcceptance({
      now: this.#deps.clock(),
      expiresAt: record.expiresAt,
      revision: record.revision,
      evidenceLevel,
      peerDeviceTrustState: trustState,
      claimedCapabilities: null,
      locallySupportedCapabilities: null,
      priorAccepted,
      conflictingDuplicateAtSameRevision: conflicting,
    });

    const observation: FedosRatchetPeerCapabilityObservationV1 = {
      schemaVersion: 1,
      localDeviceRef: this.#deps.localDeviceRef,
      peerAccountRef: record.issuerAccountRef,
      peerDeviceRef: record.affectedDeviceRef,
      sourceKind: "lifecycle-notification",
      sourceId: record.notificationId,
      revision: record.revision,
      evidenceLevel,
      acceptanceOutcome,
      supersededSourceId: record.supersedesNotificationId,
      observedAt: this.#deps.clock(),
      expiresAt: record.expiresAt,
      claimedRoutes: [],
      factKind: record.fact.kind,
    };
    const writeResult = this.#deps.observationPersistence.putObservation(observation);
    if (writeResult === "failed") return { outcome: "persistence-failed" };
    if (writeResult === "conflict") return { outcome: "conflicting-duplicate" };
    if (writeResult === "already-present") return { outcome: "duplicate" };

    return {
      outcome: "recorded",
      acceptanceOutcome,
      recommendation: recommendFedosRatchetPeerSessionAction(acceptanceOutcome, record.fact.kind),
    };
  }

  /** The ONE inbound entry point for this domain — see this file's own header for the exact call-site convention this mirrors. */
  async importRumorContent(content: string): Promise<FedosRatchetPeerCapabilityInboundOutcome> {
    const payload = decodeFedosRatchetPeerCapabilityControlPayloadFromContent(content);
    if (payload === null) return { outcome: "not-peer-capability-payload" };
    if (payload.kind === "peer-capability-advertisement") return this.#importAdvertisement(payload.advertisement);
    return this.#importNotification(payload.notification);
  }
}

export type { FedosRatchetPeerCapabilityRoute };
