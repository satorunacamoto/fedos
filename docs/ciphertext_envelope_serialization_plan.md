# Ciphertext Envelope Serialization Plan (Stage 177, updated Stage 182) — binding, docs only

**Status: this document adds no code. The MVP encoding this document
originally left open is now DECIDED — see §9 and
`docs/ciphertext_serialization_format_decision.md` (Stage 182).** This
document still fixes, in writing, the field list a future ciphertext WIRE
format would need, compares candidate encodings, and fixes the SELECTION
CRITERIA a future stage must satisfy — §9 below records which candidate
was picked and why, without adding any implementation itself. This is the
same "fix the shape before
the implementation" discipline `docs/ciphertext_envelope_plan.md` used for
`AeadCiphertextEnvelope`'s field list before Stage 157–158 implemented it,
and `docs/secret_handle_api_shape.md` used for `SecretHandle` before Stage
144–146. Nothing under `src/`, `packages/`, `Cargo.toml`, or `test/` is
changed by this document beyond the crate-private, unconnected
`crypto::ciphertext_transport` label skeleton
(`packages/fedos-core-rust/src/crypto/ciphertext_transport.rs`, Stage
177–178) — no serialization function, no JSON/base64/CBOR/binary codec,
and no encoding decision exists anywhere in this crate as of this stage.

This complements, and does not renegotiate, `docs/ciphertext_envelope_plan.md`
(the six in-memory fields this document's wire-format field list is built
from), `docs/public_crypto_opaque_handles.md` (the opaque
`FedosCiphertextEnvelope` type this future wire format would eventually
serialize/deserialize, on the far side of the opaque boundary — not
inside it), and `docs/encrypted_payload_storage_boundary.md` (Stage
177–180, what a serialized envelope would be handed to once this format
exists). Where this document and any of those disagree, the earlier
binding docs win.

---

## 1. Purpose

- **Fix the WIRE-FORMAT field list** a future serialization stage must
  satisfy — extending `docs/ciphertext_envelope_plan.md` §3's in-memory
  field list with the encoding-specific concerns (byte order, length
  framing, forward-compatibility) a wire format adds on top.
- **Compare candidate encodings** (JSON, base64, CBOR, raw binary) against
  fixed selection criteria, without picking one.
- **Fix the selection criteria** an implementing stage must weigh, so that
  future MVP-encoding decision is reviewed against a written rubric rather
  than an ad hoc preference.
- **Not an implementation.** No `serde` derive, no `Serialize`/
  `Deserialize` impl, no `base64`/`CBOR` crate dependency, no binary
  layout code, no `Cargo.toml` change.

## 2. Scope: what this format carries, and what it explicitly excludes

### 2.1 Fields carried (from `docs/ciphertext_envelope_plan.md` §3, §8)

