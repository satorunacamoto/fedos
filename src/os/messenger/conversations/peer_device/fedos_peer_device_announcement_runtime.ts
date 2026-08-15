/**
 * FedOS Peer Device Discovery Arc — the narrow safe facade. Composes the
 * Outbound and Inbound coordinators over one shared Device Registry /
 * Observation persistence / clock, mirrors
 * `../ratchet/peer_capability/fedos_ratchet_peer_capability_runtime.ts`'s
 * own "safe facade over a narrow, injected dependency bundle" shape as a
 * SIBLING Runtime, never a merge into that frozen class.
 *
 * Deliberately reuses the EXISTING, already-safe `FedosDeviceTrustState`
 * vocabulary (`pending | trusted | revoked | unavailable`) for its own
 * `listObservedPeerDevices()` output instead of inventing a new status
 * type — the Registry's own real trust state (queried live) IS the
 * presentation-safe fact this domain has to show; no new vocabulary
 * needed, no risk of the two drifting apart.
 */
import type { FedosDeviceBindingAccountRef, FedosDeviceTrustState } from "../../device/fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../../device/persistence/fedos_device_registry_persistence.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosNostrSigningAuthority } from "../../adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import type { FedosDeviceSigningKeypair } from "../../device/crypto/fedos_device_signing_keypair.js";
import type { FedosRatchetPeerCapabilityEntry } from "../ratchet/peer_capability/fedos_ratchet_peer_capability_vocabulary.js";
import { FedosPeerDeviceAnnouncementOutboundCoordinator, type FedosPeerDeviceAnnouncementOutboundOutcome, type FedosPeerDeviceAnnouncementSendResult } from "./fedos_peer_device_announcement_outbound_coordinator.js";
import { FedosPeerDeviceAnnouncementInboundCoordinator, type FedosPeerDeviceAnnouncementInboundOutcome } from "./fedos_peer_device_announcement_inbound_coordinator.js";
import type { FedosPeerDeviceAnnouncementObservationPersistence } from "./persistence/fedos_peer_device_announcement_observation_persistence.js";
import type { FedosPeerDeviceAnnouncementObservationV1 } from "./fedos_peer_device_announcement_observation.js";
import { isFedosPeerDeviceAnnouncementAccepted } from "./fedos_peer_device_announcement_acceptance_outcome.js";

export interface FedosPeerDeviceAnnouncementRuntimeDependencies {
  readonly deviceRegistry: FedosDeviceRegistryPersistence;
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly accountIndex: number;
  readonly localAccountRef: FedosDeviceBindingAccountRef;
  readonly localDeviceRef: string;
  readonly localAnnouncedDeviceId: string;
  readonly localAnnouncedDevicePublicKeyHex: string;
  readonly clock: () => number;
  readonly sendMailboxNip17Control: (controlId: string, conversationId: FedosConversationId, plaintext: Uint8Array, createdAt: number) => Promise<FedosPeerDeviceAnnouncementSendResult | { readonly outcome: string }>;
  readonly observationPersistence: FedosPeerDeviceAnnouncementObservationPersistence;
  readonly locallySupportedCapabilities: readonly FedosRatchetPeerCapabilityEntry[];
}

export interface FedosPeerDeviceAnnouncementPeerDeviceStatus {
  readonly peerAccountRef: FedosDeviceBindingAccountRef;
  readonly deviceId: string;
  /** Live Registry lookup — the real, current trust state, never a cached/stale copy. `"unavailable"` when no Registry binding exists at all despite an observation record (should not normally happen; disclosed as a genuine possible state, never hidden). */
  readonly trustState: FedosDeviceTrustState | "unknown";
  readonly lastAcceptanceOutcome: FedosPeerDeviceAnnouncementObservationV1["acceptanceOutcome"];
  readonly lastObservedAt: number;
}

export class FedosPeerDeviceAnnouncementRuntime {
  readonly #deps: FedosPeerDeviceAnnouncementRuntimeDependencies;
  readonly #outbound: FedosPeerDeviceAnnouncementOutboundCoordinator;
  readonly #inbound: FedosPeerDeviceAnnouncementInboundCoordinator;

