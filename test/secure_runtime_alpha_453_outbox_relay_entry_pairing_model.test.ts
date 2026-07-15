import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_453_outbox_relay_entry_pairing_model.md?raw";

describe("Secure Runtime Alpha 453 -- Outbox<->Relay Entry Pairing Model", () => {
  it("the doc adopts the FedosNostrBoardPublishEntry pairing shape", () => {
    expect(doc).toMatch(
      /FedosNostrBoardPublishEntry \{ readonly intent: FedosBoardOutboxIntent;\s*readonly event: FedosNostrWireEvent \}/,
    );
  });

  it("the doc decides protocol-mismatch fails closed, never throws", () => {
    expect(doc).toMatch(/fails closed to `false`,\s+never throws, never/i);
  });

  it("the doc decides the interface/implementation split mirrors the Signing Authority precedent", () => {
    expect(doc).toContain("FedosWasmNostrSigningAuthority");
    expect(doc).toContain("FedosNostrBoardPublisher");
    expect(doc).toContain("FedosRelayNostrBoardPublisher");
  });

  it("the doc names the exact reserved file path from Alpha 448", () => {
    expect(doc).toContain("src/board/publish/nostr/fedos_nostr_board_publisher.ts");
  });

  it("the doc rejects deriving the event from the Outbox intent by signing inside the Publisher", () => {
    expect(doc).toMatch(/Rejected: deriving `event` from `intent\.postId`/);
  });
});
