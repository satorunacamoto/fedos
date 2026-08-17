/**
 * Public Relay Reliability + Gift-Wrap Subscription Narrowing arc —
 * proves the `"#p"` filter this arc adds to `FedosSubscriptionFilter`
 * (`fedos_subscription_filter.ts`) actually narrows what a real relay
 * would deliver, using a fake relay that performs genuine NIP-01
 * server-side filter matching (kinds AND #p, both required when
 * present; `kinds` OR-matched against `event.kind`, `#p` OR-matched
 * against any `"p"` tag value on the event) — the same semantics any
 * real public relay implements. This is deliberately at the
 * `FedosRelay` boundary, not full NIP-17/NIP-59 crypto: the property
 * under test is "does server-side filtering cut the client-visible
 * event stream from hundreds down to the target," which does not
 * require a genuine decryptable Gift Wrap, only the correct outer
 * `kind`/`tags` shape every real Gift Wrap already carries (see
 * `fedos_nip59_gift_wrap.ts`'s own header).
 */
import { describe, it, expect } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { FedosConversationRelaySet } from "../src/os/messenger/adapters/nostr/transport/relay/fedos_conversation_relay_set.js";
import { FedosConversationInboundSubscription } from "../src/os/messenger/adapters/nostr/transport/relay/fedos_conversation_inbound_subscription.js";
import type { FedosRelay } from "../src/os/messenger/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/os/messenger/desktop/fedos_event_descriptor.js";
import type { FedosRelayMessageListener, FedosSubscriptionListener } from "../src/os/messenger/desktop/fedos_relay_listeners.js";
import type { FedosSubscription } from "../src/os/messenger/desktop/fedos_subscription.js";
import type { FedosSubscriptionFilter } from "../src/os/messenger/desktop/fedos_subscription_filter.js";
import type { FedosNostrWireEvent } from "../src/os/messenger/desktop/fedos_nostr_wire_event.js";
import { FEDOS_GIFT_WRAP_KIND } from "../src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.js";
import type { FedosPrivateWireAdapter, FedosPrivateWireParseResult } from "../src/os/messenger/adapters/nostr/transport/fedos_private_wire_adapter.js";

/** Minimal fake NIP-17 wire adapter: recognizes kind:1059 (real Gift Wrap shape) and reports "parsed-rumor" unconditionally, deriving `recipientPublicKeyHex` from the event's own real "p" tag -- no NIP-44/seal crypto involved, since the property under test (dedup, bounded processing) lives entirely above the decrypt boundary. */
class FakeGiftWrapWireAdapter implements FedosPrivateWireAdapter {
  readonly route = "nostr-nip17-v1" as unknown as FedosPrivateWireAdapter["route"];
  isAvailable(): boolean {
    return true;
  }
  async build(): ReturnType<FedosPrivateWireAdapter["build"]> {
    return { outcome: "unsupported" };
  }
  async parse(descriptor: FedosEventDescriptor): Promise<FedosPrivateWireParseResult> {
    if (descriptor.kind !== FEDOS_GIFT_WRAP_KIND) return { outcome: "not-mine" };
    const recipient = descriptor.tags.find((t) => t[0] === "p")?.[1];
    if (recipient === undefined) return { outcome: "not-mine" };
    return {
      outcome: "parsed-rumor",
      rumor: {
        envelopeId: descriptor.id,
        senderPublicKeyHex: descriptor.author,
        recipientPublicKeyHex: recipient,
        createdAt: descriptor.createdAt,
        kind: descriptor.kind,
        tags: descriptor.tags,
        content: descriptor.content,
      },
    };
  }
}

const ALICE_PUBKEY = "a".repeat(64);
const BOB_PUBKEY = "b".repeat(64);
const STRANGER_PUBKEY = "c".repeat(64);

/** Matches NIP-01 REQ semantics: a stored event matches a filter iff EVERY present field matches (AND across fields), each field itself OR-matched against its own array. Mirrors what a real public relay does server-side. */
function eventMatchesFilter(event: FedosNostrWireEvent, filter: FedosSubscriptionFilter): boolean {
  if (filter.kinds !== undefined && !filter.kinds.includes(event.kind)) return false;
  if (filter.authors !== undefined && !filter.authors.includes(event.pubkey)) return false;
  if (filter.ids !== undefined && !filter.ids.includes(event.id)) return false;
  if (filter.since !== undefined && event.created_at < filter.since) return false;
  if (filter.until !== undefined && event.created_at > filter.until) return false;
  const recipientFilter = filter["#p"];
  if (recipientFilter !== undefined) {
    const eventRecipients = event.tags.filter((t) => t[0] === "p").map((t) => t[1]);
    if (!recipientFilter.some((p) => eventRecipients.includes(p))) return false;
  }
  return true;
}

