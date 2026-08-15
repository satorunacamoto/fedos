/**
 * FedOS Peer Device Discovery Arc — the narrow Inbound Coordinator.
 * Receives an already-unwrapped Rumor's own `content: string`, classifies
 * it, runs strict schema validation, verifies the real account signature
 * (independent of the Rumor's own UNSIGNED `pubkey` claim — never trusted),
 * verifies the optional device signature when present, runs the pure
 * acceptance policy, durably records the observation, and — on an accepted
 * outcome — writes/updates a `"trusted"` Device Registry binding via
 * `FedosPeerDeviceAnnouncementRegistrationAuthority`. Mirrors
 * `../ratchet/peer_capability/fedos_ratchet_peer_capability_inbound_coordinator.ts`'s
 * shape, with one deliberate difference: THIS coordinator DOES mutate the
 * Device Registry (that is this protocol's entire purpose — see
 * `06_PROTOCOL_CONTRACT_FREEZE.md` §7), whereas peer_capability's own
 * inbound coordinator never does.
 */
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import { decodeFedosPeerDeviceAnnouncementControlPayloadFromContent } from "./fedos_peer_device_announcement_control_payload.js";
import { canonicalSerializeFedosPeerDeviceAnnouncementContent, FEDOS_PEER_DEVICE_ANNOUNCEMENT_DEVICE_SIGNATURE_PREFIX, type FedosPeerDeviceAnnouncementV1 } from "./fedos_peer_device_announcement.js";
import { evaluateFedosPeerDeviceAnnouncementEvidence, verifyFedosPeerDeviceAnnouncementAccountAuthorization, verifyFedosPeerDeviceAnnouncementDeviceSignature } from "./fedos_peer_device_announcement_authentication.js";
import { evaluateFedosPeerDeviceAnnouncementAcceptance, type FedosPeerDeviceAnnouncementPriorAcceptedSummary } from "./fedos_peer_device_announcement_acceptance_policy.js";
import { isFedosPeerDeviceAnnouncementAccepted, type FedosPeerDeviceAnnouncementAcceptanceOutcome } from "./fedos_peer_device_announcement_acceptance_outcome.js";
import { entriesOfKindRoutes } from "../ratchet/peer_capability/fedos_ratchet_peer_capability_vocabulary.js";
import type { FedosPeerDeviceAnnouncementObservationPersistence } from "./persistence/fedos_peer_device_announcement_observation_persistence.js";
import type { FedosPeerDeviceAnnouncementObservationV1 } from "./fedos_peer_device_announcement_observation.js";
import { FedosPeerDeviceAnnouncementRegistrationAuthority, type FedosPeerDeviceAnnouncementRegistrationOutcome } from "./fedos_peer_device_announcement_registration_authority.js";
import type { FedosDeviceRegistryPersistence } from "../../device/persistence/fedos_device_registry_persistence.js";

export interface FedosPeerDeviceAnnouncementInboundDependencies {
  readonly localAccountRef: FedosDeviceBindingAccountRef;
  readonly clock: () => number;
  readonly observationPersistence: FedosPeerDeviceAnnouncementObservationPersistence;
  /** The SAME, SHARED Registry the Direct Ratchet resolver already reads (06 §7) — never a second, parallel Registry. */
  readonly deviceRegistry: FedosDeviceRegistryPersistence;
  /** Multi-device isolation key, mirrors peer_capability's own `localDeviceRef` on the Observation record. */
  readonly localDeviceRef: string;
}

export type FedosPeerDeviceAnnouncementInboundOutcome =
  | { readonly outcome: "not-peer-device-announcement-payload" }
  | { readonly outcome: "wrong-recipient" }
  | { readonly outcome: "bad-account-signature" }
  | { readonly outcome: "bad-device-signature" }
  | { readonly outcome: "persistence-failed" }
  | { readonly outcome: "duplicate" }
  | { readonly outcome: "conflicting" }
  | { readonly outcome: "stale" }
  | { readonly outcome: "recorded"; readonly acceptanceOutcome: FedosPeerDeviceAnnouncementAcceptanceOutcome; readonly registration: FedosPeerDeviceAnnouncementRegistrationOutcome | null };

function accountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier && a.identityId === b.identityId;
}

export class FedosPeerDeviceAnnouncementInboundCoordinator {
  readonly #deps: FedosPeerDeviceAnnouncementInboundDependencies;
  readonly #registrationAuthority: FedosPeerDeviceAnnouncementRegistrationAuthority;

  constructor(deps: FedosPeerDeviceAnnouncementInboundDependencies) {
    this.#deps = deps;
    this.#registrationAuthority = new FedosPeerDeviceAnnouncementRegistrationAuthority({ registryPersistence: deps.deviceRegistry });
  }

