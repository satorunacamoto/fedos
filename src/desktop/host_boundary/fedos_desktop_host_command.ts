/**
 * Secure Runtime Alpha 3561-3640 — Phase C: Safe Command Vocabulary.
 *
 * A closed command union for exactly the user actions the EXISTING Shell/
 * ViewModel stack already supports for real -- no command is added merely
 * to complete a category list this Arc's own spec names. Two named
 * categories are DELIBERATELY absent, and documented here rather than
 * faked:
 *
 *   - `redeem-invitation` / `device-status`-as-a-distinct-mutation: the
 *     Shell's own `redeemInvitation()` is honestly `"unavailable"` on this
 *     base (Alpha 2841-2920, unchanged) -- there is nothing this command
 *     layer could usefully validate or dispatch beyond immediately
 *     returning that same closed failure, so no command is defined for
 *     it. `device-status` (real, if honestly always-unavailable) IS
 *     included -- see `"device-status"` below.
 *   - `archive-list` / `archive-verify`: NEITHER exists as a real
 *     operation on `FedosDesktopArchiveViewModel`/`FedosDesktopApplicationShell.archive()`
 *     (Alpha 3081-3160's own documented finding: the Archive Runtime has
 *     exactly four real operations -- inspect/preflightRestore/export/
 *     restore -- no "list" or "verify"). `archive-inspect` is the ONE
 *     archive command this Arc exposes; export/preflightRestore/restore
 *     are DELIBERATELY excluded too (Phase H: they require a raw
 *     filesystem destination path plus account-index/counterparty-key
 *     parameters this foundational Arc declines to validate/expose across
 *     a future untrusted process boundary without a real path-authority
 *     story -- see the completion declaration's own Phase H section).
 *
 * Every field is validated STRUCTURALLY here (right type, present,
 * non-empty, within an operational size limit) -- never re-deriving a
 * DOMAIN decision the Shell/Accessor/ViewModel layer already owns (e.g.
 * this file does not re-check Membership/activation/retention; it only
 * ensures a malformed/oversized/wrong-shaped object can never reach that
 * layer at all).
 */

import { FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES, type FedosConversationParticipantReference } from "../../conversation/membership/fedos_conversation_participant_reference.js";
import { FEDOS_CONVERSATION_DIRECT_MESSAGE_MAX_BODY_LENGTH } from "../../conversation/messaging/fedos_conversation_direct_message_plaintext_policy.js";
import type { CreateDirectDraftCommand, CreatePrivateGroupDraftCommand } from "../../conversation/construction/fedos_private_conversation_construction_command.js";
import type { FedosConversationListFilter } from "../shell/fedos_desktop_shell_view_models.js";
// Secure Runtime Alpha 4581-4660 -- every import/addition below this
// comment is ADDITIVE ONLY, mirroring this file's own established pattern.
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import { FEDOS_DEVICE_PAIRING_EXCHANGE_MAX_BYTE_LENGTH } from "../../device/binding_challenge/fedos_device_binding_pairing_exchange.js";
// Secure Runtime Alpha 6041-6120 -- every import/addition below this comment
// is ADDITIVE ONLY, mirroring this file's own established pattern above.
import { FEDOS_DELETION_REQUEST_SCOPES, type FedosDeletionRequestScope } from "../../conversation/deletion_request/fedos_deletion_request_scope.js";
import { FEDOS_DELETION_REQUEST_REASON_CODES, type FedosDeletionRequestReasonCode } from "../../conversation/deletion_request/fedos_deletion_request_reason_code.js";
import { FEDOS_DELETION_RECIPIENT_POLICIES, type FedosDeletionRecipientPolicy } from "../../conversation/deletion_request/fedos_deletion_recipient_policy.js";
// Secure Runtime Alpha 6121-6200 -- every import/addition below this comment
// is ADDITIVE ONLY, mirroring this file's own established pattern above.
import {
  FEDOS_IDENTITY_TRANSITION_KNOWN_MANUAL_VERIFICATION_METHODS,
  FEDOS_IDENTITY_TRANSITION_KNOWN_MANUAL_VERIFICATION_NOTE_CODES,
  type FedosIdentityTransitionManualVerificationMethod,
  type FedosIdentityTransitionManualVerificationNoteCode,
} from "../../conversation/identity_transition/peer_integration/fedos_identity_transition_manual_verification.js";
import { FEDOS_IDENTITY_TRANSITION_KNOWN_ACCEPTANCE_STATES, type FedosIdentityTransitionAcceptanceState } from "../../conversation/identity_transition/fedos_identity_transition_acceptance_state.js";
// Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy Controls and
// Safety Center Arc) -- every import/addition below this comment is
// ADDITIVE ONLY, mirroring this file's own established pattern above.
import { FEDOS_SAFETY_CENTER_SECTIONS, type FedosSafetyCenterSection } from "../presentation/safety_center/fedos_safety_center_state.js";

