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

/** This layer's own bound for id-shaped strings (conversation/message ids) -- mirrors the "512, non-empty" bound this codebase's own domain validators already apply pervasively to ids (e.g. `fedos_group_message.ts`/`fedos_group_direct_path.ts`'s own `MAX_STRING_LENGTH`), restated here since this Host layer sits ABOVE those domains and must reject an oversized/malformed id before it ever reaches them. */
export const FEDOS_DESKTOP_HOST_MAX_ID_LENGTH = 512;

/** This layer's own bound for search query text -- no existing domain limit exists for search query text specifically (Search has no caller-facing length bound of its own); chosen modestly below the message-body bound since a query is display text, never stored content. */
export const FEDOS_DESKTOP_HOST_MAX_QUERY_LENGTH = 500;

/** This layer's own bound for a filesystem path string passed to `archive-inspect` -- generous enough for a real path, still a hard ceiling against an unbounded string. */
export const FEDOS_DESKTOP_HOST_MAX_PATH_LENGTH = 4096;

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
  | { readonly type: "archive-inspect"; readonly sourcePath: string; readonly requestId?: string };

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

    default:
      return null;
  }
}
