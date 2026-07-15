import { describe, it, expect } from "vitest";
import { nostrWireEventToFedosEventDescriptor } from "../src/board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.js";
import type { FedosNostrWireEvent } from "../src/desktop/fedos_nostr_wire_event.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import source from "../src/board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.ts?raw";

const sampleWireEvent: FedosNostrWireEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_000,
  kind: 1,
  tags: [["e", "c".repeat(64)]],
  content: "hello relay",
  sig: "d".repeat(128),
};

describe("Secure Runtime Alpha 454 -- Nostr Wire Event to Event Descriptor Mapping", () => {
  it("maps every field, renaming pubkey/created_at/sig and supplying provider = \"nostr\"", () => {
    const descriptor = nostrWireEventToFedosEventDescriptor(sampleWireEvent);
    expect(descriptor).toEqual({
      id: sampleWireEvent.id,
      provider: "nostr",
      author: sampleWireEvent.pubkey,
      createdAt: sampleWireEvent.created_at,
      kind: sampleWireEvent.kind,
      tags: sampleWireEvent.tags,
      content: sampleWireEvent.content,
      signature: sampleWireEvent.sig,
    });
  });

  it("returns a frozen object", () => {
    const descriptor = nostrWireEventToFedosEventDescriptor(sampleWireEvent);
    expect(Object.isFrozen(descriptor)).toBe(true);
  });

  it("provider is always the fixed literal \"nostr\", never derived from the input", () => {
    const descriptor = nostrWireEventToFedosEventDescriptor(sampleWireEvent);
    expect(descriptor.provider).toBe("nostr");
  });

  it("is the ONLY export, and imports no Relay/Outbox/network primitive", () => {
    const exportLines = (source as string).match(/^export .*$/gm) ?? [];
    expect(exportLines).toHaveLength(1);
    const importLines = (source as string).match(/^import .*$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/WebSocket|fetch\(|FedosRelay\b|Outbox/);
    }
  });
});
