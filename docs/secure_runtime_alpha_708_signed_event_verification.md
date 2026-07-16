# Secure Runtime Alpha 708 — Signed Event Verification

Stage 8 of Phase B. The actual sent Event is independently verified — not
trusted merely because the Publisher returned success.

`NobleSignatureVerifier` (`src/nostr/noble_signature.ts`, pre-existing,
unchanged) already implements: recompute the event id from the event body
and confirm it equals the claimed `id`, then check that `sig` is a valid
BIP-340 Schnorr signature of that id under `pubkey`. Its `NostrEvent`
input shape (`id`/`pubkey`/`created_at`/`kind`/`tags`/`content`/`sig`) is
field-for-field identical to `FedosNostrWireEvent`
(`src/desktop/fedos_nostr_wire_event.ts`) — reused directly, no new
verifier written.

`test/secure_runtime_alpha_707_real_nostr_outbox_processing.test.ts` test
1:

- Converts the actually-sent `FedosEventDescriptor` back into the
  legacy `NostrEvent` shape (mutable `tags` array).
- `expect(await NobleSignatureVerifier.verify(asLegacyNostrEvent)).toBe(true)`
  — genuine, independent event-id and BIP-340 signature verification.
- `expect(boundIdentity?.author.publicIdentifier).toBe(sent.author)` —
  the sent `pubkey` equals the Phase A binding's own public key, closing
  the loop from "resolved and bound" all the way to "the bytes that hit
  the wire really are signed by that identity."

This is real, not merely structural — a tampered `content`, `created_at`,
or `sig` byte would make `NobleSignatureVerifier.verify()` return `false`
(confirmed by that verifier's own pre-existing test suite,
`test/noble_signature.test.ts`).
