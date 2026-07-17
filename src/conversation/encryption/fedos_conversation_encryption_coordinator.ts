/**
 * Secure Runtime Alpha 943 ("Encryption Coordinator") — Phase B of the
 * Alpha 931–990 Conversation Identity Resolution and Encryption
 * Coordinator Arc.
 *
 * The Coordinator Alpha 890's own completion declaration named as
 * unbuildable until identity resolution existed
 * ("`fedos_conversation_encryption_coordinator.ts` ... does not exist —
 * building one now would either re-invent the [identity-resolution]
 * blocker inline, or merely pass an already-resolved pair through").
 * Now that `./identity/fedos_conversation_key_resolver.ts` (Alpha 935)
 * performs that resolution for real, this file is exactly what that
 * declaration predicted it would become: "a comparatively small,
 * low-risk wiring task" — readiness check + Envelope/Payload persistence
 * orchestration around the EXISTING, byte-for-byte UNMODIFIED
 * `FedosConversationEncryptionAuthority` (Alpha 861/863/870).
 *
 * SEQUENCE, mirroring `FedosPrivateConversationConstructionCoordinator`'s
 * own (Alpha 915) ordering discipline:
 *   validate command -> load Conversation (draft record) -> FAIL CLOSED
 *   unless `lifecycleState === "active"` -> resolve local identity ->
 *   Membership/crypto readiness (Alpha 866, unmodified) -> resolve
 *   Conversation key (Alpha 935) -> persist "prepared" coordination fact
 *   -> encrypt (Alpha 870, unmodified) -> persist payload -> persist
 *   "payload-persisted" fact -> persist Envelope -> persist
 *   "envelope-persisted" (completed) fact -> return.
 *
 * FAIL CLOSED, THREE NAMED CASES (Alpha 931–990's own explicit
 * constraints):
 *   1. identity cannot be resolved -> `"identity-unavailable"` (and every
 *      other identity/key-resolution failure Alpha 935 names).
 *   2. the Conversation is still a draft -> `"conversation-not-active"`.
 *      NOTHING in this repository can construct an `"active"`
 *      Conversation yet (`fedos_conversation_lifecycle_state.ts`'s own
 *      validator statically rejects every lifecycle value except
 *      `"draft"`) — this is therefore the ONLY branch a real, unmodified
 *      runtime call can ever reach; see this Arc's own completion
 *      declaration for the honest accounting of what that means for test
 *      coverage below "prepared".
 *   3. encryption is unavailable -> `"key-unavailable"` /
 *      `"encryption-failed"`, produced by the EXISTING
 *      `FedosConversationEncryptionAuthority` (Alpha 863's own coarse
 *      vocabulary) exactly as before — this file adds no second gate and
 *      no fallback path.
 *
 * RESTART RECOVERY (Alpha 945), reusing
 * `FedosConversationDurableRedemptionCoordinator`'s own "read how far a
 * prior attempt got, only move forward, never re-spend an
 * already-consumed resource" discipline (Alpha 845–847) exactly,
 * substituted onto THIS domain's own two durable writes (payload bytes,
 * Envelope metadata):
 *   - no fact, or only `"prepared"`/`"terminal-failed"` — nothing was
 *     durably written yet; the full sequence (including a fresh
 *     `encryptionAuthority.encrypt()` call) re-runs from scratch.
 *   - `"payload-persisted"` or later — the ciphertext IS already durably
 *     stored (in `payloadStorage`, keyed by the id recorded on the
 *     coordination fact). `encrypt()` is NEVER called again for this
 *     idempotency key past this point — re-encrypting would draw a fresh
 *     nonce for content that is already durably sealed and referenced,
 *     which is unnecessary and, if the recovery attempt's caller-supplied
 *     `plaintext` ever differed from the original (a caller error this
 *     file does not otherwise detect), would silently mint a SECOND
 *     ciphertext under a REUSED payload id — `putPayload()`'s own
 *     `"conflict"` outcome catches exactly that case and this method
 *     surfaces it as `"persistence-failed"` rather than silently
 *     preferring either version.
 *   - `"envelope-persisted"` — the WHOLE attempt already completed; this
 *     call re-reads the already-persisted Envelope and returns the
 *     identical `"encrypted"` result, touching no durable store again.
 *
 * `DecryptionCoordinator` (`./fedos_conversation_decryption_coordinator.ts`,
 * Alpha 946) deliberately has NO coordination log of its own — decryption
 * performs no durable write, so it has no partial state to converge; a
 * read is either answerable right now or it is not, on every call,
 * restart or no restart.
 */

