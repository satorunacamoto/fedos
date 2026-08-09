import { describe, it, expect, vi } from "vitest";
import type { MessagingPort } from "../src/os/core/ports/messaging_port.js";
import type { ConversationPort } from "../src/os/core/ports/conversation_port.js";
import type { NotificationPort } from "../src/os/core/ports/notification_port.js";
import type { TransportPort } from "../src/os/core/ports/transport_port.js";
import { FedosMessengerMessagingPortAdapter } from "../src/os/messenger/adapters/messaging_port_adapter.js";
import { FedosMessengerConversationPortAdapter } from "../src/os/messenger/adapters/conversation_port_adapter.js";
import { FedosMessengerNotificationPortAdapter } from "../src/os/messenger/adapters/notification_port_adapter.js";
import { NostrTransportAdapter, type NostrTransportEventSource } from "../src/os/messenger/adapters/nostr_transport_adapter.js";
import type { FedosConversationDirectMessagingCoordinator } from "../src/os/messenger/conversations/messaging/fedos_conversation_direct_messaging_coordinator.js";
import type { FedosPrivateConversationConstructionCoordinator } from "../src/os/messenger/conversations/construction/fedos_private_conversation_construction_coordinator.js";
import type { FedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/fedos_conversation_membership_authority.js";
import type { FedosDesktopNotificationCoordinator } from "../src/os/messenger/notifications/fedos_desktop_notification_coordinator.js";
import type { RelayPublisher, PublishResult } from "../src/os/messenger/adapters/nostr/protocol/publish.js";
import type { RelayAdapter, NostrFilter } from "../src/os/messenger/adapters/nostr/protocol/relay.js";
import type { NostrEvent } from "../src/os/messenger/adapters/nostr/protocol/types.js";

/**
 * OS Capability Modularization — Port-shape check for the three
 * `src/os/messenger/adapters/*` files.
 *
 * Factory/Port Completion pass: repointed every import to its CANONICAL
 * post-migration location (`src/os/messenger/conversations/...`,
 * `src/os/messenger/notifications/...`) rather than the old top-level
 * compatibility shims (`src/conversation/...`, `src/desktop/notification/...`)
 * this file used before this pass, and widened coverage for the three
 * adapters' now-widened `MessagingPort`/`ConversationPort` surfaces
 * (`read`/`list`, `createDirect`/`createGroup`, `admit`/`revoke`/`leave`,
 * `readiness`).
 *
 * Each adapter class already declares `implements <Port>`, so
 * `npm run typecheck:core` (`tsc --noEmit`) is itself the primary,
 * strongest form of this check: a class that does not actually satisfy its
 * declared Port interface fails compilation, full stop. This file adds two
 * things `tsc` alone doesn't give a reader:
 *
 *   1. an explicit, visible assignability check at each adapter's own call
 *      site here (`assert*PortShape`) — belt-and-suspenders documentation
 *      of intent, not a substitute for the `implements` clause; and
 *   2. a handful of runtime behavior checks against a MINIMAL hand-built
 *      test double for the real coordinator each adapter delegates to.
 *
 * These doubles are intentionally narrow (only the one or two methods each
 * adapter actually calls) and are attached via `as unknown as <Coordinator>`
 * — the real coordinator classes use ECMAScript `#private` fields, which
 * TypeScript treats as a nominal brand no structurally-shaped object
 * literal can satisfy, so a genuine instance of e.g.
 * `FedosConversationDirectMessagingCoordinator` would require assembling
 * its full production dependency graph (draft/activation/envelope
 * persistence, membership authority, identity resolver, retention
 * authority, encryption/decryption coordinators — see that class's own
 * `Dependencies` interface). That full wiring is the composition root's
 * job (today `src/desktop/runtime/`), not this adapter-shape test's job —
 * exactly the "type-level check is enough where full runtime wiring needs
 * infrastructure this test doesn't have" case.
 */

function assertMessagingPortShape(_port: MessagingPort): void {}
function assertConversationPortShape(_port: ConversationPort): void {}
function assertNotificationPortShape(_port: NotificationPort): void {}
function assertTransportPortShape(_port: TransportPort): void {}

describe("MessagingPort adapter", () => {
  it("satisfies the MessagingPort shape (type-level, via the class's own `implements` clause)", () => {
    const fakeCoordinator = {
      sendDirectMessage: vi.fn(async () => ({ outcome: "sent-locally" as const, envelopeId: "env-1" })),
    } as unknown as FedosConversationDirectMessagingCoordinator;
    const adapter = new FedosMessengerMessagingPortAdapter(fakeCoordinator);
    assertMessagingPortShape(adapter);
    expect(typeof adapter.send).toBe("function");
    expect(typeof adapter.read).toBe("function");
    expect(typeof adapter.list).toBe("function");
    expect(typeof adapter.onMessage).toBe("function");
  });

  it("send() delegates to sendDirectMessage() with replyToEnvelopeId derived from replyToMessageId, and maps a successful outcome to a delivered SendResult", async () => {
    const fakeCoordinator = {
      sendDirectMessage: vi.fn(async () => ({ outcome: "sent-locally" as const, envelopeId: "env-42" })),
    } as unknown as FedosConversationDirectMessagingCoordinator;
    const adapter = new FedosMessengerMessagingPortAdapter(fakeCoordinator);

    const result = await adapter.send("conversation-1", { text: "hello", replyToMessageId: "env-1" });

    expect(fakeCoordinator.sendDirectMessage).toHaveBeenCalledWith({
      conversationId: "conversation-1",
      body: "hello",
      replyToEnvelopeId: "env-1",
    });
    expect(result).toEqual({ delivered: true, messageId: "env-42" });
  });

  it("send() omits replyToMessageId and passes null through, matching the old default behavior", async () => {
    const fakeCoordinator = {
      sendDirectMessage: vi.fn(async () => ({ outcome: "sent-locally" as const, envelopeId: "env-42" })),
    } as unknown as FedosConversationDirectMessagingCoordinator;
    const adapter = new FedosMessengerMessagingPortAdapter(fakeCoordinator);

    await adapter.send("conversation-1", { text: "hello" });

    expect(fakeCoordinator.sendDirectMessage).toHaveBeenCalledWith({
      conversationId: "conversation-1",
      body: "hello",
      replyToEnvelopeId: null,
    });
  });

  it("send() maps a failure outcome to a non-delivered SendResult with a closed-vocabulary reason, never throws", async () => {
    const fakeCoordinator = {
      sendDirectMessage: vi.fn(async () => ({ outcome: "conversation-not-active" as const })),
    } as unknown as FedosConversationDirectMessagingCoordinator;
    const adapter = new FedosMessengerMessagingPortAdapter(fakeCoordinator);

    const result = await adapter.send("conversation-1", { text: "hello" });

    expect(result).toEqual({ delivered: false, reason: "conversation-not-active" });
  });

  it("read() delegates to readDirectMessage() and maps a decrypted outcome to an ok ReadResult", async () => {
    const plaintext = new TextEncoder().encode("hi");
    const fakeCoordinator = {
      readDirectMessage: vi.fn(async () => ({ outcome: "decrypted" as const, plaintext })),
    } as unknown as FedosConversationDirectMessagingCoordinator;
    const adapter = new FedosMessengerMessagingPortAdapter(fakeCoordinator);

    const result = await adapter.read("conversation-1", "env-1");

    expect(fakeCoordinator.readDirectMessage).toHaveBeenCalledWith({ conversationId: "conversation-1", envelopeId: "env-1" });
    expect(result).toEqual({ ok: true, plaintext });
  });

  it("read() maps a tombstoned outcome to a closed-vocabulary failure reason, never throws", async () => {
    const fakeCoordinator = {
      readDirectMessage: vi.fn(async () => ({ outcome: "tombstoned" as const })),
    } as unknown as FedosConversationDirectMessagingCoordinator;
    const adapter = new FedosMessengerMessagingPortAdapter(fakeCoordinator);

    const result = await adapter.read("conversation-1", "env-1");

    expect(result).toEqual({ ok: false, reason: "tombstoned" });
  });

  it("list() delegates to listDirectMessages() and converts createdAt seconds to createdAtMs milliseconds", async () => {
    const fakeCoordinator = {
      listDirectMessages: vi.fn(() => [
        { envelopeId: "env-1", senderMembershipId: "m-1", createdAt: 1000, replyToEnvelopeId: null, retentionState: "active" as const },
      ]),
    } as unknown as FedosConversationDirectMessagingCoordinator;
    const adapter = new FedosMessengerMessagingPortAdapter(fakeCoordinator);

    const result = await adapter.list("conversation-1");

    expect(fakeCoordinator.listDirectMessages).toHaveBeenCalledWith("conversation-1");
    expect(result).toEqual([
      { conversationId: "conversation-1", messageId: "env-1", createdAtMs: 1_000_000, replyToMessageId: null, retentionState: "active" },
    ]);
  });

  it("onMessage()/dispatchInbound() form a working, unsubscribable local registry", () => {
    const fakeCoordinator = {} as unknown as FedosConversationDirectMessagingCoordinator;
    const adapter = new FedosMessengerMessagingPortAdapter(fakeCoordinator);
    const received: unknown[] = [];
    const unsubscribe = adapter.onMessage((msg) => received.push(msg));

    adapter.dispatchInbound({ conversationId: "c1", messageId: "m1", payload: { text: "hi" } });
    expect(received).toHaveLength(1);

    unsubscribe();
    adapter.dispatchInbound({ conversationId: "c1", messageId: "m2", payload: { text: "again" } });
    expect(received).toHaveLength(1); // unsubscribed -- no second delivery.
  });
});

describe("ConversationPort adapter", () => {
  it("satisfies the ConversationPort shape (type-level, via the class's own `implements` clause)", () => {
    const fakeConstructionCoordinator = {
      createDirectDraft: vi.fn(),
      createPrivateGroupDraft: vi.fn(),
    } as unknown as FedosPrivateConversationConstructionCoordinator;
    const fakeMembershipAuthority = {
      listMemberships: vi.fn(() => []),
    } as unknown as FedosConversationMembershipAuthority;
    const adapter = new FedosMessengerConversationPortAdapter({
      constructionCoordinator: fakeConstructionCoordinator,
      membershipAuthority: fakeMembershipAuthority,
    });
    assertConversationPortShape(adapter);
    expect(typeof adapter.createDirect).toBe("function");
    expect(typeof adapter.createGroup).toBe("function");
    expect(typeof adapter.listParticipants).toBe("function");
    expect(typeof adapter.admit).toBe("function");
    expect(typeof adapter.revoke).toBe("function");
    expect(typeof adapter.leave).toBe("function");
    expect(typeof adapter.readiness).toBe("function");
  });

  it("createDirect() rejects a malformed counterparty reference without calling the coordinator", async () => {
    const fakeConstructionCoordinator = {
      createDirectDraft: vi.fn(),
    } as unknown as FedosPrivateConversationConstructionCoordinator;
    const fakeMembershipAuthority = {
      listMemberships: vi.fn(() => []),
    } as unknown as FedosConversationMembershipAuthority;
    const adapter = new FedosMessengerConversationPortAdapter({
      constructionCoordinator: fakeConstructionCoordinator,
      membershipAuthority: fakeMembershipAuthority,
    });

    const result = await adapter.createDirect("not-a-recognized-authority-ref");

    expect(result.ok).toBe(false);
    expect(fakeConstructionCoordinator.createDirectDraft).not.toHaveBeenCalled();
  });

  it("createDirect() parses a well-formed counterparty ref, delegates to createDirectDraft(), and returns a direct-mode descriptor", async () => {
    const fakeConstructionCoordinator = {
      createDirectDraft: vi.fn(() => ({
        outcome: "draft-created" as const,
        draft: { id: "conversation-abc" },
      })),
    } as unknown as FedosPrivateConversationConstructionCoordinator;
    const fakeMembershipAuthority = {
      listMemberships: vi.fn(() => [
        { participant: { authority: "nostr", publicIdentifier: "abc123" } },
        { participant: { authority: "nostr", publicIdentifier: "def456" } },
      ]),
    } as unknown as FedosConversationMembershipAuthority;
    const adapter = new FedosMessengerConversationPortAdapter({
      constructionCoordinator: fakeConstructionCoordinator,
      membershipAuthority: fakeMembershipAuthority,
    });

    const result = await adapter.createDirect("nostr:abc123");

    expect(fakeConstructionCoordinator.createDirectDraft).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: { authority: "nostr", publicIdentifier: "abc123" } }),
    );
    expect(result.ok).toBe(true);
    expect(result.conversation).toEqual({
      conversationId: "conversation-abc",
      mode: "direct",
      participants: ["nostr:abc123", "nostr:def456"],
    });
  });

  it("createGroup() delegates to createPrivateGroupDraft() with no initial capability request and returns a group-mode descriptor", async () => {
    const fakeConstructionCoordinator = {
      createPrivateGroupDraft: vi.fn(() => ({
        outcome: "draft-created" as const,
        draft: { id: "conversation-group-1" },
      })),
    } as unknown as FedosPrivateConversationConstructionCoordinator;
    const fakeMembershipAuthority = {
      listMemberships: vi.fn(() => [{ participant: { authority: "nostr", publicIdentifier: "owner1" } }]),
    } as unknown as FedosConversationMembershipAuthority;
    const adapter = new FedosMessengerConversationPortAdapter({
      constructionCoordinator: fakeConstructionCoordinator,
      membershipAuthority: fakeMembershipAuthority,
    });

    const result = await adapter.createGroup();

    expect(fakeConstructionCoordinator.createPrivateGroupDraft).toHaveBeenCalledWith({});
    expect(result.ok).toBe(true);
    expect(result.conversation).toEqual({
      conversationId: "conversation-group-1",
      mode: "group",
      participants: ["nostr:owner1"],
    });
  });

  it("admit() parses the counterparty ref and delegates to membershipAuthority.admit() with role \"member\"", async () => {
    const fakeConstructionCoordinator = {} as unknown as FedosPrivateConversationConstructionCoordinator;
    const fakeMembershipAuthority = {
      admit: vi.fn(() => ({
        outcome: "admitted" as const,
        membership: { participant: { authority: "nostr", publicIdentifier: "abc123" } },
      })),
    } as unknown as FedosConversationMembershipAuthority;
    const adapter = new FedosMessengerConversationPortAdapter({
      constructionCoordinator: fakeConstructionCoordinator,
      membershipAuthority: fakeMembershipAuthority,
      clock: () => 1000,
    });

    const result = await adapter.admit("conversation-1", "nostr:abc123");

    expect(fakeMembershipAuthority.admit).toHaveBeenCalledWith(
      "conversation-1",
      { authority: "nostr", publicIdentifier: "abc123", identityId: null },
      "member",
      1000,
    );
    expect(result).toEqual({ outcome: "admitted", participant: "nostr:abc123" });
  });

  it("revoke() delegates to membershipAuthority.revoke() and maps a failure outcome without a participant field", async () => {
    const fakeConstructionCoordinator = {} as unknown as FedosPrivateConversationConstructionCoordinator;
    const fakeMembershipAuthority = {
      revoke: vi.fn(() => ({ outcome: "not-found" as const })),
    } as unknown as FedosConversationMembershipAuthority;
    const adapter = new FedosMessengerConversationPortAdapter({
      constructionCoordinator: fakeConstructionCoordinator,
      membershipAuthority: fakeMembershipAuthority,
      clock: () => 2000,
    });

    const result = await adapter.revoke("conversation-1", "nostr:abc123");

    expect(fakeMembershipAuthority.revoke).toHaveBeenCalledWith(
      "conversation-1",
      { authority: "nostr", publicIdentifier: "abc123", identityId: null },
      2000,
    );
    expect(result).toEqual({ outcome: "not-found" });
  });

  it("leave() returns unavailable without calling membershipAuthority when no identityResolver was injected", async () => {
    const fakeConstructionCoordinator = {} as unknown as FedosPrivateConversationConstructionCoordinator;
    const fakeMembershipAuthority = {
      leave: vi.fn(),
    } as unknown as FedosConversationMembershipAuthority;
    const adapter = new FedosMessengerConversationPortAdapter({
      constructionCoordinator: fakeConstructionCoordinator,
      membershipAuthority: fakeMembershipAuthority,
    });

    const result = await adapter.leave("conversation-1");

    expect(result).toEqual({ outcome: "unavailable" });
    expect(fakeMembershipAuthority.leave).not.toHaveBeenCalled();
  });

  it("leave() resolves the local identity and delegates to membershipAuthority.leave() when identityResolver is injected", async () => {
    const fakeConstructionCoordinator = {} as unknown as FedosPrivateConversationConstructionCoordinator;
    const fakeMembershipAuthority = {
      leave: vi.fn(() => ({
        outcome: "left" as const,
        membership: { participant: { authority: "nostr", publicIdentifier: "self1" } },
      })),
    } as unknown as FedosConversationMembershipAuthority;
    const fakeIdentityResolver = {
      resolveLocalParticipant: vi.fn(() => ({
        outcome: "resolved" as const,
        creator: { authority: "nostr" as const, publicIdentifier: "self1", identityId: null },
      })),
    };
    const adapter = new FedosMessengerConversationPortAdapter({
      constructionCoordinator: fakeConstructionCoordinator,
      membershipAuthority: fakeMembershipAuthority,
      identityResolver: fakeIdentityResolver,
      clock: () => 3000,
    });

    const result = await adapter.leave("conversation-1");

    expect(fakeMembershipAuthority.leave).toHaveBeenCalledWith(
      "conversation-1",
      { authority: "nostr", publicIdentifier: "self1", identityId: null },
      3000,
    );
    expect(result).toEqual({ outcome: "left", participant: "nostr:self1" });
  });

  it("readiness() returns null without calling the coordinator when no draftPersistence was injected", async () => {
    const fakeConstructionCoordinator = { readinessForDraft: vi.fn() } as unknown as FedosPrivateConversationConstructionCoordinator;
    const fakeMembershipAuthority = {} as unknown as FedosConversationMembershipAuthority;
    const adapter = new FedosMessengerConversationPortAdapter({
      constructionCoordinator: fakeConstructionCoordinator,
      membershipAuthority: fakeMembershipAuthority,
    });

    const result = await adapter.readiness("conversation-1");

    expect(result).toBeNull();
    expect(fakeConstructionCoordinator.readinessForDraft).not.toHaveBeenCalled();
  });

  it("readiness() returns null when the draft cannot be found, and the coarse overall outcome when it can", async () => {
    const fakeConstructionCoordinator = {
      readinessForDraft: vi.fn(() => ({ axes: [], overall: "draft-ready" as const })),
    } as unknown as FedosPrivateConversationConstructionCoordinator;
    const fakeMembershipAuthority = {} as unknown as FedosConversationMembershipAuthority;
    const fakeDraftPersistence = {
      getDraft: vi.fn(() => ({
        schemaVersion: 1 as const,
        id: "conversation-1",
        mode: "direct" as const,
        lifecycleState: "draft" as const,
        policyReference: "direct-draft-v1" as const,
        creatorAuthority: "nostr",
        creatorPublicIdentifier: "self1",
        creatorIdentityId: null,
        createdAt: 1_700_000_000,
      })),
      putDraft: vi.fn(),
      listDrafts: vi.fn(() => []),
    };
    const adapter = new FedosMessengerConversationPortAdapter({
      constructionCoordinator: fakeConstructionCoordinator,
      membershipAuthority: fakeMembershipAuthority,
      draftPersistence: fakeDraftPersistence,
    });

    const result = await adapter.readiness("conversation-1");

    expect(fakeConstructionCoordinator.readinessForDraft).toHaveBeenCalled();
    expect(result).toEqual({ overall: "draft-ready" });
  });
});

