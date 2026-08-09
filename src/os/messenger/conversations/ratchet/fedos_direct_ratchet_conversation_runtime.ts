/**
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — Phase M: the narrow Runtime
 * facade. Exposes ONLY safe operations — never raw session state, never
 * counters as diagnostics beyond the closed status vocabulary, never
 * root/chain/message/skipped keys, never a Rust/WASM object handle,
 * never generic cryptographic execution.
 *
 * Composes `FedosDirectRatchetOutboundIntegration` (Phase E/D) and
 * `FedosDirectRatchetInboundIntegration` (Phase G) over ONE shared
 * `FedosDirectRatchetStateRuntime` (Alpha 5401–5480, UNCHANGED) and ONE
 * shared `FedosDirectRatchetLiveSessionCache` — never a second,
 * divergent graph.
 *
 * Keeps existing Direct messaging behavior UNCHANGED unless an explicit
 * ratchet route is selected — this class performs no automatic
 * migration, no automatic session creation, no silent route change.
 */
import type { FedosDeviceRegistryPersistence } from "../../../../device/persistence/fedos_device_registry_persistence.js";
import type { FedosDeviceBindingAccountRef } from "../../../../device/fedos_device_binding.js";
import type { FedosMasterSeedAuthority } from "../../../../runtime/master_seed/fedos_master_seed_authority.js";
import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationDraftPersistence } from "../../../../conversation/construction/fedos_conversation_draft_persistence.js";
import type { FedosConversationActivationPersistence } from "../../../../conversation/activation/fedos_conversation_activation_persistence.js";
import type { FedosConversationMembershipAuthority } from "../../../../conversation/membership/fedos_conversation_membership_authority.js";
import type { FedosConversationIdentityResolver } from "../../../../conversation/encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationEncryptionAuthority } from "../../../../conversation/encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationMessageEnvelopePersistence } from "../../../../conversation/envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationEnvelopeIdGenerator } from "../../../../conversation/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationPayloadStorage } from "../../../../conversation/payload_storage/fedos_conversation_payload_storage.js";
import type { FedosConversationPayloadIdGenerator } from "../../../../conversation/payload_storage/fedos_conversation_payload_id.js";
import type { FedosPrivateNostrImportRecordPersistence } from "../../../../conversation/delivery/nostr/fedos_private_nostr_import_record.js";
import type { FedosPrivateWireParsedRumor } from "../../../../conversation/transport/fedos_private_wire_adapter.js";
import type { FedosPrivateWireDeliveryQueueOutcome } from "../../../../conversation/transport/fedos_private_wire_prepared_delivery.js";
import { resolveFedosConversationActiveConversation } from "../../../../conversation/activation/fedos_conversation_active_lookup.js";

import type { FedosDirectRatchetSessionPersistence } from "../../../../conversation/ratchet/persistence/fedos_direct_ratchet_session_persistence.js";
import type { FedosSealedDirectRatchetSecretPersistence } from "../../../../conversation/ratchet/persistence/fedos_sealed_direct_ratchet_secret_persistence.js";
import type { FedosDirectRatchetRemotePublicKeyPersistence } from "../../../../conversation/ratchet/persistence/fedos_direct_ratchet_remote_public_key_persistence.js";
import type { FedosDirectRatchetLiveStateSnapshotPersistence } from "../../../../conversation/ratchet/persistence/fedos_direct_ratchet_live_state_snapshot_persistence.js";
import type { FedosDirectRatchetSealingAuthority } from "../../../../conversation/ratchet/fedos_direct_ratchet_sealing_authority.js";
import { FedosDirectRatchetStateRuntime } from "../../../../conversation/ratchet/fedos_direct_ratchet_state_runtime.js";
import { FedosDirectRatchetLiveSessionCache } from "../../../../conversation/ratchet/fedos_direct_ratchet_live_session_cache.js";
import {
  resolveFedosDirectRatchetDevicePair,
  FEDOS_DIRECT_RATCHET_DEFAULT_SUITE,
} from "../../../../conversation/ratchet/fedos_direct_ratchet_device_pair_resolver.js";
import {
  FedosDirectRatchetOutboundIntegration,
  type FedosDirectRatchetCounterpartyResolution,
  type FedosDirectRatchetEstablishOptions,
  type FedosDirectRatchetEstablishOutcome,
  type FedosDirectRatchetSendOutcome,
} from "../../../../conversation/ratchet/fedos_direct_ratchet_outbound_integration.js";
import {
  FedosDirectRatchetInboundIntegration,
  type FedosDirectRatchetInboundReceiveResult,
} from "../../../../conversation/ratchet/fedos_direct_ratchet_inbound_integration.js";
import type { FedosConversationEnvelopeId } from "../../../../conversation/envelope/fedos_conversation_envelope_id.js";
import { FedosDirectRatchetResetCoordinator } from "../../../../conversation/ratchet/fedos_direct_ratchet_reset_coordinator.js";
import type { FedosDirectRatchetSessionResetRecordPersistence } from "../../../../conversation/ratchet/persistence/fedos_direct_ratchet_session_reset_record_persistence.js";