/** This layer's own bound for id-shaped strings (conversation/message ids) -- mirrors the "512, non-empty" bound this codebase's own domain validators already apply pervasively to ids (e.g. `fedos_group_message.ts`/`fedos_group_direct_path.ts`'s own `MAX_STRING_LENGTH`), restated here since this Host layer sits ABOVE those domains and must reject an oversized/malformed id before it ever reaches them. */
export const FEDOS_DESKTOP_HOST_MAX_ID_LENGTH = 512;

/** This layer's own bound for search query text -- no existing domain limit exists for search query text specifically (Search has no caller-facing length bound of its own); chosen modestly below the message-body bound since a query is display text, never stored content. */
export const FEDOS_DESKTOP_HOST_MAX_QUERY_LENGTH = 500;

/** This layer's own bound for a filesystem path string passed to `archive-inspect` -- generous enough for a real path, still a hard ceiling against an unbounded string. */
export const FEDOS_DESKTOP_HOST_MAX_PATH_LENGTH = 4096;

/** This layer's own bound for an encoded pairing exchange record -- mirrors `FEDOS_DEVICE_PAIRING_EXCHANGE_MAX_BYTE_LENGTH` (Phase C's own hard ceiling), restated here as a STRING length bound (UTF-8 byte length is checked again, and authoritatively, by `decodeFedosDevicePairing*V1()` itself) so an absurdly long string can never even reach `JSON.parse()` inside this layer's own downstream call. */
export const FEDOS_DESKTOP_HOST_MAX_PAIRING_RECORD_LENGTH = FEDOS_DEVICE_PAIRING_EXCHANGE_MAX_BYTE_LENGTH;

