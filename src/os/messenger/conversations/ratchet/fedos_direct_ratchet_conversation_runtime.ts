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
import type { FedosDeviceRegistryPersistence } from "../../device/persistence/fedos_device_registry_persistence.js";
import type { FedosDirectRatchetSessionRecordV1 } from "./fedos_direct_ratchet_session_record.js";
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import type { FedosMasterSeedAuthority } from "../../../core/vault/wasm/fedos_master_seed_authority.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationDraftPersistence } from "../construction/fedos_conversation_draft_persistence.js";
import type { FedosConversationActivationPersistence } from "../activation/fedos_conversation_activation_persistence.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationIdentityResolver } from "../encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationEncryptionAuthority } from "../encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationMessageEnvelopePersistence } from "../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationEnvelopeIdGenerator } from "../envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationPayloadStorage } from "../payload_storage/fedos_conversation_payload_storage.js";
import type { FedosConversationPayloadIdGenerator } from "../payload_storage/fedos_conversation_payload_id.js";
import type { FedosPrivateNostrImportRecordPersistence } from "../../adapters/nostr/conversation_delivery/fedos_private_nostr_import_record.js";
import type { FedosPrivateWireParsedRumor } from "../../adapters/nostr/transport/fedos_private_wire_adapter.js";
import type { FedosPrivateWireDeliveryQueueOutcome } from "../../adapters/nostr/transport/fedos_private_wire_prepared_delivery.js";
import { resolveFedosConversationActiveConversation } from "../activation/fedos_conversation_active_lookup.js";

import type { FedosDirectRatchetSessionPersistence } from "./persistence/fedos_direct_ratchet_session_persistence.js";
import type { FedosSealedDirectRatchetSecretPersistence } from "./persistence/fedos_sealed_direct_ratchet_secret_persistence.js";
import type { FedosDirectRatchetRemotePublicKeyPersistence } from "./persistence/fedos_direct_ratchet_remote_public_key_persistence.js";
import {
  checkFedosDirectRatchetLiveStateSnapshotFreshness,
  readFedosDirectRatchetLiveStateSnapshotSafe,
  type FedosDirectRatchetLiveStateSnapshotPersistence,
} from "./persistence/fedos_direct_ratchet_live_state_snapshot_persistence.js";
import type { FedosDirectRatchetSealingAuthority } from "./fedos_direct_ratchet_sealing_authority.js";
import { FedosDirectRatchetStateRuntime } from "./fedos_direct_ratchet_state_runtime.js";
import { FedosDirectRatchetLiveSessionCache } from "./fedos_direct_ratchet_live_session_cache.js";
import {
  resolveFedosDirectRatchetDevicePair,
  FEDOS_DIRECT_RATCHET_DEFAULT_SUITE,
} from "./fedos_direct_ratchet_device_pair_resolver.js";
import {
  FedosDirectRatchetOutboundIntegration,
  type FedosDirectRatchetCounterpartyResolution,
  type FedosDirectRatchetEstablishOptions,
  type FedosDirectRatchetEstablishOutcome,
  type FedosDirectRatchetSendOutcome,
} from "./fedos_direct_ratchet_outbound_integration.js";
import {
  FedosDirectRatchetInboundIntegration,
  type FedosDirectRatchetInboundReceiveResult,
} from "./fedos_direct_ratchet_inbound_integration.js";
import type { FedosConversationEnvelopeId } from "../envelope/fedos_conversation_envelope_id.js";
import { FedosDirectRatchetResetCoordinator } from "./fedos_direct_ratchet_reset_coordinator.js";
import type { FedosDirectRatchetSessionResetRecordPersistence } from "./persistence/fedos_direct_ratchet_session_reset_record_persistence.js";

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

/**
 * Direct Ratchet Live-State Durability arc — an ADDITIVE, orthogonal fact
 * alongside `FedosDirectRatchetSafeStatus`, never a replacement for it.
 * `getDirectRatchetStatus()`'s own `"active"` answer is `lifecycleState`
 * metadata alone — durable, but NOT proof the live cryptographic session
 * is actually usable in THIS process right now (session metadata survives
 * a restart; live crypto state, by design, does not carry over except
 * through a real, explicit restore). This vocabulary exists so a
 * consumer (the Security State Controller's own Axis 2/3 fact-gathering)
 * can distinguish "genuinely usable" from "merely durable" WITHOUT itself
 * needing to know anything about sessions/snapshots/counters.
 */
