/**
 * Secure Runtime Alpha 1611–1690 — Alpha 1613 (Canonical Route
 * Decision), Alpha 1614 (Proprietary Route Status), Alpha 1616
 * (Transport/Protocol Separation).
 */
import { describe, it, expect } from "vitest";
import {
  resolveFedosPrivateWireRoute,
  FEDOS_PRIVATE_WIRE_ROUTE_DEFAULT,
} from "../src/conversation/transport/fedos_private_wire_route.js";
import { FedosPrivateV1WireAdapter } from "../src/conversation/transport/fedos_private_v1_wire_adapter.js";
import { NostrNip17V1WireAdapter } from "../src/conversation/delivery/nostr/nip17/fedos_nostr_nip17_v1_wire_adapter.js";
import { FEDOS_PRIVATE_NOSTR_DELIVERY_KIND } from "../src/conversation/delivery/nostr/fedos_private_nostr_delivery_mode.js";
import type { FedosPrivateWireAdapter } from "../src/conversation/transport/fedos_private_wire_adapter.js";
import type { FedosConversationMessageEnvelope } from "../src/conversation/envelope/fedos_conversation_message_envelope.js";
import type { FedosEventDescriptor } from "../src/desktop/fedos_event_descriptor.js";

function adapters(): Record<"fedos-private-v1" | "nostr-nip17-v1", FedosPrivateWireAdapter> {
  return {
    "fedos-private-v1": new FedosPrivateV1WireAdapter(),
    "nostr-nip17-v1": new NostrNip17V1WireAdapter(),
  };
}

describe("Secure Runtime Alpha 1611-1690 -- Alpha 1613: Canonical Route Decision", () => {
  it("1. the fixed default route is fedos-private-v1", () => {
    expect(FEDOS_PRIVATE_WIRE_ROUTE_DEFAULT).toBe("fedos-private-v1");
  });

  it("2. resolving with no request returns the fixed default (available)", () => {
    const table = adapters();
    expect(resolveFedosPrivateWireRoute(undefined, (route) => table[route])).toBe("fedos-private-v1");
  });

  it("3. explicitly requesting fedos-private-v1 resolves to fedos-private-v1", () => {
    const table = adapters();
    expect(resolveFedosPrivateWireRoute("fedos-private-v1", (route) => table[route])).toBe("fedos-private-v1");
  });

  it("4. explicitly requesting nostr-nip17-v1 resolves to unsupported today -- never a silent fallback to fedos-private-v1 (Alpha 1648 No-Downgrade Rule)", () => {
    const table = adapters();
    expect(resolveFedosPrivateWireRoute("nostr-nip17-v1", (route) => table[route])).toBe("unsupported");
  });

  it("5. the default does not depend on which adapters are constructed/passed in -- same fixed value regardless (Alpha 1613's own 'never silently changes based on available files')", () => {
    const table = adapters();
    const a = resolveFedosPrivateWireRoute(undefined, (route) => table[route]);
    const b = resolveFedosPrivateWireRoute(undefined, () => ({ isAvailable: () => true }));
    expect(a).toBe(b);
  });
});

function fakeEnvelope(): FedosConversationMessageEnvelope {
  return Object.freeze({
    id: "envelope-1" as never,
    conversationId: "conversation-1" as never,
    senderMembershipId: "membership-1" as never,
    payloadId: "payload-1" as never,
    encryptionSuite: "ChaCha20Poly1305",
    keyEpoch: 0,
    createdAt: 1_700_000_000,
    replyToEnvelopeId: null,
  });
}

describe("Secure Runtime Alpha 1611-1690 -- Alpha 1614/1616: FedosPrivateV1WireAdapter", () => {
  const adapter = new FedosPrivateV1WireAdapter();

  it("1. route is fedos-private-v1 and it is always available", () => {
    expect(adapter.route).toBe("fedos-private-v1");
    expect(adapter.isAvailable()).toBe(true);
  });

  it("2. build() produces a request at the shared proprietary kind, never kind 1", () => {
    const result = adapter.build({
      envelope: fakeEnvelope(),
      ciphertext: new Uint8Array([1, 2, 3]),
      counterpartyPublicKeyHex: "b".repeat(64),
      localAccountIndex: 0,
    });
    expect(result.outcome).toBe("built");
    if (result.outcome === "built") {
      expect(result.request.kind).toBe(FEDOS_PRIVATE_NOSTR_DELIVERY_KIND);
      expect(result.request.kind).not.toBe(1);
    }
  });

  it("3. parse() is not-mine for an unrelated descriptor, parsed for one built by this same adapter", () => {
    const built = adapter.build({
      envelope: fakeEnvelope(),
      ciphertext: new Uint8Array([9, 9]),
      counterpartyPublicKeyHex: "b".repeat(64),
      localAccountIndex: 0,
    });
    expect(built.outcome).toBe("built");
    if (built.outcome !== "built") return;
    const descriptor: FedosEventDescriptor = Object.freeze({
      id: "event-1",
      provider: "nostr",
      author: "a".repeat(64),
      createdAt: built.request.createdAt,
      kind: built.request.kind,
      tags: built.request.tags,
      content: built.request.content,
      signature: "sig",
    });
    expect(adapter.parse(descriptor).outcome).toBe("parsed");

    const unrelated: FedosEventDescriptor = Object.freeze({
      id: "event-2",
      provider: "nostr",
      author: "a".repeat(64),
      createdAt: 0,
      kind: FEDOS_PRIVATE_NOSTR_DELIVERY_KIND,
      tags: [],
      content: "",
      signature: "sig",
    });
    expect(adapter.parse(unrelated).outcome).toBe("not-mine");
  });
});

describe("Secure Runtime Alpha 1611-1690 -- Alpha 1616/1617: NostrNip17V1WireAdapter (real module, permanently unsupported today)", () => {
  const adapter = new NostrNip17V1WireAdapter();

  it("1. route is nostr-nip17-v1 and it is never available", () => {
    expect(adapter.route).toBe("nostr-nip17-v1");
    expect(adapter.isAvailable()).toBe(false);
  });

  it("2. build() always resolves to unsupported -- never a partial/best-effort event", () => {
    const result = adapter.build({
      envelope: fakeEnvelope(),
      ciphertext: new Uint8Array([1, 2, 3]),
      counterpartyPublicKeyHex: "b".repeat(64),
      localAccountIndex: 0,
    });
    expect(result).toEqual({ outcome: "unsupported" });
  });

  it("3. parse() always resolves to unsupported -- never a best-effort partial parse", () => {
    const descriptor: FedosEventDescriptor = Object.freeze({
      id: "event-1",
      provider: "nostr",
      author: "a".repeat(64),
      createdAt: 0,
      kind: 1059,
      tags: [],
      content: "",
      signature: "sig",
    });
    expect(adapter.parse(descriptor)).toEqual({ outcome: "unsupported" });
  });
});
