/**
 * Secure Runtime Alpha 3081-3160 ("Desktop Runtime Conversation Content
 * Accessor and Application Shell Activation Arc") — Phase B.
 *
 * Closed, immutable, application-layer result/view shapes for
 * `FedosDesktopConversationContentAccessor`
 * (`./fedos_desktop_conversation_content_accessor.ts`). Deliberately a
 * SEPARATE closed vocabulary from `FedosDesktopShellResult`
 * (`../shell/fedos_desktop_shell_result.ts`) — this Runtime-layer accessor
 * does not import anything from `../shell/`, avoiding a layering inversion
 * (the Shell depends on the Runtime layer, never the reverse); the Shell
 * maps this vocabulary onto its own outcome kinds one-for-one, matching
 * this Arc's own "Shell body replacement... map accepted domain outcomes
 * into existing Shell result vocabulary" instruction.
 *
 * Never a raw `Error`, never a crypto handle, never a persistence record —
 * every field here is either already-public metadata or a coarse, closed
 * outcome token.
 */

export type FedosContentAccessorOutcomeKind =
  | "unavailable"
  | "unauthorized"
  | "not-found"
  | "invalid-input"
  | "conflict"
  | "requires-activation"
  | "requires-unlock"
  | "unsupported"
  | "failed";

export interface FedosContentAccessorFailure {
  readonly outcome: FedosContentAccessorOutcomeKind;
  /** Short, closed, non-secret diagnostic — safe to display or log verbatim. */
  readonly reason: string;
}

export type FedosContentAccessorResult<T> = { readonly outcome: "ok"; readonly value: T } | FedosContentAccessorFailure;

export function fedosContentAccessorOk<T>(value: T): FedosContentAccessorResult<T> {
  return Object.freeze({ outcome: "ok", value });
}

export function fedosContentAccessorFailure<T = never>(outcome: FedosContentAccessorOutcomeKind, reason: string): FedosContentAccessorResult<T> {
  return Object.freeze({ outcome, reason });
}

/**
 * The message DOES exist and its metadata is genuinely known — plaintext is
 * "unavailable" only for an honest, content-level reason (retention denial,
 * the local participant being this Group Message's own sender with no
 * self-Envelope to decrypt, or not being one of its fan-out recipients).
 * Never conflated with `FedosContentAccessorFailure` — a caller that cannot
 * even resolve WHICH message/conversation is meant gets a failure outcome
 * instead (see `readMessage()`'s own header).
 */
export type FedosContentAccessorPlaintextView =
  | { readonly state: "available"; readonly text: string }
  | { readonly state: "unavailable"; readonly reason: string };

/** `"stored-locally"` says nothing about remote delivery — see Phase F's own "never claim remote delivery from a local write" rule. */
export type FedosContentAccessorLocalDeliveryStateView = "stored-locally" | "unavailable";

/** Mirrors `FedosPayloadRetentionState`'s own three real values, plus `"unavailable"` for a Group message whose per-recipient retention this base cannot roll up to one state (see the accessor's own header). */
export type FedosContentAccessorRetentionStateView = "active" | "tombstoned" | "payload-removed" | "unavailable";

export interface FedosContentAccessorMessageView {
  readonly messageId: string;
  readonly conversationId: string;
  readonly senderMembershipId: string;
  readonly createdAt: number;
  readonly replyToMessageId: string | null;
  readonly plaintext: FedosContentAccessorPlaintextView;
  readonly localDeliveryState: FedosContentAccessorLocalDeliveryStateView;
  readonly retentionState: FedosContentAccessorRetentionStateView;
}