  /**
   * Exact-nonce replay short-circuit, run BEFORE epoch ordering/conflict
   * detection — mirrors peer_capability's own `#existingObservationForSource()`
   * discipline exactly (see that file's own header for why this must run
   * first).
   */
  #existingObservationForSource(peerAccountRef: FedosDeviceBindingAccountRef, deviceId: string, sourceId: string): FedosPeerDeviceAnnouncementObservationV1 | null {
    const observed = this.#deps.observationPersistence.listObservationsForPeerDevice(this.#deps.localDeviceRef, peerAccountRef, deviceId);
    return observed.find((r) => r.sourceId === sourceId) ?? null;
  }

  #priorAccepted(peerAccountRef: FedosDeviceBindingAccountRef, deviceId: string): FedosPeerDeviceAnnouncementPriorAcceptedSummary | null {
    const observed = this.#deps.observationPersistence.listObservationsForPeerDevice(this.#deps.localDeviceRef, peerAccountRef, deviceId);
    let best: FedosPeerDeviceAnnouncementObservationV1 | null = null;
    for (const record of observed) {
      if (!isFedosPeerDeviceAnnouncementAccepted(record.acceptanceOutcome)) continue;
      if (best === null || record.epoch > best.epoch) best = record;
    }
    return best === null ? null : { epoch: best.epoch, devicePublicKeyHex: best.devicePublicKeyHex };
  }

  #hasConflictingDuplicateAtSameEpoch(peerAccountRef: FedosDeviceBindingAccountRef, deviceId: string, epoch: number, sourceId: string): boolean {
    const observed = this.#deps.observationPersistence.listObservationsForPeerDevice(this.#deps.localDeviceRef, peerAccountRef, deviceId);
    return observed.some((r) => r.epoch === epoch && r.sourceId !== sourceId);
  }

  async #importAnnouncement(record: FedosPeerDeviceAnnouncementV1): Promise<FedosPeerDeviceAnnouncementInboundOutcome> {
    if (!accountRefsEqual(record.recipientAccountRef, this.#deps.localAccountRef)) return { outcome: "wrong-recipient" };

    const canonicalContent = canonicalSerializeFedosPeerDeviceAnnouncementContent(record);
    const verification = await verifyFedosPeerDeviceAnnouncementAccountAuthorization(record.accountAuthorization, canonicalContent);
    if (verification.outcome !== "valid" || verification.accountPublicKeyHex !== record.senderAccountRef.publicIdentifier) {
      return { outcome: "bad-account-signature" };
    }

    let deviceSignatureVerified = false;
    if (record.deviceSignatureHex !== null) {
      deviceSignatureVerified = verifyFedosPeerDeviceAnnouncementDeviceSignature(record.devicePublicKeyHex, FEDOS_PEER_DEVICE_ANNOUNCEMENT_DEVICE_SIGNATURE_PREFIX, canonicalContent, record.deviceSignatureHex);
      if (!deviceSignatureVerified) return { outcome: "bad-device-signature" };
    }
    const evidenceLevel = evaluateFedosPeerDeviceAnnouncementEvidence(record.deviceSignatureHex, deviceSignatureVerified);

    if (this.#existingObservationForSource(record.senderAccountRef, record.deviceId, record.nonce) !== null) {
      return { outcome: "duplicate" };
    }

    const priorAccepted = this.#priorAccepted(record.senderAccountRef, record.deviceId);
    const conflicting = this.#hasConflictingDuplicateAtSameEpoch(record.senderAccountRef, record.deviceId, record.epoch, record.nonce);
    const acceptanceOutcome = evaluateFedosPeerDeviceAnnouncementAcceptance({
      epoch: record.epoch,
      devicePublicKeyHex: record.devicePublicKeyHex,
      priorAccepted,
      conflictingDuplicateAtSameEpoch: conflicting,
    });

    const observation: FedosPeerDeviceAnnouncementObservationV1 = {
      schemaVersion: 1,
      localDeviceRef: this.#deps.localDeviceRef,
      peerAccountRef: record.senderAccountRef,
      deviceId: record.deviceId,
      devicePublicKeyHex: record.devicePublicKeyHex,
      sourceId: record.nonce,
      epoch: record.epoch,
      evidenceLevel,
      acceptanceOutcome,
      supersedesAnnouncementId: record.supersedesAnnouncementId,
      observedAt: this.#deps.clock(),
      claimedRoutes: entriesOfKindRoutes(record.capabilities),
    };
    const writeResult = this.#deps.observationPersistence.putObservation(observation);
    if (writeResult === "failed") return { outcome: "persistence-failed" };
    if (writeResult === "conflict") return { outcome: "conflicting" };
    if (writeResult === "already-present") return { outcome: "duplicate" };

    if (acceptanceOutcome === "stale") return { outcome: "stale" };
    if (acceptanceOutcome === "conflicting") return { outcome: "conflicting" };

    if (!isFedosPeerDeviceAnnouncementAccepted(acceptanceOutcome)) {
      return { outcome: "recorded", acceptanceOutcome, registration: null };
    }

    const registration = this.#registrationAuthority.registerOrUpdate(record.deviceId, record.senderAccountRef, record.devicePublicKeyHex, this.#deps.clock());
    return { outcome: "recorded", acceptanceOutcome, registration: registration.outcome };
  }

  /** The ONE inbound entry point — `content` is the already-unwrapped Rumor's own `content: string`. */
  async importRumorContent(content: string): Promise<FedosPeerDeviceAnnouncementInboundOutcome> {
    const payload = decodeFedosPeerDeviceAnnouncementControlPayloadFromContent(content);
    if (payload === null) return { outcome: "not-peer-device-announcement-payload" };
    return this.#importAnnouncement(payload.announcement);
  }
}
