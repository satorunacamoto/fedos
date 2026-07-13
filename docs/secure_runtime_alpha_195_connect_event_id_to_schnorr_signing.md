# Secure Runtime Alpha 195 — Connect Event ID Generation to the Schnorr Signature Foundation

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs` (the same file edit as Alpha
192/193/194 — this Arc lands as a single commit). This is Stage 5 of
the Alpha 191–200 Nostr Event Foundation Arc, following Alpha 194's
own deterministic Event ID generation.**

## 1. Why now

Alpha 194 produces the Event ID; the ALREADY-COMPLETE, UNCHANGED
Schnorr Signature foundation (Alpha 183) already signs any 32-byte
message digest. This Stage is the ONE function that connects them —
the exact call shape Alpha 187 §2 (the predecessor Arc's own Event
Builder Compatibility Review) already named as the future need this
Arc would fill.

## 2. What was implemented

```rust
pub(crate) fn sign_nostr_event_internal(
    event: &FedosNostrEventHandle,
    secret_key: &FedosNostrSecretKeyHandle,
) -> Option<FedosNostrSignatureHandle> {
    let event_id = derive_nostr_event_id_internal(event)?;
    derive_nostr_signature_internal(secret_key, &event_id)
}
```

This function's ENTIRE body is exactly two calls — one to Alpha 194's
own `derive_nostr_event_id_internal`, one to Alpha 183's own
`derive_nostr_signature_internal` — connected by `?`. No third line,
no additional logic, no Relay reference of any kind.

## 3. "No Relay logic" — confirmed by what this function does NOT do

This Arc's own Alpha 195 instruction states "No Relay logic"
explicitly. Confirmed, not merely asserted: this function does not
import `src/nostr/relay.ts`-equivalent Rust code (none exists), does
not construct a NIP-01 wire message of any kind, does not open a
network connection, and does not publish or transmit anything —
`event`/`secret_key` are both borrowed, never consumed, and the
function's own return value is a `FedosNostrSignatureHandle` that
NEVER leaves `packages/fedos-core-rust/src/` (Alpha 198 confirms this
independently). "Connecting" here means exactly what it says: wiring
one ALREADY-EXISTING function's output into another
ALREADY-EXISTING function's input, nothing more.

## 4. Reuses `derive_nostr_signature_internal` completely unchanged

Per this Arc's own "Do not redesign" instruction covering the Schnorr
Signature foundation: `derive_nostr_signature_internal`'s own
signature, body, and Fail-Closed behavior (Alpha 183) are BYTE-FOR-BYTE
unchanged by this Stage — confirmed by this Stage's own structural
check (§6 below). `sign_nostr_event_internal` is a NEW, ADDITIONAL
caller of that function, not a modification of it — the SAME
`message: &[u8; 32]` contract every existing caller (including Alpha
184/186's own tests) already relies on.

## 5. Fail Closed — propagates both upstream failures, adds none of
   its own

Returns `None` if EITHER Event ID derivation (Alpha 194) OR signing
(Alpha 183) fails; both underlying functions already apply this
crate's own Fail-Closed discipline independently (both `Option`-typed,
both matched exhaustively at their own call sites via `?`). This
function introduces NO new failure path of its own — it is a pure
connector, confirmed by direct inspection: its own body contains no
`unwrap`/`expect`/`panic!` of any kind, and no conditional logic
beyond the two `?` short-circuits already inherent to calling two
`Option`-returning functions in sequence.

## 6. Structural confirmation (real inspection, this Stage)

- `#[wasm_bindgen]` count in `lib.rs`: fixed at 13, unchanged.
- `pub fn` count in `lib.rs`: fixed at 36, unchanged.
- `derive_nostr_signature_internal`'s own signature (Alpha 183):
  byte-for-byte unchanged — same parameters, same return type, same
  body.
- `sign_nostr_event_internal`'s own body: exactly two statements, both
  calls to already-existing functions, connected by `?` — confirmed by
  line count, not merely by reading the source once.
- Alpha 196's own real-execution tests confirm the FULL pipeline
  cryptographically verifies end to end
  (`signed_nostr_event_cryptographically_verifies_end_to_end`) and
  correctly REJECTS a mismatched event
  (`signed_nostr_event_does_not_verify_against_a_different_events_id`)
  — real, executed BIP-340 verification via
  `k256::schnorr::VerifyingKey::verify_prehash`, not internal
  self-consistency alone.

## 7. What this Stage does NOT do

- Does **not** implement Relay communication, event publishing,
  subscription, or filters of any kind.
- Does **not** modify `derive_nostr_signature_internal` (Alpha 183),
  `derive_nostr_public_key_internal` (Alpha 169), or any other
  already-frozen foundation function.
- Does **not** add a new field or method to `FedosNostrEventHandle`
  (Alpha 192) — it remains exactly as immutable as before this Stage
  (Alpha 197 confirms this independently).
- Does **not** modify `src/desktop/*`, `src/identity/*`, `src/nostr/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  `Cargo.toml`, or `package.json`.

## 8. See also

- `docs/secure_runtime_alpha_194_deterministic_event_id_generation.md`
- `docs/secure_runtime_alpha_193_canonical_event_serialization.md`
- `docs/secure_runtime_alpha_192_nostr_event_handle.md`
- `docs/secure_runtime_alpha_183_derive_nostr_signature_internal.md`
- `docs/secure_runtime_alpha_187_event_builder_compatibility_review.md`
