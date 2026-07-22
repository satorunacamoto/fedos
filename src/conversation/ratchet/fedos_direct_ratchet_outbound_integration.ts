/**
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — Phase D/E: real outbound session
 * establishment and real outbound ratchet message send.
 *
 * Required ordering (Phase E):
 *   1. authorize the Direct Conversation send — the CALLER's own job
 *      (`FedosConversationDirectMessagingCoordinator.sendDirectMessage()`
 *      already authorizes BEFORE its `ratchetDelivery` thunk ever fires;
 *      this class performs no authorization of its own).
 *   2. identify the exact remote Device/path — `remoteDeviceRef`, an
 *      explicit, already-configured value (never fabricated).
 *   3. select the explicit route — `resolveFedosDirectRatchetRoute()`.
 *   4. require an active ratchet session — the route resolver's own
 *      `"unsupported"` outcomes fail closed BEFORE any encrypt.
 *   5. call the real Ratchet Core encrypt operation.
 *   6. atomically persist the complete next ratchet revision — the
 *      Foundation Runtime's own event-sourced `updateCounters()` (Alpha
 *      5401–5480, UNCHANGED).
 *   7. construct the ratchet payload.
 *   8–13. Rumor/Seal/Gift Wrap/Outbox/publish/ACK — the EXISTING,
 *      UNCHANGED `FedosPrivateTransport` seam (`sendMailboxNip17()`/
 *      `sendMailboxNip17Control()`), injected as an opaque thunk exactly
 *      like the static route's own `sendMailboxNip17` dependency.
 *
 * CRITICAL RULE: a failed publish never causes reuse of the consumed
 * ratchet message key. `encrypt()` runs EXACTLY ONCE per logical send
 * (step 5), producing one already-consumed wire message; the resulting
 * already-signed Gift Wrap is what `FedosPrivateTransport`'s own Outbox
 * retries verbatim (Option A, the SAME retry-safety answer the static
 * NIP-17 lineage already adopted — see
 * `../transport/fedos_private_wire_prepared_delivery.ts`'s own header).
 * This file never re-encrypts the same logical send using rolled-back
 * state, and never silently falls back to a static/legacy route.
 */
import type { FedosDeviceRegistryPersistence } from "../../device/persistence/fedos_device_registry_persistence.js";
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import type { FedosMasterSeedAuthority } from "../../runtime/master_seed/fedos_master_seed_authority.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationEnvelopeId } from "../envelope/fedos_conversation_envelope_id.js";
import type { FedosPrivateWireDeliveryQueueOutcome } from "../transport/fedos_private_wire_prepared_delivery.js";
import type { FedosPrivateWireRouteAvailability } from "../transport/fedos_private_wire_route.js";
import { resolveFedosDirectRatchetRoute } from "./fedos_direct_ratchet_route_resolution.js";
import {
  resolveFedosDirectRatchetDevicePair,
  findCurrentFedosDirectRatchetSession,
  FEDOS_DIRECT_RATCHET_DEFAULT_SUITE,
} from "./fedos_direct_ratchet_device_pair_resolver.js";
import type { FedosDirectRatchetSessionPersistence } from "./persistence/fedos_direct_ratchet_session_persistence.js";
import type { FedosSealedDirectRatchetSecretPersistence } from "./persistence/fedos_sealed_direct_ratchet_secret_persistence.js";
import type { FedosDirectRatchetRemotePublicKeyPersistence } from "./persistence/fedos_direct_ratchet_remote_public_key_persistence.js";
import type { FedosDirectRatchetLiveStateSnapshotPersistence } from "./persistence/fedos_direct_ratchet_live_state_snapshot_persistence.js";
import { FedosDirectRatchetStateRuntime } from "./fedos_direct_ratchet_state_runtime.js";
import type { FedosDirectRatchetSessionId } from "./fedos_direct_ratchet_session_id.js";
import { FedosDirectRatchetCryptographicSession } from "./fedos_direct_ratchet_cryptographic_session.js";
import { FedosDirectRatchetLiveSessionCache } from "./fedos_direct_ratchet_live_session_cache.js";
import {
  checkpointFedosDirectRatchetSecretsV1,
  restoreFedosDirectRatchetSealedStateV1,
} from "./fedos_direct_ratchet_secret_checkpoint.js";
import {
  encodeFedosDirectRatchetNip17PayloadToPlaintext,
  wireMessageBytesToBase64,
  type FedosDirectRatchetMessagePayloadV1,
  type FedosDirectRatchetSessionInitPayloadV1,
} from "../delivery/nostr/nip17/fedos_direct_ratchet_nip17_payload.js";
import type { FedosDeviceSigningKeypair } from "../../device/crypto/fedos_device_signing_keypair.js";
import type { FedosDirectRatchetSessionResetReason } from "./fedos_direct_ratchet_session_reset_reason.js";
import {
  createFedosDirectRatchetSessionResetDeviceSignature,
  type FedosDirectRatchetSessionResetSignableContent,
} from "./fedos_direct_ratchet_session_reset_authentication.js";
import type { FedosDirectRatchetResetCoordinator } from "./fedos_direct_ratchet_reset_coordinator.js";
import { generateFedosDirectRatchetSessionResetNonce } from "./fedos_direct_ratchet_session_reset_nonce.js";

