/**
 * Secure Runtime Alpha 7081-7160 (FedOS Conversation Invitation and
 * Shared Conversation Foundation Arc) — the signed, transferable
 * invitation record. Mirrors `fedos_ratchet_peer_capability_advertisement.ts`'s
 * own established shape/discipline exactly (fixed-order canonical array
 * tuple, exact-field-set structural validation, fail-closed decode) —
 * narrowed to what a single one-time conversation invitation needs, not
 * an ongoing/revisable advertisement (no `revision`, no capability list).
 *
 * Carries NO private key, NO Master Seed material, NO Ratchet key, NO
 * bearer secret from the pre-existing Capability system (this Arc builds
 * an additive, parallel mechanism — see the reconciliation report — the
 * old Capability/Invitation Transport is untouched and unused here).
 */
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import { validateFedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference_validator.js";
import type { FedosConversationInvitationAccountAuthorizationV1 } from "./fedos_conversation_invitation_authentication.js";

/** Distinct from every other signed-content domain in this codebase. */
export const FEDOS_CONVERSATION_INVITATION_DOMAIN = "fedos-conversation-invitation-v1";

export const FEDOS_CONVERSATION_INVITATION_SCHEMA_VERSION = 1;

const MAX_ID_FIELD_LENGTH = 512;

export interface FedosConversationInvitationSignableContentV1 {
  readonly conversationId: string;
  readonly inviter: FedosConversationParticipantReference;
  readonly invitee: FedosConversationParticipantReference;
  readonly issuedAt: number;
  readonly expiresAt: number;
  /** Replay/duplicate-delivery discriminator — a fresh random value per invitation, never reused across two distinct invitations for the same conversationId. */
  readonly nonce: string;
}

export interface FedosConversationInvitationAdvertisementV1 extends FedosConversationInvitationSignableContentV1 {
  readonly schemaVersion: 1;
  readonly accountAuthorization: FedosConversationInvitationAccountAuthorizationV1;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isSafeIdField(value: unknown): value is string {
  return isNonEmptyString(value) && value.length <= MAX_ID_FIELD_LENGTH;
}

/** A fresh, real 16-byte hex nonce (minted by the outbound coordinator via the same CSPRNG idiom `FedosSecureRandomConstructionIdGenerator` already uses). */
function isWellFormedNonce(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
}

/** Fixed-order array tuple — no object-key-ordering ambiguity, deterministic across any two conforming implementations. */
export function canonicalSerializeFedosConversationInvitationContent(content: FedosConversationInvitationSignableContentV1): string {
  return JSON.stringify([
    FEDOS_CONVERSATION_INVITATION_DOMAIN,
    content.conversationId,
    content.inviter.authority,
    content.inviter.publicIdentifier,
    content.inviter.identityId,
    content.invitee.authority,
    content.invitee.publicIdentifier,
    content.invitee.identityId,
    content.issuedAt,
    content.expiresAt,
    content.nonce,
  ]);
}

const CONTENT_FIELDS = new Set<string>(["conversationId", "inviter", "invitee", "issuedAt", "expiresAt", "nonce"]);

function isWellFormedContentFieldValues(r: Record<string, unknown>): boolean {
  if (!isSafeIdField(r.conversationId)) return false;
  if (validateFedosConversationParticipantReference(r.inviter) === null) return false;
  if (validateFedosConversationParticipantReference(r.invitee) === null) return false;
  if (typeof r.issuedAt !== "number" || !Number.isFinite(r.issuedAt)) return false;
  if (typeof r.expiresAt !== "number" || !Number.isFinite(r.expiresAt) || r.expiresAt <= r.issuedAt) return false;
  if (!isWellFormedNonce(r.nonce)) return false;
  return true;
}

export function isWellFormedFedosConversationInvitationSignableContent(
  candidate: unknown,
): candidate is FedosConversationInvitationSignableContentV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== CONTENT_FIELDS.size || !keys.every((k) => CONTENT_FIELDS.has(k))) return false;
  return isWellFormedContentFieldValues(candidate as Record<string, unknown>);
}

const RECORD_FIELDS = new Set<string>([...CONTENT_FIELDS, "schemaVersion", "accountAuthorization"]);

function isWellFormedAccountAuthorization(candidate: unknown): candidate is FedosConversationInvitationAccountAuthorizationV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== 1 || !keys.includes("event")) return false;
  const event = (candidate as Record<string, unknown>).event;
  if (typeof event !== "object" || event === null) return false;
  const e = event as Record<string, unknown>;
  return (
    isNonEmptyString(e.id) &&
    isNonEmptyString(e.pubkey) &&
    typeof e.created_at === "number" &&
    typeof e.kind === "number" &&
    Array.isArray(e.tags) &&
    typeof e.content === "string" &&
    isNonEmptyString(e.sig)
  );
}

/** Structural validation only, exact field set. Fails closed; never throws. */
export function isWellFormedFedosConversationInvitationAdvertisementV1(
  candidate: unknown,
): candidate is FedosConversationInvitationAdvertisementV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== RECORD_FIELDS.size || !keys.every((k) => RECORD_FIELDS.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== FEDOS_CONVERSATION_INVITATION_SCHEMA_VERSION) return false;
  if (!isWellFormedContentFieldValues(r)) return false;
  return isWellFormedAccountAuthorization(r.accountAuthorization);
}

export function encodeFedosConversationInvitationAdvertisementV1(record: FedosConversationInvitationAdvertisementV1): string {
  return JSON.stringify(record);
}

/** `null` (never throws) for invalid JSON or a structurally malformed record — fail closed. */
export function decodeFedosConversationInvitationAdvertisementV1(line: string): FedosConversationInvitationAdvertisementV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosConversationInvitationAdvertisementV1(parsed) ? parsed : null;
}
