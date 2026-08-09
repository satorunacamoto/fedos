import { describe, it, expect, vi } from "vitest";
import type { MessagingPort } from "../src/os/core/ports/messaging_port.js";
import type { ConversationPort } from "../src/os/core/ports/conversation_port.js";
import type { NotificationPort } from "../src/os/core/ports/notification_port.js";
import { FedosMessengerMessagingPortAdapter } from "../src/os/messenger/adapters/messaging_port_adapter.js";
import { FedosMessengerConversationPortAdapter } from "../src/os/messenger/adapters/conversation_port_adapter.js";
import { FedosMessengerNotificationPortAdapter } from "../src/os/messenger/adapters/notification_port_adapter.js";
import type { FedosConversationDirectMessagingCoordinator } from "../src/conversation/messaging/fedos_conversation_direct_messaging_coordinator.js";
import type { FedosPrivateConversationConstructionCoordinator } from "../src/conversation/construction/fedos_private_conversation_construction_coordinator.js";
import type { FedosConversationMembershipAuthority } from "../src/conversation/membership/fedos_conversation_membership_authority.js";
import type { FedosDesktopNotificationCoordinator } from "../src/desktop/notification/fedos_desktop_notification_coordinator.js";

/**
 * OS Capability Modularization — Port-shape check for the three new
 * `src/os/messenger/adapters/*` files.
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

describe("MessagingPort adapter", () => {
  it("satisfies the MessagingPort shape (type-level, via the class's own `implements` clause)", () => {
    const fakeCoordinator = {
      sendDirectMessage: vi.fn(async () => ({ outcome: "sent-locally" as const, envelopeId: "env-1" })),
    } as unknown as FedosConversationDirectMessagingCoordinator;
    const adapter = new FedosMessengerMessagingPortAdapter(fakeCoordinator);
    assertMessagingPortShape(adapter);
    expect(typeof adapter.send).toBe("function");
    expect(typeof adapter.onMessage).toBe("function");
  });

  it("send() delegates to sendDirectMessage() and maps a successful outcome to a delivered SendResult", async () => {
    const fakeCoordinator = {
      sendDirectMessage: vi.fn(async () => ({ outcome: "sent-locally" as const, envelopeId: "env-42" })),
    } as unknown as FedosConversationDirectMessagingCoordinator;
    const adapter = new FedosMessengerMessagingPortAdapter(fakeCoordinator);

    const result = await adapter.send("conversation-1", { text: "hello" });

    expect(fakeCoordinator.sendDirectMessage).toHaveBeenCalledWith({
      conversationId: "conversation-1",
      body: "hello",
      replyToEnvelopeId: null,
    });
    expect(result).toEqual({ delivered: true, messageId: "env-42" });
  });

  it("send() maps a failure outcome to a non-delivered SendResult with a reason, never throws", async () => {
    const fakeCoordinator = {
      sendDirectMessage: vi.fn(async () => ({ outcome: "conversation-not-active" as const })),
    } as unknown as FedosConversationDirectMessagingCoordinator;
    const adapter = new FedosMessengerMessagingPortAdapter(fakeCoordinator);

    const result = await adapter.send("conversation-1", { text: "hello" });

    expect(result).toEqual({ delivered: false, reason: "conversation-not-active" });
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
    } as unknown as FedosPrivateConversationConstructionCoordinator;
    const fakeMembershipAuthority = {
      listMemberships: vi.fn(() => []),
    } as unknown as FedosConversationMembershipAuthority;
    const adapter = new FedosMessengerConversationPortAdapter({
      constructionCoordinator: fakeConstructionCoordinator,
      membershipAuthority: fakeMembershipAuthority,
    });
    assertConversationPortShape(adapter);
    expect(typeof adapter.createOrResolve).toBe("function");
    expect(typeof adapter.listParticipants).toBe("function");
  });

  it("createOrResolve() rejects a malformed counterparty reference without calling the coordinator", async () => {
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

    const result = await adapter.createOrResolve("not-a-recognized-authority-ref");

    expect(result.ok).toBe(false);
    expect(fakeConstructionCoordinator.createDirectDraft).not.toHaveBeenCalled();
  });

  it("createOrResolve() parses a well-formed counterparty ref, delegates to createDirectDraft(), and lists participants via the membership authority", async () => {
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

    const result = await adapter.createOrResolve("nostr:abc123");

    expect(fakeConstructionCoordinator.createDirectDraft).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: { authority: "nostr", publicIdentifier: "abc123" } }),
    );
    expect(result.ok).toBe(true);
    expect(result.conversation).toEqual({
      conversationId: "conversation-abc",
      participants: ["nostr:abc123", "nostr:def456"],
    });
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
