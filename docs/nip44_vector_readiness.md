# NIP-44 Vector Readiness Review (Stage 185) — binding, docs only

**Status: this document adds no code.** It confirms, in writing, that
`test-vectors/nip44/nip44-v2.json` (imported Stage 73) already exists,
records exactly what it contains, and fixes the ORDER a future NIP-44
implementation stage must follow — before any NIP-44 code, any
`cargo test` wiring of this file, or any secp256k1 dependency exists in
this crate. This is a READINESS review, not an implementation: it
confirms the inputs a future stage needs are already in place and
reviewed, the same role `docs/crypto_test_vectors.md` played for the
RFC 8439/5869/9106 vectors before Stage 74–147 wired each one.

This complements, and does not renegotiate, `docs/nip44_internal_plan.md`
(Stage 177–180 — the full NIP-44 v2 pipeline this readiness review's
ordering is built to implement, in the order fixed below), and
`docs/rust_dependency_adoption.md` (the review process the secp256k1
dependency named in §3 below must go through, on its own, separate
terms). Where this document and any of those disagree, the earlier
binding docs win.

---

## 1. Purpose

- **Confirm `test-vectors/nip44/nip44-v2.json` already exists and record
  its exact contents** — so a future implementing stage does not need to
  re-derive or re-verify its provenance from scratch.
- **Fix the IMPLEMENTATION ORDER** a future NIP-44 stage must follow —
  smallest, most independently-verifiable piece first, most
  integration-dependent piece last — so that stage has a reviewed
  sequence instead of an ad hoc one.
- **Not an implementation.** No NIP-44 code, no `cargo test` wiring of
  this vector file, no secp256k1 dependency, no `Cargo.toml` change.

## 2. What already exists (confirmed, unchanged by this review)

`test-vectors/nip44/nip44-v2.json` (imported Stage 73, per that file's own
`"source"`/`"revision"`/`"license"` provenance fields — verbatim from
`paulmillr/nip44`, byte-identical to upstream, confirmed via the SHA-256
match recorded inside the file itself) contains:

| Top-level field | Content |
|---|---|
| `algorithm` | `"NIP-44 v2 (Nostr versioned encrypted payloads: secp256k1 ECDH -> HKDF-SHA256 -> ChaCha20 + HMAC-SHA256, padded)"` — matches `docs/nip44_internal_plan.md` §2's description exactly. |
| `source` / `section` / `revision` / `license` | Upstream provenance (`nostr-protocol/nips` 44.md + the companion `paulmillr/nip44` vector file) — see that file's own fields for the full chain of custody; this review does not restate it beyond confirming it is present and internally consistent. |
| `vectors` | An array of **8 category entries**, each shaped `{ category, description, shouldPass, data }` — confirmed below. |

**The 8 categories, confirmed present:**

| # | `category` | `shouldPass` | Exercises (per `docs/nip44_internal_plan.md` section) |
|---|---|---|---|
| 1 | `valid.get_conversation_key` | `true` | §3 — ECDH + HKDF-extract, `sec1`/`pub2` → `conversation_key`. |
| 2 | `valid.get_message_keys` | `true` | §4 — HKDF-expand from `conversation_key` + a message nonce → `chacha_key`/`chacha_nonce`/`hmac_key`. |
| 3 | `valid.calc_padded_len` | `true` | §5 — the padding-length schedule, independent of any actual encryption. |
| 4 | `valid.encrypt_decrypt` | `true` | §5–§7 — full seal/open round trip for ordinary-length messages. |
| 5 | `valid.encrypt_decrypt_long_msg` | `true` | §5–§7 — the same round trip at the padding schedule's upper length range. |
| 6 | `invalid.encrypt_msg_lengths` | `false` | §5 — under-minimum/over-maximum plaintext length, must be REJECTED before encryption is attempted. |
| 7 | `invalid.get_conversation_key` | `false` | §3 — malformed/invalid `sec1`/`pub2` input, must be REJECTED with a fixed failure label, never a panic. |
| 8 | `invalid.decrypt` | `false` | §7 — tampered ciphertext/MAC/nonce/version, all collapsing to ONE fixed `AuthenticationFailed`-equivalent label, per `docs/nip44_internal_plan.md` §7's "single label, never distinguishing WHY" rule. |

**No vector category is missing** for the pipeline stages
`docs/nip44_internal_plan.md` names (§3 conversation key, §4 message
keys, §5 padding, §6 payload structure — implicitly exercised by
`encrypt_decrypt`/`encrypt_decrypt_long_msg` producing/consuming the full
wire payload, §7 MAC/failure labels) — this vector file is READY for a
future implementing stage to wire against, category by category.

## 3. Fixed implementation order (binding on the future implementing stage)