import { randomBytes as nobleRandomBytes, bytesToHex } from "@noble/hashes/utils.js";
import type { FedosBoardRuntimeClock } from "../../board/runtime/fedos_board_runtime_clock.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationDraftPersistence } from "../construction/fedos_conversation_draft_persistence.js";
import {
  evaluateFedosConversationCryptoReadiness,
  FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH,
} from "./fedos_conversation_membership_readiness.js";
import type { FedosConversationEncryptionAuthority } from "./fedos_conversation_encryption_authority.js";
import { FEDOS_CONVERSATION_ENVELOPE_ENCRYPTION_SUITES, type FedosConversationEnvelopeEncryptionSuite, type FedosConversationMessageEnvelope } from "../envelope/fedos_conversation_message_envelope.js";
import { validateFedosConversationMessageEnvelope } from "../envelope/fedos_conversation_message_envelope_validator.js";
import type { FedosConversationMessageEnvelopePersistence } from "../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import { serializeFedosConversationMessageEnvelope, deserializeFedosConversationMessageEnvelope } from "../envelope/persistence/fedos_conversation_message_envelope_codec.js";
import { toFedosConversationEnvelopeId, type FedosConversationEnvelopeId, type FedosConversationEnvelopeIdGenerator } from "../envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationPayloadStorage } from "../payload_storage/fedos_conversation_payload_storage.js";
import { toFedosConversationPayloadId, type FedosConversationPayloadIdGenerator } from "../payload_storage/fedos_conversation_payload_id.js";
import type { FedosConversationIdentityResolver } from "./identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationKeyResolver } from "./identity/fedos_conversation_key_resolver.js";
import {
  fedosConversationEncryptionCoordinationId,
  type FedosConversationEncryptionCoordinationPhase,
  type FedosPersistedConversationEncryptionCoordinationV1,
} from "./coordination/fedos_persisted_conversation_encryption_coordination_v1.js";
import type { FedosConversationEncryptionCoordinationPersistence } from "./coordination/fedos_conversation_encryption_coordination_persistence.js";
import type { FedosConversationActivationPersistence } from "../activation/fedos_conversation_activation_persistence.js";
import { resolveFedosConversationActiveConversation } from "../activation/fedos_conversation_active_lookup.js";

/** Injected — mints the opaque idempotency key a fresh (non-recovery) call uses. Mirrors `FedosConversationConstructionIdGenerator`'s own shape (Alpha 908). */
export interface FedosConversationEncryptionIdempotencyKeyGenerator {
  generateIdempotencyKey(): string;
}

/** Default — 16 bytes of `@noble/hashes` randomness, hex-encoded, exactly like `FedosSecureRandomConstructionIdGenerator` (Alpha 908). Zero new dependency. */
export class FedosSecureRandomEncryptionIdempotencyKeyGenerator implements FedosConversationEncryptionIdempotencyKeyGenerator {
  generateIdempotencyKey(): string {
    return bytesToHex(nobleRandomBytes(16));
  }
}

export interface FedosConversationEncryptMessageCommand {
  readonly conversationId: string;
  readonly plaintext: Uint8Array;
  readonly suite: FedosConversationEnvelopeEncryptionSuite;
  readonly replyToEnvelopeId: string | null;
  /** Optional — supplying the SAME key for a retried call is what makes recovery re-derive the SAME coordination attempt rather than starting a new one. Omitted, a fresh one is generated (a genuinely new send, never a recovery). */
  readonly idempotencyKey?: string;
}

export type FedosConversationEncryptionCoordinatorResult =
  | { readonly outcome: "encrypted"; readonly envelope: FedosConversationMessageEnvelope }
  | { readonly outcome: "invalid-command" }
  | { readonly outcome: "conversation-not-found" }
  | { readonly outcome: "conversation-not-active" }
  | { readonly outcome: "not-member" }
  | { readonly outcome: "unsupported-suite" }
  | { readonly outcome: "unsupported-epoch" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "no-counterparty" }
  | { readonly outcome: "ambiguous-counterparty" }
  | { readonly outcome: "unsupported-counterparty-authority" }
  | { readonly outcome: "invalid-counterparty-public-key" }
  | { readonly outcome: "identity-binding-unavailable" }
  | { readonly outcome: "identity-binding-mismatch" }
  | { readonly outcome: "key-unavailable" }
  | { readonly outcome: "encryption-failed" }
  | { readonly outcome: "persistence-failed" };

export interface FedosConversationEncryptionCoordinatorDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  /** Alpha 1116/1160 -- the ONE durable source of truth for "is this Conversation active" (see `../activation/fedos_conversation_active_lookup.ts`'s own header). */
  readonly activationPersistence: FedosConversationActivationPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly keyResolver: FedosConversationKeyResolver;
  readonly encryptionAuthority: FedosConversationEncryptionAuthority;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  readonly coordinationPersistence: FedosConversationEncryptionCoordinationPersistence;
  readonly envelopeIdGenerator: FedosConversationEnvelopeIdGenerator;
  readonly payloadIdGenerator: FedosConversationPayloadIdGenerator;
  readonly idempotencyKeyGenerator: FedosConversationEncryptionIdempotencyKeyGenerator;
  readonly clock: FedosBoardRuntimeClock;
}

const IDEMPOTENCY_KEY_MAX_LENGTH = 256;

function isSafeIdempotencyKey(value: string): boolean {
  return value.length > 0 && value.length <= IDEMPOTENCY_KEY_MAX_LENGTH && !value.includes("::");
}

export class FedosConversationEncryptionCoordinator {
  readonly #deps: FedosConversationEncryptionCoordinatorDependencies;

  constructor(deps: FedosConversationEncryptionCoordinatorDependencies) {
    this.#deps = deps;
  }

  async encrypt(command: FedosConversationEncryptMessageCommand): Promise<FedosConversationEncryptionCoordinatorResult> {
    if (command === null || typeof command !== "object") return { outcome: "invalid-command" };
    if (typeof command.conversationId !== "string" || command.conversationId.length === 0) return { outcome: "invalid-command" };
    if (!(command.plaintext instanceof Uint8Array)) return { outcome: "invalid-command" };
    if (!FEDOS_CONVERSATION_ENVELOPE_ENCRYPTION_SUITES.includes(command.suite)) return { outcome: "invalid-command" };
    if (command.replyToEnvelopeId !== null && (typeof command.replyToEnvelopeId !== "string" || command.replyToEnvelopeId.length === 0)) {
      return { outcome: "invalid-command" };
    }
    if (command.idempotencyKey !== undefined && (typeof command.idempotencyKey !== "string" || !isSafeIdempotencyKey(command.idempotencyKey))) {
      return { outcome: "invalid-command" };
    }

    const conversationId = command.conversationId as FedosConversationId;

    // Fail closed #2 — the Conversation must be genuinely active. Alpha
    // 1111–1180 closes what this gate's own prior header documented as
    // permanently dead code: `resolveFedosConversationActiveConversation()`
    // (`../activation/fedos_conversation_active_lookup.ts`) consults the
    // NEW, separate, durable Activation fact
    // (`FedosConversationDirectActivationCoordinator`, Alpha 1122) rather
    // than the draft record's own `lifecycleState` field, which stays
    // permanently `"draft"` by design (Alpha 1116's own "do not silently
    // rewrite persisted V1 records" instruction) and is never consulted
    // here.
    const activeLookup = resolveFedosConversationActiveConversation(
      this.#deps.draftPersistence,
      this.#deps.activationPersistence,
      conversationId,
    );
    if (activeLookup.outcome === "not-found") return { outcome: "conversation-not-found" };
    if (activeLookup.outcome === "not-active") return { outcome: "conversation-not-active" };

    // Fail closed #1 — resolve local identity before any durable write.
    const identity = this.#deps.identityResolver.resolveLocalParticipant();
    if (identity.outcome === "unavailable") return { outcome: "identity-unavailable" };
    const localParticipant = identity.creator;

    const readiness = evaluateFedosConversationCryptoReadiness(
      this.#deps.membershipAuthority,
      conversationId,
      localParticipant,
      command.suite,
      FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH,
    );
    if (readiness.outcome !== "ready") return { outcome: readiness.outcome };

    const keyResolution = await this.#deps.keyResolver.resolve(conversationId);
    if (keyResolution.outcome !== "resolved") return { outcome: keyResolution.outcome };

    const now = this.#deps.clock();
    const idempotencyKey = command.idempotencyKey ?? this.#deps.idempotencyKeyGenerator.generateIdempotencyKey();
    if (!isSafeIdempotencyKey(idempotencyKey)) return { outcome: "invalid-command" };
    const coordinationId = fedosConversationEncryptionCoordinationId(conversationId, idempotencyKey);

    const existing = this.#deps.coordinationPersistence.getCoordination(coordinationId);
    const startedAt = existing?.startedAt ?? now;

    // Recovery reuses the SAME ids a prior attempt already minted (Alpha 945)
    // — never a fresh id once "prepared" is durable.
    const envelopeIdRaw = existing?.envelopeId ?? this.#deps.envelopeIdGenerator.generateEnvelopeId();
    const payloadIdRaw = existing?.payloadId ?? this.#deps.payloadIdGenerator.generatePayloadId();
    const envelopeId = toFedosConversationEnvelopeId(envelopeIdRaw);
    const payloadId = toFedosConversationPayloadId(payloadIdRaw);
    if (envelopeId === null || payloadId === null) return { outcome: "invalid-command" };
    const replyToEnvelopeId: FedosConversationEnvelopeId | null =
      command.replyToEnvelopeId === null ? null : (command.replyToEnvelopeId as FedosConversationEnvelopeId);

    if (existing === undefined || existing === null) {
      this.#deps.coordinationPersistence.putCoordinationFact(
        this.#fact(coordinationId, conversationId, envelopeId, payloadId, "prepared", startedAt, now),
      );
    }

