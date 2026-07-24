/**
 * Secure Runtime Alpha 3081-3160 ("Desktop Runtime Conversation Content
 * Accessor and Application Shell Activation Arc") — Phase B/C/D/E/F/G/H.
 *
 * `FedosDesktopConversationContentAccessor` is the ONE narrow application
 * boundary this Arc adds between `FedosRunningDesktopRuntime`
 * (`../runtime/fedos_desktop_runtime.ts`) and
 * `FedosDesktopApplicationShell` (`../shell/fedos_desktop_application_shell.ts`),
 * closing the exact gap Alpha 2841-2920 documented and stopped at: neither
 * `boardRuntime()`/`conversationRuntime()`/`privateTransport()` reached
 * Envelope/Payload persistence, Search, or Archive in a way the Shell could
 * call safely. This file owns NO persistence of its own — every method
 * delegates to `FedosConversationRuntime`
 * (`../../conversation/runtime/fedos_conversation_runtime.ts`),
 * `FedosConversationGroupRuntime`
 * (`../../conversation/group/fedos_conversation_group_runtime.ts`),
 * `FedosConversationSearchIndex`
 * (`../../conversation/search/fedos_conversation_search_index.ts`), and
 * `FedosConversationArchiveRuntime`
 * (`../../conversation/archive/runtime/fedos_conversation_archive_runtime.ts`)
 * — every one of them ALREADY constructed, UNCHANGED-in-kind, by
 * `startFedosDesktopRuntime()`.
 *
 * LIFECYCLE (Phase C): `isRuntimeRunning` is an INJECTED predicate, never an
 * internal mutable flag — mirrors `FedosConversationArchiveRuntime`'s own
 * already-established "every public method checks it FIRST, before any
 * await" discipline exactly (see that file's own header, "LIFECYCLE"). The
 * owning `startFedosDesktopRuntime()` passes a closure reading its own
 * `stopped` local variable; `FedosRunningDesktopRuntime.conversationContentAccessor()`
 * ADDITIONALLY throws once `stop()` has been called (the SAME two-layer
 * defense `conversationArchiveRuntime()` itself already gets).
 *
 * SEARCH INDEXING (Phase G): this accessor owns exactly ONE
 * `FedosConversationSearchIndex` instance per running Runtime, constructed
 * once via `conversationRuntime.createSearchIndex()` and retained for the
 * whole session (that method's own contract: "callers MUST retain and
 * reuse ONE instance"). Indexing happens ONLY at the moment this accessor
 * itself already holds plaintext it legitimately produced —
 * `readMessage()`/`sendMessage()` on a DIRECT conversation, immediately
 * after a real decrypt/encrypt — never a bulk background decrypt-everything
 * pass (Phase G's own "no query-time decryption bypass"). Group messages
 * are DELIBERATELY not indexed by this Arc: a Group message's own
 * recipient Envelope lives under its pairwise Direct child's own
 * conversation id (`fedos_group_send_coordinator.ts`'s own header), not the
 * Group id a Shell/UI caller actually holds — indexing it would either leak
 * that internal child id into a search result or require silently
 * remapping it, and this Arc declines to invent either. Documented
 * honestly in this Arc's own completion declaration, not fabricated.
 */

import type { FedosConversationRuntime } from "../../conversation/runtime/fedos_conversation_runtime.js";
import type { FedosConversationArchiveRuntime } from "../../conversation/archive/runtime/fedos_conversation_archive_runtime.js";
import type { FedosConversationSearchIndex } from "../../conversation/search/fedos_conversation_search_index.js";
import type { FedosConversationParticipantReference } from "../../conversation/membership/fedos_conversation_participant_reference.js";
import {
  fedosContentAccessorOk,
  fedosContentAccessorFailure,
  type FedosContentAccessorResult,
  type FedosContentAccessorMessageView,
  type FedosContentAccessorSendResult,
  type FedosContentAccessorSearchHit,
  type FedosContentAccessorArchiveCommand,
  type FedosContentAccessorArchiveValue,
} from "./fedos_desktop_conversation_content_accessor_result.js";

