# Secure Runtime Alpha 165 — Nostr Secret Key Derivation Completion

**Status: this Stage is REVIEW ONLY — it adds test coverage
(`packages/fedos-core-rust/src/lib.rs`'s own `#[cfg(test)]` module,
landed alongside Alpha 163/164's implementation in the same file edit)
but makes NO further production-code change. This is Stage 5, the
closing Stage, of the Alpha 161–165 Deterministic Nostr Secret Key
Derivation Arc.**

## 1. Why now

Alpha 161 inventoried, Alpha 162 decided, Alpha 163 added the Handle,
Alpha 164 added the derivation function. This Stage verifies, by real
execution, that every property this Arc's own 重要方針 (guiding
policy) required actually holds, and issues the Arc's own closing
Completion Declaration.

## 2. Verification performed (real execution, `master_root::tests`)

- **Same Master Seed + same Account Index → same Nostr Secret Key
  Handle content:**
  `same_nostr_root_and_same_account_index_derive_matching_secret_keys`
  derives the SAME Nostr Root, then the SAME Account Index twice, and
  confirms `matches_for_internal_verification` returns `true`.
- **Same Master Seed + different Account Index → different key:**
  `same_nostr_root_and_different_account_indices_derive_non_matching_secret_keys`
  confirms account `0` and account `1` under the SAME Nostr Root never
  match.
- **Different Master Seed + same Account Index → different key:**
  `different_nostr_roots_and_same_account_index_derive_non_matching_secret_keys`
  builds two independent `Master Seed → Identity Root → Application
  Root → Nostr Root` chains from two different Master Seed byte
  patterns, derives account `0` under each, and confirms they never
  match.
- **Account 0 / 1 / max boundary handling:**
  `account_index_zero_one_and_u32_max_all_derive_successfully_and_distinctly`
  confirms `0`, `1`, and `u32::MAX` all derive successfully (`Success`
  status, real output) and are pairwise non-matching — no reserved or
  special-cased index value.
