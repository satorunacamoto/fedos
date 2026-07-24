/**
 * Secure Runtime Alpha 7881-7960 (Stage 3, Phase H/I: "FedOS Archive
 * Suppression Production Wiring") — the Inbound Subscription.
 *
 * Closes the LAST missing piece the prior Arc (7721-7800) disclosed but
 * never wired: `FedosArchiveSuppressionInboundHandler` (Phase G, fully
 * built and tested) was never given a real, live feed of relay events —
 * `fedos_desktop_runtime.ts` constructed no subscription of any kind for
 * the suppression `kind:1` route. Mirrors
 * `../../conversation/transport/relay/fedos_conversation_inbound_subscription.ts`'s
 * own established idiom EXACTLY (Alpha 1471–1540: one `FedosRelay.subscribe()`
 * call per Relay in a `FedosConversationRelaySet`, one `onSubscriptionMessage`
 * listener per Relay, `stop()` unsubscribes best-effort from every Relay it
 * opened) — a NEW, small, Device-Sync-scoped copy of that idiom, not a
 * modification of the Conversation-domain file and not a shared/generalized
 * class, matching this codebase's own "new parallel implementation per
 * domain" discipline (already used twice: Board Outbox -> Conversation
 * Outbox, and again for `FedosDeviceRelaySyncPublisher` itself, Alpha
 * 3641-3720, vs. the Conversation transport's own Multi-Relay publisher).
 *
 * Server-side filter is `kinds: [1]` ONLY (`FedosSubscriptionFilter` has no
 * server-side tag filter anywhere in this repository's Relay boundary,
 * exactly as the Conversation Inbound Subscription's own header already
 * documents) — every other check (marker tag, signature, recipient,
 * account, expiry, source-Device trust) happens inside
 * `FedosArchiveSuppressionInboundHandler.handleIncomingEvent()` itself,
 * unmodified by this file. Deduplication is the Inbound Handler's OWN
 * `dedupPersistence.getByRelayEventId()` check (already the FIRST thing it
 * does) — this file adds no second deduplicator, so the same event
 * reaching two or more Relays in the set is handled exactly once by the
 * Handler's own existing, already-tested logic.
 *
 * HARD GUARDRAILS:
 *   - No Relay Pool, no reconnect logic, no new `FedosRelay` implementation.
 *   - `start()` may only be called once per instance — a second call
 *     throws, matching this repository's own established convention.
 *   - `stop()` unsubscribes from every Relay it opened a subscription on;
 *     one Relay's own failure to unsubscribe cleanly never blocks another.
 */

import type { FedosConversationRelaySet } from "../../conversation/transport/relay/fedos_conversation_relay_set.js";
import type { FedosSubscription } from "../../desktop/fedos_subscription.js";
import { nostrWireEventToFedosEventDescriptor } from "../../board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.js";
import type { FedosArchiveSuppressionInboundHandler } from "./fedos_archive_suppression_inbound_handler.js";

const SUPPRESSION_SYNC_SUBSCRIPTION_KIND = 1;

interface OpenSubscription {
  readonly relayIndex: number;
  readonly subscription: FedosSubscription;
}

export class FedosArchiveSuppressionInboundSubscription {
  readonly #relaySet: FedosConversationRelaySet;
  readonly #handler: FedosArchiveSuppressionInboundHandler;
  readonly #now: () => number;
  #open: readonly OpenSubscription[] | null = null;

  constructor(relaySet: FedosConversationRelaySet, handler: FedosArchiveSuppressionInboundHandler, now?: () => number) {
    this.#relaySet = relaySet;
    this.#handler = handler;
    this.#now = now ?? (() => Math.floor(Date.now() / 1000));
  }

  isRunning(): boolean {
    return this.#open !== null;
  }

  async start(): Promise<void> {
    if (this.#open !== null) {
      throw new Error("FedosArchiveSuppressionInboundSubscription.start() may only be called from the stopped state.");
    }

    const relays = this.#relaySet.relays;
    const opened: OpenSubscription[] = [];
    for (let relayIndex = 0; relayIndex < relays.length; relayIndex += 1) {
      const relay = relays[relayIndex]!;
      const subscription = await relay.subscribe([{ kinds: [SUPPRESSION_SYNC_SUBSCRIPTION_KIND] }]);
      relay.onSubscriptionMessage(subscription, (message) => {
        if (message.kind !== "event") return;
        const descriptor = nostrWireEventToFedosEventDescriptor(message.event);
        void this.#handler.handleIncomingEvent({ descriptor, now: this.#now() });
      });
      opened.push({ relayIndex, subscription });
    }
    this.#open = opened;
  }

  async stop(): Promise<void> {
    if (this.#open === null) return;
    const open = this.#open;
    this.#open = null;

    const relays = this.#relaySet.relays;
    await Promise.all(
      open.map(async ({ relayIndex, subscription }) => {
        const relay = relays[relayIndex];
        if (relay === undefined) return;
        try {
          await relay.unsubscribe(subscription);
        } catch {
          // Best-effort -- a relay that fails to unsubscribe cleanly never blocks the others.
        }
      }),
    );
  }
}