export type FedosDirectRatchetLiveVerificationState =
  /** No session applies here at all (mirrors `getDirectRatchetStatus()`'s own non-`"active"`/`"pending"` outcomes) — this fact is meaningless in this case. */
  | "not-applicable"
  /** A real, live `FedosDirectRatchetCryptographicSession` object is held in THIS process's own in-memory cache right now — the strongest claim, genuinely usable without any further restore step. */
  | "live-confirmed-this-process"
  /** No live object cached in this process, but a durable sealed snapshot exists AND passes the freshness check against this session's own durably-known counters — restoring it would very likely succeed, but that restore has not actually been attempted/confirmed in this process yet. */
  | "restorable-not-yet-confirmed"
  /** A durable sealed snapshot exists but is stale relative to this session's own durably-known counters (see `checkFedosDirectRatchetLiveStateSnapshotFreshness()`) — restoring it is known, deterministically, to be unsafe/would fail; never partially trusted. */
  | "restore-attempted-and-failed"
  /** No durable sealed snapshot exists for this session at all — the universal case for every session that existed before this arc's own durable-persistence wiring landed ("legacy metadata-only"), and any session for which a checkpoint genuinely never happened. */
  | "no-durable-snapshot";

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

  /**
   * Direct Ratchet Live-State Durability arc — the ONE place a consumer
   * that needs to know "is this genuinely usable, not just durably
   * `'active'`" should ask. Deliberately cheap and side-effect-free: it
   * NEVER attempts a real restore itself (never touches Master Seed
   * authority, never runs WASM/Rust) — it only reads facts already
   * cheaply available (the live session cache, the snapshot's own
   * embedded counters compared against the durable session record's
   * counters). See `FedosDirectRatchetLiveVerificationState`'s own header
   * for what each value means and why "decrypts successfully" is
   * deliberately never checked here — this function answers "would a
   * restore be SAFE to attempt," not "does the sealed ciphertext parse."
   */
  getDirectRatchetLiveVerification(conversationId: string, remoteDeviceRef: string): FedosDirectRatchetLiveVerificationState {
    const counterparty = resolveCounterparty(this.#deps, conversationId as FedosConversationId);
    if (counterparty.outcome !== "resolved") return "not-applicable";

    const resolution = resolveFedosDirectRatchetDevicePair(this.#deps.deviceRegistry, this.#deps.sessionPersistence, {
      localAccountRef: counterparty.localAccountRef,
      localDeviceRef: this.#deps.localDeviceRef,
      remoteAccountRef: counterparty.remoteAccountRef,
      remoteDeviceRef,
      conversationId: conversationId as FedosConversationId,
    });
    if (resolution.outcome !== "resolved") return "not-applicable";

    const metadata = this.#stateRuntime.getSessionMetadata(resolution.sessionId);
    if (metadata === null || (metadata.lifecycleState !== "active" && metadata.lifecycleState !== "initialized")) return "not-applicable";

    if (this.#liveSessionCache.get(resolution.sessionId) !== null) return "live-confirmed-this-process";

    const { snapshot, corrupt } = readFedosDirectRatchetLiveStateSnapshotSafe(this.#deps.snapshotPersistence, resolution.sessionId as unknown as string);
    if (corrupt) return "restore-attempted-and-failed";
    const freshness = checkFedosDirectRatchetLiveStateSnapshotFreshness(snapshot, metadata.counters);
    if (freshness === "not-found") return "no-durable-snapshot";
    if (freshness === "stale") return "restore-attempted-and-failed";
    return "restorable-not-yet-confirmed";
  }

  /**
   * Commerce Product-Media Sync + Truthful Completion mega-arc (Wave B) —
   * a narrow, additive, read-only delegation to the already-existing
   * session-persistence listing, needed by
   * `FedosIdentityTransitionPeerRuntime.assessIdentityTransitionRatchetImpact()`
   * to plan which real sessions an Identity Replacement's Ratchet reset
   * would affect. Mirrors `getDirectRatchetStatus()`'s own "delegate to an
   * already-public persistence method, no new business logic" shape —
   * never exposes session secrets, only the same record shape the
   * persistence layer already returns.
   */
  listLiveSessions(): readonly FedosDirectRatchetSessionRecordV1[] {
    return this.#deps.sessionPersistence.listSessions();
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
