/**
 * Secure Runtime Alpha 763 ("Participant Validation") — Stage 3 of the
 * Alpha 761–790 Canonical Conversation Membership & Capability
 * Foundation Arc.
 *
 * The ONLY place in this repository that constructs a
 * `FedosConversationParticipantReference` — mirrors
 * `validateFedosConversationRecord`'s own "typed builder, sole
 * constructor, fail-closed to `null`, never throws" discipline
 * (`../fedos_conversation_record_validator.ts`, Alpha 748).
 *
 * HARD GUARDRAILS:
 *   - Fails closed: every rejection returns `null`, never throws.
 *   - Unknown `authority` rejected.
 *   - Empty or oversized `publicIdentifier`/`identityId` rejected.
 *   - Unknown/extra field rejected (exact key set only).
 *   - No network, no profile resolution, no identity mutation.
 *   - Deep-copies and `Object.freeze`s the result, never the caller's
 *     own reference.
 */

import {
  FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES,
  type FedosConversationParticipantAuthority,
  type FedosConversationParticipantReference,
} from "./fedos_conversation_participant_reference.js";

/** Generous enough for an npub/DID/ActivityPub Actor URI/Session ID; bounded against abuse. No existing repo-wide identifier bound to reuse (only `FEDOS_BOARD_POST_MAX_BODY_LENGTH` exists, a content bound, not an identifier bound). */
export const FEDOS_CONVERSATION_PARTICIPANT_PUBLIC_IDENTIFIER_MAX_LENGTH = 512;
export const FEDOS_CONVERSATION_PARTICIPANT_IDENTITY_ID_MAX_LENGTH = 256;

const EXPECTED_KEYS: readonly string[] = ["authority", "identityId", "publicIdentifier"].slice().sort();

function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBoundedNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isKnownAuthority(value: unknown): value is FedosConversationParticipantAuthority {
  return typeof value === "string" && FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES.includes(value as FedosConversationParticipantAuthority);
}

/**
 * Validates and constructs a `FedosConversationParticipantReference`.
 * See this file's own header for the full check list.
 */
export function validateFedosConversationParticipantReference(candidate: unknown): FedosConversationParticipantReference | null {
  if (!isNonEmptyObject(candidate)) return null;

  const keys = Object.keys(candidate).sort();
  if (keys.length !== EXPECTED_KEYS.length || !keys.every((key, index) => key === EXPECTED_KEYS[index])) {
    return null;
  }

  const value = candidate as Record<string, unknown>;
  if (!isKnownAuthority(value.authority)) return null;
  if (!isBoundedNonEmptyString(value.publicIdentifier, FEDOS_CONVERSATION_PARTICIPANT_PUBLIC_IDENTIFIER_MAX_LENGTH)) return null;

  let identityId: string | null;
  if (value.identityId === null) {
    identityId = null;
  } else if (isBoundedNonEmptyString(value.identityId, FEDOS_CONVERSATION_PARTICIPANT_IDENTITY_ID_MAX_LENGTH)) {
    identityId = value.identityId;
  } else {
    return null;
  }

  return Object.freeze({
    authority: value.authority,
    publicIdentifier: value.publicIdentifier,
    identityId,
  });
}