| Field | Type today (in-memory) | Wire-format concern this stage adds |
|---|---|---|
| `version` | `AeadEnvelopeVersion` (`V1` only) | MUST be the first bytes decoded, and MUST cause an immediate, clean rejection if unrecognized — before any other field is even framed, let alone parsed. |
| `algorithm` | `AeadEnvelopeAlgorithm` (`ChaCha20Poly1305` / `Aes256Gcm`) | A small fixed enum tag — 1 byte is sufficient for the two variants that exist today; the wire representation must leave room for a future third variant without a version bump if that is ever desired (an implementing-stage decision, not fixed here). |
| `nonce` | `[u8; 12]` | Fixed-width — no length prefix needed, unlike `ciphertext`. Not secret (`docs/nonce_generation_policy.md` §9), so no special handling beyond "carry it verbatim." |
| `ciphertext` (+ `tag`, concatenated per §8's Stage 161 resolution) | `Vec<u8>`, variable length | MUST be length-prefixed or otherwise unambiguously framed — this is the one field whose size is not fixed by the format itself. |
| `aad` domain label | `AeadEnvelopeAadDomain` (`RootKey`/`Identity`/`Storage`/`Conversation`/`TestOnly`) | A small fixed enum tag, same shape as `algorithm`. **Carried as a LABEL, never as the actual AAD bytes** — `docs/aead_internal_implementation.md` fixes AAD as a compile-time `&'static [u8]` constant per domain, so the wire format only needs to name WHICH domain, never transmit AAD bytes themselves. |

### 2.2 Fields explicitly EXCLUDED from this format (binding exclusions)

- **No raw secret of any kind.** No key byte, no `SecretHandle` payload,
  no seed, no password. The AEAD key is never part of a ciphertext
  envelope's own wire representation — a decrypting party must already
  possess the correct key out-of-band (exactly how AEAD envelopes work
  today in-memory; this format changes nothing about that).
- **No key identifier / key ID field.** Whether a future format needs a
  "which key was this sealed under" reference (a key ID, a fingerprint, a
  `FedosAeadKeyHandle`-adjacent opaque reference) is explicitly OUT OF
  SCOPE for this stage — naming one now would be guessing at a key
  management design (rotation, multi-recipient, per-conversation keys)
  that has not been reviewed yet. A future stage adds this field only via
  its own explicit review, the same "extend, never silently" discipline
  `docs/ciphertext_envelope_plan.md` §1 already established for its own
  field list.
- **No buyer/payment/entitlement metadata of any kind.** No price, no
  product ID, no purchase/subscription/entitlement reference, no buyer or
  seller identifier. A ciphertext envelope's wire format is a
  cryptographic transport concern ONLY — commerce-layer metadata belongs
  to whatever calling code constructs a payload around this format (if
  ever), never inside the format itself. Mixing the two would make this
  format's own security review (a small, auditable byte layout) impossible
  to reason about independently of an unrelated commerce data model.
- **No plaintext.** Obviously — but stated explicitly since a wire format
  spec is exactly the kind of document a future stage might be tempted to
  extend with a "plaintext preview" or "content-type hint" field. Neither
  exists here, and neither should exist in any future implementing stage
  without its own separate, explicit review (a content-type hint in
  particular is a classic side-channel: it leaks structure about
  otherwise-opaque ciphertext).
- **No Runtime/Worker/Storage/Nostr/NIP-44/WASM connection or reference of
  any kind.** This is a byte-layout question, independent of any
  transport or storage integration — see
  `docs/encrypted_payload_storage_boundary.md` for that separate, later
  concern.

## 3. Candidate encodings, compared

Four candidates, evaluated against the criteria fixed in §4. This is a
comparison, not a ranking — no candidate is recommended as the MVP here.

| Encoding | Description | Size overhead | Human-readability | Implementation cost | Ecosystem fit |
|---|---|---|---|---|---|
| **JSON** | Field names + base64/hex-encoded byte fields, in a JSON object | Highest — field names repeated per envelope, plus ~33% base64 inflation per byte field | Highest — directly inspectable in logs/devtools without a decoder | Low — `serde_json` is already a dev-dependency (RFC test-vector parsing); promoting it to a production dependency is a `Cargo.toml` change this stage does NOT make | Best fit if this format is ever expected to cross a JS/TS boundary as plain text (e.g. embedded in a Nostr event's `content` field, which is itself a string) |
| **base64 (raw, no JSON wrapper)** | The envelope's fixed-order fields concatenated as raw bytes, then base64-encoded as a single opaque string | Fixed ~33% inflation, no per-field name repetition | Low — a human sees only an opaque string, but it is still `Vec<u8>`-safe to embed anywhere text is expected | Low-to-medium — needs a binary framing layer (see "raw binary" below) UNDER the base64 layer, so this is really "binary framing + a base64 presentation layer," not a standalone alternative to binary | Same Nostr-`content`-string motivation as JSON, without JSON's field-name/structure overhead |
| **CBOR** | A binary, self-describing, length-prefixed format (RFC 8949) — the "binary JSON" | Lower than JSON (no repeated field names if using array-not-map encoding; binary length prefixes instead of quoted strings) | Low — requires a CBOR decoder to inspect | Medium — no CBOR crate is currently a dependency of this crate; adopting one would be a `Cargo.toml` change this stage does NOT make, and would need its own dependency-adoption review per `docs/rust_dependency_adoption.md` | Reasonable fit if this format is expected to cross into a binary storage backend (a KV store, a file) rather than a text-only transport |
| **Raw binary (fixed-offset or TLV)** | Hand-rolled byte layout: e.g. `[version: 1 byte][algorithm: 1 byte][aad_domain: 1 byte][nonce: 12 bytes][ciphertext_len: 4 bytes (or varint)][ciphertext: N bytes]` | Lowest — no encoding inflation at all, no repeated structure | Lowest — completely opaque without this crate's own decoder | Highest implementation/review cost — every byte offset, every length-prefix width, and every endianness choice must be hand-specified and hand-tested (no existing dependency does this work); highest risk of a parsing bug (buffer over-read, integer overflow on a length prefix) if done carelessly | Best fit for a storage backend that already treats values as opaque `Vec<u8>`/`Uint8Array` (no string-safety requirement), and the only option with zero new dependency |

## 4. Selection criteria (fixed; the MVP decision itself is NOT made here)

A future implementing stage (Stage 182 candidate: "Ciphertext envelope
serialization format decision") MUST weigh its choice against ALL of the
following, and document which it prioritized where they conflict:

1. **No new dependency without its own adoption review.** Per
   `docs/rust_dependency_adoption.md`: if the chosen encoding requires a
   crate not already a PRODUCTION dependency of this crate (`serde`/
   `serde_json` are currently `[dev-dependencies]` only, used for RFC
   test-vector parsing — promoting either to `[dependencies]`, or adding a
   CBOR crate, is its own reviewed `Cargo.toml` change, not a side effect
   of this decision), that adoption is reviewed on its own terms first.
2. **Round-trip correctness is provable before shipping.** Whatever is
   chosen must have a `cargo test` known-answer round-trip suite
   (encode → decode → byte-identical or field-identical to the original
   `AeadCiphertextEnvelope`) before any public API is authorized to
   produce or consume it — mirroring this crate's standing discipline of
   verifying every cryptographic primitive against known-answer vectors
   before connecting it to anything (RFC 8439, RFC 5869, RFC 9106, and
   this repository's own NIP-44 vectors all follow this pattern already).
3. **Version MUST be checked first, and rejection MUST be clean.** Per
   `docs/ciphertext_envelope_plan.md` §3's "version must be checked before
   any other field is interpreted" rule — an unrecognized version byte
   must produce a fixed error label, never a panic, never a best-effort
   parse of the remaining bytes under a wrong assumption.
4. **No ambiguous length framing.** The `ciphertext` field's length MUST
   be unambiguous from the encoding itself (a length prefix, a
   self-describing format's own framing, or a text encoding's own
   delimiter rules) — never inferred by "read until end of buffer," which
   breaks the moment this format is ever embedded inside a larger
   structure (e.g. as one field of a future Nostr event's `content`).
5. **Text-safety is a REQUIREMENT, not a preference, if Nostr transport is
   ever a consumer.** Nostr events' `content` field is a JSON string — any
   encoding destined for that path MUST already be (or be wrapped in) a
   text-safe representation (base64, hex, or JSON itself); raw binary
   cannot be embedded directly. This does not mean text-safety is required
   for EVERY use of this format (a storage backend may accept raw bytes
   directly) — it means the implementing stage must decide per §5 below
   whether one format serves both consumers, or whether the format
   differs by destination.
6. **No side-channel field.** No "content-type hint," no plaintext length
   (ciphertext length reveals plaintext length up to the fixed AEAD tag
   overhead already, which is an accepted, unavoidable AEAD property — an
   ADDITIONAL, separate plaintext-length or content-type field would leak
   more than the ciphertext length already does, and must not be added).
7. **Minimal surface, reviewed once.** Whatever is chosen becomes this
   crate's ONE ciphertext wire format — this document does not anticipate
   multiple simultaneous formats (e.g. "JSON for Nostr, binary for
   storage") as a default assumption; if the implementing stage decides
   two formats are genuinely needed, that is its own explicit,
   individually-reviewed decision, not an assumed outcome of this plan.

## 5. Open questions for the implementing stage (explicitly NOT fixed here)

- **Which single encoding (or, if justified, which small set) is the
  MVP?** Not decided — see Stage 182 candidate below.
- **Does the format need a checksum/integrity field of its own?** The
  AEAD tag (already part of `ciphertext‖tag` per this crate's convention)
  already provides authenticity/integrity for the PLAINTEXT+AAD; whether
  the ENVELOPE's own framing (version/algorithm/aad_domain/nonce/length
  prefix) needs a separate integrity check against transport-layer
  corruption (as opposed to malicious tampering, which the AEAD tag
  already catches once decrypted) is not decided here.
- **Fixed-width vs. varint length prefix for `ciphertext`?** Not decided.
- **Does a key-identifier field get added eventually, and if so, in what
  shape?** Explicitly deferred per §2.2 — this is a key-management design
  question, not a serialization-format one, and deserves its own stage.
- **Whether `CiphertextTransportKind` (Stage 177–178's
  `crypto::ciphertext_transport` skeleton — `Storage` vs. `NostrEvent`)
  ends up selecting a DIFFERENT encoding per destination, or whether one
  encoding serves both.** Not decided — `crypto::ciphertext_transport`
  intentionally only NAMES the destination today (`encoding` stays
  `Undecided` regardless of `transport_kind`); connecting the two is a
  future, separate, explicitly-reviewed bridge.

## 6. NIP-44 is out of scope, explicitly (again)

This plan is for THIS crate's OWN ciphertext envelope format
(`AeadCiphertextEnvelope`, sealed via `crypto::aead_internal`) — it is NOT
a NIP-44 payload format. NIP-44 defines its OWN versioned, padded payload
encoding (see `docs/nip44_internal_plan.md`, Stage 177 companion
document), independent of this crate's envelope. Whether a future stage
reuses any encoding choice made here for NIP-44's own payload framing is
that future stage's own decision, not assumed by this document.

## 7. What this stage DOES build (Stage 177–178)

- **`packages/fedos-core-rust/src/crypto/ciphertext_transport.rs` (new)**:
  a crate-private, LABEL-ONLY `CiphertextTransportDescriptor` naming
  `version` (`V1` only), `algorithm` (mirrors `AeadCipher`'s two variants,
  as its own separate type), `encoding` (`Undecided` — the ONE variant
  this stage's `CiphertextEncodingPlaceholder` has, directly recording
  that §4/§5's decision is not made), `transport_kind` (`Storage` /
  `NostrEvent` — naming a FUTURE destination, connecting to neither), and
  `status` (`Unavailable` — no real transport wiring exists). This type
  holds NO ciphertext, NO nonce, and NO key — see this module's own
  doc comment for the full design.
- **No bridge** connects `CiphertextTransportDescriptor` to
  `AeadCiphertextEnvelope`, `FedosCiphertextEnvelope`, or any real
  seal/open call. This is a pure classification-label skeleton, matching
  every other unconnected skeleton this crate has shipped since Stage 79.

## 8. Conclusion

- **Wire-format field list fixed** (§2.1), extending
  `docs/ciphertext_envelope_plan.md`'s in-memory field list with
  encoding-specific framing concerns.
- **Four candidate encodings compared** (§3): JSON, base64, CBOR, raw
  binary — none chosen.
- **Seven selection criteria fixed** (§4) for whichever future stage picks
  one.
- **Raw secret, key ID, and buyer/payment/entitlement metadata are all
  explicitly EXCLUDED** from this format, permanently, unless a future
  stage explicitly reviews adding a key-ID field (§2.2) — commerce
  metadata is excluded with no such reconsideration path named, since it
  never belongs in a cryptographic transport format.
- **`crypto::ciphertext_transport`** (this stage's only code change) adds
  a crate-private, unconnected, label-only descriptor — no serialization,
  no public API, no `Cargo.toml` change.
- **The actual encoding decision is Stage 182 candidate work**
  ("Ciphertext envelope serialization format decision"), not made here.

## 9. Stage 182 update — the MVP encoding is now DECIDED

`docs/ciphertext_serialization_format_decision.md` (Stage 182) picks
**canonical JSON + base64url fields** as the MVP encoding, weighed
explicitly against this document's own §4 selection criteria, and fixes
the canonical field order (`v`/`alg`/`aad`/`n`/`ct`/`tag`) an implementing
stage must produce. This is a DECISION, still not an implementation — no
encode/decode function, no `serde_json` promotion to `[dependencies]`, no
base64url-encoding dependency, and no `Cargo.toml` change exist anywhere
in this crate as of Stage 182. See that document for the full reasoning
and the exclusions (still no key ID, no secret, no buyer/payment/
entitlement metadata) it restates unchanged from this document's own §2.2.

`crypto::ciphertext_transport::CiphertextEncodingPlaceholder` gains one
additive label, `CanonicalJsonBase64UrlPlaceholder`, alongside its
original `Undecided` variant — recording the decision, not implementing
it. See that module's own doc comment for the exact record.

The actual Rust implementation (encode/decode functions, the dependency
adoption this decision explicitly does not authorize, and a round-trip
`cargo test` suite) remains Stage 186 candidate work ("Ciphertext
serialization implementation in Rust"), not built here either.
