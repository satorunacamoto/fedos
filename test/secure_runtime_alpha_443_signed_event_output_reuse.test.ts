import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_443_signed_event_output_reuse.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wireEventSource from "../src/os/messenger/desktop/fedos_nostr_wire_event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import signingAuthoritySource from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.ts?raw";

describe("Secure Runtime Alpha 443 -- Signed Event Output Reuse", () => {
  it("the signing authority contract returns FedosNostrWireEvent, never a fourth duplicate type", () => {
    expect(signingAuthoritySource).toMatch(/import type \{ FedosNostrWireEvent \}/);
    expect(signingAuthoritySource).toMatch(/Promise<FedosNostrWireEvent \| null>/);
    expect(signingAuthoritySource).not.toMatch(/interface FedosSignedNostrEvent/);
  });

  it("FedosNostrWireEvent still carries exactly the seven NIP-01 wire fields", () => {
    for (const field of ["id:", "pubkey:", "created_at:", "kind:", "tags:", "content:", "sig:"]) {
      expect(wireEventSource).toContain(field);
    }
  });

  it("the doc confirms no fourth duplicate type and no npub/Relay/Outbox field in the output", () => {
    expect(doc).toMatch(/no fourth duplicate signed-event type/);
    expect(doc).toContain("No secret Handle");
  });
});
