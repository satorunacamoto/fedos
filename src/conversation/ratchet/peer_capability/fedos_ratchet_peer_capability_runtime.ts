/**
 * Secure Runtime Alpha 5721–5800 — Phase N: the narrow safe facade.
 * Composes the Outbound (Phase G) and Inbound (Phase H) coordinators over
 * one shared Device Registry / Observation persistence / clock, and
 * exposes ONLY the six safe operations this Arc's own brief names. Never
 * exposes raw signatures beyond what internal persistence already needs,
 * raw payload bytes, private keys, ratchet counters, secret handles, or
 * local file paths. Mirrors
 * `FedosDirectRatchetConversationRuntime`'s own "safe facade over a
 * narrow, injected dependency bundle" shape, deliberately as a SIBLING
 * Runtime, never a merge into that frozen class.
 */
import type { FedosDeviceBindingAccountRef } from "../../../device/fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../../../device/persistence/fedos_device_registry_persistence.js";
import type { FedosConversationId } from "../../fedos_conversation_id.js";
import type { FedosNostrSigningAuthority } from "../../../nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosDeviceSigningKeypair } from "../../../device/crypto/fedos_device_signing_keypair.js";
import type { FedosRatchetPeerCapabilityEntry } from "./fedos_ratchet_peer_capability_vocabulary.js";
import type { FedosRatchetPeerLifecycleFact } from "./fedos_ratchet_peer_lifecycle_notification.js";
import {
  FedosRatchetPeerCapabilityOutboundCoordinator,
  type FedosRatchetPeerCapabilityOutboundOutcome,
  type FedosRatchetPeerCapabilitySendResult,
} from "./fedos_ratchet_peer_capability_outbound_coordinator.js";
import {
  FedosRatchetPeerCapabilityInboundCoordinator,
  type FedosRatchetPeerCapabilityInboundOutcome,
} from "./fedos_ratchet_peer_capability_inbound_coordinator.js";
import type { FedosRatchetPeerCapabilityObservationPersistence } from "./persistence/fedos_ratchet_peer_capability_observation_persistence.js";
import type { FedosRatchetPeerCapabilityObservationV1 } from "./fedos_ratchet_peer_capability_observation.js";
import {
  computeFedosRatchetPeerCapabilitySafeStatus,
  type FedosRatchetPeerCapabilitySafeStatus,
} from "./fedos_ratchet_peer_capability_safe_status.js";
import { recommendFedosRatchetPeerSessionAction } from "./fedos_ratchet_peer_capability_session_action_recommendation.js";

export interface FedosRatchetPeerCapabilityRuntimeDependencies {
  readonly deviceRegistry: FedosDeviceRegistryPersistence;
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly accountIndex: number;
  readonly localAccountRef: FedosDeviceBindingAccountRef;
  readonly localDeviceRef: string;
  readonly clock: () => number;
  readonly sendMailboxNip17Control: (
    controlId: string,
    conversationId: FedosConversationId,
    plaintext: Uint8Array,
    createdAt: number,
  ) => Promise<FedosRatchetPeerCapabilitySendResult | { readonly outcome: string }>;
  readonly observationPersistence: FedosRatchetPeerCapabilityObservationPersistence;
  readonly locallySupportedCapabilities: readonly FedosRatchetPeerCapabilityEntry[];
}

export interface FedosRatchetPeerCapabilityPeerDeviceStatus {
  readonly peerAccountRef: FedosDeviceBindingAccountRef;
  readonly peerDeviceRef: string;
  readonly safeStatus: FedosRatchetPeerCapabilitySafeStatus;
}

export class FedosRatchetPeerCapabilityRuntime {
  readonly #deps: FedosRatchetPeerCapabilityRuntimeDependencies;
  readonly #outbound: FedosRatchetPeerCapabilityOutboundCoordinator;
  readonly #inbound: FedosRatchetPeerCapabilityInboundCoordinator;

  constructor(deps: FedosRatchetPeerCapabilityRuntimeDependencies) {
    this.#deps = deps;
    this.#outbound = new FedosRatchetPeerCapabilityOutboundCoordinator(deps);
    this.#inbound = new FedosRatchetPeerCapabilityInboundCoordinator(deps);
  }

  /** Irreversible for this instance. */
  stop(): void {
    this.#outbound.stop();
  }

  async advertiseLocalCapabilities(params: {
    readonly recipientAccountRef: FedosDeviceBindingAccountRef;
    readonly recipientDeviceRef: string;
    readonly conversationId: FedosConversationId;
    readonly revision: number;
    readonly expiresInMs: number;
    readonly deviceSigningKeypair?: FedosDeviceSigningKeypair;
  }): Promise<FedosRatchetPeerCapabilityOutboundOutcome> {
    return this.#outbound.advertiseCapabilities(params);
  }

  async publishDeviceLifecycleNotification(params: {
    readonly notificationId: string;
    readonly recipientAccountRef: FedosDeviceBindingAccountRef;
    readonly recipientDeviceRef: string;
    readonly conversationId: FedosConversationId;
    readonly affectedDeviceRef: string;
    readonly fact: FedosRatchetPeerLifecycleFact;
    readonly revision: number;
    readonly expiresInMs: number;
    readonly supersedesNotificationId?: string;
    readonly deviceSigningKeypair?: FedosDeviceSigningKeypair;
  }): Promise<FedosRatchetPeerCapabilityOutboundOutcome> {
    return this.#outbound.publishDeviceLifecycleNotification(params);
  }

