import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_448_outbox_publisher_readiness_adapter.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import signingAuthoritySource from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmSigningAuthoritySource from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_wasm_nostr_signing_authority.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync } from "node:fs";

describe("Secure Runtime Alpha 448 -- Outbox Publisher Readiness Adapter", () => {
  it("no FedosNostrBoardPublisher was created THIS Stage (Alpha 448 itself still says so); it is created later, by Alpha 451-460", () => {
    // Alpha 451-460 (Canonical Nostr Outbound Publisher Foundation Arc)
    // fulfills this Stage's own §"Not built this Stage" prediction at exactly
    // the file path this Stage's own doc reserved. See
    // docs/secure_runtime_alpha_460_nostr_outbound_publisher_foundation_completion.md.
    // This doc's own text (unchanged) still correctly describes Alpha 448 itself.
    expect(existsSync("src/board/publish/nostr/fedos_nostr_board_publisher.ts")).toBe(true);
    expect(doc).toMatch(/not created/);
  });

  it("the signing authority contains no transport concern (no Relay/Outbox/fetch/WebSocket import)", () => {
    for (const source of [signingAuthoritySource, wasmSigningAuthoritySource]) {
      const importLines = (source as string).match(/^import .*$/gm) ?? [];
      for (const line of importLines) {
        expect(line.toLowerCase()).not.toContain("relay");
        expect(line.toLowerCase()).not.toContain("outbox");
      }
      expect(source).not.toMatch(/WebSocket/);
      expect(source).not.toMatch(/\bfetch\(/);
    }
  });

  it("signEvent()'s own signature is already the shape a future Publisher would depend on", () => {
    expect(signingAuthoritySource).toContain(
      "signEvent(request: FedosNostrUnsignedEventRequest): Promise<FedosNostrWireEvent | null>;",
    );
  });
});
