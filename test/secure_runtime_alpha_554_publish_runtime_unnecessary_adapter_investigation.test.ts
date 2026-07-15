import { describe, it, expect } from "vitest";
import { FedosBoardServiceReader } from "../src/board/repository/fedos_board_reader.js";
import { FedosBoardService } from "../src/board/repository/fedos_board_service.js";
import { nostrWireEventToFedosEventDescriptor } from "../src/board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.js";
import type { FedosNostrWireEvent } from "../src/desktop/fedos_nostr_wire_event.js";

/**
 * Secure Runtime Alpha 554 -- "Unnecessary Adapter Investigation":
 * Stage 14 of the Alpha 541-560 Publish Runtime Operational Review
 * Arc. Review test only -- proves, by real execution, that removing
 * FedosBoardServiceReader would reopen a write bypass, and that
 * nostrWireEventToFedosEventDescriptor performs real, non-trivial field
 * translation.
 */
describe("Secure Runtime Alpha 554 -- Unnecessary Adapter Investigation", () => {
  it("1. a raw FedosBoardService instance has a live, callable registerPost method at the object level", () => {
    const service = new FedosBoardService();
    expect(typeof (service as unknown as Record<string, unknown>).registerPost).toBe("function");
  });

  it("2. FedosBoardServiceReader's own object surface has NO registerPost property -- the bypass FedosBoardServiceReader closes", () => {
    const service = new FedosBoardService();
    const reader = new FedosBoardServiceReader(service);
    expect((reader as unknown as Record<string, unknown>).registerPost).toBeUndefined();
    expect(Object.keys(reader)).not.toContain("registerPost");
  });

  it("3. nostrWireEventToFedosEventDescriptor performs real field renaming, not a pass-through", () => {
    const wireEvent: FedosNostrWireEvent = {
      id: "event-1",
      pubkey: "pubkey-1",
      created_at: 1_700_000_000,
      kind: 1,
      tags: [],
      content: "hello",
      sig: "sig-1",
    };
    const descriptor = nostrWireEventToFedosEventDescriptor(wireEvent);
    expect(descriptor.author).toBe(wireEvent.pubkey);
    expect(descriptor.createdAt).toBe(wireEvent.created_at);
    expect(descriptor.signature).toBe(wireEvent.sig);
    expect(descriptor.provider).toBe("nostr");
    // The descriptor's own field NAMES differ from the wire event's -- confirming this is
    // a real translation, not a structural alias.
    expect(Object.keys(descriptor).sort()).not.toEqual(Object.keys(wireEvent).sort());
  });
});
