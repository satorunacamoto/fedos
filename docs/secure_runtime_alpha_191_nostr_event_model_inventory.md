# Secure Runtime Alpha 191 — Nostr Event Model Inventory

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind — no `src/` file, no `packages/` file, is modified.
This is Stage 1 of the Alpha 191–200 Nostr Event Foundation Arc,
following the completed Nostr Schnorr Signing Foundation Arc (Alpha
181–190), which froze real, deterministic BIP-340 signing and
recommended this exact Arc — "Nostr Signature Encoding & Event
Assembly Boundary Review" — as its own next candidate.**

## 1. Why now

The Secret Key, Public Key, hex/npub encoding, and Schnorr Signature
foundations are complete and frozen. Alpha 187 §4 already named four
concrete gaps standing between that foundation and a real, signed
Nostr Event: a signature Encoder, event serialization, a field
assembly API, and eventually a Public Runtime API. This Stage
inventories the FIRST TWO of those (serialization, assembly) against
NIP-01 itself, and against the ALREADY-EXISTING TypeScript-side event
model, before this Arc implements anything.

## 2. NIP-01's own event shape and canonical serialization rule

A NIP-01 event has seven fields: `id`, `pubkey`, `created_at`, `kind`,
`tags`, `content`, `sig`. Of these, `id` and `sig` are COMPUTED, never
caller-supplied directly — `id` is the lowercase-hex sha256 of the
event's own canonical serialization, and `sig` is a BIP-340 Schnorr
signature over that `id` (Alpha 187 §2, already established this
Arc's own predecessor). The five REMAINING fields —
`pubkey`/`created_at`/`kind`/`tags`/`content` — are exactly this
crate's own TypeScript-side `EventCore` type (`src/nostr/types.ts`,
Alpha 1) already names as "the fields that participate in id
computation."

NIP-01's own canonical serialization rule, quoted precisely (not
paraphrased) from the spec itself:

> To prevent implementation differences from creating a different
> event ID for the same event, the following rules MUST be followed
> while serializing:
> - UTF-8 should be used for encoding.
> - Whitespace, line breaks or other unnecessary formatting should not
>   be included in the output JSON.
> - The following characters in the content field (and ONLY these)
>   must be escaped exactly as shown: line break (0x0A) as `\n`,
>   double quote (0x22) as `\"`, backslash (0x5C) as `\\`, carriage
>   return (0x0D) as `\r`, tab (0x09) as `\t`, backspace (0x08) as
>   `\b`, form feed (0x0C) as `\f`. No other character is escaped.

The pre-image itself is a fixed five-element JSON array:
`[0, <pubkey>, <created_at>, <kind>, <tags>, <content>]` — the literal
integer `0` is NIP-01's own fixed serialization-format version marker,
never anything else.

## 3. What already exists — TypeScript side, confirmed by direct
   inspection

`src/nostr/event.ts` already implements this exact algorithm:
`serializeForId(event: EventCore): string` builds the five-element
array via `JSON.stringify`; `computeEventId`/`verifyEventId` hash it
via an injected `Sha256Hex` function (`src/nostr/crypto.ts`) and
compare against a supplied `id`. This is READ/VERIFY-oriented — Alpha
1's own scope, confirmed unchanged (Alpha 175 §5, Alpha 190 §3, both
already recorded `computeEventId` as TypeScript-only and unrelated to
the Rust-side signing chain). Its own doc comment already flags a
real, DELIBERATE limitation for this Arc's own purposes: `JSON.stringify`'s
escaping "matches the spec for the common cases," but NIP-01's own
SIX-character escape list is narrower than what `JSON.stringify`
actually does (which additionally escapes every other C0 control
character as `\uXXXX`) — a divergence that is harmless for VERIFYING
an already-received event's `id` (verification only needs the SAME
serialization the ORIGINAL signer used, and any two conforming
serializers of the SAME input agree on all but this one edge), but
would be WRONG for an OUTBOUND signer, which must reproduce NIP-01's
own exact byte sequence so that OTHER clients' verifiers accept the
result. This crate's own new work (an outbound signer, connecting to
the just-completed Schnorr foundation) is exactly the direction that
edge case matters for — confirmed, not assumed, by re-reading
`serializeForId`'s own doc comment directly (§7 below).

## 4. What does NOT exist yet — Rust side, confirmed by direct
   inspection

- No canonical JSON serialization function of any kind exists in
  `packages/fedos-core-rust/src/lib.rs` — `nostr_identifier_encoding`
  (Alpha 173) hand-writes hex/Bech32, never JSON.
- No event-shaped type (`FedosNostrEventHandle` or otherwise) exists
  anywhere in `lib.rs`.
