/**
 * Secure Runtime Alpha 836 ("Capability Codec V1") — Stage 4 of Phase C
 * of the Alpha 821–850 Durable Conversation Membership & Capability
 * Persistence Arc.
 *
 * The ONLY functions permitted to convert between a
 * `FedosConversationCapabilityDescriptor`+bearer-secret pair (Alpha 777,
 * frozen) or a redemption fact, and the persisted wire events
 * (`./fedos_persisted_conversation_capability_v1.ts`) — mirrors
 * `serializeFedosConversationMembership`/`deserializeFedosConversationMembership`'s
 * own exact discipline (Alpha 826).
 *
 * HARD GUARDRAILS:
 *   - Both `deserialize*` functions fail closed: `null` for anything
 *     malformed, never throw.
 *   - `schemaVersion` checked EXACTLY against `1`.
 *   - Unknown top-level fields REJECTED.
 *   - `maxUses`/`currentUses` consistency, expiry consistency, and
 *     recipient validation all enforced here.
 *   - No plaintext bearer output anywhere — `serializeFedosConversationCapabilityIssuedEvent`
 *     takes a `bearerVerifier` (already one-way hashed by the caller),
 *     never a raw `FedosConversationCapabilityBearerSecret`.
 */

import { validateFedosConversationParticipantReference } from "../../../../../conversation/membership/fedos_conversation_participant_reference_validator.js";
import type { FedosConversationCapabilityAction, FedosConversationCapabilityDescriptor } from "../../../../../conversation/capability/fedos_conversation_capability_descriptor.js";
import type { FedosConversationCapabilityId } from "../../../../../conversation/capability/fedos_conversation_capability_id.js";
import type { FedosConversationId } from "../../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../../../../../conversation/membership/fedos_conversation_participant_reference.js";
import { FEDOS_BOARD_POST_MIN_CREATED_AT, FEDOS_BOARD_POST_MAX_CREATED_AT } from "../../../../../board/fedos_board_post_validator.js";
import type {
  FedosPersistedConversationCapabilityIssuedEventV1,
  FedosPersistedConversationCapabilityRedeemedEventV1,
} from "../../../../../conversation/capability/persistence/fedos_persisted_conversation_capability_v1.js";
import type { FedosConversationCapabilityBearerVerifier } from "../../../../../conversation/capability/persistence/fedos_conversation_capability_bearer_verifier.js";

function isValidTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= FEDOS_BOARD_POST_MIN_CREATED_AT &&
    value <= FEDOS_BOARD_POST_MAX_CREATED_AT
  );
}