    if (existing?.phase === "envelope-persisted") {
      // The whole attempt already completed — re-read, never re-write.
      const persistedEnvelope = this.#deps.envelopePersistence.getEnvelope(envelopeId);
      if (persistedEnvelope === null) return { outcome: "persistence-failed" };
      const envelope = deserializeFedosConversationMessageEnvelope(persistedEnvelope);
      if (envelope === null) return { outcome: "persistence-failed" };
      return { outcome: "encrypted", envelope };
    }

    const alreadyEncrypted = existing?.phase === "payload-persisted";
    let ciphertext: Uint8Array;

    if (!alreadyEncrypted) {
      const encryption = await this.#deps.encryptionAuthority.encrypt({
        envelopeId,
        conversationId,
        senderMembershipId: keyResolution.senderMembershipId,
        keyEpoch: FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH,
        createdAt: startedAt,
        replyToEnvelopeId,
        suite: command.suite,
        plaintext: command.plaintext,
        localAccountIndex: keyResolution.localAccountIndex,
        counterpartyPublicKeyHex: keyResolution.counterpartyPublicKeyHex,
      });
      if (encryption.outcome === "key-unavailable") return { outcome: "key-unavailable" };
      if (encryption.outcome !== "encrypted") {
        this.#deps.coordinationPersistence.putCoordinationFact(
          this.#fact(coordinationId, conversationId, envelopeId, payloadId, "terminal-failed", startedAt, now),
        );
        return { outcome: "encryption-failed" };
      }
      ciphertext = encryption.ciphertext;

      const payloadWrite = this.#deps.payloadStorage.putPayload(
        { id: payloadId, conversationId, mediaType: "application/octet-stream", byteLength: ciphertext.length, createdAt: startedAt },
        ciphertext,
      );
      if (payloadWrite === "failed" || payloadWrite === "conflict") {
        this.#deps.coordinationPersistence.putCoordinationFact(
          this.#fact(coordinationId, conversationId, envelopeId, payloadId, "terminal-failed", startedAt, now),
        );
        return { outcome: "persistence-failed" };
      }
      this.#deps.coordinationPersistence.putCoordinationFact(
        this.#fact(coordinationId, conversationId, envelopeId, payloadId, "payload-persisted", startedAt, now),
      );
    } else {
      // Recovery from "payload-persisted" — the ciphertext is already durable; read it back, never re-encrypt.
      const storedPayload = this.#deps.payloadStorage.getPayload(payloadId);
      if (storedPayload === null) return { outcome: "persistence-failed" };
      ciphertext = storedPayload.bytes;
    }

    const envelope = validateFedosConversationMessageEnvelope({
      id: envelopeId,
      conversationId,
      senderMembershipId: keyResolution.senderMembershipId,
      payloadId,
      encryptionSuite: command.suite,
      keyEpoch: FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH,
      createdAt: startedAt,
      replyToEnvelopeId: command.replyToEnvelopeId,
    });
    if (envelope === null) return { outcome: "invalid-command" };

    const envelopeWrite = this.#deps.envelopePersistence.putEnvelope(serializeFedosConversationMessageEnvelope(envelope));
    if (envelopeWrite === "failed" || envelopeWrite === "conflict") return { outcome: "persistence-failed" };

    this.#deps.coordinationPersistence.putCoordinationFact(
      this.#fact(coordinationId, conversationId, envelopeId, payloadId, "envelope-persisted", startedAt, now),
    );

    return { outcome: "encrypted", envelope };
  }

  #fact(
    coordinationId: string,
    conversationId: string,
    envelopeId: string,
    payloadId: string,
    phase: FedosConversationEncryptionCoordinationPhase,
    startedAt: number,
    now: number,
  ): FedosPersistedConversationEncryptionCoordinationV1 {
    return { schemaVersion: 1, coordinationId, conversationId, envelopeId, payloadId, phase, startedAt, updatedAt: now };
  }
}