export type FedosDirectRatchetCounterpartyResolution =
  | { readonly outcome: "resolved"; readonly localAccountRef: FedosDeviceBindingAccountRef; readonly remoteAccountRef: FedosDeviceBindingAccountRef; readonly remoteAccountPublicKeyHex: string }
  | { readonly outcome: "not-direct" }
  | { readonly outcome: "identity-unavailable" };

export type FedosDirectRatchetEstablishOutcome =
  | { readonly outcome: "initiated"; readonly sessionId: FedosDirectRatchetSessionId; readonly queue: FedosPrivateWireDeliveryQueueOutcome }
  | { readonly outcome: "already-active"; readonly sessionId: FedosDirectRatchetSessionId }
  | { readonly outcome: "not-direct" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "local-device-unknown" | "local-device-revoked" | "local-device-not-trusted" }
  | { readonly outcome: "remote-device-unknown" | "remote-device-revoked" | "remote-device-not-trusted" }
  | { readonly outcome: "invalid-binding" }
  | { readonly outcome: "crypto-unavailable" }
  | { readonly outcome: "persistence-failed" }
  /** A tuple with an existing generation was asked to establish again (a real reset, `current !== null`) without naming a `reason` — review §09's own "a reset always names why" decision, enforced here as a hard, structural requirement rather than a silently-defaulted one. */
  | { readonly outcome: "reason-required" };

export interface FedosDirectRatchetEstablishOptions {
  /** REQUIRED whenever a session already exists for this tuple (a real reset) — omitted (or supplied regardless, harmlessly ignored) for a tuple's very first establishment. */
  readonly reason?: FedosDirectRatchetSessionResetReason;
  /** OPTIONAL — see `./fedos_direct_ratchet_session_reset_authentication.ts`'s own header for why this can never be a hard requirement: this Runtime never durably holds a Device signing keypair, so a caller that currently has one available (e.g. mid-session in an unlocked Desktop process) may supply it per-call to additionally authenticate this specific reset at the Device level, on top of the existing, always-real NIP-17 envelope-level account authentication. */
  readonly deviceSigningKeypair?: FedosDeviceSigningKeypair;
}

export type FedosDirectRatchetSendOutcome =
  | { readonly outcome: "queued"; readonly sessionId: FedosDirectRatchetSessionId; readonly queue: FedosPrivateWireDeliveryQueueOutcome }
  | { readonly outcome: "route-unavailable"; readonly reason: string }
  | { readonly outcome: "crypto-unavailable" }
  | { readonly outcome: "persistence-failed" }
  | { readonly outcome: "not-direct" }
  | { readonly outcome: "identity-unavailable" };

export interface FedosDirectRatchetOutboundIntegrationDependencies {
  readonly deviceRegistry: FedosDeviceRegistryPersistence;
  readonly sessionPersistence: FedosDirectRatchetSessionPersistence;
  readonly sealedSecretPersistence: FedosSealedDirectRatchetSecretPersistence;
  readonly stateRuntime: FedosDirectRatchetStateRuntime;
  readonly masterSeedAuthority: FedosMasterSeedAuthority;
  readonly accountIndex: number;
  readonly localDeviceRef: string;
  readonly liveSessionCache: FedosDirectRatchetLiveSessionCache;
  readonly remotePublicKeyPersistence: FedosDirectRatchetRemotePublicKeyPersistence;
  readonly snapshotPersistence: FedosDirectRatchetLiveStateSnapshotPersistence;
  readonly resetCoordinator: FedosDirectRatchetResetCoordinator;
  /** Overridable for tests only — defaults to `generateFedosDirectRatchetSessionResetNonce()`. */
  readonly resetNonceGenerator?: () => string;
  readonly resolveCounterparty: (conversationId: FedosConversationId) => FedosDirectRatchetCounterpartyResolution;
  readonly sendMailboxNip17Control: (
    controlId: string,
    conversationId: FedosConversationId,
    plaintext: Uint8Array,
    createdAt: number,
  ) => Promise<FedosPrivateWireDeliveryQueueOutcome>;
  readonly now: () => number;
}

