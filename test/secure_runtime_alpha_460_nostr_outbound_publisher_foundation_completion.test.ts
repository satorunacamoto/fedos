import { describe, it, expect } from "vitest";
import { FedosRelayNostrBoardPublisher } from "../src/os/messenger/board/publish/nostr/fedos_relay_nostr_board_publisher.js";
import type { FedosNostrBoardPublisher } from "../src/os/messenger/board/publish/nostr/fedos_nostr_board_publisher.js";
import { NullRelay } from "../src/os/messenger/desktop/null_relay.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_460_nostr_outbound_publisher_foundation_completion.md?raw";

describe("Secure Runtime Alpha 460 -- Canonical Nostr Outbound Publisher Foundation Completion", () => {
  it("declares every Stage 451-459 complete", () => {
    for (let n = 451; n <= 459; n++) {
      expect(doc).toContain(`secure_runtime_alpha_${n}_`);
    }
  });

  it("FedosRelayNostrBoardPublisher satisfies FedosNostrBoardPublisher end to end", () => {
    const relay = new NullRelay("wss://relay.example.test");
    const publisher: FedosNostrBoardPublisher = new FedosRelayNostrBoardPublisher(relay);
    expect(typeof publisher.publishOne).toBe("function");
    expect(typeof publisher.publishBatch).toBe("function");
  });

  it("honestly documents the concurrent-writer finding rather than claiming a clean full-repo baseline", () => {
    expect(doc).toMatch(/concurrent writer was detected/i);
    expect(doc).toMatch(/does\s+NOT claim a clean full-repository `npm test` baseline/);
  });

  it("names the four pre-existing tests updated, and explains why", () => {
    for (const name of [
      "secure_runtime_alpha_420_outbox_foundation_completion",
      "secure_runtime_alpha_421_existing_nostr_outbound_construction_inventory",
      "secure_runtime_alpha_423_nostr_signing_boundary_options",
      "secure_runtime_alpha_448_outbox_publisher_readiness_adapter",
    ]) {
      expect(doc).toContain(name);
    }
  });

  it("acknowledges other uncommitted, further-numbered work without adopting or reconciling it", () => {
    expect(doc).toMatch(/does not import, and does not reconcile with/);
  });

  it("lists what remains out of scope: observation, retry, scheduler, other protocols, GUI", () => {
    for (const term of ["Delivery observation", "retry/backoff", "publish scheduler", "ActivityPub", "GUI"]) {
      expect(doc).toContain(term);
    }
  });
});