/** A fake relay that genuinely evaluates server-side filter matching (real NIP-01 semantics), rather than delivering every stored event regardless of filter -- the honest simulation of "what a real busy public relay does." Tracks how many events were EVALUATED (server-side matches) vs. how many the client actually had to process, for the busy-relay measurement. */
class FilteringFakeRelay implements FedosRelay {
  readonly url = "wss://busy-fake-relay.test";
  #connected = false;
  #subscriptionListeners = new Map<string, FedosSubscriptionListener>();
  #subscriptionFilters = new Map<string, readonly FedosSubscriptionFilter[]>();
  #subscriptionCounter = 0;
  readonly #stored: FedosNostrWireEvent[] = [];
  deliveredCount = 0;

  storeEvent(event: FedosNostrWireEvent): void {
    this.#stored.push(event);
  }

  /** Simulates the relay processing its backlog against a live subscription's filters -- exactly what a real relay does on REQ (deliver stored events matching the filter) followed by ongoing live delivery. */
  deliverMatchingBacklog(): void {
    for (const [subId, filters] of this.#subscriptionFilters) {
      const listener = this.#subscriptionListeners.get(subId);
      if (listener === undefined) continue;
      for (const event of this.#stored) {
        if (filters.some((f) => eventMatchesFilter(event, f))) {
          this.deliveredCount += 1;
          listener({ kind: "event", subscriptionId: subId, event });
        }
      }
    }
  }

