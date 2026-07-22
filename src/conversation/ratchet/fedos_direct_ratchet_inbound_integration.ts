/**
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — Phase G: real inbound ratchet
 * dispatch.
 *
 * Required ordering:
 *   1. receive Gift Wrap — the CALLER's own job (a real inbound
 *      subscription already dispatched through
 *      `NostrNip17V1WireAdapter.parse()`; this file never touches a raw
 *      wire event).
 *   2. existing outer-event validation — done by the CALLER.
 *   3. decrypt/unwrap Seal and Rumor — done by the CALLER
 *      (`NostrNip17V1WireAdapter.parse()`); this file receives an
 *      ALREADY fully-authenticated `FedosPrivateWireParsedRumor`.
 *   4. classify the inner route/payload —
 *      `decodeFedosDirectRatchetNip17PayloadFromContent()`; a decode
 *      failure returns `"not-ratchet-payload"` so the caller falls
 *      through to the EXISTING, UNCHANGED legacy
 *      `FedosNip17InboundImportCoordinator` — never the reverse (see
 *      that codec file's own header for why this ordering prevents
 *      mislabeling).
 *   5. validate schema and limits — the codec's own strict validator.
 *   6. resolve the exact recipient Device-pair session.
 *   7. validate ratchet header/context.
 *   8. call real Ratchet Core decrypt.
 *   9. atomically persist the complete next ratchet revision.
 *  10. import exact plaintext through the existing Conversation pipeline
 *      — mirrors `FedosNip17InboundImportCoordinator`'s own identical
 *      local-storage-at-rest re-seal (Alpha 1860, UNCHANGED reviewed
 *      boundary), duplicated here rather than refactored into that
 *      frozen coordinator (this codebase's own established "model
 *      directly on" precedent — see that file's own header for the same
 *      choice made one Arc earlier).
 *  11/12. Retention/Search/safe observations — inherited for free: the
 *      imported Envelope/Payload flow through the SAME unmodified
 *      `FedosConversationEncryptionAuthority`/envelope/payload ports
 *      every other Direct message already uses.
 *
 * Authentication failure never advances state: a `decrypt()` failure
 * (tamper, wrong Device, replay/duplicate message number — the Rust
 * ratchet core's own fail-closed `null`) returns `"decrypt-failed"`
 * WITHOUT importing anything or updating counters. A duplicate Rumor
 * (same `envelopeId`, even re-wrapped in a different Gift Wrap) is
 * rejected BEFORE decrypt is ever attempted (Phase H — layered dedup),
 * mirroring `FedosNip17InboundImportCoordinator`'s own Alpha 1861
 * dedup-before-decrypt discipline exactly.
 */