describe("NotificationPort adapter", () => {
  it("satisfies the NotificationPort shape (type-level, via the class's own `implements` clause)", () => {
    const fakeCoordinator = {
      notify: vi.fn(async () => ({ state: "delivered" as const, reason: "ok", notification: null })),
    } as unknown as FedosDesktopNotificationCoordinator;
    const adapter = new FedosMessengerNotificationPortAdapter(fakeCoordinator);
    assertNotificationPortShape(adapter);
    expect(typeof adapter.notify).toBe("function");
  });

  it("notify() with a recognized meta.kind delegates to the coordinator's closed-vocabulary request, never forwarding raw title/body", () => {
    const fakeCoordinator = {
      notify: vi.fn(async () => ({ state: "delivered" as const, reason: "ok", notification: null })),
    } as unknown as FedosDesktopNotificationCoordinator;
    const adapter = new FedosMessengerNotificationPortAdapter(fakeCoordinator);

    adapter.notify("caller free-form title", "caller free-form body -- must never reach the coordinator", {
      kind: "conversation-message",
      targetConversationId: "conversation-1",
    });

    expect(fakeCoordinator.notify).toHaveBeenCalledWith({
      kind: "conversation-message",
      targetConversationId: "conversation-1",
    });
  });

  it("notify() fails closed (never calls the coordinator) when meta.kind is missing or unrecognized", () => {
    const fakeCoordinator = { notify: vi.fn() } as unknown as FedosDesktopNotificationCoordinator;
    const adapter = new FedosMessengerNotificationPortAdapter(fakeCoordinator);

    adapter.notify("title", "body");
    adapter.notify("title", "body", { kind: "not-a-real-kind" });

    expect(fakeCoordinator.notify).not.toHaveBeenCalled();
  });
});

