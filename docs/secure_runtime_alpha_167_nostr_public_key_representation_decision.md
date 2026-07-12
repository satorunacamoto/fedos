# Secure Runtime Alpha 167 — Nostr Public Key Representation Decision

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind — no `src/` file, no `packages/` file, is modified.
This is Stage 2 of the Alpha 166–170 Deterministic Nostr Public Key
Derivation Arc, following Alpha 166's own Inventory.**

## 1. Why now

Alpha 166 confirmed Nostr requires a 32-byte x-only public key (its
own §2.4), that no existing `k256` type under this crate's
`arithmetic`-only feature set directly represents that shape (its own
§2.2/§2.3), and that `k256::PublicKey`/`EncodedPoint::x()` can produce
one with zero new dependency (its own §2.7). This Stage decides HOW
the derived public key is REPRESENTED internally, comparing four
options and adopting exactly one.

## 2. Options compared

| # | Option | Description |
|---|---|---|
| A | `k256::PublicKey` held directly | Store the full SEC1-representable curve point as-is. |
| B | `k256::schnorr::VerifyingKey` held directly | Store `k256`'s own BIP-340 verifying-key type. |
| C | 32-byte x-only material, dedicated type | Store exactly the 32-byte X coordinate Nostr requires, in a purpose-built Rust type. |
| D | SEC1 compressed 33-byte public key held | Store the compressed point (parity tag + X coordinate) as-is. |

Per this Arc's own instruction, the first candidate considered was an
EXISTING `k256` type that directly represents a 32-byte x-only public
key. Alpha 166 §2.2 already found none exists without enabling the
`schnorr` feature (Option B) — this Stage's own comparison below
confirms that finding is decisive.

## 3. Evaluation