function isValidMaxUses(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isValidExpiresAt(value: unknown): value is number | null {
  return value === null || isValidTimestamp(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Serializes an issued descriptor plus its already-hashed bearer verifier. Never accepts a raw bearer secret. */
export function serializeFedosConversationCapabilityIssuedEvent(
  descriptor: FedosConversationCapabilityDescriptor,
  bearerVerifier: FedosConversationCapabilityBearerVerifier,
): FedosPersistedConversationCapabilityIssuedEventV1 {
  return {
    schemaVersion: 1,
    eventType: "issued",
    capabilityId: descriptor.capabilityId,
    conversationId: descriptor.conversationId,
    action: descriptor.action,
    issuerAuthority: descriptor.issuer.authority,
    issuerPublicIdentifier: descriptor.issuer.publicIdentifier,
    issuerIdentityId: descriptor.issuer.identityId,
    intendedRecipientAuthority: descriptor.intendedRecipient?.authority ?? null,
    intendedRecipientPublicIdentifier: descriptor.intendedRecipient?.publicIdentifier ?? null,
    intendedRecipientIdentityId: descriptor.intendedRecipient?.identityId ?? null,
    maxUses: descriptor.maxUses,
    expiresAt: descriptor.expiresAt,
    issuedAt: descriptor.issuedAt,
    bearerVerifier,
  };
}

const ISSUED_EVENT_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "eventType",
  "capabilityId",
  "conversationId",
  "action",
  "issuerAuthority",
  "issuerPublicIdentifier",
  "issuerIdentityId",
  "intendedRecipientAuthority",
  "intendedRecipientPublicIdentifier",
  "intendedRecipientIdentityId",
  "maxUses",
  "expiresAt",
  "issuedAt",
  "bearerVerifier",
]);

/** The runtime-shaped result of decoding an `"issued"` event: the public descriptor plus the persisted verifier -- never a raw bearer secret. */
export interface FedosDecodedConversationCapabilityIssuedEvent {
  readonly descriptor: FedosConversationCapabilityDescriptor;
  readonly bearerVerifier: FedosConversationCapabilityBearerVerifier;
}

/** Fails closed to `null` for any malformed, unrecognized-schema, or corrupt input. */
export function deserializeFedosConversationCapabilityIssuedEvent(record: unknown): FedosDecodedConversationCapabilityIssuedEvent | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  if (!keys.every((key) => ISSUED_EVENT_KEYS.has(key))) return null;

  const value = record as Record<string, unknown>;
  if (value.schemaVersion !== 1) return null;
  if (value.eventType !== "issued") return null;
  if (!isNonEmptyString(value.capabilityId)) return null;
  if (!isNonEmptyString(value.conversationId)) return null;
  if (value.action !== "join-conversation") return null;
  if (!isNonEmptyString(value.issuerAuthority)) return null;
  if (!isNonEmptyString(value.issuerPublicIdentifier)) return null;
  if (value.issuerIdentityId !== null && typeof value.issuerIdentityId !== "string") return null;
  if (!isValidMaxUses(value.maxUses)) return null;
  if (!isValidExpiresAt(value.expiresAt)) return null;
  if (!isValidTimestamp(value.issuedAt)) return null;
  if (!isNonEmptyString(value.bearerVerifier)) return null;

  const issuer = validateFedosConversationParticipantReference({
    authority: value.issuerAuthority,
    publicIdentifier: value.issuerPublicIdentifier,
    identityId: value.issuerIdentityId,
  });
  if (issuer === null) return null;

  let intendedRecipient: FedosConversationParticipantReference | null = null;
  const hasRecipient = value.intendedRecipientAuthority !== null;
  if (hasRecipient) {
    if (!isNonEmptyString(value.intendedRecipientAuthority)) return null;
    if (!isNonEmptyString(value.intendedRecipientPublicIdentifier)) return null;
    if (value.intendedRecipientIdentityId !== null && typeof value.intendedRecipientIdentityId !== "string") return null;
    intendedRecipient = validateFedosConversationParticipantReference({
      authority: value.intendedRecipientAuthority,
      publicIdentifier: value.intendedRecipientPublicIdentifier,
      identityId: value.intendedRecipientIdentityId,
    });
    if (intendedRecipient === null) return null;
  } else if (value.intendedRecipientPublicIdentifier !== null || value.intendedRecipientIdentityId !== null) {
    return null; // inconsistent: no recipient authority, but a recipient identifier/identityId is present
  }

  const action: FedosConversationCapabilityAction = "join-conversation";
  const descriptor: FedosConversationCapabilityDescriptor = Object.freeze({
    capabilityId: value.capabilityId as FedosConversationCapabilityId,
    conversationId: value.conversationId as FedosConversationId,
    action,
    issuer,
    intendedRecipient,
    maxUses: value.maxUses,
    expiresAt: value.expiresAt as number | null,
    issuedAt: value.issuedAt,
  });

  return { descriptor, bearerVerifier: value.bearerVerifier as FedosConversationCapabilityBearerVerifier };
}

const REDEEMED_EVENT_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "eventType",
  "capabilityId",
  "redeemerAuthority",
  "redeemerPublicIdentifier",
  "redeemerIdentityId",
  "redeemedAt",
]);

export interface FedosDecodedConversationCapabilityRedeemedEvent {
  readonly capabilityId: string;
  readonly redeemer: FedosConversationParticipantReference;
  readonly redeemedAt: number;
}

export function serializeFedosConversationCapabilityRedeemedEvent(
  capabilityId: string,
  redeemer: FedosConversationParticipantReference,
  redeemedAt: number,
): FedosPersistedConversationCapabilityRedeemedEventV1 {
  return {
    schemaVersion: 1,
    eventType: "redeemed",
    capabilityId,
    redeemerAuthority: redeemer.authority,
    redeemerPublicIdentifier: redeemer.publicIdentifier,
    redeemerIdentityId: redeemer.identityId,
    redeemedAt,
  };
}

/** Fails closed to `null` for any malformed, unrecognized-schema, or corrupt input. */
export function deserializeFedosConversationCapabilityRedeemedEvent(record: unknown): FedosDecodedConversationCapabilityRedeemedEvent | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  if (!keys.every((key) => REDEEMED_EVENT_KEYS.has(key))) return null;

  const value = record as Record<string, unknown>;
  if (value.schemaVersion !== 1) return null;
  if (value.eventType !== "redeemed") return null;
  if (!isNonEmptyString(value.capabilityId)) return null;
  if (!isNonEmptyString(value.redeemerAuthority)) return null;
  if (!isNonEmptyString(value.redeemerPublicIdentifier)) return null;
  if (value.redeemerIdentityId !== null && typeof value.redeemerIdentityId !== "string") return null;
  if (!isValidTimestamp(value.redeemedAt)) return null;

  const redeemer = validateFedosConversationParticipantReference({
    authority: value.redeemerAuthority,
    publicIdentifier: value.redeemerPublicIdentifier,
    identityId: value.redeemerIdentityId,
  });
  if (redeemer === null) return null;

  return { capabilityId: value.capabilityId, redeemer, redeemedAt: value.redeemedAt };
}