/** Phase N — the ONE closed, safe status vocabulary a Desktop/UI surface may show. Never raw counters, never keys. */
export type FedosDirectRatchetSafeStatus =
  | "unsupported"
  | "initialization-required"
  | "pending"
  | "active"
  | "reset-required"
  | "peer-incompatible"
  | "revoked"
  | "unavailable";

export interface FedosDirectRatchetConversationRuntimeDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly activationPersistence: FedosConversationActivationPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly deviceRegistry: FedosDeviceRegistryPersistence;
  readonly sessionPersistence: FedosDirectRatchetSessionPersistence;
  readonly sealedSecretPersistence: FedosSealedDirectRatchetSecretPersistence;
  readonly remotePublicKeyPersistence: FedosDirectRatchetRemotePublicKeyPersistence;
  readonly snapshotPersistence: FedosDirectRatchetLiveStateSnapshotPersistence;
  readonly resetRecordPersistence: FedosDirectRatchetSessionResetRecordPersistence;
  readonly sealingAuthority: FedosDirectRatchetSealingAuthority | null;
  readonly masterSeedAuthority: FedosMasterSeedAuthority;
  readonly accountIndex: number;
  readonly localDeviceRef: string;
  readonly encryptionAuthority: FedosConversationEncryptionAuthority;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  readonly envelopeIdGenerator: FedosConversationEnvelopeIdGenerator;
  readonly payloadIdGenerator: FedosConversationPayloadIdGenerator;
  readonly importRecordPersistence: FedosPrivateNostrImportRecordPersistence;
  readonly sendMailboxNip17Control: (
    controlId: string,
    conversationId: FedosConversationId,
    plaintext: Uint8Array,
    createdAt: number,
  ) => Promise<FedosPrivateWireDeliveryQueueOutcome>;
  readonly clock: () => number;
}

function resolveCounterparty(
  deps: Pick<FedosDirectRatchetConversationRuntimeDependencies, "draftPersistence" | "activationPersistence" | "membershipAuthority" | "identityResolver">,
  conversationId: FedosConversationId,
): FedosDirectRatchetCounterpartyResolution {
  const active = resolveFedosConversationActiveConversation(deps.draftPersistence, deps.activationPersistence, conversationId);
  if (active.outcome !== "active") return { outcome: "not-direct" };
  const identity = deps.identityResolver.resolveLocalParticipant();
  if (identity.outcome === "unavailable") return { outcome: "identity-unavailable" };
  const memberships = deps.membershipAuthority.listMemberships(conversationId).filter((m) => m.state === "active");
  if (memberships.length !== 2) return { outcome: "not-direct" };
  const localMembership = memberships.find(
    (m) => m.participant.authority === identity.creator.authority && m.participant.publicIdentifier === identity.creator.publicIdentifier,
  );
  if (localMembership === undefined) return { outcome: "identity-unavailable" };
  const counterpartyMembership = memberships.find((m) => m.id !== localMembership.id);
  if (counterpartyMembership === undefined) return { outcome: "not-direct" };

  const localAccountRef: FedosDeviceBindingAccountRef = { authority: identity.creator.authority, publicIdentifier: identity.creator.publicIdentifier, identityId: null };
  const remoteAccountRef: FedosDeviceBindingAccountRef = {
    authority: counterpartyMembership.participant.authority,
    publicIdentifier: counterpartyMembership.participant.publicIdentifier,
    identityId: null,
  };
  return { outcome: "resolved", localAccountRef, remoteAccountRef, remoteAccountPublicKeyHex: counterpartyMembership.participant.publicIdentifier };
}

export class FedosDirectRatchetConversationRuntime {
  readonly #deps: FedosDirectRatchetConversationRuntimeDependencies;
  readonly #stateRuntime: FedosDirectRatchetStateRuntime;
  readonly #liveSessionCache: FedosDirectRatchetLiveSessionCache;
  readonly #resetCoordinator: FedosDirectRatchetResetCoordinator;
  readonly #outbound: FedosDirectRatchetOutboundIntegration;
  readonly #inbound: FedosDirectRatchetInboundIntegration;

