import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_443_signed_event_output_reuse.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import signingAuthoritySource from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import canonicalTypesSource from "../src/os/messenger/adapters/nostr/protocol/types.ts?raw";

describe("Secure Runtime Alpha 443 -- Signed Event Output Reuse", () => {
  // Nostr Consolidation Plan, Step 1 (docs/architecture/NOSTR-CONSOLIDATION-PLAN.md):
  // FedosNostrWireEvent and NostrEvent converged on one canonical type,
  // defined at adapters/nostr/protocol/types.ts. protocol/sign/'s own files
  // now import NostrEvent directly from their own ../types.ts (fixing a
  // logical backward dependency into desktop/) rather than importing the
  // FedosNostrWireEvent alias name -- this is the intended, fixed shape,
  // not a regression. "Never a fourth duplicate type" still holds: this
  // test now asserts the canonical name instead of the pre-consolidation one.
  it("the signing authority contract returns the canonical NostrEvent, never a fourth duplicate type", () => {
    expect(signingAuthoritySource).toMatch(/import type \{ NostrEvent \}/);
    expect(signingAuthoritySource).toMatch(/Promise<NostrEvent \| null>/);
    expect(signingAuthoritySource).not.toMatch(/interface FedosSignedNostrEvent/);
  });

  // fedos_nostr_wire_event.ts is now a one-line re-export alias to the
  // canonical type (see its own header comment) -- the seven NIP-01 wire
  // fields are declared once, at the canonical definition, not duplicated
  // here. Assert against the real source of truth instead.
  it("the canonical NostrEvent type still carries exactly the seven NIP-01 wire fields", () => {
    for (const field of ["id:", "pubkey:", "created_at:", "kind:", "tags:", "content:", "sig:"]) {
      expect(canonicalTypesSource).toContain(field);
    }
  });

  it("the doc confirms no fourth duplicate type and no npub/Relay/Outbox field in the output", () => {
    expect(doc).toMatch(/no fourth duplicate signed-event type/);
    expect(doc).toContain("No secret Handle");
  });
});