import type { FedosDeviceRegistryPersistence } from "../../device/persistence/fedos_device_registry_persistence.js";
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import type { FedosMasterSeedAuthority } from "../../runtime/master_seed/fedos_master_seed_authority.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationDraftPersistence } from "../construction/fedos_conversation_draft_persistence.js";
import type { FedosConversationActivationPersistence } from "../activation/fedos_conversation_activation_persistence.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationIdentityResolver } from "../encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationEncryptionAuthority } from "../encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationMessageEnvelopePersistence } from "../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import { serializeFedosConversationMessageEnvelope } from "../envelope/persistence/fedos_conversation_message_envelope_codec.js";
import { validateFedosConversationMessageEnvelope } from "../envelope/fedos_conversation_message_envelope_validator.js";
import { toFedosConversationEnvelopeId, type FedosConversationEnvelopeIdGenerator } from "../envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationPayloadStorage } from "../payload_storage/fedos_conversation_payload_storage.js";
import { toFedosConversationPayloadId, type FedosConversationPayloadIdGenerator } from "../payload_storage/fedos_conversation_payload_id.js";
import { FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH } from "../encryption/fedos_conversation_membership_readiness.js";
import {
  resolveFedosPrivateNostrInboundDirectConversation,
  type FedosPrivateNostrInboundConversationResolution,
} from "../delivery/nostr/fedos_private_nostr_inbound_conversation_resolver.js";
import {
  createFedosPrivateNostrImportRecord,
  type FedosPrivateNostrImportRecordPersistence,
} from "../delivery/nostr/fedos_private_nostr_import_record.js";
import type { FedosPrivateWireParsedRumor } from "../transport/fedos_private_wire_adapter.js";
import {
  decodeFedosDirectRatchetNip17PayloadFromContent,
  wireMessageBytesFromBase64,
  type FedosDirectRatchetSessionInitPayloadV1,
  type FedosDirectRatchetMessagePayloadV1,
} from "../delivery/nostr/nip17/fedos_direct_ratchet_nip17_payload.js";
import {
  resolveFedosDirectRatchetDevicePair,
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

export type FedosDirectRatchetInboundReceiveResult =
  | { readonly outcome: "not-ratchet-payload" }
  | { readonly outcome: "duplicate" }
  | { readonly outcome: "unknown-sender" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "invalid-payload" }
  | { readonly outcome: "wrong-conversation" }
  | { readonly outcome: "wrong-recipient" }
  | { readonly outcome: "unsupported-suite" }
  | { readonly outcome: "local-device-unknown" | "local-device-revoked" | "local-device-not-trusted" }
  | { readonly outcome: "remote-device-unknown" | "remote-device-revoked" | "remote-device-not-trusted" }
  | { readonly outcome: "invalid-binding" }
  | { readonly outcome: "crypto-unavailable" }
  | { readonly outcome: "session-established"; readonly sessionId: string }
  | { readonly outcome: "already-initialized"; readonly sessionId: string }
  | { readonly outcome: "unknown-session" }
  | { readonly outcome: "session-not-active" }
  | { readonly outcome: "decrypt-failed" }
  | { readonly outcome: "persistence-failed" }
  | { readonly outcome: "imported"; readonly conversationId: string; readonly envelopeId: string };

export interface FedosDirectRatchetInboundIntegrationDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly activationPersistence: FedosConversationActivationPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly deviceRegistry: FedosDeviceRegistryPersistence;
  readonly sessionPersistence: FedosDirectRatchetSessionPersistence;
  readonly sealedSecretPersistence: FedosSealedDirectRatchetSecretPersistence;
  readonly remotePublicKeyPersistence: FedosDirectRatchetRemotePublicKeyPersistence;
  readonly snapshotPersistence: FedosDirectRatchetLiveStateSnapshotPersistence;
  readonly stateRuntime: FedosDirectRatchetStateRuntime;
  readonly masterSeedAuthority: FedosMasterSeedAuthority;
  readonly accountIndex: number;
  readonly localDeviceRef: string;
  readonly liveSessionCache: FedosDirectRatchetLiveSessionCache;
  readonly encryptionAuthority: FedosConversationEncryptionAuthority;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  readonly envelopeIdGenerator: FedosConversationEnvelopeIdGenerator;
  readonly payloadIdGenerator: FedosConversationPayloadIdGenerator;
  readonly importRecordPersistence: FedosPrivateNostrImportRecordPersistence;
  readonly clock: () => number;
}

function accountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier;
}

export class FedosDirectRatchetInboundIntegration {
  readonly #deps: FedosDirectRatchetInboundIntegrationDependencies;

  constructor(deps: FedosDirectRatchetInboundIntegrationDependencies) {
    this.#deps = deps;
  }

