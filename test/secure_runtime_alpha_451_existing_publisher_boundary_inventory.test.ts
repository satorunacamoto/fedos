import { describe, it, expect } from "vitest";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_451_existing_publisher_boundary_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import signingAuthoritySource from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmSigningAuthoritySource from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_wasm_nostr_signing_authority.ts?raw";

describe("Secure Runtime Alpha 451 -- Existing Publisher Boundary Inventory", () => {
  it("the doc is substantial and names the gap this Arc resolves", () => {
    expect(doc.length).toBeGreaterThan(1500);
    expect(doc).toMatch(/never carries a\s+signed event body/i);
    expect(doc).toMatch(/two\s+DIFFERENT types/);
  });

  it("FedosBoardOutboxPersistence still exposes exactly putIntent/getIntent/listIntents -- no delete/dequeue/ack", () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const publicMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(persistence)).filter(
      (name) => name !== "constructor",
    );
    expect(publicMethods.sort()).toEqual(["getIntent", "listIntents", "putIntent"]);
  });

  it("FedosRelay.publish() signature is unchanged: (event: FedosEventDescriptor) => Promise<void>", () => {
    expect(relaySource).toMatch(/publish\(event: FedosEventDescriptor\): Promise<void>;/);
  });

  it("the signing authority still has no Relay/Outbox transport concern", () => {
    for (const source of [signingAuthoritySource, wasmSigningAuthoritySource]) {
      const importLines = (source as string).match(/^import .*$/gm) ?? [];
      for (const line of importLines) {
        expect(line.toLowerCase()).not.toContain("relay");
        expect(line.toLowerCase()).not.toContain("outbox");
      }
    }
  });

  it("the doc cross-references Alpha 448 and Alpha 234", () => {
    expect(doc).toContain("secure_runtime_alpha_448_outbox_publisher_readiness_adapter");
    expect(doc).toContain("secure_runtime_alpha_234_inbound_event_representation");
  });
});
