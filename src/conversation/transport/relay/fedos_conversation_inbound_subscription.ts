/**
 * Secure Runtime Alpha 1471–1540 — Inbound Subscription.
 *
 * Opens a `FedosSubscriptionFilter` (`../../../desktop/fedos_subscription_filter.ts`,
 * Alpha 223, UNCHANGED) on EVERY relay in a `FedosConversationRelaySet`
 * simultaneously, via `FedosRelay.subscribe()`/`onSubscriptionMessage()`
 * (Alpha 226/236, UNCHANGED). NAMED LIMITATION, not silently worked
 * around: `FedosSubscriptionFilter` has exactly six fields
 * (`ids/authors/kinds/since/until/limit`) — there is NO server-side tag
 * filter (`#p`) anywhere in this repository's Relay boundary. A caller
 * therefore filters by `authors`/`kinds` server-side (the six real NIP-01
 * filter fields this repository's Relay boundary actually supports) and
 * this class does the CLIENT-side `"is this for me"` check itself, after
 * `FedosRelayEventMessage` arrives, by requiring
 * `parseFedosPrivateTransportEventDescriptor()`
 * (`../fedos_conversation_transport_event.ts`) to succeed AND its own
 * `recipientPublicKeyHex` to match the caller-supplied local pubkey.
 *
 * Relay Deduplication: every inbound event, from every relay, passes
 * through ONE shared `FedosRelayEventDeduplicator`
 * (`./fedos_relay_event_deduplicator.ts`) keyed by the Nostr event's own
 * `id` — the caller's `onEnvelope` callback fires EXACTLY ONCE per
 * genuinely-new event, no matter how many relays in the set deliver the
 * identical event (this is the concrete case Multiple Relay fan-out
 * creates: the SAME counterparty event reaching two or more relays this
 * transport is also subscribed to).
 *
 * HARD GUARDRAILS:
 *   - `stop()` unsubscribes from every relay it opened a subscription
 *     on; a relay that fails to unsubscribe cleanly never blocks the
 *     others (mirrors `FedosConversationRelaySet.disconnectAll()`'s own
 *     best-effort discipline).
 *   - `start()` may only be called once per instance — a second call
 *     throws, matching this repository's own "may only be called once,
 *     from the stopped state" convention (e.g. `FedosPublishScheduler.start()`).
 */

import type { FedosConversationRelaySet } from "./fedos_conversation_relay_set.js";
import type { FedosSubscriptionFilter } from "../../../desktop/fedos_subscription_filter.js";
import type { FedosSubscription } from "../../../desktop/fedos_subscription.js";
import { FedosRelayEventDeduplicator } from "./fedos_relay_event_deduplicator.js";
import { nostrWireEventToFedosEventDescriptor } from "../../../board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.js";
import {
  parseFedosPrivateTransportEventDescriptor,
  type FedosPrivateTransportParsedEvent,
} from "../fedos_conversation_transport_event.js";

export type FedosConversationInboundEnvelopeListener = (event: FedosPrivateTransportParsedEvent) => void;

interface OpenSubscription {
  readonly relayIndex: number;
  readonly subscription: FedosSubscription;
}

export class FedosConversationInboundSubscription {
  readonly #relaySet: FedosConversationRelaySet;
  readonly #localPublicKeyHex: string;
  readonly #deduplicator: FedosRelayEventDeduplicator;
  #open: readonly OpenSubscription[] | null = null;

  constructor(relaySet: FedosConversationRelaySet, localPublicKeyHex: string, deduplicator?: FedosRelayEventDeduplicator) {
    this.#relaySet = relaySet;
    this.#localPublicKeyHex = localPublicKeyHex;
    this.#deduplicator = deduplicator ?? new FedosRelayEventDeduplicator();
  }

  isRunning(): boolean {
    return this.#open !== null;
  }

  async start(filter: FedosSubscriptionFilter, onEnvelope: FedosConversationInboundEnvelopeListener): Promise<void> {
    if (this.#open !== null) {
      throw new Error("FedosConversationInboundSubscription.start() may only be called from the stopped state.");
    }

    const relays = this.#relaySet.relays;
    const opened: OpenSubscription[] = [];
    for (let relayIndex = 0; relayIndex < relays.length; relayIndex += 1) {
      const relay = relays[relayIndex]!;
      const subscription = await relay.subscribe([filter]);
      relay.onSubscriptionMessage(subscription, (message) => {
        if (message.kind !== "event") return;
        if (!this.#deduplicator.shouldProcess(message.event.id)) return;

        const descriptor = nostrWireEventToFedosEventDescriptor(message.event);
        const parsed = parseFedosPrivateTransportEventDescriptor(descriptor);
        if (parsed === null) return;
        if (parsed.recipientPublicKeyHex !== this.#localPublicKeyHex) return;

        onEnvelope(parsed);
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