export type FedosDesktopHostCommand =
  | { readonly type: "runtime-status"; readonly requestId?: string }
  | { readonly type: "device-status"; readonly requestId?: string }
  | { readonly type: "conversations-list"; readonly filter?: FedosConversationListFilter; readonly requestId?: string }
  | { readonly type: "conversation-open"; readonly conversationId: string; readonly requestId?: string }
  | { readonly type: "conversation-create-direct"; readonly command: CreateDirectDraftCommand; readonly requestId?: string }
  | { readonly type: "conversation-create-group"; readonly command: CreatePrivateGroupDraftCommand; readonly requestId?: string }
  | { readonly type: "messages-list"; readonly conversationId: string; readonly requestId?: string }
  | { readonly type: "message-reveal"; readonly conversationId: string; readonly messageId: string; readonly requestId?: string }
  | { readonly type: "message-send"; readonly conversationId: string; readonly sender: FedosConversationParticipantReference; readonly body: string; readonly requestId?: string }
  | {
      readonly type: "message-reply";
      readonly conversationId: string;
      readonly sender: FedosConversationParticipantReference;
      readonly replyToMessageId: string;
      readonly body: string;
      readonly requestId?: string;
    }
  | { readonly type: "membership-list"; readonly conversationId: string; readonly requestId?: string }
  | { readonly type: "invitation-descriptor"; readonly conversationId: string; readonly issuer: FedosConversationParticipantReference; readonly requestId?: string }
  | { readonly type: "search"; readonly query: string; readonly requestId?: string }
  | { readonly type: "archive-inspect"; readonly sourcePath: string; readonly requestId?: string }
  // Secure Runtime Alpha 4581-4660 -- Device Registration/Pairing commands.
  | { readonly type: "device-pairing-create"; readonly deviceId: string; readonly expectedAccountRef: FedosDeviceBindingAccountRef; readonly requestId?: string }
  | { readonly type: "device-pairing-inspect"; readonly encodedRequest: string; readonly requestId?: string }
  | { readonly type: "device-pairing-approve"; readonly encodedRequest: string; readonly requestId?: string }
  | { readonly type: "device-pairing-complete"; readonly pairingId: string; readonly encodedApproval: string; readonly requestId?: string }
  | { readonly type: "device-pairings-list"; readonly requestId?: string }
  | { readonly type: "device-revoke"; readonly deviceId: string; readonly devicePublicKeyHex: string; readonly requestId?: string }
  | { readonly type: "device-registration-status"; readonly deviceId: string; readonly requestId?: string }
  // Secure Runtime Alpha 6041-6120 -- Signed Deletion Request Multi-Device
  // Aggregation and Consent commands.
  | {
      readonly type: "deletion-request-create";
      readonly requesterAccountRef: string;
      readonly recipientAccountRef: string;
      readonly recipientDeviceRef: string;
      readonly conversationId: string;
      readonly targetEnvelopeId: string;
      readonly scope: FedosDeletionRequestScope;
      readonly expiresInSeconds: number;
      readonly reasonCode: FedosDeletionRequestReasonCode | null;
      readonly requestId?: string;
    }
  | { readonly type: "deletion-request-list-sent"; readonly conversationId: string; readonly targetEnvelopeId: string; readonly knownDeviceIds: readonly string[]; readonly requestId?: string }
  | { readonly type: "deletion-request-list-received"; readonly requestId?: string }
  | { readonly type: "deletion-request-open"; readonly deletionRequestId: string; readonly localPolicy: FedosDeletionRecipientPolicy; readonly requestId?: string }
  | { readonly type: "deletion-request-approve"; readonly deletionRequestId: string; readonly requestId?: string }
  | { readonly type: "deletion-request-reject"; readonly deletionRequestId: string; readonly requestId?: string }
  | { readonly type: "deletion-request-status"; readonly deletionRequestId: string; readonly requestId?: string }
  | { readonly type: "deletion-request-device-outcomes"; readonly conversationId: string; readonly targetEnvelopeId: string; readonly knownDeviceIds: readonly string[]; readonly requestId?: string }
  | { readonly type: "deletion-request-dismiss"; readonly deletionRequestId: string; readonly requestId?: string }
  // Secure Runtime Alpha 6121-6200 (FedOS Identity Replacement User Verification and Conversation Continuity UI Arc).
  | { readonly type: "identity-transition-list"; readonly limit: number; readonly offset: number; readonly requestId?: string }
  | {
      readonly type: "identity-transition-open";
      readonly peerAccountRef: FedosDeviceBindingAccountRef;
      readonly peerDeviceRef: string;
      readonly transitionId: string;
      readonly requestId?: string;
    }
  | {
      readonly type: "identity-transition-inspect-evidence";
      readonly peerAccountRef: FedosDeviceBindingAccountRef;
      readonly peerDeviceRef: string;
      readonly transitionId: string;
      readonly requestId?: string;
    }
  | {
      readonly type: "identity-transition-record-manual-verification";
      readonly transitionId: string;
      readonly method: FedosIdentityTransitionManualVerificationMethod;
      readonly verifiedAt: number;
      readonly noteCode: FedosIdentityTransitionManualVerificationNoteCode;
      readonly requestId?: string;
    }
  | {
      readonly type: "identity-transition-accept";
      readonly peerAccountRef: FedosDeviceBindingAccountRef;
      readonly peerDeviceRef: string;
      readonly transitionId: string;
      readonly requestId?: string;
    }
  | {
      readonly type: "identity-transition-reject";
      readonly peerAccountRef: FedosDeviceBindingAccountRef;
      readonly peerDeviceRef: string;
      readonly transitionId: string;
      readonly requestId?: string;
    }
  | {
      readonly type: "identity-transition-defer";
      readonly peerAccountRef: FedosDeviceBindingAccountRef;
      readonly peerDeviceRef: string;
      readonly transitionId: string;
      readonly requestId?: string;
    }
  | {
      readonly type: "identity-transition-assess-continuity";
      readonly pairs: readonly { readonly conversationId: string; readonly remoteDeviceRef: string }[];
      readonly requestId?: string;
    }
  | {
      readonly type: "identity-transition-authorize-ratchet-reset";
      readonly transitionId: string;
      readonly acceptanceState: FedosIdentityTransitionAcceptanceState;
      readonly affectedSessions: readonly { readonly sessionId: string; readonly conversationId: string; readonly remoteAccountRef: FedosDeviceBindingAccountRef; readonly remoteDeviceRef: string }[];
      readonly requestId?: string;
    }
  | {
      readonly type: "identity-transition-status";
      readonly peerAccountRef: FedosDeviceBindingAccountRef;
      readonly peerDeviceRef: string;
      readonly transitionId: string;
      readonly requestId?: string;
    }
  // Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy Controls and Safety Center Arc).
  // Eight new, narrow, closed commands -- deliberately NOT a ninth
  // "identity-action"/"deletion-action" duplicate of the existing
  // `identity-transition-*`/`deletion-request-*` commands above, which
  // already cover those two domains' own mutations (this Arc's own
  // reconciliation/execution spec documents this choice).
  | { readonly type: "safety-center-overview"; readonly ratchetPairs: readonly { readonly conversationId: string; readonly remoteDeviceRef: string }[]; readonly requestId?: string }
  | { readonly type: "safety-center-events"; readonly limit: number; readonly offset: number; readonly requestId?: string }
  | { readonly type: "safety-center-section"; readonly section: FedosSafetyCenterSection; readonly requestId?: string }
  | { readonly type: "safety-center-device-action"; readonly action: "request-revoke"; readonly deviceId: string; readonly devicePublicKeyHex: string; readonly requestId?: string }
  | { readonly type: "safety-center-ratchet-action"; readonly action: "request-reset"; readonly conversationId: string; readonly remoteDeviceRef: string; readonly requestId?: string }
  | { readonly type: "safety-center-confirm-action"; readonly requestId?: string }
  | { readonly type: "safety-center-cancel-action"; readonly requestId?: string }
  | { readonly type: "safety-center-settings-action"; readonly field: "notifications" | "background-sync"; readonly enabled: boolean; readonly requestId?: string };

function isNonEmptyBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isId(value: unknown): value is string {
  return isNonEmptyBoundedString(value, FEDOS_DESKTOP_HOST_MAX_ID_LENGTH);
}

/** Structural shape check only -- `authority` must be one of the ALREADY-closed real values; never accepts an unknown protocol label. No secret field exists on this type to validate against (Alpha 762's own guardrail, unchanged). */
function isParticipantReference(value: unknown): value is FedosConversationParticipantReference {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.authority !== "string" || !FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES.includes(candidate.authority as never)) return false;
  if (!isNonEmptyBoundedString(candidate.publicIdentifier, FEDOS_DESKTOP_HOST_MAX_ID_LENGTH)) return false;
  if (candidate.identityId !== null && !isNonEmptyBoundedString(candidate.identityId, FEDOS_DESKTOP_HOST_MAX_ID_LENGTH)) return false;
  return true;
}

/** No `".."` path segment on either separator -- Phase H's own "no path traversal" requirement, enforced BEFORE the Archive File Authority's own (separate, already-real) filesystem checks are ever reached. */
function isSafeArchivePath(value: unknown): value is string {
  if (!isNonEmptyBoundedString(value, FEDOS_DESKTOP_HOST_MAX_PATH_LENGTH)) return false;
  const segments = value.split(/[/\\]/);
  return !segments.includes("..");
}

function optionalRequestId(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= FEDOS_DESKTOP_HOST_MAX_ID_LENGTH ? value : undefined;
}

/** Structural shape check only -- mirrors `isParticipantReference()`'s own discipline, but `authority` is NOT restricted to `FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES` (a Device Binding account authority is a separate, Device-Registry-scoped concept, see `../../device/fedos_device_binding.ts`) -- structural non-empty-bounded-string only. */
function isDeviceBindingAccountRef(value: unknown): value is FedosDeviceBindingAccountRef {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (!isNonEmptyBoundedString(candidate.authority, FEDOS_DESKTOP_HOST_MAX_ID_LENGTH)) return false;
  if (!isNonEmptyBoundedString(candidate.publicIdentifier, FEDOS_DESKTOP_HOST_MAX_ID_LENGTH)) return false;
  if (candidate.identityId !== null && !isNonEmptyBoundedString(candidate.identityId, FEDOS_DESKTOP_HOST_MAX_ID_LENGTH)) return false;
  return true;
}

function isPairingRecord(value: unknown): value is string {
  return isNonEmptyBoundedString(value, FEDOS_DESKTOP_HOST_MAX_PAIRING_RECORD_LENGTH);
}

// Secure Runtime Alpha 6041-6120 -- deletion-request structural checks.
function isFedosDeletionRequestScopeValue(value: unknown): value is FedosDeletionRequestScope {
  return typeof value === "string" && (FEDOS_DELETION_REQUEST_SCOPES as readonly string[]).includes(value);
}
function isFedosDeletionRequestReasonCodeOrNull(value: unknown): value is FedosDeletionRequestReasonCode | null {
  return value === null || (typeof value === "string" && (FEDOS_DELETION_REQUEST_REASON_CODES as readonly string[]).includes(value));
}
function isFedosDeletionRecipientPolicyValue(value: unknown): value is FedosDeletionRecipientPolicy {
  return typeof value === "string" && (FEDOS_DELETION_RECIPIENT_POLICIES as readonly string[]).includes(value);
}
const FEDOS_DESKTOP_HOST_MAX_DEVICE_LIST_LENGTH = 64;
function isDeviceIdList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length <= FEDOS_DESKTOP_HOST_MAX_DEVICE_LIST_LENGTH && value.every((v) => isId(v));
}