  async receiveRumor(rumor: FedosPrivateWireParsedRumor, relaySource: string | null): Promise<FedosDirectRatchetInboundReceiveResult> {
    const payload = decodeFedosDirectRatchetNip17PayloadFromContent(rumor.content);
    if (payload === null) return { outcome: "not-ratchet-payload" };

    // Phase H — layered dedup: Rumor-id dedup BEFORE any decrypt/state
    // change, sharing the SAME dedicated namespace for every ratchet
    // control/message fact this integration ever imports.
    if (this.#deps.importRecordPersistence.getImport(rumor.envelopeId) !== null) return { outcome: "duplicate" };

    const resolution = resolveFedosPrivateNostrInboundDirectConversation(
      {
        draftPersistence: this.#deps.draftPersistence,
        activationPersistence: this.#deps.activationPersistence,
        membershipAuthority: this.#deps.membershipAuthority,
        identityResolver: this.#deps.identityResolver,
      },
      rumor.senderPublicKeyHex,
    );
    if (resolution.outcome === "identity-unavailable") return { outcome: "identity-unavailable" };
    if (resolution.outcome === "unknown-sender") return { outcome: "unknown-sender" };

    const identity = this.#deps.identityResolver.resolveLocalParticipant();
    if (identity.outcome === "unavailable") return { outcome: "identity-unavailable" };
    const localAccountRef: FedosDeviceBindingAccountRef = {
      authority: identity.creator.authority,
      publicIdentifier: identity.creator.publicIdentifier,
      identityId: null,
    };
    const remoteAccountRef: FedosDeviceBindingAccountRef = {
      authority: resolution.counterpartyMembership.participant.authority,
      publicIdentifier: resolution.counterpartyMembership.participant.publicIdentifier,
      identityId: null,
    };

    if (payload.suite !== FEDOS_DIRECT_RATCHET_DEFAULT_SUITE) return { outcome: "unsupported-suite" };

    if (payload.kind === "session-init") {
      return this.#receiveSessionInit(rumor, relaySource, payload, resolution.conversationId, localAccountRef, remoteAccountRef);
    }
    return this.#receiveMessage(rumor, relaySource, payload, resolution, localAccountRef, remoteAccountRef);
  }

  async #receiveSessionInit(
    rumor: FedosPrivateWireParsedRumor,
    relaySource: string | null,
    payload: FedosDirectRatchetSessionInitPayloadV1,
    conversationId: string,
    localAccountRef: FedosDeviceBindingAccountRef,
    remoteAccountRef: FedosDeviceBindingAccountRef,
  ): Promise<FedosDirectRatchetInboundReceiveResult> {
    if (payload.conversationId !== conversationId) return { outcome: "wrong-conversation" };
    if (!accountRefsEqual(payload.recipientAccountRef, localAccountRef)) return { outcome: "wrong-recipient" };
    if (payload.recipientDeviceRef !== this.#deps.localDeviceRef) return { outcome: "wrong-recipient" };
    if (!accountRefsEqual(payload.senderAccountRef, remoteAccountRef)) return { outcome: "wrong-recipient" };

    const resolution = resolveFedosDirectRatchetDevicePair(this.#deps.deviceRegistry, this.#deps.sessionPersistence, {
      localAccountRef,
      localDeviceRef: this.#deps.localDeviceRef,
      remoteAccountRef,
      remoteDeviceRef: payload.senderDeviceRef,
      conversationId: conversationId as FedosConversationId,
      generation: payload.generation,
    });
    if (resolution.outcome !== "resolved") return { outcome: resolution.outcome };

    const existing = this.#deps.stateRuntime.getSessionMetadata(resolution.sessionId);
    if (existing !== null && (existing.lifecycleState === "active" || existing.lifecycleState === "initialized")) {
      this.#recordImport(rumor, relaySource);
      return { outcome: "already-initialized", sessionId: resolution.sessionId as unknown as string };
    }

    const session = await FedosDirectRatchetCryptographicSession.createAsSender(
      this.#deps.masterSeedAuthority,
      this.#deps.accountIndex,
      rumor.senderPublicKeyHex,
      resolution.sessionId,
      this.#deps.localDeviceRef,
      payload.generation,
      payload.ratchetPublicKeyHex,
    );
    if (session === null) return { outcome: "crypto-unavailable" };

    const created = this.#deps.stateRuntime.createSession({
      sessionId: resolution.sessionId,
      localAccountRef,
      localDeviceRef: this.#deps.localDeviceRef,
      remoteAccountRef,
      remoteDeviceRef: payload.senderDeviceRef,
      conversationId: conversationId as FedosConversationId,
      suite: FEDOS_DIRECT_RATCHET_DEFAULT_SUITE,
      generation: payload.generation,
    });
    if (created.outcome !== "created" && created.outcome !== "already-exists") return { outcome: "persistence-failed" };
    if (created.outcome === "created") {
      const activated = this.#deps.stateRuntime.markActive(resolution.sessionId);
      if (activated.outcome !== "transitioned") return { outcome: "persistence-failed" };
    }

    this.#deps.liveSessionCache.set(resolution.sessionId, session);
    this.#deps.remotePublicKeyPersistence.putRemoteRatchetPublicKeyHex(resolution.sessionId as unknown as string, payload.ratchetPublicKeyHex);

    const sealedState = await session.sealState(this.#deps.masterSeedAuthority, payload.senderDeviceRef, conversationId);
    if (sealedState !== null) {
      checkpointFedosDirectRatchetSecretsV1(
        this.#deps.sealedSecretPersistence,
        this.#deps.snapshotPersistence,
        resolution.sessionId,
        FEDOS_DIRECT_RATCHET_DEFAULT_SUITE,
        payload.generation,
        sealedState,
        this.#deps.clock(),
      );
    }

    this.#recordImport(rumor, relaySource);
    return { outcome: "session-established", sessionId: resolution.sessionId as unknown as string };
  }

  async #receiveMessage(
    rumor: FedosPrivateWireParsedRumor,
    relaySource: string | null,
    payload: FedosDirectRatchetMessagePayloadV1,
    resolution: Extract<FedosPrivateNostrInboundConversationResolution, { outcome: "resolved" }>,
    localAccountRef: FedosDeviceBindingAccountRef,
    remoteAccountRef: FedosDeviceBindingAccountRef,
  ): Promise<FedosDirectRatchetInboundReceiveResult> {
    const sessionId = payload.sessionId as unknown as FedosDirectRatchetSessionId;
    const sessionMetadata = this.#deps.stateRuntime.getSessionMetadata(sessionId);
    if (sessionMetadata === null) return { outcome: "unknown-session" };

    // Authentication: the CLAIMED sessionId must genuinely belong to THIS
    // exact sender/Conversation/local Device — verified against the
    // ALREADY-persisted, trust-established binding, never against the
    // wire's own unauthenticated say-so.
    if ((sessionMetadata.binding.conversationId as unknown as string) !== resolution.conversationId) return { outcome: "wrong-conversation" };
    if (!accountRefsEqual(sessionMetadata.binding.localAccountRef, localAccountRef)) return { outcome: "wrong-recipient" };
    if (sessionMetadata.binding.localDeviceRef !== this.#deps.localDeviceRef) return { outcome: "wrong-recipient" };
    if (!accountRefsEqual(sessionMetadata.binding.remoteAccountRef, remoteAccountRef)) return { outcome: "wrong-recipient" };
    if (sessionMetadata.binding.generation !== payload.generation) return { outcome: "unknown-session" };

    if (sessionMetadata.lifecycleState !== "active" && sessionMetadata.lifecycleState !== "initialized") {
      return { outcome: "session-not-active" };
    }

    let session = this.#deps.liveSessionCache.get(sessionId);
    if (session === null) {
      const restored = await this.#restoreLiveSession(sessionId, sessionMetadata);
      if (restored === null) return { outcome: "crypto-unavailable" };
      session = restored;
      this.#deps.liveSessionCache.set(sessionId, session);
    }

    const wireMessage = wireMessageBytesFromBase64(payload.wireMessageBase64);
    if (wireMessage === null) return { outcome: "invalid-payload" };

    const now = this.#deps.clock();
    const plaintext = await session.decrypt(wireMessage, now);
    if (plaintext === null) return { outcome: "decrypt-failed" };

    // Phase G step 9 — persist the next revision BEFORE import. A DH
    // ratchet step inside THIS decrypt can reset `send_counter` to `0`
    // (see `FedosDirectRatchetStateRuntime.commitCounters()`'s own
    // header) — every counter is read from the LIVE, now-authoritative
    // session, never locally assumed.
    const sendCounterAfter = await session.sendCounter();
    const receiveCounterAfter = await session.receiveCounter();
    const previousChainCounterAfter = await session.previousSendingChainLength();
    this.#deps.stateRuntime.commitCounters(sessionId, {
      sendCounter: sendCounterAfter ?? sessionMetadata.counters.sendCounter,
      receiveCounter: receiveCounterAfter ?? sessionMetadata.counters.receiveCounter + 1,
      previousChainCounter: previousChainCounterAfter ?? sessionMetadata.counters.previousChainCounter,
    });
    const remoteRatchetPublicKeyHexAfter = await session.remoteRatchetPublicKeyHex();
    if (remoteRatchetPublicKeyHexAfter !== null) {
      this.#deps.remotePublicKeyPersistence.putRemoteRatchetPublicKeyHex(sessionId as unknown as string, remoteRatchetPublicKeyHexAfter);
    }
    const sealedState = await session.sealState(
      this.#deps.masterSeedAuthority,
      sessionMetadata.binding.remoteDeviceRef,
      sessionMetadata.binding.conversationId as unknown as string,
    );
    if (sealedState !== null) {
      checkpointFedosDirectRatchetSecretsV1(
        this.#deps.sealedSecretPersistence,
        this.#deps.snapshotPersistence,
        sessionId,
        sessionMetadata.binding.suite,
        sessionMetadata.binding.generation,
        sealedState,
        now,
      );
    }

    // Phase G step 10 — import through the EXISTING Conversation pipeline.
    const localEnvelopeIdRaw = this.#deps.envelopeIdGenerator.generateEnvelopeId();
    const localEnvelopeId = toFedosConversationEnvelopeId(localEnvelopeIdRaw);
    const localPayloadId = toFedosConversationPayloadId(this.#deps.payloadIdGenerator.generatePayloadId());
    if (localEnvelopeId === null || localPayloadId === null) return { outcome: "persistence-failed" };

    const conversationIdBranded = resolution.conversationId as unknown as FedosConversationId;
    const encryption = await this.#deps.encryptionAuthority.encrypt({
      envelopeId: localEnvelopeId,
      conversationId: conversationIdBranded,
      senderMembershipId: resolution.counterpartyMembership.id,
      keyEpoch: FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH,
      createdAt: now,
      replyToEnvelopeId: null,
      suite: "ChaCha20Poly1305",
      plaintext,
      localAccountIndex: this.#deps.accountIndex,
      counterpartyPublicKeyHex: rumor.senderPublicKeyHex,
    });
    if (encryption.outcome !== "encrypted") return { outcome: "persistence-failed" };

    const payloadWrite = this.#deps.payloadStorage.putPayload(
      { id: localPayloadId, conversationId: conversationIdBranded, mediaType: "application/octet-stream", byteLength: encryption.ciphertext.length, createdAt: now },
      encryption.ciphertext,
    );
    if (payloadWrite === "failed" || payloadWrite === "conflict") return { outcome: "persistence-failed" };

    const localEnvelope = validateFedosConversationMessageEnvelope({
      id: localEnvelopeId,
      conversationId: resolution.conversationId,
      senderMembershipId: resolution.counterpartyMembership.id as unknown as string,
      payloadId: localPayloadId,
      encryptionSuite: "ChaCha20Poly1305",
      keyEpoch: FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH,
      createdAt: now,
      replyToEnvelopeId: null,
    });
    if (localEnvelope === null) return { outcome: "invalid-payload" };
    const envelopeWrite = this.#deps.envelopePersistence.putEnvelope(serializeFedosConversationMessageEnvelope(localEnvelope));
    if (envelopeWrite === "failed" || envelopeWrite === "conflict") return { outcome: "persistence-failed" };

    this.#recordImport(rumor, relaySource, resolution.conversationId, localEnvelopeId as unknown as string);
    return { outcome: "imported", conversationId: resolution.conversationId, envelopeId: localEnvelopeId as unknown as string };
  }

  #recordImport(rumor: FedosPrivateWireParsedRumor, relaySource: string | null, conversationId?: string, envelopeId?: string): void {
    const record = createFedosPrivateNostrImportRecord({
      nostrEventId: rumor.envelopeId,
      conversationId: conversationId ?? "direct-ratchet-control",
      envelopeId: envelopeId ?? rumor.envelopeId,
      relaySource,
      receivedAt: this.#deps.clock(),
      importResult: "imported",
    });
    if (record !== null) this.#deps.importRecordPersistence.putImportFact(record);
  }

  async #restoreLiveSession(
    sessionId: FedosDirectRatchetSessionId,
    sessionMetadata: NonNullable<ReturnType<FedosDirectRatchetStateRuntime["getSessionMetadata"]>>,
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
      sessionMetadata.binding.remoteDeviceRef,
      sessionMetadata.binding.conversationId as unknown as string,
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