- No sha256-of-arbitrary-input function exists yet at the `master_root`
  level — `Sha256` is imported and used ONLY as `Hkdf::<Sha256>`'s own
  type parameter (Alpha 164) and inside `k256::schnorr`'s own internal
  tagged-hash implementation (Alpha 181, never called by this crate's
  own code directly) — never as a standalone `Sha256::digest(...)`
  call. `crypto::nip44_hmac` (Stage 231) already establishes the exact
  `use sha2::{Digest, Sha256}; Sha256::digest(bytes)` call shape this
  Arc reuses verbatim — confirmed by direct inspection, not assumed.
- `serde_json` remains a `[dev-dependencies]`-only entry (confirmed
  unchanged since Alpha 171 §2.2/§2.5) — no production JSON library
  exists or is proposed.

## 5. The minimal canonical event representation this Arc adopts

Following the SAME "hand-written, closed-input-shape codec, no new
Cargo dependency" precedent `nostr_identifier_encoding` (Alpha 173)
and `crypto::ciphertext_serialization`/`crypto::nip44_wire_encoding`
already established, this Arc's own `FedosNostrEventHandle` (Alpha
192) holds exactly the five `EventCore` fields, each represented by
the MOST DIRECT Rust type NIP-01 itself calls for — no field
invented, none omitted:

| NIP-01 field | Rust field type | Why this type |
|---|---|---|
| `pubkey` | `FedosNostrPublicKeyHex` (Alpha 173, REUSED, not re-derived) | Already the exact 64-char lowercase-hex value NIP-01's own `pubkey` field requires — computing it a second, independent way would risk disagreement with the existing, already-verified Encoder |
| `created_at` | `u64` | NIP-01 defines it as "a unix timestamp in seconds" — an unbounded non-negative integer; TypeScript's own `created_at: number` (`src/nostr/types.ts`) imposes no ceiling either, so this Arc does not invent one |
| `kind` | `u64` | NIP-01 defines `kind` as "an integer" with no fixed ceiling of its own — this Arc names no protocol-specific business rule that isn't in NIP-01 itself, matching TypeScript's own unbounded `kind: number` exactly; a narrower Rust integer type (e.g. `u16`) would silently assert a ceiling NIP-01 itself never states |
| `tags` | `Vec<Vec<String>>` | NIP-01: "an array of arrays of strings" — the direct Rust shape, matching TypeScript's own `NostrTag[]` (`string[][]`) exactly |
| `content` | `String` | NIP-01: "arbitrary string" — Rust's `String` already guarantees valid UTF-8, satisfying NIP-01's own UTF-8 requirement by construction, with no additional validation needed |

`id` and `sig` are deliberately NOT fields of `FedosNostrEventHandle`
itself — both are COMPUTED outputs (Alpha 194/195), never
caller-supplied input, matching NIP-01's own "these are derived, not
authored" semantics exactly, and keeping the Handle itself immutable
(Alpha 197 previews this — no field ever needs to change after
construction).

## 6. Answers to this Stage's own three required questions

1. **What is NIP-01's own event model?** Seven fields, five
   caller-authored (`pubkey`/`created_at`/`kind`/`tags`/`content`),
   two computed (`id`/`sig`) — confirmed against the spec text
   directly (§2).
2. **What already exists?** A read/verify-oriented TypeScript
   implementation (`serializeForId`/`computeEventId`/`verifyEventId`,
   Alpha 1) with a documented, acceptable-for-verification-only
   escaping divergence from strict NIP-01 (§3) — and nothing on the
   Rust side (§4).
3. **What is the minimal canonical representation Rust needs?** Five
   fields, one REUSED type (`FedosNostrPublicKeyHex`) and four direct
   NIP-01-native Rust types, with `id`/`sig` excluded as computed
   outputs (§5).

## 7. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** implement `FedosNostrEventHandle`, canonical
  serialization, Event ID generation, or signing — Alpha 192/193/194/195's
  own deliverables.
- Does **not** modify `src/nostr/event.ts`, `src/nostr/types.ts`, or
  `src/nostr/crypto.ts` — the TypeScript-side implementation remains
  exactly as-is; this Arc adds an independent Rust-side implementation
  for a different (outbound-signing) purpose, never a replacement.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, Storage, Observation,
  `Cargo.toml`, or `package.json`.

## 8. See also

- `docs/secure_runtime_alpha_190_schnorr_signing_foundation_completion.md`
- `docs/secure_runtime_alpha_187_event_builder_compatibility_review.md`
- `docs/secure_runtime_alpha_173_nostr_public_identifier_encoder.md`
- `src/nostr/event.ts`