// Secure Runtime Alpha 6121-6200 -- identity-transition structural checks.
function isFedosIdentityTransitionManualVerificationMethodValue(value: unknown): value is FedosIdentityTransitionManualVerificationMethod {
  return typeof value === "string" && (FEDOS_IDENTITY_TRANSITION_KNOWN_MANUAL_VERIFICATION_METHODS as readonly string[]).includes(value);
}
function isFedosIdentityTransitionManualVerificationNoteCodeValue(value: unknown): value is FedosIdentityTransitionManualVerificationNoteCode {
  return typeof value === "string" && (FEDOS_IDENTITY_TRANSITION_KNOWN_MANUAL_VERIFICATION_NOTE_CODES as readonly string[]).includes(value);
}
function isFedosIdentityTransitionAcceptanceStateValue(value: unknown): value is FedosIdentityTransitionAcceptanceState {
  return typeof value === "string" && (FEDOS_IDENTITY_TRANSITION_KNOWN_ACCEPTANCE_STATES as readonly string[]).includes(value);
}
const FEDOS_DESKTOP_HOST_MAX_SESSION_PAIR_LIST_LENGTH = 64;
function isSessionPairList(value: unknown): value is readonly { readonly conversationId: string; readonly remoteDeviceRef: string }[] {
  if (!Array.isArray(value) || value.length > FEDOS_DESKTOP_HOST_MAX_SESSION_PAIR_LIST_LENGTH) return false;
  return value.every((v) => {
    if (v === null || typeof v !== "object") return false;
    const r = v as Record<string, unknown>;
    return isId(r.conversationId) && isId(r.remoteDeviceRef);
  });
}
function isAffectedSessionList(
  value: unknown,
): value is readonly { readonly sessionId: string; readonly conversationId: string; readonly remoteAccountRef: FedosDeviceBindingAccountRef; readonly remoteDeviceRef: string }[] {
  if (!Array.isArray(value) || value.length > FEDOS_DESKTOP_HOST_MAX_SESSION_PAIR_LIST_LENGTH) return false;
  return value.every((v) => {
    if (v === null || typeof v !== "object") return false;
    const r = v as Record<string, unknown>;
    return isId(r.sessionId) && isId(r.conversationId) && isDeviceBindingAccountRef(r.remoteAccountRef) && isId(r.remoteDeviceRef);
  });
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Fails closed to `null` for anything not a genuinely well-formed,
 * in-vocabulary command -- an unknown `type`, a missing/oversized/
 * wrong-typed field, or a non-object candidate. Never throws.
 */
export function validateFedosDesktopHostCommand(candidate: unknown): FedosDesktopHostCommand | null {
  if (candidate === null || typeof candidate !== "object") return null;
  const c = candidate as Record<string, unknown>;
  const requestId = optionalRequestId(c.requestId);

  switch (c.type) {
    case "runtime-status":
    case "device-status":
      return requestId === undefined ? { type: c.type } : { type: c.type, requestId };

    case "conversations-list": {
      // `filter` is passed straight through to the Shell's own listConversations() -- that
      // method itself already ignores an unrecognized value safely; this layer only bounds
      // its TYPE, never re-implements the Shell's own filtering semantics.
      const filter = c.filter !== null && typeof c.filter === "object" ? (c.filter as FedosConversationListFilter) : undefined;
      return requestId === undefined ? { type: "conversations-list", filter } : { type: "conversations-list", filter, requestId };
    }

    case "conversation-open":
    case "messages-list":
    case "membership-list": {
      if (!isId(c.conversationId)) return null;
      const conversationId = c.conversationId;
      return requestId === undefined ? { type: c.type, conversationId } : { type: c.type, conversationId, requestId };
    }

    case "conversation-create-direct": {
      if (c.command === null || typeof c.command !== "object") return null;
      const command = c.command as Record<string, unknown>;
      if (command.recipient === null || typeof command.recipient !== "object") return null;
      const recipient = command.recipient as Record<string, unknown>;
      if (typeof recipient.authority !== "string" || !FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES.includes(recipient.authority as never)) return null;
      const authority = recipient.authority as (typeof FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES)[number];
      if (!isId(recipient.publicIdentifier)) return null;
      if (command.idempotencyKey !== undefined && !isId(command.idempotencyKey)) return null;
      const draftCommand: CreateDirectDraftCommand = {
        recipient: { authority, publicIdentifier: recipient.publicIdentifier },
        ...(command.idempotencyKey !== undefined ? { idempotencyKey: command.idempotencyKey as string } : {}),
      };
      return requestId === undefined
        ? { type: "conversation-create-direct", command: draftCommand }
        : { type: "conversation-create-direct", command: draftCommand, requestId };
    }

    case "conversation-create-group": {
      const command = c.command !== null && typeof c.command === "object" ? (c.command as CreatePrivateGroupDraftCommand) : {};
      return requestId === undefined
        ? { type: "conversation-create-group", command }
        : { type: "conversation-create-group", command, requestId };
    }

    case "message-reveal": {
      if (!isId(c.conversationId) || !isId(c.messageId)) return null;
      const conversationId = c.conversationId;
      const messageId = c.messageId;
      return requestId === undefined
        ? { type: "message-reveal", conversationId, messageId }
        : { type: "message-reveal", conversationId, messageId, requestId };
    }

    case "message-send": {
      if (!isId(c.conversationId)) return null;
      if (!isParticipantReference(c.sender)) return null;
      if (!isNonEmptyBoundedString(c.body, FEDOS_CONVERSATION_DIRECT_MESSAGE_MAX_BODY_LENGTH)) return null;
      const conversationId = c.conversationId;
      const sender = c.sender;
      const body = c.body;
      return requestId === undefined
        ? { type: "message-send", conversationId, sender, body }
        : { type: "message-send", conversationId, sender, body, requestId };
    }

    case "message-reply": {
      if (!isId(c.conversationId) || !isId(c.replyToMessageId)) return null;
      if (!isParticipantReference(c.sender)) return null;
      if (!isNonEmptyBoundedString(c.body, FEDOS_CONVERSATION_DIRECT_MESSAGE_MAX_BODY_LENGTH)) return null;
      const conversationId = c.conversationId;
      const sender = c.sender;
      const replyToMessageId = c.replyToMessageId;
      const body = c.body;
      return requestId === undefined
        ? { type: "message-reply", conversationId, sender, replyToMessageId, body }
        : { type: "message-reply", conversationId, sender, replyToMessageId, body, requestId };
    }

    case "invitation-descriptor": {
      if (!isId(c.conversationId)) return null;
      if (!isParticipantReference(c.issuer)) return null;
      const conversationId = c.conversationId;
      const issuer = c.issuer;
      return requestId === undefined
        ? { type: "invitation-descriptor", conversationId, issuer }
        : { type: "invitation-descriptor", conversationId, issuer, requestId };
    }

    case "search": {
      if (typeof c.query !== "string" || c.query.length > FEDOS_DESKTOP_HOST_MAX_QUERY_LENGTH) return null;
      const query = c.query;
      return requestId === undefined ? { type: "search", query } : { type: "search", query, requestId };
    }

    case "archive-inspect": {
      if (!isSafeArchivePath(c.sourcePath)) return null;
      const sourcePath = c.sourcePath;
      return requestId === undefined ? { type: "archive-inspect", sourcePath } : { type: "archive-inspect", sourcePath, requestId };
    }

    // Secure Runtime Alpha 4581-4660 -- Device Registration/Pairing commands.
    case "device-pairing-create": {
      if (!isId(c.deviceId)) return null;
      if (!isDeviceBindingAccountRef(c.expectedAccountRef)) return null;
      const deviceId = c.deviceId;
      const expectedAccountRef = c.expectedAccountRef;
      return requestId === undefined
        ? { type: "device-pairing-create", deviceId, expectedAccountRef }
        : { type: "device-pairing-create", deviceId, expectedAccountRef, requestId };
    }

    case "device-pairing-inspect":
    case "device-pairing-approve": {
      if (!isPairingRecord(c.encodedRequest)) return null;
      const encodedRequest = c.encodedRequest;
      return requestId === undefined ? { type: c.type, encodedRequest } : { type: c.type, encodedRequest, requestId };
    }

    case "device-pairing-complete": {
      if (!isId(c.pairingId)) return null;
      if (!isPairingRecord(c.encodedApproval)) return null;
      const pairingId = c.pairingId;
      const encodedApproval = c.encodedApproval;
      return requestId === undefined
        ? { type: "device-pairing-complete", pairingId, encodedApproval }
        : { type: "device-pairing-complete", pairingId, encodedApproval, requestId };
    }

    case "device-pairings-list":
      return requestId === undefined ? { type: "device-pairings-list" } : { type: "device-pairings-list", requestId };

    case "device-revoke": {
      if (!isId(c.deviceId)) return null;
      if (!isId(c.devicePublicKeyHex)) return null;
      const deviceId = c.deviceId;
      const devicePublicKeyHex = c.devicePublicKeyHex;
      return requestId === undefined
        ? { type: "device-revoke", deviceId, devicePublicKeyHex }
        : { type: "device-revoke", deviceId, devicePublicKeyHex, requestId };
    }

    case "device-registration-status": {
      if (!isId(c.deviceId)) return null;
      const deviceId = c.deviceId;
      return requestId === undefined
        ? { type: "device-registration-status", deviceId }
        : { type: "device-registration-status", deviceId, requestId };
    }

    // Secure Runtime Alpha 6041-6120 -- Signed Deletion Request commands.
    case "deletion-request-create": {
      if (!isId(c.requesterAccountRef) || !isId(c.recipientAccountRef) || !isId(c.recipientDeviceRef)) return null;
      if (!isId(c.conversationId) || !isId(c.targetEnvelopeId)) return null;
      if (!isFedosDeletionRequestScopeValue(c.scope)) return null;
      if (typeof c.expiresInSeconds !== "number" || !Number.isInteger(c.expiresInSeconds) || c.expiresInSeconds <= 0) return null;
      if (!isFedosDeletionRequestReasonCodeOrNull(c.reasonCode)) return null;
      const base = {
        type: "deletion-request-create" as const,
        requesterAccountRef: c.requesterAccountRef,
        recipientAccountRef: c.recipientAccountRef,
        recipientDeviceRef: c.recipientDeviceRef,
        conversationId: c.conversationId,
        targetEnvelopeId: c.targetEnvelopeId,
        scope: c.scope,
        expiresInSeconds: c.expiresInSeconds,
        reasonCode: c.reasonCode,
      };
      return requestId === undefined ? base : { ...base, requestId };
    }

    case "deletion-request-list-sent":
    case "deletion-request-device-outcomes": {
      if (!isId(c.conversationId) || !isId(c.targetEnvelopeId)) return null;
      if (!isDeviceIdList(c.knownDeviceIds)) return null;
      const conversationId = c.conversationId;
      const targetEnvelopeId = c.targetEnvelopeId;
      const knownDeviceIds = c.knownDeviceIds;
      return requestId === undefined
        ? { type: c.type, conversationId, targetEnvelopeId, knownDeviceIds }
        : { type: c.type, conversationId, targetEnvelopeId, knownDeviceIds, requestId };
    }

    case "deletion-request-list-received":
      return requestId === undefined ? { type: "deletion-request-list-received" } : { type: "deletion-request-list-received", requestId };

    case "deletion-request-open": {
      if (!isId(c.deletionRequestId)) return null;
      if (!isFedosDeletionRecipientPolicyValue(c.localPolicy)) return null;
      const deletionRequestId = c.deletionRequestId;
      const localPolicy = c.localPolicy;
      return requestId === undefined
        ? { type: "deletion-request-open", deletionRequestId, localPolicy }
        : { type: "deletion-request-open", deletionRequestId, localPolicy, requestId };
    }

    case "deletion-request-approve":
    case "deletion-request-reject":
    case "deletion-request-status":
    case "deletion-request-dismiss": {
      if (!isId(c.deletionRequestId)) return null;
      const deletionRequestId = c.deletionRequestId;
      return requestId === undefined ? { type: c.type, deletionRequestId } : { type: c.type, deletionRequestId, requestId };
    }

    case "identity-transition-list": {
      if (!isNonNegativeInteger(c.limit) || !isNonNegativeInteger(c.offset)) return null;
      const limit = c.limit;
      const offset = c.offset;
      return requestId === undefined ? { type: "identity-transition-list", limit, offset } : { type: "identity-transition-list", limit, offset, requestId };
    }

    case "identity-transition-open":
    case "identity-transition-inspect-evidence":
    case "identity-transition-accept":
    case "identity-transition-reject":
    case "identity-transition-defer":
    case "identity-transition-status": {
      if (!isDeviceBindingAccountRef(c.peerAccountRef)) return null;
      if (!isId(c.peerDeviceRef)) return null;
      if (!isId(c.transitionId)) return null;
      const peerAccountRef = c.peerAccountRef;
      const peerDeviceRef = c.peerDeviceRef;
      const transitionId = c.transitionId;
      return requestId === undefined
        ? { type: c.type, peerAccountRef, peerDeviceRef, transitionId }
        : { type: c.type, peerAccountRef, peerDeviceRef, transitionId, requestId };
    }

    case "identity-transition-record-manual-verification": {
      if (!isId(c.transitionId)) return null;
      if (!isFedosIdentityTransitionManualVerificationMethodValue(c.method)) return null;
      if (!isFiniteNumber(c.verifiedAt)) return null;
      if (!isFedosIdentityTransitionManualVerificationNoteCodeValue(c.noteCode)) return null;
      const transitionId = c.transitionId;
      const method = c.method;
      const verifiedAt = c.verifiedAt;
      const noteCode = c.noteCode;
      return requestId === undefined
        ? { type: "identity-transition-record-manual-verification", transitionId, method, verifiedAt, noteCode }
        : { type: "identity-transition-record-manual-verification", transitionId, method, verifiedAt, noteCode, requestId };
    }

    case "identity-transition-assess-continuity": {
      if (!isSessionPairList(c.pairs)) return null;
      const pairs = c.pairs;
      return requestId === undefined
        ? { type: "identity-transition-assess-continuity", pairs }
        : { type: "identity-transition-assess-continuity", pairs, requestId };
    }

    case "identity-transition-authorize-ratchet-reset": {
      if (!isId(c.transitionId)) return null;
      if (!isFedosIdentityTransitionAcceptanceStateValue(c.acceptanceState)) return null;
      if (!isAffectedSessionList(c.affectedSessions)) return null;
      const transitionId = c.transitionId;
      const acceptanceState = c.acceptanceState;
      const affectedSessions = c.affectedSessions;
      return requestId === undefined
        ? { type: "identity-transition-authorize-ratchet-reset", transitionId, acceptanceState, affectedSessions }
        : { type: "identity-transition-authorize-ratchet-reset", transitionId, acceptanceState, affectedSessions, requestId };
    }

    case "safety-center-overview": {
      if (!isSessionPairList(c.ratchetPairs)) return null;
      const ratchetPairs = c.ratchetPairs;
      return requestId === undefined ? { type: "safety-center-overview", ratchetPairs } : { type: "safety-center-overview", ratchetPairs, requestId };
    }

    case "safety-center-events": {
      if (!isNonNegativeInteger(c.limit) || !isNonNegativeInteger(c.offset)) return null;
      const limit = c.limit;
      const offset = c.offset;
      return requestId === undefined ? { type: "safety-center-events", limit, offset } : { type: "safety-center-events", limit, offset, requestId };
    }

    case "safety-center-section": {
      if (typeof c.section !== "string" || !(FEDOS_SAFETY_CENTER_SECTIONS as readonly string[]).includes(c.section)) return null;
      const section = c.section as FedosSafetyCenterSection;
      return requestId === undefined ? { type: "safety-center-section", section } : { type: "safety-center-section", section, requestId };
    }

    case "safety-center-device-action": {
      if (c.action !== "request-revoke") return null;
      if (!isId(c.deviceId) || !isId(c.devicePublicKeyHex)) return null;
      const deviceId = c.deviceId;
      const devicePublicKeyHex = c.devicePublicKeyHex;
      return requestId === undefined
        ? { type: "safety-center-device-action", action: "request-revoke", deviceId, devicePublicKeyHex }
        : { type: "safety-center-device-action", action: "request-revoke", deviceId, devicePublicKeyHex, requestId };
    }

    case "safety-center-ratchet-action": {
      if (c.action !== "request-reset") return null;
      if (!isId(c.conversationId) || !isId(c.remoteDeviceRef)) return null;
      const conversationId = c.conversationId;
      const remoteDeviceRef = c.remoteDeviceRef;
      return requestId === undefined
        ? { type: "safety-center-ratchet-action", action: "request-reset", conversationId, remoteDeviceRef }
        : { type: "safety-center-ratchet-action", action: "request-reset", conversationId, remoteDeviceRef, requestId };
    }

    case "safety-center-confirm-action":
    case "safety-center-cancel-action":
      return requestId === undefined ? { type: c.type } : { type: c.type, requestId };

    case "safety-center-settings-action": {
      if (c.field !== "notifications" && c.field !== "background-sync") return null;
      if (typeof c.enabled !== "boolean") return null;
      const field = c.field;
      const enabled = c.enabled;
      return requestId === undefined
        ? { type: "safety-center-settings-action", field, enabled }
        : { type: "safety-center-settings-action", field, enabled, requestId };
    }

    default:
      return null;
  }
}