- **Invalid-scalar path does not panic:** the production code path
  (`derive_nostr_secret_key_internal`'s `Err(_) =>
  NostrSecretKeyStatus::InvalidScalar` arm) contains no `.unwrap()`,
  `.expect()`, or `panic!()` of any kind — confirmed by direct source
  inspection (this Arc's own test suite additionally confirms the
  `Success`/`InvalidInput`/`InvalidScalar`/`InternalFailure` match is
  exhaustive via
  `nostr_secret_key_status_has_exactly_four_variants`); a real invalid
  32-byte candidate (all-zero, or the curve order itself) is
  cryptographically unreachable through this function's own HKDF
  output (probability ~1/2^128), so no test vector forces the branch,
  exactly like every prior exhaustively-matched-but-unreachable branch
  in this crate (`HkdfStatus::InternalFailure`,
  `ConversationKeyStatus::InternalFailure`).
- **Handle comparison is constant-time-internal only:**
  `nostr_secret_key_matches_for_internal_verification_returns_false_after_either_side_is_cleared`
  confirms `matches_for_internal_verification` is the ONLY comparison
  path exercised — `FedosNostrSecretKeyHandle` derives no
  `PartialEq`/`Eq` (confirmed by direct source inspection: no such
  `#[derive(...)]` appears on the type).
- **No raw byte getter exists:** confirmed by direct source
  inspection — `FedosNostrSecretKeyHandle`'s only public(crate) methods
  are `kind()`, `is_cleared()`, `clear()`,
  `matches_for_internal_verification()`; none returns `[u8; N]` or any
  byte-shaped value.
- **No `#[wasm_bindgen]` export exists:** the crate's own total
  `#[wasm_bindgen]` annotation count remains fixed at **13** — zero
  added by this whole Arc.
- **Unreachable from TypeScript/Desktop/Runtime:** `master_root`
  remains a plain (non-`pub`) module; this Arc touches ONLY
  `packages/fedos-core-rust/src/lib.rs` — no `src/` file is modified by
  any of its five Stages.
- **Does not mutate its inputs:**
  `derive_nostr_secret_key_internal_does_not_mutate_the_input_nostr_root`
  confirms `nostr_root` is left un-`clear()`-ed after the call.
- **Rejects an already-cleared Nostr Root:**
  `derive_nostr_secret_key_internal_rejects_a_cleared_nostr_root`
  confirms `NostrSecretKeyStatus::InvalidInput` with `output: None`.

## 3. The Foundation, confirmed complete

```rust
FedosMasterSeedHandle       (Alpha 146)
        │  derive_identity_root_internal        (Alpha 147, HkdfDomain::Identity)
        ↓
FedosIdentityRootHandle     (Alpha 147)
        │  derive_application_root_internal      (Alpha 148, HkdfDomain::Application)
        ↓
FedosApplicationRootHandle  (Alpha 148)
        │  derive_nostr_root_internal             (Alpha 152, HkdfDomain::Nostr)
        ↓
FedosProtocolRootHandle     (the Nostr Root instance — Alpha 151/152)
        │  derive_nostr_secret_key_internal(account_index)   (Alpha 164, direct HKDF)
        ↓
FedosNostrSecretKeyHandle   (Account-indexed Nostr Secret Key — Alpha 163/164)
```

Every arrow above the last one reuses the SAME single production
HKDF-SHA256 call site (`kdf_core::derive_secret_handle_internal`,
unchanged since Stage 147). The last arrow is a deliberate, minimal
DIRECT `Hkdf::<Sha256>` call (Alpha 161 §2.14, Alpha 164 §3) — the only
way to add Account-Index parameterization without modifying that
shared, fixed-`info` bridge every earlier arrow depends on. Zero new
cryptographic algorithm across the whole chain: HKDF-SHA256 (RFC 5869)
throughout, plus `k256::SecretKey::from_slice`'s pre-existing scalar
validation (Alpha 161 §2.2, already used unchanged by
`crypto::conversation_key` since Stage 199).

## 4. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE. A Nostr Root now
deterministically derives an Account-indexed secp256k1 Nostr Secret
Key, entirely `pub(crate)`, via `FedosNostrSecretKeyHandle`/
`derive_nostr_secret_key_internal` (Alpha 163/164), with ZERO new
Cargo dependency, ZERO new cryptographic algorithm, ZERO WASM
exposure (`#[wasm_bindgen]` count fixed at 13), ZERO Desktop access,
and ZERO Runtime/Worker/Storage/Observation/Identity-Layer exposure.**

**The following do NOT exist yet, exactly as this Arc's own Objective
requires — unchanged from Alpha 160's own list, minus the one item this
Arc resolves:**

- ~~**Nostr Secret Key**~~ — now exists (this Arc).
- **Nostr Public Key** — no public-key derivation from the Nostr
  Secret Key exists anywhere in this crate.
- **`npub`** — no bech32 public-key encoding exists.
- **`nsec`** — no bech32 secret-key encoding exists.
- **Schnorr signature** — no BIP-340 signing function exists.
- **Event generation** — no Nostr event construction/signing exists.
- **Relay communication** — no WebSocket/Relay connection exists in
  this crate.
- **DM** — no NIP-04/NIP-44-based direct-message send path exists.
- **Key export/import** — no path exists to export a raw secret byte
  from `FedosNostrSecretKeyHandle` or any other Handle in this crate.

**The NEXT Arc begins Nostr Public Key Derivation — deriving a Nostr
public key FROM the `FedosNostrSecretKeyHandle` this Arc's own Alpha
163/164 Stages confirmed complete. This is explicitly the next Arc's
own scope, not this one's.**

## 5. What this Stage does NOT do

- Does **not** modify `packages/fedos-core-rust/src/lib.rs` beyond the
  `#[cfg(test)]`-only test module landed alongside Alpha 163/164's own
  implementation — no further production code change.
- Does **not** derive a Nostr public key, `npub`, `nsec`, or signature,
  and does **not** contact a Relay.
- Does **not** add a new Rust type, function, `SecretHandleKind`
  variant, or dependency beyond Alpha 163/164's own two additions
  (`FedosNostrSecretKeyHandle`,
  `SecretHandleKind::NostrSecretKeyMaterial`, and
  `derive_nostr_secret_key_internal`).
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_164_deterministic_nostr_secret_key_derivation.md`
- `docs/secure_runtime_alpha_163_nostr_secret_key_handle.md`
- `docs/secure_runtime_alpha_162_nostr_account_derivation_decision.md`
- `docs/secure_runtime_alpha_161_existing_nostr_key_inventory.md`
- `docs/secure_runtime_alpha_160_integration_completion.md`