/**
 * FedOS Message Delivery Truth arc — a SEPARATE fact from `fanout`/
 * `localWrite`, mirroring `FedosConversationDirectMessageSendResult.delivery`'s
 * own "never label Relay ACK as recipient delivery, return SEPARATE facts"
 * discipline (Alpha 1851) one layer up, into the application/presentation
 * boundary. This is the field that used to be silently thrown away: a
 * Direct send's real `result.delivery` (already correctly awaited and
 * carried by the Runtime coordinator) reached this file's own
 * `sendMessage()` and was discarded in favor of a hardcoded
 * `fanout: "not-applicable"` — which is honest about fan-out (a Direct
 * send genuinely has none) but said nothing at all about whether the
 * message actually queued for delivery, and silently dropped a real
 * failure (`crypto-unavailable`/`route-unavailable`/etc.) as if it had
 * never happened.
 *
 * Only ever reflects what the current architecture can actually prove
 * synchronously at send time: whether the message was handed to a real
 * transport/ratchet delivery attempt and what that attempt's own closed
 * outcome was. `"queued"` means genuinely queued for asynchronous relay
 * delivery via the existing outbox/mailbox mechanism — NEVER a relay ACK,
 * NEVER "the recipient received it" (this codebase has no synchronous
 * relay-ACK-to-caller path today; claiming one would itself be a new
 * lie). `undefined` (the field entirely absent) means no delivery
 * dependency was configured for this send at all — a real, honest
 * "unknown" distinct from every other state, never coerced to `"queued"`.
 */
export type FedosContentAccessorDeliveryRoute = "direct-ratchet" | "legacy-nip17";

export type FedosContentAccessorDeliveryFact =
  | { readonly route: FedosContentAccessorDeliveryRoute; readonly state: "queued" }
  | { readonly route: FedosContentAccessorDeliveryRoute; readonly state: "route-unavailable"; readonly reason: string }
  | { readonly route: FedosContentAccessorDeliveryRoute; readonly state: "unavailable"; readonly reason: string }
  | { readonly route: FedosContentAccessorDeliveryRoute; readonly state: "failed"; readonly reason: string };

/**
 * The result of a just-performed `sendMessage()`/`replyToMessage()` call —
 * deliberately NOT a `FedosContentAccessorMessageView` (the caller already
 * knows the plaintext it just sent; re-embedding it would invite a second,
 * divergent "what did I just send" source of truth). `fanout` is the ONE
 * new axis Phase F requires beyond a Direct 1:1 send: `"not-applicable"`
 * for a Direct send (no fan-out concept exists), `"complete"` when every
 * Group recipient's own Envelope was stored, `"partial"` when at least one
 * recipient's own Envelope failed while at least one other succeeded (a
 * whole-operation failure — zero recipients stored — is a
 * `FedosContentAccessorFailure` instead, never an `ok` result nobody can
 * actually read). `delivery` is Direct-only (see its own header above) —
 * always `undefined` for a Group send, which already reports its own real
 * per-recipient outcome via `fanout`.
 */
export interface FedosContentAccessorSendResult {
  readonly messageId: string;
  readonly conversationId: string;
  readonly createdAt: number;
  readonly localWrite: "stored";
  readonly fanout: "not-applicable" | "complete" | "partial";
  readonly delivery?: FedosContentAccessorDeliveryFact;
}

export interface FedosContentAccessorSearchHit {
  readonly conversationId: string;
  readonly messageId: string;
}

import type {
  FedosConversationArchiveExportRequest,
  FedosConversationArchiveExportResult,
  FedosConversationArchiveInspectionResult,
  FedosConversationArchivePreflightResult,
  FedosConversationArchiveRestoreRequest,
  FedosConversationArchiveRestoreResultSummary,
} from "../../conversations/archive/runtime/fedos_conversation_archive_runtime.js";

/**
 * One discriminated command per REAL operation
 * `FedosConversationArchiveRuntime` actually exposes (Alpha 1691–1760,
 * unmodified, exactly four methods) — no "list"/"summary"/"verify"
 * operation is invented here; this base's own Archive Runtime has no such
 * distinct capability (see this Arc's own reconciliation/completion docs).
 */
export type FedosContentAccessorArchiveCommand =
  | { readonly operation: "inspect"; readonly sourcePath: string }
  | { readonly operation: "preflightRestore"; readonly request: FedosConversationArchiveRestoreRequest }
  | { readonly operation: "export"; readonly request: FedosConversationArchiveExportRequest }
  | { readonly operation: "restore"; readonly request: FedosConversationArchiveRestoreRequest };

export type FedosContentAccessorArchiveValue =
  | { readonly operation: "inspect"; readonly result: FedosConversationArchiveInspectionResult }
  | { readonly operation: "preflightRestore"; readonly result: FedosConversationArchivePreflightResult }
  | { readonly operation: "export"; readonly result: FedosConversationArchiveExportResult }
  | { readonly operation: "restore"; readonly result: FedosConversationArchiveRestoreResultSummary };