const NEVER_AVAILABLE: FedosPrivateWireRouteAvailability = { isAvailable: () => false };

export class FedosDirectRatchetOutboundIntegration {
  readonly #deps: FedosDirectRatchetOutboundIntegrationDependencies;

  constructor(deps: FedosDirectRatchetOutboundIntegrationDependencies) {
    this.#deps = deps;
  }

  /** Phase D — the local Runtime that calls this becomes the RECEIVER role (publishes its own fresh ratchet public key; see `fedos_direct_ratchet_cryptographic_session.js`'s own header for why only the receiver role needs no remote public key up front). */
  async establishSession(
    conversationId: FedosConversationId,
    remoteDeviceRef: string,
    options?: FedosDirectRatchetEstablishOptions,
  ): Promise<FedosDirectRatchetEstablishOutcome> {
    const counterparty = this.#deps.resolveCounterparty(conversationId);
    if (counterparty.outcome === "not-direct") return { outcome: "not-direct" };
    if (counterparty.outcome === "identity-unavailable") return { outcome: "identity-unavailable" };

    const current = findCurrentFedosDirectRatchetSession(this.#deps.sessionPersistence, {
      localAccountRef: counterparty.localAccountRef,
      localDeviceRef: this.#deps.localDeviceRef,
      remoteAccountRef: counterparty.remoteAccountRef,
      remoteDeviceRef,
      conversationId,
      suite: FEDOS_DIRECT_RATCHET_DEFAULT_SUITE,
    });
    // A `reason` supplied by the caller is an explicit request for a real
    // reset (a NEW generation) even though the current one is still
    // active/initialized — the "already-active" idempotent short-circuit
    // below applies ONLY when no reset was actually requested; otherwise
    // every reset would be silently swallowed as a no-op the very first
    // time it mattered (the current session being active is precisely
    // the normal case a reset supersedes).
    if (
      current !== null &&
      (current.lifecycleState === "active" || current.lifecycleState === "initialized") &&
      options?.reason === undefined
    ) {
      return { outcome: "already-active", sessionId: current.binding.sessionId };
    }
    const previousGeneration = current === null ? null : current.binding.generation;
    if (previousGeneration !== null && options?.reason === undefined) {
      return { outcome: "reason-required" };
    }
    const reason = previousGeneration === null ? null : (options!.reason as FedosDirectRatchetSessionResetReason);
    const generation = current === null ? 0 : current.binding.generation + 1;
    const resetNonce = (this.#deps.resetNonceGenerator ?? generateFedosDirectRatchetSessionResetNonce)();

    const resolution = resolveFedosDirectRatchetDevicePair(this.#deps.deviceRegistry, this.#deps.sessionPersistence, {
      localAccountRef: counterparty.localAccountRef,
      localDeviceRef: this.#deps.localDeviceRef,
      remoteAccountRef: counterparty.remoteAccountRef,
      remoteDeviceRef,
      conversationId,
      generation,
    });
    if (resolution.outcome !== "resolved") return { outcome: resolution.outcome };

    const session = await FedosDirectRatchetCryptographicSession.createAsReceiver(
      this.#deps.masterSeedAuthority,
      this.#deps.accountIndex,
      counterparty.remoteAccountPublicKeyHex,
      resolution.sessionId,
      this.#deps.localDeviceRef,
      generation,
    );
    if (session === null) return { outcome: "crypto-unavailable" };