A future NIP-44 implementation stage MUST proceed in this exact order —
each step both delivers independently-verifiable value and de-risks the
step after it, so skipping ahead (e.g. writing the full encrypt/decrypt
path before a conversation-key test exists) would leave a failure
unattributable to whichever sub-step actually broke:

1. **Vector schema guard.** A `cargo test` (or an equivalent guard, e.g. a
   `#[cfg(test)]`-only JSON-shape check mirroring
   `rfc8439_vectors::rfc8439_json_parses_and_is_non_empty` and siblings,
   Stage 74/77/103) that ONLY confirms `test-vectors/nip44/nip44-v2.json`
   parses and its `vectors` array is non-empty with all 8 categories
   present (§2's table) — no cryptographic code runs yet. This is the
   SAME first-step discipline every prior vector file in this crate
   followed (RFC 8439 Stage 74, RFC 5869 Stage 77, RFC 9106 Stage 103) —
   confirm the fixture is readable before building anything against it.
2. **secp256k1 dependency adoption** (`docs/rust_dependency_adoption.md`'s
   own review process, on its own separate terms — NOT pre-authorized by
   this document) — needed before step 3 can do real ECDH. This crate has
   no secp256k1/ECDH primitive today; adopting one (e.g. a `secp256k1`- or
   `k256`-family crate) is its own `Cargo.toml` change, reviewed
   independently of this readiness review.
3. **Conversation-key test** (`docs/nip44_internal_plan.md` §3): implement
   ECDH + HKDF-extract, verify against `valid.get_conversation_key` AND
   `invalid.get_conversation_key` (§2 table rows 1 and 7) — the smallest,
   most independently-testable unit, and the one every later step depends
   on.
4. **Message-key test** (§4): implement the per-message HKDF-expand step,
   verify against `valid.get_message_keys` (row 2) — depends on step 3's
   `conversation_key` output as its own input, but is otherwise
   independently verifiable without any encryption yet.
5. **Padding test** (§5): implement `calc_padded_len`, verify against
   `valid.calc_padded_len` (row 3) — a pure length-arithmetic function,
   verifiable with NO key material at all, so it can be implemented and
   tested independently of steps 3–4.
6. **Encrypt/decrypt test** (§5–§7): implement the full seal (pad →
   ChaCha20 → HMAC → payload assembly) and open (HMAC-verify → decrypt →
   unpad) pipeline, verify against `valid.encrypt_decrypt` AND
   `valid.encrypt_decrypt_long_msg` (rows 4–5) — this step composes steps
   3–5's already-independently-verified pieces, so a failure here is
   attributable to the COMPOSITION, not to conversation-key/message-key/
   padding logic already proven correct in isolation.
7. **Invalid-case test** (§7): verify `invalid.encrypt_msg_lengths` (row
   6, length-bound rejection) and `invalid.decrypt` (row 8, every
   tamper/MAC-failure cause collapsing to one fixed label) — LAST,
   because a misuse-guard test is only meaningful once the correct-path
   implementation it is guarding already passes; testing failure paths
   before the success path exists risks a guard that "passes" only
   because nothing works yet.

**Chat/DM feature connection is explicitly a separate, later stage** —
none of the 7 steps above wire a NIP-44 primitive to `src/chat/` or any
messaging UI. That remains `docs/nip44_internal_plan.md` §8/§9's own
deferred concern, unaffected by this ordering.

## 4. What this stage does NOT do

- **No NIP-44 code of any kind** — no conversation-key function, no
  message-key function, no padding function, no encrypt/decrypt
  function, no vector-schema-guard test.
- **No secp256k1/ECDH dependency adoption.** Still zero such dependency
  in `packages/fedos-core-rust/Cargo.toml`.
- **No `cargo test` wiring of `test-vectors/nip44/nip44-v2.json`** — §3
  step 1 (vector schema guard) is named as the future FIRST step, not
  built here.
- **No `Cargo.toml` change of any kind.**
- **No Chat/DM connection.**

## 5. Conclusion

- **`test-vectors/nip44/nip44-v2.json` is confirmed READY**: it exists,
  parses (per its own already-recorded provenance), and its 8 categories
  cover every pipeline stage `docs/nip44_internal_plan.md` names, with no
  gap requiring a NEW vector import before implementation can begin.
- **A 7-step implementation order is fixed** (§3): vector schema guard →
  secp256k1 dependency adoption → conversation-key test → message-key
  test → padding test → encrypt/decrypt test → invalid-case test.
- **No code, no dependency, no `Cargo.toml` change, no Chat/DM
  connection** is added or authorized by this document.
- **The actual first implementation step (vector schema guard) is Stage
  186+ candidate work**, following the order fixed here, not built in
  this stage.
