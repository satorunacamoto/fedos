import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_420_outbox_foundation_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import typesSource from "../src/os/messenger/board/outbox/fedos_board_outbox_types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import codecSource from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import persistenceSource from "../src/os/messenger/board/outbox/fedos_board_outbox_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import inMemorySource from "../src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import appendOnlySource from "../src/os/messenger/board/outbox/append_only_fedos_board_outbox_persistence.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync } from "node:fs";

import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";

/**
 * Secure Runtime Alpha 420 -- "Outbox Foundation Completion Gate /
 * Declaration": Stage 10 of the Alpha 411-420 Canonical Board Durable
 * Outbox Foundation Arc.
 */
describe("Secure Runtime Alpha 420 -- Outbox Foundation Completion Gate / Declaration", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares the gate PASSED for Phase A", () => {
    expect(designDocSource).toMatch(/\*\*Gate: PASSED\.\*\* Phase A \(Alpha 411–420\) is complete and durable\./);
  });

  it("3. the design doc declares Phase B NOT implemented, with the exact reason", () => {
    expect(designDocSource).toMatch(/\*\*Phase B is NOT implemented\.\*\*/);
    expect(designDocSource).toMatch(/pub\(crate\)`? Rust with no `#\[wasm_bindgen\]` export/);
  });

  it("4. the design doc recommends a signing-boundary-decision Arc, not a blind ActivityPub or retry recommendation", () => {
    expect(designDocSource).toMatch(/Nostr\s*\nOutbound Signing Boundary Decision Arc/);
    expect(designDocSource).not.toMatch(/Recommended: Secure Runtime Alpha 431–440/);
  });

  it("5. behavioral: local-only submitPost() is unaffected end to end -- unrelated to any Outbox wiring", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await host.start();
    const input: FedosBoardPostInput = {
      id: "gate-check",
      boardId: "board-420",
      threadId: "gate-check",
      replyTo: null,
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a420" },
      body: "gate check",
      createdAt: 1_700_005_000,
      source: { protocol: "nostr", reference: "ref-gate" },
    };
    const post = validateFedosBoardPost(input)!;
    expect(host.submitPost(post)).toBe("inserted");
  });

  it("6. structural: no file under src/board/outbox imports a Relay, fetch, or WebSocket", () => {
    for (const [name, source] of Object.entries({
      typesSource,
      codecSource,
      persistenceSource,
      inMemorySource,
      appendOnlySource,
    })) {
      expect(source as string, name).not.toMatch(/WebSocket|fetch\(|FedosRelay|Relay\.publish/);
    }
  });

  it("7. src/board/publish/nostr did not exist as of this Stage's own Phase A work -- fulfilled later, by Alpha 451-460", () => {
    // This Stage (Alpha 420) itself wrote no Phase B code -- `src/board/publish/`
    // exists now because Alpha 451-460 (Canonical Nostr Outbound Publisher
    // Foundation Arc) later fulfills the gap this Stage's own "Phase B honestly
    // blocked" declaration left open. See
    // docs/secure_runtime_alpha_460_nostr_outbound_publisher_foundation_completion.md.
    expect(existsSync("src/board/publish")).toBe(true);
  });

  it("8. the design doc cross-references Alpha 412, Alpha 419, and Alpha 421", () => {
    for (const ref of [
      "secure_runtime_alpha_412_outbox_responsibility_decision",
      "secure_runtime_alpha_419_host_submit_outbox_coordination",
      "secure_runtime_alpha_421_existing_nostr_outbound_construction_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