  constructor(deps: FedosDirectRatchetConversationRuntimeDependencies) {
    this.#deps = deps;
    this.#stateRuntime = new FedosDirectRatchetStateRuntime({
      sessionPersistence: deps.sessionPersistence,
      sealedSecretPersistence: deps.sealedSecretPersistence,
      sealingAuthority: deps.sealingAuthority,
      now: deps.clock,
    });
    this.#liveSessionCache = new FedosDirectRatchetLiveSessionCache();
    this.#resetCoordinator = new FedosDirectRatchetResetCoordinator({
      stateRuntime: this.#stateRuntime,
      resetRecordPersistence: deps.resetRecordPersistence,
      now: deps.clock,
    });

    this.#outbound = new FedosDirectRatchetOutboundIntegration({
      deviceRegistry: deps.deviceRegistry,
      sessionPersistence: deps.sessionPersistence,
      sealedSecretPersistence: deps.sealedSecretPersistence,
      stateRuntime: this.#stateRuntime,
      resetCoordinator: this.#resetCoordinator,
      masterSeedAuthority: deps.masterSeedAuthority,
      accountIndex: deps.accountIndex,
      localDeviceRef: deps.localDeviceRef,
      liveSessionCache: this.#liveSessionCache,
      remotePublicKeyPersistence: deps.remotePublicKeyPersistence,
      snapshotPersistence: deps.snapshotPersistence,
      resolveCounterparty: (conversationId) => resolveCounterparty(deps, conversationId),
      sendMailboxNip17Control: deps.sendMailboxNip17Control,
      now: deps.clock,
    });

    this.#inbound = new FedosDirectRatchetInboundIntegration({
      draftPersistence: deps.draftPersistence,
      activationPersistence: deps.activationPersistence,
      membershipAuthority: deps.membershipAuthority,
      identityResolver: deps.identityResolver,
      deviceRegistry: deps.deviceRegistry,
      sessionPersistence: deps.sessionPersistence,
      sealedSecretPersistence: deps.sealedSecretPersistence,
      remotePublicKeyPersistence: deps.remotePublicKeyPersistence,
      snapshotPersistence: deps.snapshotPersistence,
      stateRuntime: this.#stateRuntime,
      resetCoordinator: this.#resetCoordinator,
      masterSeedAuthority: deps.masterSeedAuthority,
      accountIndex: deps.accountIndex,
      localDeviceRef: deps.localDeviceRef,
      liveSessionCache: this.#liveSessionCache,
      encryptionAuthority: deps.encryptionAuthority,
      envelopePersistence: deps.envelopePersistence,
      payloadStorage: deps.payloadStorage,
      envelopeIdGenerator: deps.envelopeIdGenerator,
      payloadIdGenerator: deps.payloadIdGenerator,
      importRecordPersistence: deps.importRecordPersistence,
      clock: deps.clock,
    });
  }

  /**
   * Phase D — establishes (or re-establishes, on a new generation) a
   * ratchet session as the RECEIVER role, publishing this Runtime's own
   * fresh ratchet public key over the SAME authenticated NIP-17 path.
   *
   * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
   * Foundation Arc — `options.reason` is REQUIRED whenever a session
   * already exists for this tuple (a real reset); `options.deviceSigningKeypair`
   * is always optional (see `FedosDirectRatchetEstablishOptions`'s own
   * doc comment for why it can never be required in this codebase today).
   */
  async initializeDirectRatchetSession(
    conversationId: string,
    remoteDeviceRef: string,
    options?: FedosDirectRatchetEstablishOptions,
  ): Promise<FedosDirectRatchetEstablishOutcome> {
    return this.#outbound.establishSession(conversationId as FedosConversationId, remoteDeviceRef, options);
  }

  /**
   * Device-revocation quarantine sweep (review §06) — transitions every
   * non-terminal ratchet session record where `deviceId` is either the
   * local or the remote Device to `"revoked"`. A caller invokes this
   * explicitly after revoking a Device binding
   * (`FedosDeviceBindingRegistrationAuthority.revokeDevice()`/
   * `FedosDevicePairingFacade.revokeDevice()`) — nothing in this codebase
   * automatically triggers it (no cross-subsystem event bus links Device
   * Trust and the Ratchet Runtime today, a disclosed, honest boundary,
   * not an oversight). Returns the session ids actually transitioned.
   */
  applyDeviceRevocationToSessions(deviceId: string): readonly string[] {
    return this.#resetCoordinator.applyDeviceRevocation(deviceId, this.#deps.sessionPersistence) as unknown as readonly string[];
  }

  /** Phase I — transitions the CURRENT session (if any) to `reset-required`; the next `initializeDirectRatchetSession()` call creates a NEW, independent generation. Never mutates a `"revoked"`/`"corrupt"` (already-terminal) session. */
  async resetDirectRatchetSession(conversationId: string, remoteDeviceRef: string): Promise<{ readonly outcome: "reset" | "no-session" | "already-terminal" | "unavailable" }> {
    const counterparty = resolveCounterparty(this.#deps, conversationId as FedosConversationId);
    if (counterparty.outcome !== "resolved") return { outcome: "unavailable" };
    const resolution = resolveFedosDirectRatchetDevicePair(this.#deps.deviceRegistry, this.#deps.sessionPersistence, {
      localAccountRef: counterparty.localAccountRef,
      localDeviceRef: this.#deps.localDeviceRef,
      remoteAccountRef: counterparty.remoteAccountRef,
      remoteDeviceRef,
      conversationId: conversationId as FedosConversationId,
    });
    if (resolution.outcome !== "resolved") return { outcome: "unavailable" };
    const metadata = this.#stateRuntime.getSessionMetadata(resolution.sessionId);
    if (metadata === null) return { outcome: "no-session" };
    const transition = this.#stateRuntime.markResetRequired(resolution.sessionId);
    if (transition.outcome === "transitioned") return { outcome: "reset" };
    return { outcome: "already-terminal" };
  }

  /** Phase M/N — the ONE safe status view. Never exposes counters, keys, or session-existence beyond this closed 8-value vocabulary. */
  getDirectRatchetStatus(conversationId: string, remoteDeviceRef: string): FedosDirectRatchetSafeStatus {
    const counterparty = resolveCounterparty(this.#deps, conversationId as FedosConversationId);
    if (counterparty.outcome !== "resolved") return "unavailable";

    const resolution = resolveFedosDirectRatchetDevicePair(this.#deps.deviceRegistry, this.#deps.sessionPersistence, {
      localAccountRef: counterparty.localAccountRef,
      localDeviceRef: this.#deps.localDeviceRef,
      remoteAccountRef: counterparty.remoteAccountRef,
      remoteDeviceRef,
      conversationId: conversationId as FedosConversationId,
    });
    if (resolution.outcome === "local-device-revoked" || resolution.outcome === "remote-device-revoked") return "revoked";
    if (resolution.outcome !== "resolved") return "peer-incompatible";

    const metadata = this.#stateRuntime.getSessionMetadata(resolution.sessionId);
    if (metadata === null) return "initialization-required";
    switch (metadata.lifecycleState) {
      case "initialized":
        return "pending";
      case "active":
        return "active";
      case "reset-required":
      case "suspended":
        return "reset-required";
      case "revoked":
        return "revoked";
      default:
        return "unavailable";
    }
  }

  /** Alias mirroring Phase M's own named `assessDirectRatchetReadiness()` operation — identical to `getDirectRatchetStatus()`. */
  assessDirectRatchetReadiness(conversationId: string, remoteDeviceRef: string): FedosDirectRatchetSafeStatus {
    return this.getDirectRatchetStatus(conversationId, remoteDeviceRef);
  }

  /** Phase E — real ratchet message send. Requires an already-persisted local Envelope for `envelopeId` (the SAME requirement `FedosPrivateTransport.sendMailboxNip17()` itself enforces). */
  async sendDirectRatchetMessage(
    conversationId: string,
    envelopeId: string,
    remoteDeviceRef: string,
    plaintext: Uint8Array,
    sendMailboxNip17: (
      envelopeId: FedosConversationEnvelopeId,
      conversationId: FedosConversationId,
      plaintext: Uint8Array,
    ) => Promise<FedosPrivateWireDeliveryQueueOutcome>,
  ): Promise<FedosDirectRatchetSendOutcome> {
    return this.#outbound.sendMessage(
      conversationId as FedosConversationId,
      envelopeId as unknown as FedosConversationEnvelopeId,
      remoteDeviceRef,
      plaintext,
      sendMailboxNip17,
    );
  }

  /** Phase G — real inbound dispatch. `"not-ratchet-payload"` signals the caller (`FedosConversationRuntime.receiveNip17Rumor()`) to fall through to the existing, unchanged legacy path. */
  async importRatchetPrivatePayload(rumor: FedosPrivateWireParsedRumor, relaySource: string | null): Promise<FedosDirectRatchetInboundReceiveResult> {
    return this.#inbound.receiveRumor(rumor, relaySource);
  }
}

export const FEDOS_DIRECT_RATCHET_ROUTE_SUITE = FEDOS_DIRECT_RATCHET_DEFAULT_SUITE;
