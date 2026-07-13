# Secure Runtime Alpha 199 — Nostr Event Protocol Extensibility Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 9 of the Alpha 191–200 Nostr Event Foundation Arc, following
Alpha 198's own Runtime Boundary Review.**

## 1. Why now

Alpha 179/188 already reviewed Identifier-layer and Signing-layer
extensibility against Session/ATProto/Wallet. This Stage runs the
SAME kind of review one layer higher — the EVENT layer — since an
"event" carries the most protocol-specific STRUCTURE of anything this
crate has built so far (a fixed field set, a fixed serialization
grammar, a fixed hash pre-image shape), making it the layer MOST at
risk of being mistaken for a generic "event model" a future Session/
ATProto/Wallet Stage could reuse as-is. This Arc's own instruction
names that risk explicitly: "Verify this foundation remains
Nostr-specific and cannot accidentally become a generic Event model."

## 2. Do Session, ATProto, or Wallet even have a NIP-01-shaped
   "event"? Reviewed, not assumed

- **Session** (the messenger protocol `HkdfDomain::Session` already
  reserves a domain for, Alpha 152) has no NIP-01-shaped concept at
  all — it is a double-ratchet-style messaging protocol whose own unit
  of exchange is an encrypted MESSAGE, not a signed, publicly
  broadcast, kind-tagged EVENT with a content-addressed id. There is
  no `pubkey`/`created_at`/`kind`/`tags`/`content` five-tuple to
  reuse, because Session's own protocol never defines one.
- **ATProto** (`HkdfDomain::ATProto`, Alpha 152) has its own, real,
  but STRUCTURALLY DIFFERENT concept — a repository RECORD, addressed
  by a CID (content identifier, computed over CBOR-encoded data, per
  the `multiformats`/IPLD conventions AT Protocol adopts), committed
  in bulk via a Merkle Search Tree, not individually sha256-hashed
  over a fixed five-element JSON array the way a Nostr event's own
  `id` is. Different serialization format (CBOR, not JSON), different
  hash construction (CID, not raw sha256 hex), different aggregation
  model (MST commit, not one signature per record).
- **Wallet** (`HkdfDomain::Wallet`, Alpha 152) has no publish-shaped
  "event" concept in scope for this crate at all — Wallet signing (a
  live future candidate, Alpha 188 §4) targets TRANSACTIONS, a
  different object family with its own serialization rules (varies by
  chain), not NIP-01 events.

**None of the three shares NIP-01's own exact shape.** This Stage's
own answer to "would Session/ATProto/Wallet reuse
`FedosNostrEventHandle`/`nostr_event_encoding` as-is" is therefore NO,
confirmed by reviewing each protocol's own actual data model rather
than assuming "event" names one universal concept.

## 3. Four explicit prohibitions, extended to the Event layer

Restating Alpha 175 §4/Alpha 179 §5/Alpha 188 §3's own established
pattern, now for Events specifically:

- **`FedosNostrEventHandle` must NEVER be repurposed for a Session
  message, an ATProto record, or a Wallet transaction.** None of the
  three shares this type's own exact five-field shape
  (`pubkey`/`created_at`/`kind`/`tags`/`content`, Alpha 191 §5) with
  the SAME semantics — a future Session message has no `kind` or
  `tags` concept at all; an ATProto record's own field set is defined
  by its own Lexicon schema, per-collection, never NIP-01's fixed
  five; a Wallet transaction's own fields are chain-specific. Sharing
  a TYPE NAME pattern ("it's an Event") is never sufficient reason to
  share a Rust type.
- **`nostr_event_encoding`'s own serialization functions must NEVER be
  generalized into a cross-protocol event/record codec.** NIP-01's own
  SIX-character escape rule and fixed `[0,...]` array shape (Alpha
  193 §3) are Nostr-specific by construction — a future ATProto Stage
  needing CBOR encoding, or a future Session Stage needing its own
  wire format, defines its OWN codec, even though the underlying
  PROCESS (canonicalize, then hash) may look structurally similar.
- **`sign_nostr_event_internal` must NEVER be assumed to work for
  Session/ATProto/Wallet signing, even though it reuses the EXISTING
  Schnorr foundation.** Alpha 188 §2 already established Session uses
  Ed25519 and ATProto uses ECDSA — neither BIP-340 Schnorr — so a
  hypothetical `sign_session_message_internal`/`sign_atproto_record_internal`
  would need its OWN signing call, not this function, even though BOTH
  would likely follow the SAME "derive an ID/CID, then sign it" shape
  this function itself demonstrates.
- **"It's an Event" is NEVER sufficient reason to unify event models
  across protocols.** The word "Event" names a ROLE (something that
  gets a deterministic id and gets signed) — Nostr's own NIP-01
  event, a future Session message, and a future ATProto record may all
  fill that role while remaining structurally incompatible, exactly as
  Alpha 175 §4 already established for identifiers one layer down, and
  Alpha 188 §3 for signatures one layer further down still.

## 4. What generalizes — the PROCESS, confirmed unchanged from Alpha
   179 §6/Alpha 188 §4, now demonstrated at the Event layer

**Opaque, immutable input Handle (Alpha 192) → protocol-specific
canonical serialization (Alpha 193) → generic content hash over that
canonical form (Alpha 194, `sha256` — an algorithm, not a format) →
signing via the protocol's own existing Signature foundation (Alpha
195).** A future Session/ATProto/Wallet Stage inherits this exact
FOUR-STEP shape — it does not need to invent its own
Handle/canonicalize/hash/sign discipline from scratch — while
supplying its OWN field set, its OWN canonical encoding, and (per
Alpha 188 §4) its OWN signing call. `sha256` itself (Alpha 194's own
hash algorithm) is the ONE piece that could, in principle, be reused
verbatim by a future protocol needing a plain content hash — but even
there, WHAT gets hashed (the canonical pre-image shape) remains
entirely protocol-specific, so no shared "hash this object" function
is proposed or would be safe to build without its own review.

## 5. Structural confirmation (real inspection, this Stage)

- `HkdfDomain`'s ten variants and `SecretHandleKind`'s thirteen
  variants: both unchanged — this Stage adds neither.
- Zero reference to `Session`/`ATProto`/`Wallet`/`CBOR`/`CID` exists
  anywhere in `FedosNostrEventHandle`'s, `nostr_event_encoding`'s,
  `derive_nostr_event_id_internal`'s, or `sign_nostr_event_internal`'s
  own CODE (doc-comment mentions IN THIS STAGE'S OWN DESIGN DOC,
  reviewing the topic, are expected and excluded from this check — the
  check is against `lib.rs`, not this doc).
- `Cargo.toml`'s own dependency set: unchanged by this Arc — no CBOR
  library, no `multiformats`/IPLD crate, no second hash-construction
  library of any kind was added.

## 6. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** add a `Session`/`ATProto`/`Wallet` event, message, or
  record type of any kind.
- Does **not** add a CBOR, IPLD, or CID library to `Cargo.toml`.
- Does **not** implement any Session or ATProto event/record signing
  function of any kind.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, `src/nostr/*`,
  Storage, Observation, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_198_event_runtime_boundary_review.md`
- `docs/secure_runtime_alpha_193_canonical_event_serialization.md`
- `docs/secure_runtime_alpha_188_session_atproto_signing_extensibility_review.md`
- `docs/secure_runtime_alpha_179_nostr_identifier_protocol_extensibility_review.md`
