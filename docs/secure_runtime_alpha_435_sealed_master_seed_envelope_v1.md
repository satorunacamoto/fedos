# Secure Runtime Alpha 435 — Sealed Master Seed Envelope V1

Phase A, Stage 5. Defines the stable wire schema `seal()`/
`restore_sealed()` (Alpha 437) produce and consume, implemented in
`master_seed_sealed_envelope_codec` (`lib.rs`).

## Schema (fixed key order, no whitespace, deterministic)

```json
{"v":1,"kdf":"argon2id","m":19456,"t":2,"p":1,"salt":"<base64url>","alg":"chacha20poly1305","n":"<base64url>","ct":"<base64url>"}
```

| Field | Meaning | Secret? |
|---|---|---|
| `v` | schema version, fixed `1` this Arc | No |
| `kdf` | fixed label `"argon2id"` | No |
| `m`, `t`, `p` | Argon2id memory/time/parallelism cost, recorded per-envelope so a restore always re-derives under the EXACT params it was sealed with | No |
| `salt` | Argon2id salt, fresh random 16 bytes (`argon2::RECOMMENDED_SALT_LEN`) per `seal()` call | No |
| `alg` | fixed label `"chacha20poly1305"` | No |
| `n` | AEAD nonce, 12 bytes | No |
| `ct` | ciphertext‖tag (AEAD-authenticated 32-byte Master Seed) | **The only field that matters — but it is ciphertext, never plaintext** |

No public identifier, no secret key, no account keys, no arbitrary
metadata bag — exactly these nine fields, nothing else.

## Fail-closed parsing

`master_seed_sealed_envelope_codec::decode()` is a strict, sequential,
hand-written scanner (mirroring `crypto::ciphertext_serialization`'s
own established discipline, Alpha 431's own precedent) — it requires
keys in EXACTLY this order, rejects an unrecognized `v` (no silent
migration), rejects an unrecognized `kdf`/`alg` label, rejects a
missing/reordered/extra field, and rejects invalid base64url text. It
never panics on malformed input — `restore_sealed_with_a_malformed_json_envelope_fails_closed_and_does_not_panic`
verifies `""`, `"not json at all"`, and `"{}"` all fail closed.

## Cryptography reused, not invented

- Argon2id: the existing `argon2` dependency (Stage 84), its own
  `Params::DEFAULT_M_COST`/`DEFAULT_T_COST`/`DEFAULT_P_COST` and
  `RECOMMENDED_SALT_LEN` — never a hand-picked cost value.
- AEAD: the existing `crypto::aead_internal::seal_internal`/
  `open_internal` ChaCha20-Poly1305 primitive, under the NEW
  `AeadAadDomain::MasterSeedSealing` domain (Alpha 433).
- base64url: RFC 4648 §5, no padding — hand-written in this file
  because Rust module privacy does not let crate-root code reach
  `crypto::ciphertext_serialization`'s own private base64url helpers
  (same algorithm, no new dependency).

Not placed in `FedosBoardPersistence` or Outbox persistence — this
schema has no relationship to Board/Outbox storage and is not written
to any Host-owned store in this Arc (Alpha 439).