/**
 * TransportPort adapter (Compatibility Facade Reduction + Package
 * Extraction Readiness + Remaining Architecture Debt Closure arc, Agent
 * P) — mirrors the three describe blocks above's own pattern: a
 * type-level `implements` check plus behavior assertions against minimal
 * hand-built doubles for `RelayPublisher`/`RelayAdapter`/
 * `NostrTransportEventSource`, the three real dependencies
 * `NostrTransportAdapter` delegates to. Unlike the three coordinators
 * above, none of these three doubles need an `as unknown as` cast — they
 * are plain interfaces with no `#private` fields, so a structurally-shaped
 * object literal genuinely satisfies each one.
 */
const SAMPLE_EVENT: NostrEvent = {
  id: "event-1",
  pubkey: "a".repeat(64),
  created_at: 1_700_000_000,
  kind: 1,
  tags: [],
  content: "irrelevant -- this adapter never reads content directly",
  sig: "b".repeat(128),
};

describe("TransportPort adapter (NostrTransportAdapter)", () => {
  it("satisfies the TransportPort shape (type-level, via the class's own `implements` clause)", () => {
    const publisher: RelayPublisher = { publish: vi.fn(async (): Promise<PublishResult> => ({ eventId: "e1", accepted: true, message: "" })) };
    const relayAdapter: RelayAdapter = { url: "wss://example.invalid", query: vi.fn(async (): Promise<NostrEvent[]> => []) };
    const eventSource: NostrTransportEventSource = {
      prepareOutboundEvent: vi.fn(async () => SAMPLE_EVENT),
      decodeInboundEvent: vi.fn(async () => null),
      filterFor: vi.fn((): NostrFilter => ({})),
    };
    const adapter = new NostrTransportAdapter({ publisher, relayAdapter, eventSource });
    assertTransportPortShape(adapter);
    expect(typeof adapter.connect).toBe("function");
    expect(typeof adapter.disconnect).toBe("function");
    expect(typeof adapter.status).toBe("function");
    expect(typeof adapter.send).toBe("function");
    expect(typeof adapter.subscribe).toBe("function");
  });

  it("status() starts disconnected; send() fails closed with not-connected before connect()", async () => {
    const publisher: RelayPublisher = { publish: vi.fn() };
    const relayAdapter: RelayAdapter = { url: "wss://example.invalid", query: vi.fn() };
    const eventSource: NostrTransportEventSource = {
      prepareOutboundEvent: vi.fn(),
      decodeInboundEvent: vi.fn(),
      filterFor: vi.fn((): NostrFilter => ({})),
    };
    const adapter = new NostrTransportAdapter({ publisher, relayAdapter, eventSource });

    expect(adapter.status()).toBe("disconnected");
    const result = await adapter.send("nostr:abc123", new TextEncoder().encode("hi"));
    expect(result).toEqual({ sent: false, reason: "not-connected" });
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it("connect() flips status to connected; send() then delegates to eventSource.prepareOutboundEvent() and publisher.publish(), mapping an accepted result to sent:true", async () => {
    const publisher: RelayPublisher = { publish: vi.fn(async (): Promise<PublishResult> => ({ eventId: "event-1", accepted: true, message: "" })) };
    const relayAdapter: RelayAdapter = { url: "wss://example.invalid", query: vi.fn() };
    const eventSource: NostrTransportEventSource = {
      prepareOutboundEvent: vi.fn(async () => SAMPLE_EVENT),
      decodeInboundEvent: vi.fn(),
      filterFor: vi.fn((): NostrFilter => ({})),
    };
    const adapter = new NostrTransportAdapter({ publisher, relayAdapter, eventSource });

    const status = await adapter.connect();
    expect(status).toBe("connected");

    const result = await adapter.send("nostr:abc123", new TextEncoder().encode("hi"));
    expect(eventSource.prepareOutboundEvent).toHaveBeenCalledWith("nostr:abc123", expect.any(Uint8Array));
    expect(publisher.publish).toHaveBeenCalledWith(SAMPLE_EVENT);
    expect(result).toEqual({ sent: true, messageId: "event-1" });
  });

  it("send() maps eventSource.prepareOutboundEvent() returning null to invalid-destination, never calling publisher.publish()", async () => {
    const publisher: RelayPublisher = { publish: vi.fn() };
    const relayAdapter: RelayAdapter = { url: "wss://example.invalid", query: vi.fn() };
    const eventSource: NostrTransportEventSource = {
      prepareOutboundEvent: vi.fn(async () => null),
      decodeInboundEvent: vi.fn(),
      filterFor: vi.fn((): NostrFilter => ({})),
    };
    const adapter = new NostrTransportAdapter({ publisher, relayAdapter, eventSource });
    await adapter.connect();

    const result = await adapter.send("nostr:unroutable", new TextEncoder().encode("hi"));

    expect(result).toEqual({ sent: false, reason: "invalid-destination" });
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it("send() maps a not-accepted PublishResult to rejected/later, never throws", async () => {
    const publisher: RelayPublisher = { publish: vi.fn(async (): Promise<PublishResult> => ({ eventId: "event-1", accepted: false, message: "relay closed before OK" })) };
    const relayAdapter: RelayAdapter = { url: "wss://example.invalid", query: vi.fn() };
    const eventSource: NostrTransportEventSource = {
      prepareOutboundEvent: vi.fn(async () => SAMPLE_EVENT),
      decodeInboundEvent: vi.fn(),
      filterFor: vi.fn((): NostrFilter => ({})),
    };
    const adapter = new NostrTransportAdapter({ publisher, relayAdapter, eventSource });
    await adapter.connect();

    const result = await adapter.send("nostr:abc123", new TextEncoder().encode("hi"));

    expect(result).toEqual({ sent: false, reason: "rejected", retryPolicy: "later" });
  });

  it("subscribe()/pollOnce() form a working, unsubscribable local registry over relayAdapter.query() + eventSource.decodeInboundEvent(), deduplicating by event id", async () => {
    const publisher: RelayPublisher = { publish: vi.fn() };
    const relayAdapter: RelayAdapter = { url: "wss://example.invalid", query: vi.fn(async (): Promise<NostrEvent[]> => [SAMPLE_EVENT]) };
    const decoded = new TextEncoder().encode("inbound payload");
    const eventSource: NostrTransportEventSource = {
      prepareOutboundEvent: vi.fn(),
      decodeInboundEvent: vi.fn(async () => decoded),
      filterFor: vi.fn((): NostrFilter => ({ authors: ["abc123"] })),
    };
    const adapter = new NostrTransportAdapter({ publisher, relayAdapter, eventSource });
    await adapter.connect();

    const received: Uint8Array[] = [];
    const unsubscribe = adapter.subscribe("nostr:abc123", (message) => received.push(message.payload));

    await adapter.pollOnce("nostr:abc123");
    expect(relayAdapter.query).toHaveBeenCalledWith([{ authors: ["abc123"] }]);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(decoded);

    // Same event id again -- deduplicated, handler not called a second time.
    await adapter.pollOnce("nostr:abc123");
    expect(received).toHaveLength(1);

    unsubscribe();
    await adapter.pollOnce("nostr:abc123"); // no-op: no longer subscribed.
    expect(received).toHaveLength(1);
  });

  it("decodeInboundEvent() returning null (not addressed to us / undecodable) is silently skipped, never dispatched", async () => {
    const publisher: RelayPublisher = { publish: vi.fn() };
    const relayAdapter: RelayAdapter = { url: "wss://example.invalid", query: vi.fn(async (): Promise<NostrEvent[]> => [SAMPLE_EVENT]) };
    const eventSource: NostrTransportEventSource = {
      prepareOutboundEvent: vi.fn(),
      decodeInboundEvent: vi.fn(async () => null),
      filterFor: vi.fn((): NostrFilter => ({})),
    };
    const adapter = new NostrTransportAdapter({ publisher, relayAdapter, eventSource });
    await adapter.connect();

    const received: unknown[] = [];
    adapter.subscribe("nostr:abc123", (message) => received.push(message));
    await adapter.pollOnce("nostr:abc123");

    expect(received).toHaveLength(0);
  });

  it("disconnect() flips status back to disconnected; a subsequent send() fails closed again", async () => {
    const publisher: RelayPublisher = { publish: vi.fn(async (): Promise<PublishResult> => ({ eventId: "event-1", accepted: true, message: "" })) };
    const relayAdapter: RelayAdapter = { url: "wss://example.invalid", query: vi.fn() };
    const eventSource: NostrTransportEventSource = {
      prepareOutboundEvent: vi.fn(async () => SAMPLE_EVENT),
      decodeInboundEvent: vi.fn(),
      filterFor: vi.fn((): NostrFilter => ({})),
    };
    const adapter = new NostrTransportAdapter({ publisher, relayAdapter, eventSource });
    await adapter.connect();
    await adapter.disconnect();

    expect(adapter.status()).toBe("disconnected");
    const result = await adapter.send("nostr:abc123", new TextEncoder().encode("hi"));
    expect(result).toEqual({ sent: false, reason: "not-connected" });
  });
});
