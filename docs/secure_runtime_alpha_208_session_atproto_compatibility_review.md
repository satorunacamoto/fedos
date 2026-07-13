# Secure Runtime Alpha 208 — Future Session/ATProto Compatibility Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 8 of the Alpha 201–210 Nostr Event Runtime Exposure Arc,
following Alpha 207's own Relay Compatibility Review.**

## 1. Why now

This Arc's own Alpha 208 instruction states plainly: "Review future
Session/ATProto compatibility. No Nostr-specific assumptions leak into
Runtime." Alpha 199 already ran this exact review at the Rust layer,
for `FedosNostrEventHandle` itself, and concluded Session/ATProto
share no NIP-01-shaped "event." This Stage runs the SAME review one
layer higher, at the NEW Desktop-facing TypeScript boundary
(`FedosEventReader`/`FedosEventDescriptor`, Alpha 202) this Arc adds —
since that boundary's own field names, not just the Rust Handle's
internal shape, are what a future Session/ATProto Stage would actually
see and could be tempted to reuse.

## 2. `FedosEventDescriptor`'s own field names, checked against
   Nostr-specific vocabulary

| Field | Nostr wire name it replaces | Why the replacement is protocol-neutral |
|---|---|---|
| `id` | `id` | Already generic — any content-addressed or otherwise-identified record has an `id`. |
| `provider` | *(none — new)* | Names the ORIGINATING protocol as DATA, mirroring `FedosIdentityDescriptor.provider` (Alpha 028/045) exactly — never a fixed Nostr-only union. |
| `author` | `pubkey` | `pubkey` names a Nostr-specific key ENCODING; `author` names a ROLE any protocol's event/record/message has, matching `FedosIdentityDescriptor.publicIdentifier`'s own "encoding-neutral" discipline (never `npub`). |
| `createdAt` | `created_at` | camelCase, TypeScript-idiomatic; the underlying concept (a timestamp) is universal, not Nostr-specific. |
| `kind` | `kind` | A numeric type/category code is a common pattern (Nostr's own NIP-01 `kind`, but also generic "record type" fields elsewhere) — Alpha 199 §3 already warned sharing a NAME is not sharing a TYPE; this Stage does not claim `kind` unifies anything, only that the WORD is not Nostr-exclusive. |
| `tags` | `tags` | "Array of arrays of strings" is a Nostr-specific STRUCTURE (Alpha 191 §5), but the WORD "tags" (arbitrary key/value-ish metadata) is common across many record formats. |
| `content` | `content` | Universal — "the payload" — not Nostr-specific in any sense. |
| `signature` | `sig` | `sig` is Nostr's own field name; `signature` is the generic term any signed artifact uses. |

**Conclusion: no field name on `FedosEventDescriptor` is Nostr-EXCLUSIVE
vocabulary** (unlike, say, `npub` or `nsec`, which name Nostr's own
Bech32 encoding specifically) — though `kind`/`tags` inherit Nostr's
own STRUCTURAL shape (a numeric code; a nested string-array list) even
under a shared name, exactly the "same word, different structure"
risk Alpha 199 §3 already flagged for `FedosNostrEventHandle` one
layer down.

## 3. Would Session or ATProto reuse `FedosEventDescriptor`/`FedosEventReader`
   as-is? Reviewed, not assumed

Restating Alpha 199 §2's own per-protocol findings, now checked
against THIS Arc's own TypeScript shapes specifically:

- **Session** has no NIP-01-shaped concept at all (Alpha 199 §2) — its
  own unit of exchange, an encrypted MESSAGE, has no `kind`/`tags`
  five-tuple to map onto `FedosEventDescriptor`'s eight fields, and no
  `author`-then-broadcast model `readEvents()`'s own "enumerate
  already-finalized items" shape assumes.
- **ATProto** has a structurally different REPOSITORY RECORD, addressed
  by a CID over CBOR-encoded data (Alpha 199 §2), not a JSON five-field
  pre-image hashed with sha256 — an ATProto record reader would need
  its OWN descriptor shape (a Lexicon-schema-driven field set, a CID
  rather than a sha256 `id`), not `FedosEventDescriptor`'s fixed eight
  fields.
- **Wallet** has no publish-shaped "event" concept in this crate's own
  scope at all (Alpha 199 §2) — nothing to compare.

**None of the three would reuse `FedosEventReader`/`FedosEventDescriptor`
as-is**, for the SAME reason Alpha 199 §3 already gave for the Rust
Handle: sharing the WORD "Event" (or, here, "Descriptor"/"Reader")
never implies sharing a TYPE.

## 4. What generalizes — the PATTERN, confirmed unchanged from Alpha
   199 §4, now demonstrated at the Desktop Reader layer

**A protocol-owns-construction, Desktop-only-consumes read boundary
(Alpha 204), returning immutable, `readonly`-fielded public data
(Alpha 205), via a single no-argument `Promise`-returning method
(Alpha 207 §2).** A future Session/ATProto Reader would inherit this
exact SHAPE (mirroring `FedosPublicIdentityReader`'s own
already-proven reuse across `NostrPublicIdentityReader`, and a
hypothetical future non-Nostr identity source) while supplying its OWN
Descriptor type with its OWN field set — never `FedosEventDescriptor`
itself, extended or reused.

## 5. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** add a `Session`/`ATProto`/`Wallet` event, message, or
  record reader type of any kind.
- Does **not** rename any `FedosEventDescriptor` field to further
  generalize `kind`/`tags` — this Stage's own finding is that the
  CURRENT names are acceptable, not that further change is needed.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, `src/nostr/*`,
  Storage, Observation, `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_207_relay_compatibility_review.md`
- `docs/secure_runtime_alpha_199_event_protocol_extensibility_review.md`
- `docs/secure_runtime_alpha_188_session_atproto_signing_extensibility_review.md`
- `docs/secure_runtime_alpha_179_nostr_identifier_protocol_extensibility_review.md`
- `docs/secure_runtime_alpha_045_fedos_identity_descriptor_expansion.md`
