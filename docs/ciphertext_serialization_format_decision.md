# Ciphertext Serialization Format Decision (Stage 182, implemented Stage 186) — binding, docs only

**Status: this decision is now IMPLEMENTED — see §8.** This document
picks the MVP wire encoding `docs/ciphertext_envelope_serialization_plan.md`
(Stage 179) compared but deliberately did not choose, fixes the canonical
field order an implementing stage must produce, and restates what that
implementation was (at Stage 182) still forbidden from doing. As of
Stage 182 itself: **no encode/decode function, no `serde` derive, no
base64 crate, and no `Cargo.toml` change exists anywhere in this
crate** — `crypto::ciphertext_transport`
(Stage 177–178) records this decision as an updated LABEL only (see §6),
never as running code.

This complements, and does not renegotiate,
`docs/ciphertext_envelope_serialization_plan.md` (§3's encoding
comparison and §4's selection criteria, which this decision is weighed
against below), `docs/ciphertext_envelope_plan.md` (the six in-memory
fields this canonical order serializes), and
`docs/encrypted_payload_storage_boundary.md` (what a serialized payload
following this format would eventually be allowed to cross into). Where
this document and any of those disagree, the earlier binding docs win.

---

## 1. The decision

**MVP format: canonical JSON, with the three variable/fixed-length byte
fields (`aad`... see §3 — actually `n`/`ct`/`tag`) base64url-encoded as
JSON string values.** Referred to throughout this crate's docs as
"canonical JSON + base64url fields."

This is a DECISION for the MVP only — not a claim that this is the best
possible format forever, and not a foreclosure on `docs/
ciphertext_envelope_serialization_plan.md` §5's still-open question of
whether NIP-44/Nostr transport eventually needs (or already fixes, per
spec) a different encoding for ITS OWN payload (see that plan's §6 and
`docs/nip44_internal_plan.md` §6 — NIP-44's own base64 payload framing is
a SEPARATE, upstream-spec-fixed format, unaffected by this decision).

## 2. Why canonical JSON + base64url (weighed against §4's criteria)

Restating `docs/ciphertext_envelope_serialization_plan.md` §4's seven
selection criteria and how this choice satisfies each:

1. **No new dependency without its own adoption review.** `serde_json` is
   currently a `[dev-dependencies]`-only crate (RFC test-vector parsing).
   Choosing JSON here does NOT itself promote it to `[dependencies]` —
   that promotion, and any base64url-encoding dependency adoption (or a
   hand-rolled implementation, an implementing stage's own choice), is
   this decision's OWN named follow-up (Stage 186 candidate: "Ciphertext
   serialization implementation in Rust"), reviewed separately when it
   happens. **This document authorizes NEITHER change — it only names
   which format an eventual implementation must produce.**
2. **Round-trip correctness provable before shipping.** JSON's
   self-describing, field-named structure makes a known-answer round-trip
   test suite (encode → decode → field-identical) straightforward to
   write and straightforward to review — no hand-rolled offset arithmetic
   to get subtly wrong, unlike raw binary.
3. **Version checked first, clean rejection.** A JSON object's `"v"` key
   can be read and validated before any other field is even attempted —
   satisfied trivially by construction; an implementing stage still must
   verify with `validate_envelope_internal`-style structural checks
   (`docs/ciphertext_envelope_plan.md`), not assume JSON parsing alone
   proves validity.
4. **No ambiguous length framing.** JSON strings are self-delimiting
   (quote-terminated); base64url's own alphabet/padding rules make the
   byte-field boundaries unambiguous within each string. No separate
   length prefix is needed for `n`/`ct`/`tag` individually — JSON's own
   structure already frames them.
5. **Text-safety, if Nostr transport is ever a consumer.** This is the
   DECIDING factor: canonical JSON + base64url is text-safe by
   construction, satisfying `docs/ciphertext_envelope_serialization_plan.md`
   §4 criterion 5 outright — a Nostr event's `content` field is itself a
   JSON string, and while THIS crate's own envelope format is NOT NIP-44's
   payload format (§1 above, and that plan's §6), a text-safe MVP means
   this crate's OWN envelope, if ever embedded in ANY text-only transport
   (Nostr `content`, an HTTP JSON body, a log line, a diagnostics dump),
   needs no additional wrapping layer. Raw binary or CBOR would need a
   base64 wrapping step added on top regardless — JSON + base64url gets
   text-safety and human-inspectability in the SAME step.
6. **No side-channel field.** The canonical field list (§3) adds nothing
   beyond what `docs/ciphertext_envelope_plan.md` §3 already named — no
   content-type hint, no plaintext-length field.
7. **Minimal surface, reviewed once.** This decision names ONE format for
   this crate's own envelope. It does not also decide a second format for
   a different destination — `docs/ciphertext_envelope_serialization_plan.md`
   §4 criterion 7's "two formats only if explicitly justified" bar is
   left exactly where that document set it; this decision does not meet
   or attempt to meet that bar for a second format.

**Cost accepted, explicitly**: per
`docs/ciphertext_envelope_serialization_plan.md` §3's own comparison
table, JSON has the HIGHEST size overhead of the four candidates (field
names repeated per envelope, ~33% base64 inflation per byte field). This
is accepted for the MVP because human-inspectability and zero-additional-
text-wrapping outweigh size for a first, reviewable implementation —
`docs/ciphertext_envelope_serialization_plan.md` §4 criterion 7 already
anticipated a future stage MAY add a second, size-optimized format (CBOR
or raw binary, e.g. for a storage backend that never needs text-safety) IF
that need is explicitly justified later; this decision does not rule that
out, it simply does not build it now.

## 3. Canonical field order (fixed)

A future implementing stage MUST produce (and MUST accept, for
decoding) exactly this JSON object shape, in exactly this key order,
whenever it serializes a `AeadCiphertextEnvelope`:

| Key | Source field (`docs/ciphertext_envelope_plan.md` §3 / §8) | JSON type | Encoding |
|---|---|---|---|
| `v` | `version` (`AeadEnvelopeVersion`) | number or short string | The version's fixed wire TAG (e.g. `1` for `V1`) — never the Rust enum's debug name. |
| `alg` | `algorithm` (`AeadEnvelopeAlgorithm`) | string | A fixed, short label per variant (e.g. `"chacha20poly1305"` / `"aes256gcm"`) — an implementing stage picks the exact strings and documents them as its own reviewed choice; not fixed further here. |
| `aad` | `aad_domain` (`AeadEnvelopeAadDomain`) | string | A fixed, short label per variant (e.g. `"root_key"` / `"identity"` / `"storage"` / `"conversation"` / `"test_only"`) — same as `alg`, exact strings are the implementing stage's own choice. **This is the AAD DOMAIN LABEL, never the actual AAD bytes** — restating `docs/ciphertext_envelope_serialization_plan.md` §2.1's identical rule. |
| `n` | `nonce` (`[u8; 12]`) | string | base64url, no padding (matching this crate's "fixed-width, not secret" nonce discipline — `docs/nonce_generation_policy.md` §9). |
| `ct` | `ciphertext` (`Vec<u8>`, the `ciphertext‖tag`-or-split question `docs/ciphertext_envelope_plan.md` §5/§8 already resolved as ONE combined field for this crate's in-memory type) | string | base64url, no padding. |
| `tag` | Present in this canonical order as its OWN key for wire-format clarity, even though the in-memory `AeadCiphertextEnvelope.ciphertext` field keeps `ciphertext‖tag` concatenated (§8's resolution, unchanged) | string | base64url, no padding. **An implementing stage decides whether to physically split the concatenated in-memory buffer into two wire keys (`ct`/`tag`) or keep one combined `ct` wire key** — this canonical ORDER fixes where `tag` would sit if split; it does not re-litigate `docs/ciphertext_envelope_plan.md` §8's in-memory combined-field decision. If an implementing stage keeps ONE combined wire field instead, `tag` is simply omitted from the produced JSON, and this document's field-order table degrades to `v`/`alg`/`aad`/`n`/`ct` — an implementing stage's own explicit choice, reviewed at that time. |

**Key order in the serialized JSON object MUST match this table's row
order** (`v`, `alg`, `aad`, `n`, `ct`, `tag`) — "canonical" means a
decoder can rely on a fixed, predictable shape for logging/diffing/
testing, even though JSON itself does not mandate key order at the parse
level. An implementing stage's own encoder is responsible for emitting
keys in this order; its own decoder must accept them in this order (and,
per §4 below, MAY reject an out-of-order document as malformed, or MAY
tolerate reordering — that leniency decision is the implementing stage's
own, not fixed here).

## 4. What this canonical order explicitly excludes

Restating and NOT relaxing
`docs/ciphertext_envelope_serialization_plan.md` §2.2's exclusions,
because a "pick a concrete format" stage is exactly the kind of moment a
future author might be tempted to add "just one more field":

- **No `kid`/key-id field.** Still explicitly deferred — naming one now
  would still be guessing at an unreviewed key-management design.
- **No secret, key byte, seed, or password field of any kind.**
- **No buyer/payment/entitlement metadata field of any kind** (price,
  product ID, purchase/subscription/entitlement reference, buyer/seller
  identifier).
- **No plaintext, content-type hint, or plaintext-length field beyond
  what `ct`'s own encoded length already unavoidably reveals.**
- **No chat/DM metadata** (sender/recipient display name, conversation
  title, read-receipt state) — this is this crate's OWN envelope format,
  not a chat feature's message envelope; see
  `docs/encrypted_payload_storage_boundary.md` §5 for the identical rule
  restated at the storage/federation boundary.

## 5. What this decision does NOT do

- **No encode function, no decode function, no `Serialize`/`Deserialize`
  derive or impl.** Zero lines of serialization code exist in this crate
  as of this stage.
- **No `Cargo.toml` change.** `serde_json` stays `[dev-dependencies]`-only;
  no base64url crate (e.g. a `base64`-family dependency) is added.
- **No round-trip test exists yet** — per §2 criterion 2, one is required
  BEFORE any public API produces/consumes this format, but writing it is
  the implementing stage's own job (Stage 186 candidate), not this
  decision's.
- **No public API change.** `fedos_encrypt`/`fedos_decrypt` are
  untouched; neither returns nor accepts this JSON shape.
- **No NIP-44 payload format change or reference** — NIP-44's own
  base64-wrapped payload (`docs/nip44_internal_plan.md` §6) is a
  completely separate, upstream-spec-fixed format; this decision governs
  ONLY this crate's own `AeadCiphertextEnvelope` wire shape.

## 6. What this stage DOES do: the transport descriptor's label updates

`crypto::ciphertext_transport::CiphertextEncodingPlaceholder` (Stage
177–178) gains a SECOND variant recording that this decision has been
made, replacing its previous permanent `Undecided`-only shape:

```rust
pub(crate) enum CiphertextEncodingPlaceholder {
    Undecided,
    CanonicalJsonBase64UrlPlaceholder,
}
```

`CanonicalJsonBase64UrlPlaceholder` is still a LABEL, not a codec —
`crypto::ciphertext_transport` gains no new method, no serialization
function, and no dependency on this document's field-order table being
implemented anywhere. The variant exists so a future descriptor CAN
record "this ciphertext is destined for the canonical-JSON+base64url
format, once that format is implemented" without inventing a new
placeholder ad hoc at implementation time. `Undecided` remains a valid
variant (a descriptor constructed before this decision, or one that
deliberately does not commit to the new format yet, may still use it) —
this is an ADDITIVE label change, not a replacement removing the old
variant. See `crypto::ciphertext_transport`'s own module-level doc
comment (updated this stage) for the exact record.

## 7. Conclusion

- **MVP format decided**: canonical JSON + base64url fields, weighed
  explicitly against `docs/ciphertext_envelope_serialization_plan.md`
  §4's seven criteria (§2 above).
- **Canonical field order fixed**: `v`, `alg`, `aad`, `n`, `ct`, `tag`
  (§3) — `kid`/secret/buyer-payment-entitlement/chat metadata all
  excluded, unchanged from `docs/ciphertext_envelope_serialization_plan.md`
  §2.2 (§4 above).
- **No implementation** — no encode/decode function, no dependency, no
  `Cargo.toml` change, no public API change (§5).
- **`crypto::ciphertext_transport`'s `CiphertextEncodingPlaceholder` gains
  one additive label**, `CanonicalJsonBase64UrlPlaceholder`, recording
  this decision without implementing it (§6).
- **The actual Rust implementation (encode/decode functions, the
  `serde_json`/base64url dependency promotion/adoption, and the
  round-trip `cargo test` suite) is Stage 186 candidate work**
  ("Ciphertext serialization implementation in Rust"), not built here.

## 8. Stage 186 update — IMPLEMENTED, with NO dependency promotion

`packages/fedos-core-rust/src/crypto/ciphertext_serialization.rs` (new)
implements `encode_envelope_internal`/`decode_envelope_internal` against
this exact decision — and resolves §7's open "`serde_json`/base64url
dependency promotion/adoption" question the OPPOSITE way from how it
reads: **no dependency was promoted or adopted.** `serde`/`serde_json`/
`hex` remain `[dev-dependencies]`-only, exactly as before Stage 186 —
`Cargo.toml` is byte-for-byte unchanged.

Both the canonical JSON emission and the base64url encoding/decoding are
hand-written against the standard library only, made tractable by this
format's CLOSED schema (a handful of fixed-label strings, one small
integer, and base64url text whose alphabet contains no `"`/`\` — see that
module's own doc comment for the full reasoning, including why this is
safe rather than merely convenient). This was a deliberate choice, not an
oversight: promoting `serde_json` to `[dependencies]` (or adding a
base64/base64url crate) remained an option this stage could have taken,
but the closed schema made a correct, narrowly-scoped hand implementation
straightforward enough that no new production dependency was needed —
consistent with this crate's standing "no new dependency without its own
adoption review" discipline (`docs/rust_dependency_adoption.md`), applied
here by simply not needing one.

**What shipped:**

- `encode_envelope_internal(envelope: &AeadCiphertextEnvelope) -> Option<String>`
  — emits the canonical `v`/`alg`/`aad`/`n`/`ct`/`tag` JSON object, no
  whitespace, splitting the in-memory combined `ciphertext‖tag` buffer at
  its final 16 bytes (both this crate's adopted AEAD ciphers' fixed tag
  length) into separate wire `ct`/`tag` fields. Returns `None` only for a
  Stage 157–158 SKELETON placeholder envelope (whose ciphertext is
  shorter than 16 bytes) — never panics.
- `decode_envelope_internal(json: &str) -> CiphertextSerializationDecision`
  — parses a candidate string back, requiring the canonical field order
  STRICTLY (§3's leniency question is resolved: reordering is rejected,
  not tolerated), and reconstructing the ONE combined `ciphertext‖tag`
  buffer the in-memory `AeadCiphertextEnvelope` type still expects (§3's
  in-memory-vs-wire split is confined entirely to this codec — the
  existing type is unchanged). Distinguishes `InvalidVersion`/
  `InvalidAlgorithm`/`InvalidAadDomain`/`InvalidBase64Url`/`MissingField`/
  `UnknownField`/`MalformedJson` — never panics.
- Both functions are `pub(crate)`-only and connect to the REAL
  `AeadCiphertextEnvelope` type (this stage's explicit authorization) —
  neither is wired to `fedos_encrypt`/`fedos_decrypt`,
  `aead_envelope_bridge`, or `ciphertext_transport` yet; that connection
  is its own, future, separate stage. No public API addition — the crate's
  `pub fn` surface stays at twenty-seven.
- **Round-trip, canonical-order, and every rejection case (`unknown
  field`, `missing field`, `invalid base64url`, `wrong version`, `wrong
  algorithm`, `wrong aad`, `reordered fields`) are all `cargo test`-verified**
  in that module's own test suite, for both adopted ciphers and every
  `AeadAadDomain` variant.

See `test/fedos_core_rust_ciphertext_serialization.test.ts` for the
dedicated JS guard suite proving this stays Rust-only (no TypeScript
`JSON.stringify`/parser was added to mirror it) and `Cargo.toml`/
`package.json` are both unchanged.