| Criterion | A (`PublicKey`) | B (`schnorr::VerifyingKey`) | C (x-only, dedicated type) | D (SEC1 compressed) |
|---|---|---|---|---|
| Nostr compatibility | Requires a conversion step every time the x-only value is needed — the type itself does not match Nostr's own shape | Matches Nostr's own x-only shape internally, but **unreachable without a new Cargo feature** | Matches Nostr's own shape EXACTLY, byte-for-byte, no conversion ever needed again | Retains an unused parity-tag byte Nostr never uses — a conversion step still remains |
| Schnorr signature integrity | N/A (out of this Arc's scope) — retains full point, so a HYPOTHETICAL future signer would not need to re-derive it | Would be the natural type for a FUTURE signer, but not reachable this Arc | A future Schnorr signer would need to re-lift the x-only value back to a point (the SAME operation `crypto::conversation_key` already performs for its OWN `pub2` input, Alpha 166 §2.6) — a known, already-precedented cost | Same re-lift cost as Option C, plus the redundant parity byte adds no benefit since Schnorr signing needs a scalar, not a stored point |
| `npub` encoding integrity | Needs its own x-only extraction step before a future bech32 encoder can run | Would already hold exactly bech32's own input shape, but unreachable | Already holds EXACTLY the 32 bytes a future `npub` encoder needs — zero conversion | Needs the SAME strip-the-parity-byte step Option C's own construction ALREADY performs once, at derivation time |
| Secret non-exposure | Equal across all four — none stores or exposes a secret byte; this criterion does not differentiate | Equal | Equal | Equal |
| Type safety | A generic `k256::PublicKey` could, in principle, be confused with `k256::PublicKey` values used elsewhere for an unrelated purpose (this crate has none today, but the risk is structural) | Same structural risk, but unreachable | A crate-own, purpose-named `FedosNostrPublicKeyHandle` cannot be confused with any other type — the STRONGEST type safety of the four | A generic SEC1-shaped byte array carries the SAME structural confusability risk as Option A |
| Future signature verification | Retains the full point, which A FUTURE BIP-340 verifier could reuse directly, avoiding a re-lift — a real, if modest, future convenience | Would avoid the re-lift entirely, but unreachable | A future verifier must re-lift x-only → point (Alpha 166 §2.6's own already-precedented operation) — a real, but already-precedented and bounded, future cost | Also requires a partial re-derivation (re-parsing the SEC1 tag) — no meaningful advantage over C here |
| `Serialize` avoidance | Equal — none of the four is `Serialize` under this crate's own "no `serde` in production" discipline (Alpha 161 §2.1) | Equal | Equal | Equal |
| WASM non-exposure | Equal — none crosses `#[wasm_bindgen]` under any option | Equal | Equal | Equal |
| Constant-time comparison | `k256::PublicKey` implements `PartialEq`/`Eq` NATIVELY — reusing it would either violate this crate's own "no `PartialEq`/`Eq` derive on any Handle" rule (Alpha 161 §2.10) or require wrapping anyway, gaining nothing over Option C | Same native-`PartialEq` tension, unreachable regardless | A plain `[u8; 32]` field cleanly supports the SAME `subtle::ConstantTimeEq`-only comparison discipline as every other Handle, no fighting a foreign type's own trait impls | Same clean fit as Option C — SEC1 bytes are just as comparable — but still carries the unused parity byte |
| Implementation complexity | Low, but defers real complexity (the x-only extraction) to every FUTURE consumer instead of doing it once now | Would be low, but blocked (§2.2) | **Lowest** — the x-only extraction happens exactly ONCE, at derivation time, in `derive_nostr_public_key_internal` itself; every future stage receives the final shape already | Low, but see Nostr compatibility row — defers the SAME conversion, just one byte narrower than Option A |
| Existing `k256` API alignment | Uses `k256::PublicKey` directly, an existing type | Would use an existing type, but gated by an unenabled feature | Uses existing `k256` API ONLY at derivation time (`SecretKey::public_key()`, `EncodedPoint::x()`) — the STORED type itself is this crate's own, not `k256`'s, which is exactly this Arc's own instruction ("Protocol Key型は必ず分離する") | Same "existing API at derivation time only" shape as C |
| Session/ATProto separation | A stored `k256::PublicKey` carries no Nostr-specific meaning — a FUTURE stage could be tempted to reuse the same field for a different protocol's own secp256k1-shaped key, exactly the confusion this Arc's own Protocol Extensibility Review §7 forbids | Same risk, unreachable | A type NAMED `FedosNostrPublicKeyHandle`, holding Nostr's own EXACT wire shape, cannot be mistaken for a Session/ATProto/Wallet key of a DIFFERENT shape (Ed25519/X25519/DID-keyed values are not even secp256k1 x-only bytes) — the STRONGEST separation of the four | A generically-shaped SEC1 byte array carries the SAME cross-protocol-confusion risk as Option A |

## 4. Decision: Option C

**Option C — a dedicated `FedosNostrPublicKeyHandle` type holding
exactly the 32-byte x-only public key material Nostr itself requires —
is adopted.** Option B is definitively excluded: it would need a new
`k256` Cargo feature, which this Arc's own "no new Cargo dependency"
prohibition and Alpha 166 §2.2's own finding both rule out. Between
the two feature-compatible options (A and D), Option C wins on every
row that differentiates it from them — Nostr compatibility (exact
shape, zero future conversion), type safety (a purpose-named type,
never confusable with a future Session/ATProto/Wallet key), constant-
time comparison ergonomics (no foreign `PartialEq` to work around),
implementation complexity (the ONE necessary conversion step happens
once, here, rather than being deferred to every future consumer), and
Session/ATProto separation (the strongest of the four, directly
satisfying this Arc's own Protocol Extensibility Review). Options A
and D's own modest "future signature verification" advantage is real
but bounded — Alpha 166 §2.6 already confirms `crypto::conversation_key`
re-lifts an x-only value to a point today, for an unrelated purpose,
proving that cost is small, ordinary, and already-precedented in this
crate — not a reason to prefer a less type-safe, less Nostr-precise
representation now.

## 5. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** implement `FedosNostrPublicKeyHandle` — that is
  Alpha 168's own deliverable.
- Does **not** implement `derive_nostr_public_key_internal` — that is
  Alpha 169's own deliverable.
- Does **not** implement Schnorr signing, `npub`/`nsec` encoding, or
  any Relay/Event code.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, Storage, Observation, Rust,
  `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_166_existing_nostr_public_key_inventory.md`
- `docs/secure_runtime_alpha_162_nostr_account_derivation_decision.md`
- `docs/secure_runtime_alpha_143_domain_separation_decision.md`
