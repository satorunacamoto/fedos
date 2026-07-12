# Secure Runtime Alpha 162 — Nostr Account Derivation Decision

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind — no `src/` file, no `packages/` file, is modified.
This is Stage 2 of the Alpha 161–165 Deterministic Nostr Secret Key
Derivation Arc, following Alpha 161's own Inventory.**

## 1. Why now

Alpha 161 confirmed the Nostr Root already exists
(`FedosProtocolRootHandle`, `derive_nostr_root_internal`) and that
`k256::SecretKey::from_slice` is the crate's own existing, reusable
secp256k1 scalar-validation entry point. This Stage decides HOW a
Nostr secret key is derived FROM that Root, comparing five options and
adopting exactly one.

## 2. Options compared

| # | Option | Description |
|---|---|---|
| A | Root-as-key | Interpret the Nostr Root's own 32 bytes directly as the secret key — no further derivation. |
| B | HKDF(account index) | Nostr Root → HKDF-SHA256(fixed salt, Account-Index-appended info) → 32-byte candidate → `k256::SecretKey::from_slice`. |
| C | Nostr Root → Account Root → Secret Key | Insert an intermediate `Account Root` Handle type between Nostr Root and the secret key, mirroring `master_root`'s own multi-level Handle hierarchy. |
| D | BIP32-style HD wallet | Adopt full BIP32 (or NIP-06's own BIP32-over-secp256k1) hierarchical derivation, with hardened/non-hardened child keys. |
| E | Random + store | Generate a random secret key per account and persist it, rather than deriving it. |

## 3. Evaluation

| Criterion | A | B | C | D | E |
|---|---|---|---|---|---|
| Determinism | Yes, but only ONE key ever (no account separation) | Yes | Yes | Yes | **No** — random, not reconstructible from Master Seed |
| Account separation | **No** — single fixed output, no index input at all | Yes, via HKDF info | Yes, via an extra Handle level | Yes | Yes, but via storage, not derivation |
| Recovery | Trivial but useless (no per-account key) | Full — Master Seed + Account Index reconstructs any key | Full, same as B | Full | **None** — a lost store loses the key permanently, defeating this Arc's own Objective |
| Domain separation | None — reuses Root bytes directly as key material for two different roles (Root identity vs. signing key) | Yes — dedicated fixed salt, separate from `HkdfDomain::Nostr`'s own salt | Yes, same as B, plus an extra domain-separated hop | Yes, via BIP32's own chain-code construction | N/A |
| Invalid-scalar handling | Undefined — the Root's own bytes were never validated as a scalar at derivation time | `k256::SecretKey::from_slice`, existing precedent (Alpha 161 §2.2/§4) | Same as B | Requires BIP32's own child-key-derivation retry-on-invalid rule (a NEW algorithm this crate does not implement) | N/A |
| Secret exposure | The Root itself becomes signing-capable — a Root leak now ALSO directly leaks a real, usable Nostr private key, collapsing Alpha 144's own Protocol-Root-leak containment boundary | Root leak still only exposes the Root (Alpha 144 §6's containment holds); a leaked Nostr Secret Key does not expose the Root or sibling Account Keys (HKDF one-wayness) | Same as B, plus containment even if the intermediate Account Root leaks | Same as B/C, standard BIP32 containment (with BIP32's own known hardened/non-hardened caveat) | Depends entirely on the storage layer, out of this Arc's scope |
| Existing dependency | Uses nothing new | Uses `hkdf`/`sha2`/`k256`, all already adopted (Alpha 161 §2.1/§2.14) | Same as B | Requires a NEW BIP32 implementation or crate — NOT adopted by this crate (Alpha 161 confirms no such dependency exists) | Uses nothing new for generation, but needs a NEW persistence mechanism this Arc is explicitly forbidden from adding (Storage is out of scope) |
| Nostr compatibility | A Nostr secret key is "any 32-byte value that is a valid secp256k1 scalar" (NIP-01/NIP-06) — Option A's un-validated Root bytes are compatible only by accident, never confirmed | Fully compatible — output is validated exactly like any other Nostr secret key must be | Same as B | Fully compatible, and matches NIP-06's own BIP32 convention most closely | Fully compatible, once generated |
| Wallet separation of concerns | Conflates "Root identity" and "signing key" into one value — actively unsafe | Clean: Root stays an identity-derivation waypoint, the Secret Key is a distinct, purpose-built leaf value | Same as B, with an extra named waypoint | Same as B | N/A — no derivation relationship to separate |
| Versioning | None possible — Option A has no schema hook | The fixed salt/info-prefix literal IS the version hook, matching `HkdfDomain`'s own `-v1` convention (Alpha 161 §2.14) | Same as B | BIP32 has its own versioning story, foreign to this crate's own `-v1` convention | N/A |
| Migration | N/A | Same mechanism as every other domain in this crate: a new fixed salt/info literal is a new, explicit, reviewed variant | Same as B | Requires adopting BIP32's own migration conventions | N/A |
| Testability | Trivial but degenerate (nothing to test beyond "returns the Root bytes") | Straightforward — deterministic function of two inputs, directly unit-testable (Alpha 165) | Same as B, one more Handle type to test | Requires BIP32 test vectors this crate does not currently import | Requires mocking storage, out of scope |
| Implementation complexity | Trivial, but see Secret Exposure row — trivial for the WRONG reason | **Low** — one direct HKDF call plus one existing validation call, no new type beyond the Handle itself | Low-to-moderate — one more Handle type, one more derivation function | **High** — a full HD-wallet child-key-derivation algorithm, hardened/non-hardened path parsing, chain codes | Low for generation, but requires a persistence layer this Arc must not add |
| Compromise containment | **Worst** — collapses Root/Key distinction entirely | Good — matches Alpha 144's existing threat-model containment guarantees exactly, one level deeper | Good, with one additional contained boundary | Good, BIP32's own standard containment | Depends on storage, unverifiable here |
| Future multi-account support | **No** — Option A has no account concept at all | Yes — any `u32` Account Index, unlimited accounts, zero additional code per account | Yes, same as B | Yes, BIP32's own path syntax | Yes, but each account needs its own stored secret |

## 4. Decision: Option B

**Option B — `Nostr Root → HKDF(account index) → 32-byte candidate →
k256::SecretKey` — is adopted.** It is the only option that satisfies
every one of this Arc's own Objective requirements (determinism,
account separation, no new cryptographic algorithm, no new
dependency, no raw-byte export) with the LOWEST implementation
complexity: Option A fails Account Separation and Secret Exposure
outright; Option C is a strict superset of B's own guarantees but adds
an unrequired intermediate Handle type Alpha 161 found no existing
precedent motivating (the Objective itself never asks for an
"Account Root," only an "Account-indexed Nostr Secret Key"); Option D
requires a wholly new dependency and algorithm this crate does not
have and this Arc's own "no new cryptographic algorithm" prohibition
forbids; Option E is not deterministic at all, failing this Arc's own
"重要方針" outright.