  constructor(deps: FedosPeerDeviceAnnouncementRuntimeDependencies) {
    this.#deps = deps;
    this.#outbound = new FedosPeerDeviceAnnouncementOutboundCoordinator(deps);
    this.#inbound = new FedosPeerDeviceAnnouncementInboundCoordinator({
      localAccountRef: deps.localAccountRef,
      clock: deps.clock,
      observationPersistence: deps.observationPersistence,
      deviceRegistry: deps.deviceRegistry,
      localDeviceRef: deps.localDeviceRef,
    });
  }

  /** Irreversible for this instance. */
  stop(): void {
    this.#outbound.stop();
  }

  async announceLocalDevice(params: {
    readonly recipientAccountRef: FedosDeviceBindingAccountRef;
    readonly conversationId: FedosConversationId;
    readonly epoch: number;
    readonly supersedesAnnouncementId?: string;
    readonly deviceSigningKeypair?: FedosDeviceSigningKeypair;
  }): Promise<FedosPeerDeviceAnnouncementOutboundOutcome> {
    return this.#outbound.announceLocalDevice(params);
  }

  /** `content` is the already-unwrapped Rumor's own `content: string` — the ONE inbound dispatch point. */
  async importPeerDeviceAnnouncementPayload(content: string): Promise<FedosPeerDeviceAnnouncementInboundOutcome> {
    return this.#inbound.importRumorContent(content);
  }

  #latestAcceptedObservation(peerAccountRef: FedosDeviceBindingAccountRef, deviceId: string): FedosPeerDeviceAnnouncementObservationV1 | null {
    const observed = this.#deps.observationPersistence.listObservationsForPeerDevice(this.#deps.localDeviceRef, peerAccountRef, deviceId);
    let best: FedosPeerDeviceAnnouncementObservationV1 | null = null;
    for (const record of observed) {
      if (best === null || record.observedAt > best.observedAt) best = record;
    }
    return best;
  }

  /** Every distinct (peer account, deviceId) subject this local Device has ever recorded an observation for, with a LIVE Registry trust-state lookup — never a cached/stale trust flag independent of signed evidence. */
  listObservedPeerDevices(): readonly FedosPeerDeviceAnnouncementPeerDeviceStatus[] {
    const seen = new Map<string, FedosPeerDeviceAnnouncementPeerDeviceStatus>();
    for (const record of this.#deps.observationPersistence.listObservations()) {
      if (record.localDeviceRef !== this.#deps.localDeviceRef) continue;
      const key = JSON.stringify([record.peerAccountRef.authority, record.peerAccountRef.publicIdentifier, record.peerAccountRef.identityId, record.deviceId]);
      if (seen.has(key)) continue;
      const latest = this.#latestAcceptedObservation(record.peerAccountRef, record.deviceId);
      if (latest === null) continue;
      const binding = this.#deps.deviceRegistry.getBinding(record.deviceId);
      seen.set(key, {
        peerAccountRef: record.peerAccountRef,
        deviceId: record.deviceId,
        trustState: binding === null ? "unknown" : binding.trustState,
        lastAcceptanceOutcome: latest.acceptanceOutcome,
        lastObservedAt: latest.observedAt,
      });
    }
    return [...seen.values()];
  }

  /** All currently-`"trusted"` peer devices for one peer account — the direct fact source a future Direct Ratchet bootstrap trigger consumes. */
  listTrustedPeerDevicesForAccount(peerAccountRef: FedosDeviceBindingAccountRef): readonly FedosPeerDeviceAnnouncementPeerDeviceStatus[] {
    return this.listObservedPeerDevices().filter(
      (d) => d.trustState === "trusted" && d.peerAccountRef.authority === peerAccountRef.authority && d.peerAccountRef.publicIdentifier === peerAccountRef.publicIdentifier && d.peerAccountRef.identityId === peerAccountRef.identityId,
    );
  }
}

export { isFedosPeerDeviceAnnouncementAccepted };