    const created = this.#deps.stateRuntime.createSession({
      sessionId: resolution.sessionId,
      localAccountRef: counterparty.localAccountRef,
      localDeviceRef: this.#deps.localDeviceRef,
      remoteAccountRef: counterparty.remoteAccountRef,
      remoteDeviceRef,
      conversationId,
      suite: FEDOS_DIRECT_RATCHET_DEFAULT_SUITE,
      generation,
    });
    if (created.outcome !== "created") return { outcome: "persistence-failed" };
    const activated = this.#deps.stateRuntime.markActive(resolution.sessionId);
    if (activated.outcome !== "transitioned") return { outcome: "persistence-failed" };

    this.#deps.resetCoordinator.applyConsequences({
      localAccountRef: counterparty.localAccountRef,
      localDeviceRef: this.#deps.localDeviceRef,
      remoteAccountRef: counterparty.remoteAccountRef,
      remoteDeviceRef,
      conversationId: conversationId as unknown as string,
      suite: FEDOS_DIRECT_RATCHET_DEFAULT_SUITE,
      previousGeneration,
      newGeneration: generation,
      reason,
      nonce: resetNonce,
      initiator: "local",
      outcome: previousGeneration === null ? "accepted-initial" : "accepted-reset",
      previousSessionId: current?.binding.sessionId ?? null,
    });

    this.#deps.liveSessionCache.set(resolution.sessionId, session);

    const sealedState = await session.sealState(this.#deps.masterSeedAuthority, remoteDeviceRef, conversationId as unknown as string);
    if (sealedState !== null) {
      checkpointFedosDirectRatchetSecretsV1(
        this.#deps.sealedSecretPersistence,
        this.#deps.snapshotPersistence,
        resolution.sessionId,
        FEDOS_DIRECT_RATCHET_DEFAULT_SUITE,
        generation,
        sealedState,
        this.#deps.now(),
      );
    }

    const ratchetPublicKeyHex = await session.localRatchetPublicKeyHex();
    if (ratchetPublicKeyHex === null) return { outcome: "crypto-unavailable" };

    const signableContent: FedosDirectRatchetSessionResetSignableContent = {
      suite: FEDOS_DIRECT_RATCHET_DEFAULT_SUITE,
      generation,
      previousGeneration,
      resetReason: reason,
      resetNonce,
      senderAccountRef: counterparty.localAccountRef,
      senderDeviceRef: this.#deps.localDeviceRef,
      recipientAccountRef: counterparty.remoteAccountRef,
      recipientDeviceRef: remoteDeviceRef,
      conversationId: conversationId as unknown as string,
      ratchetPublicKeyHex,
    };
    const deviceSignatureHex =
      options?.deviceSigningKeypair !== undefined
        ? createFedosDirectRatchetSessionResetDeviceSignature(options.deviceSigningKeypair, signableContent)
        : null;

    const initPayload: FedosDirectRatchetSessionInitPayloadV1 = {
      schemaVersion: 1,
      kind: "session-init",
      ...signableContent,
      deviceSignatureHex,
    };
    const controlId = `direct-ratchet-init##${resolution.sessionId}`;
    const now = this.#deps.now();
    const queue = await this.#deps.sendMailboxNip17Control(
      controlId,
      conversationId,
      encodeFedosDirectRatchetNip17PayloadToPlaintext(initPayload),
      now,
    );

    return { outcome: "initiated", sessionId: resolution.sessionId, queue };
  }

  /** Phase E — real ratchet message send. `sendMailboxNip17` is the SAME real-Envelope thunk shape the static route already uses. */
  async sendMessage(
    conversationId: FedosConversationId,
    envelopeId: FedosConversationEnvelopeId,
    remoteDeviceRef: string,
    plaintext: Uint8Array,
    sendMailboxNip17: (
      envelopeId: FedosConversationEnvelopeId,
      conversationId: FedosConversationId,
      plaintext: Uint8Array,
    ) => Promise<FedosPrivateWireDeliveryQueueOutcome>,
  ): Promise<FedosDirectRatchetSendOutcome> {
    const counterparty = this.#deps.resolveCounterparty(conversationId);
    if (counterparty.outcome === "not-direct") return { outcome: "not-direct" };
    if (counterparty.outcome === "identity-unavailable") return { outcome: "identity-unavailable" };

    const decision = resolveFedosDirectRatchetRoute("nostr-nip17-v1-ratchet", {
      deviceRegistry: this.#deps.deviceRegistry,
      sessionPersistence: this.#deps.sessionPersistence,
      stateRuntime: this.#deps.stateRuntime,
      devicePair: {
        localAccountRef: counterparty.localAccountRef,
        localDeviceRef: this.#deps.localDeviceRef,
        remoteAccountRef: counterparty.remoteAccountRef,
        remoteDeviceRef,
        conversationId,
      },
      legacyAdapterFor: () => NEVER_AVAILABLE,
    });
    if (decision.route !== "nostr-nip17-v1-ratchet") {
      return { outcome: "route-unavailable", reason: decision.route === "unsupported" ? decision.reason : "unknown" };
    }
    const sessionId = decision.sessionId;

    const sessionMetadata = this.#deps.stateRuntime.getSessionMetadata(sessionId);
    if (sessionMetadata === null) return { outcome: "route-unavailable", reason: "session-initialization-required" };

    let session = this.#deps.liveSessionCache.get(sessionId);
    if (session === null) {
      const restored = await this.#restoreLiveSession(sessionId, remoteDeviceRef, conversationId, sessionMetadata);
      if (restored === null) return { outcome: "crypto-unavailable" };
      session = restored;
      this.#deps.liveSessionCache.set(sessionId, session);
    }

    const ready = await session.isReadyToSend();
    if (!ready) return { outcome: "route-unavailable", reason: "session-initialization-required" };

    const wireMessage = await session.encrypt(plaintext);
    if (wireMessage === null) return { outcome: "crypto-unavailable" };

    const remoteRatchetPublicKeyHexAfter = await session.remoteRatchetPublicKeyHex();
    if (remoteRatchetPublicKeyHexAfter !== null) {
      this.#deps.remotePublicKeyPersistence.putRemoteRatchetPublicKeyHex(sessionId as unknown as string, remoteRatchetPublicKeyHexAfter);
    }

    // A DH ratchet step can occur inside `decrypt()` on a PRIOR call and
    // resets `send_counter` to `0` (see `FedosDirectRatchetStateRuntime.commitCounters()`'s
    // own header) — `encrypt()` itself never triggers a DH step, but the
    // counters read here must always be the LIVE session's own current,
    // authoritative values, never a locally-assumed increment.
    const sendCounterAfter = await session.sendCounter();
    const receiveCounterAfter = await session.receiveCounter();
    const previousChainCounterAfter = await session.previousSendingChainLength();
    const counterUpdate = this.#deps.stateRuntime.commitCounters(sessionId, {
      sendCounter: sendCounterAfter ?? sessionMetadata.counters.sendCounter + 1,
      receiveCounter: receiveCounterAfter ?? sessionMetadata.counters.receiveCounter,
      previousChainCounter: previousChainCounterAfter ?? sessionMetadata.counters.previousChainCounter,
    });
    if (counterUpdate.outcome !== "updated") return { outcome: "persistence-failed" };

    // Phase E step 6 — checkpoint the NOW-ADVANCED chain-key state
    // BEFORE constructing/sending the payload: the sending chain key
    // genuinely advances on every `encrypt()` call (see this file's own
    // header), so the durable snapshot must be refreshed every send, not
    // only at session establishment.
    const sealedStateAfterEncrypt = await session.sealState(
      this.#deps.masterSeedAuthority,
      remoteDeviceRef,
      conversationId as unknown as string,
    );
    if (sealedStateAfterEncrypt !== null) {
      checkpointFedosDirectRatchetSecretsV1(
        this.#deps.sealedSecretPersistence,
        this.#deps.snapshotPersistence,
        sessionId,
        sessionMetadata.binding.suite,
        sessionMetadata.binding.generation,
        sealedStateAfterEncrypt,
        this.#deps.now(),
      );
    }

    const messagePayload: FedosDirectRatchetMessagePayloadV1 = {
      schemaVersion: 1,
      kind: "message",
      suite: sessionMetadata.binding.suite,
      generation: sessionMetadata.binding.generation,
      sessionId: sessionId as unknown as string,
      messageNumber: sendCounterAfter ?? counterUpdate.record.counters.sendCounter,
      wireMessageBase64: wireMessageBytesToBase64(wireMessage),
    };

    const queue = await sendMailboxNip17(envelopeId, conversationId, encodeFedosDirectRatchetNip17PayloadToPlaintext(messagePayload));
    return { outcome: "queued", sessionId, queue };
  }

  async #restoreLiveSession(
    sessionId: FedosDirectRatchetSessionId,
    remoteDeviceRef: string,
    conversationId: FedosConversationId,
    sessionMetadata: ReturnType<FedosDirectRatchetStateRuntime["getSessionMetadata"]> & {},
  ): Promise<FedosDirectRatchetCryptographicSession | null> {
    const sealedState = restoreFedosDirectRatchetSealedStateV1(
      this.#deps.sealedSecretPersistence,
      this.#deps.snapshotPersistence,
      sessionId,
      sessionMetadata.binding.generation,
    );
    if (sealedState === null) return null;
    const remoteRatchetPublicKeyHex = this.#deps.remotePublicKeyPersistence.getRemoteRatchetPublicKeyHex(sessionId as unknown as string);
    return FedosDirectRatchetCryptographicSession.restore(
      this.#deps.masterSeedAuthority,
      remoteDeviceRef,
      conversationId as unknown as string,
      sessionId as unknown as string,
      this.#deps.localDeviceRef,
      sessionMetadata.binding.generation,
      sessionMetadata.counters.sendCounter,
      sessionMetadata.counters.receiveCounter,
      sessionMetadata.counters.previousChainCounter,
      remoteRatchetPublicKeyHex,
      sealedState,
    );
  }
}
