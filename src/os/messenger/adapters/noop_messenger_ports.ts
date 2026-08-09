/**
 * OS Capability Modularization — Factory/Port Completion pass. Safe,
 * zero-external-contact default implementations of the three widened
 * `os/core/ports/*` Messenger ports.
 *
 * Mirrors this codebase's own established `Noop*` convention
 * (`NoopPaymentProvider`, `NoopMarketplaceProvider`,
 * `NoFedosDesktopNotificationPort`): every method is total, never throws,
 * contacts no relay/socket/filesystem, and constructing an instance does
 * nothing. These exist so `createMessenger()` (`../create_messenger.ts`)
 * has a genuinely safe default for every Port a caller omits — "SAFE
 * DEFAULTS ONLY" (no factory may silently enable a real external service).
 *
 * NOT wired into any composition root — these are defaults for the
 * `createMessenger()` factory only, not a general-purpose "offline mode"
 * for the shipped app.
 */

import type {
  ConversationCreationPort,
  ConversationId,
  ConversationMembershipPort,
  ConversationPort,
  ConversationQueryPort,
  ConversationReadiness,
  ConversationReadinessPort,
  ConversationResult,
  CounterpartyRef,
  MembershipMutationResult,
} from "../../core/ports/conversation_port.js";
import type {
  ConversationId as MessageConversationId,
  MessageHandler,
  MessageHistoryPort,
  MessageId,
  MessageInboundPort,
  MessagePayload,
  MessageReadResult,
  MessagingPort,
  MessageSendPort,
  MessageSummary,
  SendResult,
  Unsubscribe,
} from "../../core/ports/messaging_port.js";
import type { NotificationMeta, NotificationPort } from "../../core/ports/notification_port.js";

/**
 * Permanently "no backend configured": every send/read fails closed with
 * `"failed"` (the real coordinator's own closed vocabulary has no dedicated
 * "no backend" token — `"failed"` is its catch-all, reused here rather
 * than inventing a Port-level token no real coordinator ever returns),
 * `list()` is always empty, and `onMessage()` registers a handler that is
 * never called (mirrors the real Messenger adapter's own honest
 * "registers but nothing calls it yet" `onMessage` gap, one layer further:
 * here, genuinely nothing ever will, since there is no backend at all).
 */
export class NoopMessagingPort implements MessagingPort, MessageSendPort, MessageHistoryPort, MessageInboundPort {
  async send(_conversationId: MessageConversationId, _payload: MessagePayload): Promise<SendResult> {
    return { delivered: false, reason: "failed" };
  }

  async read(_conversationId: MessageConversationId, _messageId: MessageId): Promise<MessageReadResult> {
    return { ok: false, reason: "failed" };
  }

  async list(_conversationId: MessageConversationId): Promise<readonly MessageSummary[]> {
    return [];
  }

  onMessage(_handler: MessageHandler): Unsubscribe {
    return () => {};
  }
}

/** Permanently "no backend configured": every creation/mutation fails closed; every query returns empty/null. */
export class NoopConversationPort
  implements ConversationPort, ConversationCreationPort, ConversationQueryPort, ConversationMembershipPort, ConversationReadinessPort
{
  async createDirect(_counterparty: CounterpartyRef): Promise<ConversationResult> {
    return { ok: false, reason: "no messenger backend is configured" };
  }

  async createGroup(): Promise<ConversationResult> {
    return { ok: false, reason: "no messenger backend is configured" };
  }

  async listParticipants(_conversationId: ConversationId): Promise<readonly CounterpartyRef[]> {
    return [];
  }

  async admit(_conversationId: ConversationId, _counterparty: CounterpartyRef): Promise<MembershipMutationResult> {
    return { outcome: "unavailable" };
  }

  async revoke(_conversationId: ConversationId, _counterparty: CounterpartyRef): Promise<MembershipMutationResult> {
    return { outcome: "unavailable" };
  }

  async leave(_conversationId: ConversationId): Promise<MembershipMutationResult> {
    return { outcome: "unavailable" };
  }

  async readiness(_conversationId: ConversationId): Promise<ConversationReadiness | null> {
    return null;
  }
}

/** Fire-and-forget no-op — surfaces nothing to any tray/toast. Matches `NotificationPort`'s own "never throws" contract trivially. */
export class NoopNotificationPort implements NotificationPort {
  notify(_title: string, _body: string, _meta?: NotificationMeta): void {
    // Intentionally does nothing.
  }
}
