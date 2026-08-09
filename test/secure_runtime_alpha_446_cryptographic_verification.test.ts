import { describe, it, expect } from "vitest";
import { validateInboundNostrEvent } from "../src/os/messenger/desktop/combined_inbound_event_validator.js";
import { verifyNostrEventId } from "../src/os/messenger/desktop/nostr_event_id_verifier.js";
import { verifyNostrEventSignature } from "../src/os/messenger/desktop/nostr_signature_verifier.js";
import type { FedosNostrWireEvent } from "../src/os/messenger/desktop/fedos_nostr_wire_event.js";

/**
 * Captured from a real, generated `FedosMasterSeedAuthority` via a
 * temporary probe test (`cargo test`, real execution — see
 * `docs/secure_runtime_alpha_447_restart_and_recovery_signing_verification.md`),
 * removed immediately after capture. Public data only (a pubkey, an
 * id, and a signature are never secret) — no seed/passphrase/private
 * key is present anywhere in this fixture.
 */
const REAL_RUST_SIGNED_EVENT: FedosNostrWireEvent = {
  id: "8dfc662e1c95a0aa2e803316149583ff08b8e0a15c622b5b9a48b84983333cf2",
  pubkey: "0dd114ce42282a141284d9658753545d86574f763781ed302236d2e89f6668f7",
  created_at: 1735000000,
  kind: 1,
  tags: [
    ["e", "deadbeefcafe"],
    ["p", "abc123"],
  ],
  content: "Secure Runtime Alpha 446 fixture",
  sig: "cca2e65a427c06c01152baba037d68b978b0443c2211037a4df5a4579509bd3a993afa769b255880e0d962ca4b2d84f658eff155beaf81b623601ade3c57d100",
};

describe("Secure Runtime Alpha 446 -- Cryptographic Verification", () => {
  it("the real Rust-signed event's id independently reconstructs under verifyNostrEventId", () => {
    expect(verifyNostrEventId(REAL_RUST_SIGNED_EVENT)).toBe(true);
  });

  it("the real Rust-signed event's BIP-340 signature independently verifies under verifyNostrEventSignature", () => {
    expect(verifyNostrEventSignature(REAL_RUST_SIGNED_EVENT)).toBe(true);
  });

  it("validateInboundNostrEvent -- this repository's own existing, unmodified validator -- accepts the Rust-signed event", () => {
    const validated = validateInboundNostrEvent(REAL_RUST_SIGNED_EVENT);
    expect(validated).not.toBeNull();
    expect(validated?.pubkey).toBe(REAL_RUST_SIGNED_EVENT.pubkey);
    expect(validated?.id).toBe(REAL_RUST_SIGNED_EVENT.id);
  });

  it("a single flipped signature byte is rejected by the SAME independent verifier", () => {
    const tampered: FedosNostrWireEvent = {
      ...REAL_RUST_SIGNED_EVENT,
      sig: "d" + REAL_RUST_SIGNED_EVENT.sig.slice(1),
    };
    expect(verifyNostrEventSignature(tampered)).toBe(false);
    expect(validateInboundNostrEvent(tampered)).toBeNull();
  });

  it("a mutated content field invalidates the id (proves the id is bound to the real content, not merely present)", () => {
    const tampered: FedosNostrWireEvent = { ...REAL_RUST_SIGNED_EVENT, content: "tampered" };
    expect(verifyNostrEventId(tampered)).toBe(false);
    expect(validateInboundNostrEvent(tampered)).toBeNull();
  });
});
