# Crypto Inventory

Every cryptographic primitive, implementation, and its exact production
call site, re-verified against `68e7be16` this pass (not copied
unchanged from the audit-prep base package's own §5 — several facts
below are re-derived fresh, and one gap that package's §14 left open is
closed here). See [`02_threat_model.md`](02_threat_model.md) for the
adversary model these primitives defend against, and
[`10_dependency_manifest.md`](10_dependency_manifest.md)/
[`15_license_inventory.md`](15_license_inventory.md) for the
package/license view of the same crates.

## Primitive A — Rust/WASM production crypto core (`packages/fedos-core-rust`)

| Primitive | Crate | Version | Purpose |
|---|---|---|---|
| ChaCha20-Poly1305 | `chacha20poly1305` | `0.11.0` | AEAD — NIP-44/Ratchet message encryption |
| AES-256-GCM | `aes-gcm` | `0.10.3` | Second AEAD — present, KAT-tested, production-reachability not independently re-confirmed this pass (carried open item from the base package's own §5) |
| HKDF-SHA256 | `hkdf` + `sha2` | `0.13.0` / `0.11.0` | Domain-separated sub-secret derivation from Master Seed / Ratchet root-chain KDF |
| Argon2id | `argon2` | `0.5.3` | Passphrase → Master Seed KDF |
| secp256k1 (ECDH + BIP-340 Schnorr) | `k256` | `0.13` (features `arithmetic`, `schnorr` only — **not** `ecdsa`) | NIP-44 ECDH shared secret; BIP-340 Schnorr for Nostr event / Device signing |
| CSPRNG | `getrandom` | `0.3` (`wasm_js` feature) | Nonce/key-material randomness; OS-backed natively, browser/Node `crypto` shim under WASM |
| Secret hygiene | `zeroize` / `secrecy` / `subtle` | `1.9.0` / `0.10.3` / `2.6.1` | Clear-on-drop, no-accidental-print, constant-time comparison |
| WASM/JS bridge | `wasm-bindgen` | `0.2.126` | Rust↔JS marshaling — not itself cryptographic, load-bearing for every primitive above to reach the renderer |

**Re-verified this pass, exact count unchanged**: **11 production Cargo
dependencies**, confirmed by direct `Cargo.toml` read at `68e7be16` (the
`cargo_toml_has_exactly_ten_production_dependencies_after_k256_adoption`
test's own "ten" is the known, already-disclosed stale count — 11 is
current and correct, unchanged since the base package's own §14 already
corrected it once).

**A real nuance this pass adds, not previously stated this precisely**:
`cargo tree` shows `ecdsa v0.16.9` in the resolved dependency graph as a
transitive dependency of `k256`, **despite `Cargo.toml` explicitly
selecting only `arithmetic`/`schnorr` features, never `ecdsa`**. This is
shared elliptic-curve trait plumbing `k256`'s own `schnorr`/`arithmetic`
features build on, not an enabled ECDSA code path — `grep -rn
"::ecdsa\|use ecdsa" packages/fedos-core-rust/src/` finds zero references
in this crate's own source. Present in the dependency GRAPH, not called
anywhere. See [`10_dependency_manifest.md`](10_dependency_manifest.md)
for the full discussion.

**SecretHandle exposure surface**: 27 `expose_bytes_for_internal_*`
accessors across at least 2 distinct secret-carrying types (unchanged
count from the base package's own re-derived §5 figure, itself a
correction of an earlier "ten" — not independently re-grepped again this
specific pass, since no `lib.rs` change is expected between `97f26f0f`
and `68e7be16`'s own docs-only delta per
[`09_commit_manifest.md`](09_commit_manifest.md); an auditor should
re-run the grep themselves before relying on the count).

## Primitive B — TypeScript-side production crypto (newly precisely located this pass)

**Not previously called out as its own distinct crypto inventory
line** in prior review work (the base package's §14 flagged
`@noble/curves`/`@noble/hashes` as an open "test-only vs. production"
question; this pass closes it — see
[`10_dependency_manifest.md`](10_dependency_manifest.md)):

| Primitive | Package | Purpose | Call site |
|---|---|---|---|
| BIP-340 Schnorr signing/verification | `@noble/curves/secp256k1.js` (`schnorr`) | Signs and verifies **Signed Deletion Requests** | `src/conversation/deletion_request/fedos_deletion_request_signing.ts` |
| SHA-256 | `@noble/hashes/sha2.js` | Hashing support for the above | Same file |
| CSPRNG (non-secret IDs only) | `@noble/hashes/utils.js` (`randomBytes`) | Non-secret identifier generation (e.g. Board runtime IDs) | `src/board/runtime/fedos_board_runtime_id_generator.ts` and others |

**This is a second, independent BIP-340 Schnorr implementation**,
separate from the Rust/WASM `k256::schnorr` path in Primitive A above —
both sign/verify the same Nostr event signature scheme, but via two
different codebases (`@noble/curves`, a pure-JS audited library from the
`paulmillr` ecosystem, versus RustCrypto's `k256`). **An external auditor
should scope both as distinct review targets** — the WASM path's own
KAT-vector test coverage (`test-vectors/`) does not automatically cover
the TypeScript-side path, and vice versa. Whether these two
implementations are ever asked to interoperate on the same signature
(e.g. one signs, the other verifies) was not traced this pass — a real,
concrete question for [`19_reviewer_checklist.md`](19_reviewer_checklist.md).

## Protocol-level cryptographic constructions (built from the primitives above, no new primitive invented)

- **NIP-44 v2** (encryption) — ECDH (via `k256`) → HKDF-SHA256 message
  key → ChaCha20-Poly1305, ~30-file implementation under
  `src/crypto/nip44_*.rs`, each stage with its own KAT-vector test.
- **Direct (1:1) Double Ratchet** — DH-ratchet transition, root/chain
  KDF, AEAD framing, skipped-key store bounded at 1000 keys / 14-day
  retention (`direct_ratchet_session.rs`). **Only Direct conversations
  use this** — Group conversations have no forward secrecy or
  post-compromise security by design (the UI intentionally does not
  expose Group conversations for exactly this reason,
  `05_known_issues.md`).
- **FedOS-proprietary route binding** (inside the already-encrypted
  Rumor content, authenticated transitively via the Seal signature) — no
  new cryptographic primitive, a structural/protocol addition only.
- **No new cryptographic primitive was invented anywhere in this
  codebase** — every Arc across this project's history explicitly
  disclaims this as a hard guardrail; this pass's own spot-checks found
  no counter-example, consistent with every prior review.

## Version-pinning / build-determinism cross-reference

The exact Rust crypto dependency graph (all 82 resolved packages, all
targets) is independently, freshly reproduced and hash-verified by this
addendum — see [`12_hashes.md`](12_hashes.md). The compiled WASM artifact
these primitives produce is confirmed byte-identical across 5 independent
builds now (same document). This is unusually strong reproducibility
evidence for a security-sensitive artifact and should be stated to the
auditor as a genuine strength, not merely a checklist item.

## What this document is not

This is an inventory, not an audit — no cryptographic correctness claim
beyond "these are the primitives, these are their exact versions, here
is where each is called" is made here. See
[`02_threat_model.md`](02_threat_model.md) and
[`05_known_issues.md`](05_known_issues.md) for what has and has not been
independently verified about how correctly these primitives are used.