export interface FedosDesktopConversationContentAccessorDependencies {
  readonly conversationRuntime: FedosConversationRuntime;
  /** `null` when `config.archiveEnabled` was not set — every `archive()` call then fails closed to `"unavailable"`, mirroring `conversationArchiveRuntime()`'s own "not enabled" contract. */
  readonly archiveRuntime: FedosConversationArchiveRuntime | null;
  /** See this file's own header, "LIFECYCLE". */
  readonly isRuntimeRunning: () => boolean;
  /**
   * Secure Runtime Alpha 6521-6600 (FedOS Desktop Beta Production Runtime
   * Configuration Unification Arc) — OPTIONAL. Omitted, this class
   * constructs its own via `conversationRuntime.createSearchIndex()`
   * (byte-for-byte the same behavior as before this Arc). A caller that
   * ALSO needs a coherent, single search-index instance shared with
   * another subsystem (e.g. Signed Deletion Request's own
   * `reconcilePayloadRetention()` reconciliation) supplies that SAME
   * instance here instead — never a second, divergent index silently
   * left un-reconciled with the one this accessor's own `search()`
   * actually queries.
   */
  readonly searchIndex?: FedosConversationSearchIndex;
}

function participantsEqual(a: FedosConversationParticipantReference, b: FedosConversationParticipantReference): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier;
}

export class FedosDesktopConversationContentAccessor {
  readonly #deps: FedosDesktopConversationContentAccessorDependencies;
  readonly #searchIndex: FedosConversationSearchIndex;

  constructor(deps: FedosDesktopConversationContentAccessorDependencies) {
    this.#deps = deps;
    this.#searchIndex = deps.searchIndex ?? deps.conversationRuntime.createSearchIndex();
  }