  async connect(): Promise<void> {
    this.#connected = true;
  }
  async disconnect(): Promise<void> {
    this.#connected = false;
  }
  isConnected(): boolean {
    return this.#connected;
  }
  async publish(_event: FedosEventDescriptor): Promise<void> {}
  async subscribe(filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription> {
    this.#subscriptionCounter += 1;
    const id = `sub-${this.#subscriptionCounter}`;
    this.#subscriptionFilters.set(id, filters);
    return { id };
  }
  async unsubscribe(subscription: FedosSubscription): Promise<void> {
    this.#subscriptionListeners.delete(subscription.id);
    this.#subscriptionFilters.delete(subscription.id);
  }
  onSubscriptionMessage(subscription: FedosSubscription, listener: FedosSubscriptionListener): void {
    this.#subscriptionListeners.set(subscription.id, listener);
  }
  onRelayMessage(_listener: FedosRelayMessageListener): void {}
}

function noiseEvent(index: number, kind: number, recipientPubkey: string): FedosNostrWireEvent {
  return {
    id: `noise-${index}`,
    pubkey: `ephemeral-${index}`,
    created_at: 1_700_000_000 + index,
    kind,
    tags: [["p", recipientPubkey]],
    content: "irrelevant-real-world-traffic",
    sig: "sig",
  };
}

/**
 * Red Team P0 closure -- `FedosConversationInboundSubscription` now runs
 * `validateInboundNostrEvent()` (real Event ID + real BIP-340 signature
 * verification) on EVERY inbound event, including the Gift Wrap/rumor
 * path this file exercises, so `targetGiftWrap()` below must produce a
 * GENUINELY signed event rather than the placeholder `id`/`sig` it used
 * to. Signs directly with `@noble/curves` (mirroring
 * `test/commerce_inbound_event_bridge.test.ts`'s own
 * `signCommerceDraftAsRealNostrEvent` pattern) rather than via
 * `RealFedosNostrSigningAuthority` (`test/support/`), since that
 * authority's own closed kind allowlist does not include
 * `FEDOS_GIFT_WRAP_KIND` (production Gift Wrap events are signed by a
 * wholly separate ephemeral authority, never the Master-Seed-backed
 * Nostr Signing Authority -- see `fedos_nostr_signing_authority.ts`'s own
 * header). The noise/backlog fixtures below (`noiseEvent`, and the
 * various raw literal events in the server-side-filtering-only tests)
 * deliberately keep their placeholder `id`/`sig` -- those tests assert
 * only on `relay.deliveredCount` (server-side filter matching, which
 * happens BEFORE this file's own client-side validation is ever reached),
 * never on `processedCount` (the validated, delivered-to-listener count).
 */
const GIFT_WRAP_TEST_SECRET = new Uint8Array(32).fill(9);

function signRealNostrEvent(kind: number, tags: string[][], content: string, createdAt: number): FedosNostrWireEvent {
  const pubkey = bytesToHex(schnorr.getPublicKey(GIFT_WRAP_TEST_SECRET));
  const preimage = JSON.stringify([0, pubkey, createdAt, kind, tags, content]);
  const id = bytesToHex(sha256(new TextEncoder().encode(preimage)));
  const sig = bytesToHex(schnorr.sign(hexToBytes(id), GIFT_WRAP_TEST_SECRET));
  return Object.freeze({ id, pubkey, created_at: createdAt, kind, tags, content, sig });
}

function targetGiftWrap(recipientPubkey: string): FedosNostrWireEvent {
  return signRealNostrEvent(FEDOS_GIFT_WRAP_KIND, [["p", recipientPubkey]], "sealed-ciphertext-placeholder", 1_700_099_999);
}

describe("Gift-wrap subscription narrowing -- busy-relay reliability (mandate section 13)", () => {
  it("1. among 500 irrelevant real-world kind:1059 events (addressed to OTHER recipients) plus 1 targeted at Alice, the '#p'-narrowed filter delivers ONLY the target", async () => {
    const relay = new FilteringFakeRelay();
    await relay.connect();
    const relaySet = new FedosConversationRelaySet([relay]);
    await relaySet.connectAll();

    // 500 real-world-shaped kind:1059 events, each addressed to some OTHER
    // random recipient -- exactly what a busy public relay's kind-only
    // stream looks like from Alice's point of view.
    for (let i = 0; i < 500; i += 1) {
      relay.storeEvent(noiseEvent(i, FEDOS_GIFT_WRAP_KIND, `stranger-${i % 97}`.padEnd(64, "0")));
    }
    relay.storeEvent(targetGiftWrap(ALICE_PUBKEY));

    const subscription = new FedosConversationInboundSubscription(relaySet, ALICE_PUBKEY);
    // Narrowed filter, exactly what the composition root now constructs.
    await subscription.start({ kinds: [FEDOS_GIFT_WRAP_KIND], "#p": [ALICE_PUBKEY] }, () => {});
    relay.deliverMatchingBacklog();

    expect(relay.deliveredCount, "server-side filtering must deliver exactly the 1 targeted event, not all 501").toBe(1);
  });

  it("2. WITHOUT '#p' narrowing (old kind-only filter), the same busy relay delivers all 501 events to the client -- proves the fix is real, not a no-op", async () => {
    const relay = new FilteringFakeRelay();
    await relay.connect();
    const relaySet = new FedosConversationRelaySet([relay]);
    await relaySet.connectAll();
    for (let i = 0; i < 500; i += 1) relay.storeEvent(noiseEvent(i, FEDOS_GIFT_WRAP_KIND, `stranger-${i % 97}`.padEnd(64, "0")));
    relay.storeEvent(targetGiftWrap(ALICE_PUBKEY));

    const subscription = new FedosConversationInboundSubscription(relaySet, ALICE_PUBKEY);
    await subscription.start({ kinds: [FEDOS_GIFT_WRAP_KIND] }, () => {});
    relay.deliverMatchingBacklog();

    expect(relay.deliveredCount, "the OLD kind-only filter is genuinely broad -- this is the exact reliability gap this arc closes").toBe(501);
  });

  it("3. wrong kind is rejected server-side even with the correct '#p' tag", async () => {
    const relay = new FilteringFakeRelay();
    await relay.connect();
    const relaySet = new FedosConversationRelaySet([relay]);
    await relaySet.connectAll();
    relay.storeEvent({ id: "wrong-kind", pubkey: "eph", created_at: 1, kind: 1, tags: [["p", ALICE_PUBKEY]], content: "x", sig: "s" });

    const subscription = new FedosConversationInboundSubscription(relaySet, ALICE_PUBKEY);
    await subscription.start({ kinds: [FEDOS_GIFT_WRAP_KIND], "#p": [ALICE_PUBKEY] }, () => {});
    relay.deliverMatchingBacklog();

    expect(relay.deliveredCount).toBe(0);
  });

  it("4. wrong recipient tag is rejected server-side even with the correct kind", async () => {
    const relay = new FilteringFakeRelay();
    await relay.connect();
    const relaySet = new FedosConversationRelaySet([relay]);
    await relaySet.connectAll();
    relay.storeEvent(targetGiftWrap(STRANGER_PUBKEY));

    const subscription = new FedosConversationInboundSubscription(relaySet, ALICE_PUBKEY);
    await subscription.start({ kinds: [FEDOS_GIFT_WRAP_KIND], "#p": [ALICE_PUBKEY] }, () => {});
    relay.deliverMatchingBacklog();

    expect(relay.deliveredCount).toBe(0);
  });

  it("5. an event with NO 'p' tag at all is rejected server-side under '#p' narrowing (never a false match)", async () => {
    const relay = new FilteringFakeRelay();
    await relay.connect();
    const relaySet = new FedosConversationRelaySet([relay]);
    await relaySet.connectAll();
    relay.storeEvent({ id: "no-p-tag", pubkey: "eph", created_at: 1, kind: FEDOS_GIFT_WRAP_KIND, tags: [], content: "x", sig: "s" });

    const subscription = new FedosConversationInboundSubscription(relaySet, ALICE_PUBKEY);
    await subscription.start({ kinds: [FEDOS_GIFT_WRAP_KIND], "#p": [ALICE_PUBKEY] }, () => {});
    relay.deliverMatchingBacklog();

    expect(relay.deliveredCount).toBe(0);
  });

  it("6. an old/arbitrarily-aged legitimate event addressed to Alice IS still matched -- proves no wall-clock/since bound was smuggled in (mandate section 9, durable mailbox semantics preserved)", async () => {
    const relay = new FilteringFakeRelay();
    await relay.connect();
    const relaySet = new FedosConversationRelaySet([relay]);
    await relaySet.connectAll();
    relay.storeEvent({ id: "ancient", pubkey: "eph", created_at: 0, kind: FEDOS_GIFT_WRAP_KIND, tags: [["p", ALICE_PUBKEY]], content: "x", sig: "s" });

    const subscription = new FedosConversationInboundSubscription(relaySet, ALICE_PUBKEY);
    await subscription.start({ kinds: [FEDOS_GIFT_WRAP_KIND], "#p": [ALICE_PUBKEY] }, () => {});
    relay.deliverMatchingBacklog();

    expect(relay.deliveredCount, "a created_at of 0 (Unix epoch) must still be discoverable -- this arc adds no since/backfill-window bound").toBe(1);
  });

  it("7. duplicate delivery of the identical event id (e.g. via multiple relays or a relay resend) is deduplicated to exactly one onEnvelope/onRumor callback", async () => {
    const relayA = new FilteringFakeRelay();
    const relayB = new FilteringFakeRelay();
    Object.defineProperty(relayA, "url", { value: "wss://relay-a.test" });
    Object.defineProperty(relayB, "url", { value: "wss://relay-b.test" });
    await relayA.connect();
    await relayB.connect();
    const relaySet = new FedosConversationRelaySet([relayA, relayB]);
    await relaySet.connectAll();
    const target = targetGiftWrap(ALICE_PUBKEY);
    relayA.storeEvent(target);
    relayB.storeEvent(target); // the SAME event id, delivered via a second relay

    let processedCount = 0;
    const subscription = new FedosConversationInboundSubscription(relaySet, ALICE_PUBKEY, undefined, new FakeGiftWrapWireAdapter());
    await subscription.start(
      { kinds: [FEDOS_GIFT_WRAP_KIND], "#p": [ALICE_PUBKEY] },
      () => {},
      () => {
        processedCount += 1;
      },
    );
    relayA.deliverMatchingBacklog();
    relayB.deliverMatchingBacklog();
    await new Promise((resolve) => setTimeout(resolve, 10)); // flush the fire-and-forget parse().then() chain

    expect(processedCount, "the existing FedosRelayEventDeduplicator must still collapse the SAME event id arriving from two relays to exactly one callback").toBe(1);
  });

  it("8. bounded processing: with 2000 irrelevant events plus 1 target, the client-visible callback count stays at exactly 1 (never grows with noise volume)", async () => {
    const relay = new FilteringFakeRelay();
    await relay.connect();
    const relaySet = new FedosConversationRelaySet([relay]);
    await relaySet.connectAll();
    for (let i = 0; i < 2000; i += 1) relay.storeEvent(noiseEvent(i, FEDOS_GIFT_WRAP_KIND, `stranger-${i % 500}`.padEnd(64, "0")));
    relay.storeEvent(targetGiftWrap(BOB_PUBKEY));

    let processedCount = 0;
    const subscription = new FedosConversationInboundSubscription(relaySet, BOB_PUBKEY, undefined, new FakeGiftWrapWireAdapter());
    await subscription.start(
      { kinds: [FEDOS_GIFT_WRAP_KIND], "#p": [BOB_PUBKEY] },
      () => {},
      () => {
        processedCount += 1;
      },
    );
    relay.deliverMatchingBacklog();
    await new Promise((resolve) => setTimeout(resolve, 10)); // flush the fire-and-forget parse().then() chain

    expect(processedCount).toBe(1);
    expect(relay.deliveredCount).toBe(1);
  });
});