## 5. Account Index encoding — per Alpha 143, unchanged

**Fixed-width big-endian binary, `u32` (4 bytes), NEVER an ASCII
decimal string, NEVER variable-length** — exactly
`docs/secure_runtime_alpha_143_domain_separation_decision.md` §3's
existing rule, applied without modification. `account_index.to_be_bytes()`
is appended directly after a fixed, compile-time HKDF `info` label
prefix — see Alpha 164 §2 for the exact byte layout.

## 6. Invalid-scalar handling — decided here, detailed in Alpha 164

Alpha 161 §2.2/§4 already confirms the ONLY existing precedent in this
crate (`crypto::conversation_key`): attempt `k256::SecretKey::from_slice`,
fail closed with a dedicated status label and `output: None` on
`Err(_)`. This Stage adopts that SAME precedent for Nostr Secret Key
derivation — no counter-based re-derivation loop (which would be a NEW
algorithm this crate has never implemented or reviewed), no
hand-rolled modular reduction (explicitly forbidden by this Arc's own
Objective), and no panic. Alpha 164 §4 restates and finalizes this as
part of its own implementation record.

## 7. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** implement `derive_nostr_secret_key_internal` — that is
  Alpha 164's own deliverable, after Alpha 163 first adds the Handle
  type this function will return.
- Does **not** decide `FedosNostrSecretKeyHandle`'s own exact shape —
  that is Alpha 163's own deliverable.
- Does **not** implement Master Seed generation, public-key derivation,
  `npub`/`nsec` encoding, signatures, or any Relay/Storage/Desktop
  connection.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, Storage, Observation, Rust,
  `Cargo.toml`, or `package.json`.

## 8. See also

- `docs/secure_runtime_alpha_161_existing_nostr_key_inventory.md`
- `docs/secure_runtime_alpha_143_domain_separation_decision.md`
- `docs/secure_runtime_alpha_144_recovery_threat_model_decision.md`
- `docs/secure_runtime_alpha_142_root_hierarchy_decision.md`