  #resolveMode(conversationId: string): "direct" | "private-group" | null {
    return this.#deps.conversationRuntime.findConversation(conversationId)?.mode ?? null;
  }

  /** Local identity + active Membership on `conversationId` — the authorization gate neither `listDirectMessages()` nor `listPrivateGroupMessages()` performs on their own (see this file's own header and Phase D). */
  #authorizeLocalRead(conversationId: string): "unavailable" | "unauthorized" | "ok" {
    const identity = this.#deps.conversationRuntime.resolveLocalParticipant();
    if (identity === null) return "unavailable";
    const membership = this.#deps.conversationRuntime.listMemberships(conversationId).find((m) => participantsEqual(m.participant, identity));
    if (membership === undefined || membership.state !== "active") return "unauthorized";
    return "ok";
  }

  // -------------------------------------------------------------------
  // Reads.
  // -------------------------------------------------------------------

  listMessages(conversationId: string): FedosContentAccessorResult<readonly FedosContentAccessorMessageView[]> {
    if (!this.#deps.isRuntimeRunning()) return fedosContentAccessorFailure("unavailable", "runtime is not running");
    const mode = this.#resolveMode(conversationId);
    if (mode === null) return fedosContentAccessorFailure("not-found", "unknown conversation");

    const authorization = this.#authorizeLocalRead(conversationId);
    if (authorization === "unavailable") return fedosContentAccessorFailure("unavailable", "local identity is not currently resolvable");
    if (authorization === "unauthorized") return fedosContentAccessorFailure("unauthorized", "local participant is not an active member of this conversation");

    if (mode === "direct") {
      const active = this.#deps.conversationRuntime.resolveActiveConversation(conversationId);
      if (active.outcome === "not-found") return fedosContentAccessorFailure("not-found", "unknown conversation");
      if (active.outcome === "not-active") {
        return fedosContentAccessorFailure("requires-activation", "this Direct conversation has not been activated yet");
      }
      const summaries = this.#deps.conversationRuntime.listDirectMessages(conversationId);
      return fedosContentAccessorOk(
        summaries.map((summary) =>
          Object.freeze({
            messageId: summary.envelopeId,
            conversationId,
            senderMembershipId: summary.senderMembershipId,
            createdAt: summary.createdAt,
            replyToMessageId: summary.replyToEnvelopeId,
            plaintext: { state: "unavailable" as const, reason: "listMessages never decrypts -- call readMessage() explicitly (Alpha 1139)" },
            localDeliveryState: "stored-locally" as const,
            retentionState: summary.retentionState,
          }),
        ),
      );
    }

    // private-group -- a Group id is never itself "activated" (the Private-Group
    // Gate, Alpha 1123, unchanged); listing existing messages does not require
    // current fan-out usability, only membership authorization (already checked).
    const summaries = this.#deps.conversationRuntime.groupRuntime().listPrivateGroupMessages(conversationId);
    return fedosContentAccessorOk(
      summaries.map((summary) =>
        Object.freeze({
          messageId: summary.id,
          conversationId,
          senderMembershipId: summary.senderMembershipId,
          createdAt: summary.createdAt,
          replyToMessageId: summary.replyToGroupMessageId,
          plaintext: { state: "unavailable" as const, reason: "listMessages never decrypts -- call readMessage() explicitly" },
          localDeliveryState: "stored-locally" as const,
          // A Group Message's retention is a per-recipient fact (each fan-out
          // Envelope has its own Payload); this base has no single rollup of
          // that to one state at the group-message-summary level -- honestly
          // "unavailable", never guessed.
          retentionState: "unavailable" as const,
        }),
      ),
    );
  }

  async readMessage(conversationId: string, messageId: string): Promise<FedosContentAccessorResult<FedosContentAccessorMessageView>> {
    if (!this.#deps.isRuntimeRunning()) return fedosContentAccessorFailure("unavailable", "runtime is not running");
    const mode = this.#resolveMode(conversationId);
    if (mode === null) return fedosContentAccessorFailure("not-found", "unknown conversation");

    if (mode === "direct") {
      const result = await this.#deps.conversationRuntime.readDirectMessage({ conversationId, envelopeId: messageId });
      switch (result.outcome) {
        case "decrypted": {
          const envelope = this.#deps.conversationRuntime.getConversationMessageEnvelope(conversationId, messageId);
          if (envelope === null) return fedosContentAccessorFailure("failed", "decrypted but envelope metadata could not be re-read");
          const text = new TextDecoder().decode(result.plaintext);
          this.#searchIndex.indexEnvelope({ envelope, text });
          return fedosContentAccessorOk(
            Object.freeze({
              messageId,
              conversationId,
              senderMembershipId: envelope.senderMembershipId,
              createdAt: envelope.createdAt,
              replyToMessageId: envelope.replyToEnvelopeId,
              plaintext: { state: "available" as const, text },
              localDeliveryState: "stored-locally" as const,
              retentionState: "active" as const,
            }),
          );
        }
        case "not-found":
          return fedosContentAccessorFailure("not-found", "unknown message for this conversation");
        case "unauthorized":
          return fedosContentAccessorFailure("unauthorized", "local participant is not an active member of this conversation");
        case "conversation-not-active":
          return fedosContentAccessorFailure("requires-activation", "this Direct conversation has not been activated yet");
        case "invalid-envelope":
          return fedosContentAccessorFailure("invalid-input", "malformed envelope");
        case "payload-unavailable":
          return fedosContentAccessorOk(this.#unavailableView(conversationId, messageId, "payload is not currently available", "unavailable"));
        case "tombstoned":
          return fedosContentAccessorOk(this.#unavailableView(conversationId, messageId, "payload was tombstoned by retention policy", "tombstoned"));
        case "key-unavailable":
          return fedosContentAccessorFailure("unavailable", "local decryption key material is not currently available");
        case "failed":
          return fedosContentAccessorFailure("failed", "decryption failed");
      }
    }

    // private-group.
    const summary = this.#deps.conversationRuntime.groupRuntime().listPrivateGroupMessages(conversationId).find((m) => m.id === messageId);
    if (summary === undefined) return fedosContentAccessorFailure("not-found", "unknown message for this conversation");

    const result = await this.#deps.conversationRuntime.groupRuntime().resolveLocalGroupMessagePlaintext(conversationId, messageId);
    const base = { messageId, conversationId, senderMembershipId: summary.senderMembershipId, createdAt: summary.createdAt, replyToMessageId: summary.replyToGroupMessageId };
    switch (result.outcome) {
      case "decrypted": {
        const text = new TextDecoder().decode(result.plaintext);
        // Deliberately NOT indexed -- see this file's own header, "SEARCH INDEXING".
        return fedosContentAccessorOk(
          Object.freeze({ ...base, plaintext: { state: "available" as const, text }, localDeliveryState: "stored-locally" as const, retentionState: "active" as const }),
        );
      }
      case "own-message":
        return fedosContentAccessorOk(
          Object.freeze({
            ...base,
            plaintext: {
              state: "unavailable" as const,
              reason: "the local participant is this Group Message's own sender; no self-Envelope exists to decrypt on this base",
            },
            localDeliveryState: "stored-locally" as const,
            retentionState: "unavailable" as const,
          }),
        );
      case "not-a-recipient":
        return fedosContentAccessorOk(
          Object.freeze({
            ...base,
            plaintext: { state: "unavailable" as const, reason: "the local participant is not one of this Group Message's fan-out recipients" },
            localDeliveryState: "unavailable" as const,
            retentionState: "unavailable" as const,
          }),
        );
      case "payload-unavailable":
        return fedosContentAccessorOk(
          Object.freeze({ ...base, plaintext: { state: "unavailable" as const, reason: "payload is not currently available" }, localDeliveryState: "stored-locally" as const, retentionState: "unavailable" as const }),
        );
      case "tombstoned":
        return fedosContentAccessorOk(
          Object.freeze({ ...base, plaintext: { state: "unavailable" as const, reason: "payload was tombstoned by retention policy" }, localDeliveryState: "stored-locally" as const, retentionState: "tombstoned" as const }),
        );
      case "identity-unavailable":
        return fedosContentAccessorFailure("unavailable", "local identity is not currently resolvable");
      case "unauthorized":
        return fedosContentAccessorFailure("unauthorized", "local participant is not an active member of this conversation");
      case "not-found":
        return fedosContentAccessorFailure("not-found", "unknown message for this conversation");
      case "conversation-not-active":
        return fedosContentAccessorFailure("requires-activation", "the underlying pairwise Direct path has not been (re)activated yet");
      case "invalid-envelope":
        return fedosContentAccessorFailure("invalid-input", "malformed envelope");
      case "key-unavailable":
        return fedosContentAccessorFailure("unavailable", "local decryption key material is not currently available");
      case "failed":
        return fedosContentAccessorFailure("failed", "decryption failed");
    }
  }

  #unavailableView(
    conversationId: string,
    messageId: string,
    reason: string,
    retentionState: "unavailable" | "tombstoned",
  ): FedosContentAccessorMessageView {
    const envelope = this.#deps.conversationRuntime.getConversationMessageEnvelope(conversationId, messageId);
    return Object.freeze({
      messageId,
      conversationId,
      senderMembershipId: envelope?.senderMembershipId ?? "",
      createdAt: envelope?.createdAt ?? 0,
      replyToMessageId: envelope?.replyToEnvelopeId ?? null,
      plaintext: { state: "unavailable" as const, reason },
      localDeliveryState: "stored-locally" as const,
      retentionState,
    });
  }

  // -------------------------------------------------------------------
  // Writes.
  // -------------------------------------------------------------------

  async sendMessage(conversationId: string, body: string, replyToMessageId: string | null): Promise<FedosContentAccessorResult<FedosContentAccessorSendResult>> {
    if (!this.#deps.isRuntimeRunning()) return fedosContentAccessorFailure("unavailable", "runtime is not running");
    const mode = this.#resolveMode(conversationId);
    if (mode === null) return fedosContentAccessorFailure("not-found", "unknown conversation");

    if (mode === "direct") {
      const result = await this.#deps.conversationRuntime.sendDirectMessage({ conversationId, body, replyToEnvelopeId: replyToMessageId });
      switch (result.outcome) {
        case "sent-locally": {
          const envelope = this.#deps.conversationRuntime.getConversationMessageEnvelope(conversationId, result.envelopeId);
          if (envelope === null) return fedosContentAccessorFailure("failed", "sent but envelope metadata could not be re-read");
          this.#searchIndex.indexEnvelope({ envelope, text: body });
          return fedosContentAccessorOk(
            Object.freeze({ messageId: result.envelopeId, conversationId, createdAt: envelope.createdAt, localWrite: "stored" as const, fanout: "not-applicable" as const }),
          );
        }
        case "invalid-input":
          return fedosContentAccessorFailure("invalid-input", "malformed message body or reply reference");
        case "conversation-not-found":
          return fedosContentAccessorFailure("not-found", "unknown conversation");
        case "conversation-not-active":
          return fedosContentAccessorFailure("requires-activation", "this Direct conversation has not been activated yet");
        case "unauthorized":
          return fedosContentAccessorFailure("unauthorized", "local participant is not an active member of this conversation");
        case "identity-unavailable":
          return fedosContentAccessorFailure("unavailable", "local identity is not currently resolvable");
        case "encryption-unavailable":
          return fedosContentAccessorFailure("unavailable", "local encryption key material is not currently available");
        case "persistence-failed":
        case "failed":
          return fedosContentAccessorFailure("failed", "send failed");
      }
    }

    // private-group.
    const result = await this.#deps.conversationRuntime.groupRuntime().sendPrivateGroupMessage({
      groupConversationId: conversationId,
      body,
      replyToGroupMessageId: replyToMessageId,
    });
    switch (result.outcome) {
      case "stored-for-all":
      case "partial-write": {
        const summary = this.#deps.conversationRuntime.groupRuntime().listPrivateGroupMessages(conversationId).find((m) => m.id === result.groupMessageId);
        const createdAt = summary?.createdAt ?? 0;
        return fedosContentAccessorOk(
          Object.freeze({
            messageId: result.groupMessageId,
            conversationId,
            createdAt,
            localWrite: "stored" as const,
            fanout: result.outcome === "stored-for-all" ? ("complete" as const) : ("partial" as const),
          }),
        );
      }
      case "invalid-input":
        return fedosContentAccessorFailure("invalid-input", "malformed message body or reply reference");
      case "group-not-usable":
        return fedosContentAccessorFailure("requires-activation", "this Group conversation is not currently usable for sending");
      case "sender-unauthorized":
        return fedosContentAccessorFailure("unauthorized", "local participant is not an active member of this conversation");
      case "recipient-path-unavailable":
        return fedosContentAccessorFailure("requires-activation", "one or more recipient Direct paths are not ready");
      case "fanout-failed":
        return fedosContentAccessorFailure("failed", "no recipient received this message");
      case "persistence-failed":
        return fedosContentAccessorFailure("failed", "send failed");
    }
  }

  async replyToMessage(
    conversationId: string,
    parentMessageId: string,
    body: string,
  ): Promise<FedosContentAccessorResult<FedosContentAccessorSendResult>> {
    if (parentMessageId.length === 0) return fedosContentAccessorFailure("invalid-input", "parentMessageId must be non-empty");
    return this.sendMessage(conversationId, body, parentMessageId);
  }

  // -------------------------------------------------------------------
  // Search.
  // -------------------------------------------------------------------

  searchConversations(query: string): FedosContentAccessorResult<readonly FedosContentAccessorSearchHit[]> {
    if (!this.#deps.isRuntimeRunning()) return fedosContentAccessorFailure("unavailable", "runtime is not running");
    if (typeof query !== "string" || query.length === 0) return fedosContentAccessorFailure("invalid-input", "query must be non-empty");

    const envelopeIds = this.#searchIndex.searchKeyword(query);
    const hits: FedosContentAccessorSearchHit[] = [];
    for (const envelopeId of envelopeIds) {
      const conversationId = this.#searchIndex.conversationIdForEnvelope(envelopeId);
      if (conversationId === null) continue;
      hits.push(Object.freeze({ conversationId, messageId: envelopeId }));
    }
    return fedosContentAccessorOk(Object.freeze(hits));
  }

  // -------------------------------------------------------------------
  // Archive.
  // -------------------------------------------------------------------

  async archive(command: FedosContentAccessorArchiveCommand): Promise<FedosContentAccessorResult<FedosContentAccessorArchiveValue>> {
    if (!this.#deps.isRuntimeRunning()) return fedosContentAccessorFailure("unavailable", "runtime is not running");
    const runtime = this.#deps.archiveRuntime;
    if (runtime === null) return fedosContentAccessorFailure("unavailable", "archive is not enabled on this runtime");

    switch (command.operation) {
      case "inspect": {
        const result = await runtime.inspectConversationArchive(command.sourcePath);
        switch (result.outcome) {
          case "inspected":
            return fedosContentAccessorOk({ operation: "inspect", result });
          case "not-found":
            return fedosContentAccessorFailure("not-found", "archive file not found");
          case "invalid":
            return fedosContentAccessorFailure("invalid-input", "archive file is malformed or unsupported");
          case "too-large":
            return fedosContentAccessorFailure("invalid-input", "archive file exceeds the configured size bound");
          case "failed":
            return fedosContentAccessorFailure("failed", "inspection failed");
        }
        break;
      }
      case "preflightRestore": {
        const result = await runtime.preflightRestore(command.request);
        switch (result.outcome) {
          case "previewed":
            return fedosContentAccessorOk({ operation: "preflightRestore", result });
          case "not-found":
            return fedosContentAccessorFailure("not-found", "archive file not found");
          case "invalid-archive":
            return fedosContentAccessorFailure("invalid-input", "archive file is malformed or unsupported");
          case "integrity-failed":
            return fedosContentAccessorFailure("failed", "archive integrity check failed");
          case "identity-mismatch":
            return fedosContentAccessorFailure("unauthorized", "local identity cannot decrypt this archive");
          case "unsupported-version":
            return fedosContentAccessorFailure("unsupported", "unsupported archive schema version");
          case "too-large":
            return fedosContentAccessorFailure("invalid-input", "archive file exceeds the configured size bound");
          case "failed":
            return fedosContentAccessorFailure("failed", "preflight failed");
        }
        break;
      }
      case "export": {
        const result = await runtime.exportConversationArchive(command.request);
        switch (result.outcome) {
          case "exported":
            return fedosContentAccessorOk({ operation: "export", result });
          case "already-exists":
            return fedosContentAccessorFailure("conflict", "destination archive file already exists");
          case "unauthorized":
            return fedosContentAccessorFailure("unauthorized", "local participant is not an active member of this conversation");
          case "conversation-not-found":
            return fedosContentAccessorFailure("not-found", "unknown conversation");
          case "crypto-unavailable":
            return fedosContentAccessorFailure("requires-unlock", "master seed / encryption authority is not currently available");
          case "storage-unavailable":
            return fedosContentAccessorFailure("unavailable", "destination directory is not available");
          case "too-large":
            return fedosContentAccessorFailure("invalid-input", "archive would exceed the configured size bound");
          case "write-failed":
          case "failed":
            return fedosContentAccessorFailure("failed", "export failed");
        }
        break;
      }
      case "restore": {
        const result = await runtime.restoreConversationArchive(command.request);
        switch (result.outcome) {
          case "restored":
          case "already-present":
          case "conflicts-found":
          case "partially-invalid":
          case "partially-denied":
            return fedosContentAccessorOk({ operation: "restore", result });
          case "invalid-archive":
            return fedosContentAccessorFailure("invalid-input", "archive file is malformed or unsupported");
          case "integrity-failed":
            return fedosContentAccessorFailure("failed", "archive integrity check failed");
          case "identity-mismatch":
            return fedosContentAccessorFailure("unauthorized", "local identity cannot decrypt this archive");
          case "unsupported-version":
            return fedosContentAccessorFailure("unsupported", "unsupported archive schema version");
          case "partial-recovery-required":
            return fedosContentAccessorFailure("unavailable", "restore requires manual recovery");
          case "persistence-failed":
          case "failed":
            return fedosContentAccessorFailure("failed", "restore failed");
        }
        break;
      }
    }
    // Unreachable — every branch above returns; kept only so this function's
    // own declared return type is provably total under `noImplicitReturns`.
    return fedosContentAccessorFailure("failed", "unreachable");
  }
}