  /** `content` is the already-unwrapped Rumor's own `content: string` — the ONE inbound dispatch point. */
  async importPeerCapabilityPayload(content: string): Promise<FedosRatchetPeerCapabilityInboundOutcome> {
    return this.#inbound.importRumorContent(content);
  }

  /**
   * The latest observation (by revision, WITHIN one `sourceKind`) this
   * local Device has recorded for one peer Device, or `null` if none
   * exists for that `sourceKind`. An advertisement's `revision` and a
   * lifecycle notification's `revision` are independent counters (see
   * the Inbound Coordinator's own `#priorAccepted()` header) — this
   * method is scoped accordingly so the two are never compared against
   * each other. Never exposes raw signatures/evidence internals — only
   * what `getPeerDeviceCapabilityStatus()` itself needs.
   */
  #latestObservationOfKind(
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
    sourceKind: "advertisement" | "lifecycle-notification",
  ): FedosRatchetPeerCapabilityObservationV1 | null {
    const observed = this.#deps.observationPersistence.listObservationsForPeerDevice(this.#deps.localDeviceRef, peerAccountRef, peerDeviceRef);
    let best: FedosRatchetPeerCapabilityObservationV1 | null = null;
    for (const record of observed) {
      if (record.sourceKind !== sourceKind) continue;
      if (best === null || record.observedAt > best.observedAt || (record.observedAt === best.observedAt && record.revision > best.revision)) {
        best = record;
      }
    }
    return best;
  }

  /**
   * Never `"trusted"` from self-advertisement alone (Phase O) — a closed,
   * pre-computed safe status only. Combines the two INDEPENDENT
   * dimensions Phase I/J actually produce, never conflating them onto one
   * "whichever arrived most recently" timeline: a Device-lifecycle fact
   * (revocation, replacement, a required reset/initialization) is a
   * stronger, identity-scoped claim than mere private-message-route/suite
   * compatibility, so an actionable lifecycle recommendation always takes
   * priority over the Advertisement's own compatibility status — a later
   * Advertisement can never silently paper over an already-recorded
   * revocation/reset/conflict fact.
   */
  getPeerDeviceCapabilityStatus(peerAccountRef: FedosDeviceBindingAccountRef, peerDeviceRef: string): FedosRatchetPeerCapabilitySafeStatus {
    const latestNotification = this.#latestObservationOfKind(peerAccountRef, peerDeviceRef, "lifecycle-notification");
    if (latestNotification !== null) {
      const notificationRecommendation = recommendFedosRatchetPeerSessionAction(latestNotification.acceptanceOutcome, latestNotification.factKind);
      if (notificationRecommendation !== "none") {
        return computeFedosRatchetPeerCapabilitySafeStatus(latestNotification.acceptanceOutcome, notificationRecommendation);
      }
    }
    const latestAdvertisement = this.#latestObservationOfKind(peerAccountRef, peerDeviceRef, "advertisement");
    if (latestAdvertisement !== null) {
      const recommendation = recommendFedosRatchetPeerSessionAction(latestAdvertisement.acceptanceOutcome, null);
      return computeFedosRatchetPeerCapabilitySafeStatus(latestAdvertisement.acceptanceOutcome, recommendation);
    }
    if (latestNotification !== null) {
      return computeFedosRatchetPeerCapabilitySafeStatus(latestNotification.acceptanceOutcome, "none");
    }
    return computeFedosRatchetPeerCapabilitySafeStatus(null, "none");
  }

  /** Alias matching this Arc's own brief naming exactly — identical to `getPeerDeviceCapabilityStatus()`. */
  assessPeerRatchetCompatibility(peerAccountRef: FedosDeviceBindingAccountRef, peerDeviceRef: string): FedosRatchetPeerCapabilitySafeStatus {
    return this.getPeerDeviceCapabilityStatus(peerAccountRef, peerDeviceRef);
  }

  /** Every distinct (peer account, peer Device) subject this local Device has ever recorded an observation for, with only its safe status — never the raw observation list. */
  listObservedPeerDevices(): readonly FedosRatchetPeerCapabilityPeerDeviceStatus[] {
    const seen = new Map<string, FedosRatchetPeerCapabilityPeerDeviceStatus>();
    for (const record of this.#deps.observationPersistence.listObservations()) {
      if (record.localDeviceRef !== this.#deps.localDeviceRef) continue;
      const key = JSON.stringify([record.peerAccountRef.authority, record.peerAccountRef.publicIdentifier, record.peerAccountRef.identityId, record.peerDeviceRef]);
      if (seen.has(key)) continue;
      seen.set(key, {
        peerAccountRef: record.peerAccountRef,
        peerDeviceRef: record.peerDeviceRef,
        safeStatus: this.getPeerDeviceCapabilityStatus(record.peerAccountRef, record.peerDeviceRef),
      });
    }
    return [...seen.values()];
  }
}
