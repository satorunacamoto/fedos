# Secure Runtime Alpha 443 — Signed Event Output Reuse

Phase B, Stage 3. Confirms `FedosNostrSigningAuthority.signEvent()`
returns the EXISTING `FedosNostrWireEvent`
(`src/desktop/fedos_nostr_wire_event.ts`, Secure Runtime Alpha 234) —
no fourth duplicate signed-event type, matching Alpha 426's own already-
frozen decision (Alpha 441 confirmed no contradiction requires
revisiting it).

## Output, exactly

```ts
{ id, pubkey, created_at, kind, tags, content, sig }
```

No secret Handle, no `npub` (a separate, distinct encoding this
authority does not produce — a caller needing `npub` derives it from
`pubkey` via the existing `nostr_identifier_encoding` path,
out of scope here), no Relay metadata, no Outbox identifier.

## Rust-side production

`nostr_event_encoding::serialize_signed_nostr_event_internal` (`lib.rs`,
inside `mod master_root`) assembles this exact shape, field order
matching `FedosNostrWireEvent` byte-for-byte — `id`/`sig` hex-encoded
(lowercase, via a crate-internal `encode_lowercase_hex_internal`, the
SAME algorithm `nostr_identifier_encoding::hex_encoding::encode_lowercase_hex_32`
already implements, reimplemented here only because Rust module
privacy does not let this function reach that sibling module's own
`pub(super)`-scoped helper). `sign_nostr_event_output_matches_the_seven_field_nip01_wire_shape`
verifies all seven keys are present with correct types/lengths (`id`/
`pubkey` 64 hex chars, `sig` 128 hex chars).

## TypeScript-side parsing

`parseSignedNostrWireEventJson()`
(`src/nostr/sign/fedos_wasm_nostr_signing_authority.ts`) parses the
JSON string Rust returns and re-validates its shape before constructing
a deep-frozen `FedosNostrWireEvent` — this is the signing authority's
OWN output (a trusted source, not untrusted network input, unlike
`parseRelayInboundMessage`'s own job), but still fails closed (`null`,
never throws) on any unexpected shape, since a WASM boundary crossing
should never be trusted blindly even when the producer is this same
codebase's own Rust.
