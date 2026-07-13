# Secure Runtime Alpha 248 — Known-Answer and Tamper Verification

**Status: this Stage is REVIEW ONLY — it adds test coverage only
(`test/secure_runtime_alpha_248_known_answer_tamper_verification.test.ts`)
but makes NO production-code change of any kind. This is Stage 8 of
the Alpha 241–250 Nostr Inbound Event Validation Arc, following Alpha
247's own Validation Failure Semantics review.**

## 1. Why now

Alpha 243–246 built the verification chain; this Stage exercises it
against REAL, cryptographically valid signed events (never a mock, a
stub, or an assumed-correct fixture) and against a full tamper matrix,
the SAME "verified by real execution rather than assumed from reading
source alone" discipline every prior Foundation Arc's own closing test
Stage has established (Alpha 196, 217, 227, 239).

## 2. Known-answer vectors — how they were produced, honestly

This Arc's own Alpha 248 instruction asks for vectors "generated from
this repository's deterministic key/signing pipeline, account index 0
... account index 1 ... u32::MAX if practical through existing
helpers." That pipeline — deterministic, account-index-based secret
key derivation followed by BIP-340 signing — lives ENTIRELY in
`packages/fedos-core-rust/src/lib.rs` (Alpha 146–195), reachable only
through a COMPILED wasm artifact. This repository's own, repeatedly
confirmed convention (every prior Arc's own completion doc; e.g. Alpha
018 §"no compiled WASM binary is committed") is that no such artifact
is ever committed, and `vitest` itself never builds one. **It is
therefore NOT practical, from this test suite, to invoke the real
account-index derivation pipeline** — confirmed, not assumed, by
Alpha 241 §2's own direct inspection of `lib.rs` finding zero
`#[wasm_bindgen]`-exported signing/verification entry point of any
kind reachable from TypeScript.

This Stage instead generates real, valid, deterministically-reproducible
NIP-01 events directly with `@noble/curves`/`@noble/hashes` — the SAME
ALREADY-PRESENT primitives `verifyNostrEventSignature` (Alpha 244)
itself uses, and the SAME approach `test/noble_signature.test.ts`'s own
`VALID_EVENT` fixture already established ("Generated once with
@noble/curves Schnorr ... and hardcoded here so the test is
deterministic"). Three fixed private keys stand in for "account index
0," "account index 1," and a "large index" (a `u32::MAX`-scale
surrogate) — each one clearly labeled as a SURROGATE in this Stage's
own test file, not a literal reproduction of the Rust-side HKDF
account-index derivation, which remains untested here because it is
unreachable from this environment. Every vector was independently
confirmed, by direct `schnorr.verify` execution at generation time (a
throwaway script, never committed), to be a real, cryptographically
valid signature before being hardcoded.

## 3. Cases covered

**Valid:**

- "account index 0" surrogate (tags present, em-dash content)
- "account index 1" surrogate (no tags)
- "large index" (`u32::MAX`-scale) surrogate (tags present)

**Tampering (each field changed independently from a valid vector,
confirmed rejected):**

- `content` changed after signing
- `created_at` changed
- `kind` changed
- `tags` changed
- `pubkey` changed
- `id` changed
- `sig` changed
- one hex nibble of `sig` flipped
- uppercase hex (`id`/`pubkey`/`sig`)
- malformed hex (non-hex character)
- wrong-length `pubkey`/`id`/`sig`

**Canonicalization (one dedicated vector whose own `content` contains
every NIP-01-escaped character AND non-ASCII UTF-8, confirmed valid,
never tampered):**

- double quote
- backslash
- newline
- carriage return
- tab
- backspace
- form feed
- non-ASCII UTF-8 (Latin-1 supplement, CJK, and an emoji outside the
  Basic Multilingual Plane)

## 4. Confirms agreement with the outbound Event Foundation

Alpha 241 §3.2 found Rust's own `escape_json_string_internal` (Alpha
193) and this Arc's own new `escapeNip01CanonicalString`
(`nostr_event_id_verifier.ts`, Alpha 243) implement the IDENTICAL
six-character rule. This Stage's own canonicalization vector — content
containing all six NIP-01-escaped characters plus non-ASCII UTF-8 —
verifying successfully confirms, by real execution, that this Arc's
own TypeScript implementation reconstructs the exact SAME canonical
byte sequence a conforming outbound signer (Rust or otherwise) would
have produced for that same event, for every supported case.

## 5. No external network calls

Every vector is a hardcoded literal; every verification call is a pure,
synchronous (or Promise-free) local computation. `vi.fn()`/network
mocks are unnecessary and unused in this Stage's own test file.

## 6. What this Stage does NOT do

- Does **not** modify `nostr_event_id_verifier.ts`,
  `nostr_signature_verifier.ts`, `combined_inbound_event_validator.ts`,
  `fedos_validated_nostr_event.ts`, or
  `validated_subscription_adapter.ts` — zero production code change.
- Does **not** invoke the real Rust-side deterministic account-index
  derivation pipeline — confirmed unreachable, not silently skipped
  (§2).
- Does **not** build or load a compiled wasm artifact of any kind.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/websocket_relay.ts`,
  `src/nostr/*`, Storage, Observation,
  `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`, or
  `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_247_validation_failure_semantics.md`
- `docs/secure_runtime_alpha_245_combined_inbound_event_validator.md`
- `docs/secure_runtime_alpha_243_canonical_event_id_verification.md`
- `docs/secure_runtime_alpha_241_existing_inbound_validation_inventory.md`
- `docs/secure_runtime_alpha_196_event_foundation_verification.md`
