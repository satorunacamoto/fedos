# Secure Runtime Alpha 6281–6360 — Phase A Reconciliation Report

**FedOS Secure Memory Secret Buffer and Zeroization Foundation Arc**

Worktree: `C:\wt\secure-memory-secret-buffer`
Branch: `arc/secure-memory-secret-buffer-zeroization-foundation`
Base commit: `b8e9e062` ("Add Secure Runtime Alpha 5561-5640: FedOS Direct
Double Ratchet Conversation Runtime and NIP-17 Integration Arc")

## 1. Alpha range verification (mandatory, before any production edit)

- `git log --all --oneline` confirms the historical **5401–5480 collision**:
  `be1bc0d9` ("Direct Ratchet State and Sealed Persistence Foundation") and
  `b3b3a6d2` ("Local Deletion Capability and Deletion-State Foundation")
  both used 5401–5480. Recorded, not repaired — matches this repo's own
  standing convention (never renumber previous commits).
- `git log --all --oneline --grep="Alpha 62\|Alpha 63" -i` returns exactly
  one hit: `8a718b02` "Add Secure Runtime Alpha 621-640: Public Board
  Runtime Application API Foundation Arc" — a three-digit-era range,
  unrelated. **6201–6280 and 6281–6360 are genuinely unused.**
- `arc/desktop-beta-privacy-controls-safety-center` (Arc A, tip `85c64304`,
  "Merge Signed Deletion Request UI gap-closure (50f80e8) as integration
  prerequisite") has not yet landed an implementation commit of its own —
  it is expected to claim **6201–6280**. This Arc claims the next free
  range, **6281–6360**, per the coordination brief's own assignment.
- Per the coordination brief: Arc A's worktree/branch/uncommitted files are
  not inspected, read, staged, or merged anywhere in this Arc. This report
  and every subsequent commit touch only
  `C:\wt\secure-memory-secret-buffer` on
  `arc/secure-memory-secret-buffer-zeroization-foundation`.

## 2. Base-lineage selection ("select the strongest compatible crypto/Rust
lineage through direct Git inspection")

Two candidate bases were inspected:

| Candidate | Tip | Contains | Verdict |
|---|---|---|---|
| `arc/runtime-secure-memory` | `406c1440` ("Add Secure Runtime Alpha 5321-5400: FedOS Secure Memory Runtime Architecture Arc") | The **normative architecture document** (`docs/runtime_secure_memory.md`, 625 lines, docs-only). Branches directly off the OLD `master` tip (`3eb9eadd`, Alpha 2581-2620) — predates ALL Direct Ratchet/NIP-17 Rust crypto work. | Doc source only — too old a Rust lineage to build production code on. |
| `arc/direct-ratchet-conversation-nip17-integration` | `b8e9e062` ("Add Secure Runtime Alpha 5561-5640") | The most recent commit touching `packages/fedos-core-rust` anywhere in this repository's history (`git log --all --oneline -- packages/fedos-core-rust` confirms). Real Direct Double Ratchet cryptographic core, real NIP-17 wire integration, and — critically — a **fully mature, production `SecretHandle` implementation** (see §3). Confirmed NOT an ancestor of Arc A's branch (`git merge-base --is-ancestor arc/desktop-beta-privacy-controls-safety-center arc/direct-ratchet-conversation-nip17-integration` → false) and confirmed to carry zero Desktop/UI/Deletion/Identity-Transition history. | **Selected.** Strongest Rust lineage, cleanly isolated from Arc A's Desktop/UI domain. |

This worktree is built on `b8e9e062`. The normative architecture document
(`docs/runtime_secure_memory.md`) is carried forward into this worktree
verbatim (byte-identical to `406c1440`'s own version — see §9) since the two
lineages never merged and the doc does not yet exist here otherwise.

## 3. HEADLINE FINDING — the normative architecture document is stale

`docs/runtime_secure_memory.md` (written against the `406c1440` lineage,
based on the OLD `master` tip) describes `SecretHandle` as essentially
unconnected: *"No Runtime, Worker, IPC, or UI code anywhere in this
repository currently constructs, holds, transmits, or references a
`SecretHandle`... there is no live secret anywhere above the Rust crate
boundary to protect yet."*

**This is no longer true on the selected `b8e9e062` lineage.** A full
source inventory (§4) shows `SecretHandle` (`packages/fedos-core-rust/src/lib.rs:1713`,
`mod secret_handle`) is a fully implemented, `pub(crate)`-only type,
already load-bearing for: the Master Seed, the Identity/Application/
Protocol Root hierarchy, Nostr signing keys, NIP-44 conversation/message
keys, and the entire Direct Ratchet Cryptographic Core (root/chain/message/
ephemeral-DH-private keys). It already satisfies the overwhelming majority
of this Arc's own Phase C "Secret Buffer" requirements: private backing
storage (`[u8; 32]` behind `secrecy::SecretBox`), strict fixed length, no
`Clone`/`Copy`/`Debug`-over-bytes/`Display`/`Serialize`/`PartialEq`, a
`pub(crate)`-at-most visibility ceiling (enforced by a dedicated TS source-
scan guard, `test/fedos_core_rust_secret_handle.test.ts`), zeroize-on-
`clear()` AND zeroize-on-`Drop` (via `secrecy::SecretBox`'s own `Drop`),
idempotent `clear()`, and a "one narrowly-named `pub(crate)` accessor per
consumer, never a generic `expose()`" discipline (eight such accessors
exist today, one per real consumer — `kdf_core`, AEAD, ECDH, and five
Direct-Ratchet-specific call sites).

**This changes this Arc's scope from "build a Secret Buffer from scratch"
to "close the two real, narrow gaps the mature implementation still has."**
Per this Arc's own mission ("do not attempt to retrofit every existing
secret flow," "prefer narrow opaque handles," "do not... broad refactor of
every crypto API"), duplicating `SecretHandle` with a second, parallel
`FedosSecretBuffer` type would itself be a violation of "narrow" — two
independent secret-owning primitives in the same crate is an auditability
regression, not an improvement. This report recommends, and this Arc
implements, extending the existing, proven `SecretHandle` boundary instead
of duplicating it.

## 4. Secret-bearing Rust type inventory

| Type | Owner (constructor) | Copy/Clone | Serialize | Drop/zeroize | WASM-visible | Risk | In scope this Arc? |
|---|---|---|---|---|---|---|---|
| `SecretHandle` (`lib.rs:1921`) | `new_placeholder()` / `new_from_32_bytes_for_internal_use(kind, [u8;32])` | No | No | Yes (`clear()` + `SecretBox` Drop) | No (never exported) | Low — mature | Extended (kind vocabulary +1 accessor), not rebuilt |
| `master_root::FedosMasterSeedHandle` (`lib.rs:3176`) | wraps `SecretHandle`, kind `MasterSeedMaterial` | No | No | Yes | No (only sealed-envelope JSON/pubkey-hex cross) | Low | Real vertical slice subject (unchanged internals) |
| `master_root::FedosNostrSecretKeyHandle` (`lib.rs:3568`) | wraps `SecretHandle`, kind `NostrSecretKeyMaterial` | No | No | Yes | No | Low | Read-only inspection |
| Direct Ratchet root/chain/ephemeral-private keys (`direct_ratchet_session.rs`, `direct_ratchet.rs`) | `SecretHandle` fields, kinds `DirectRatchetRootKeyMaterial`/`ChainKeyMaterial`/`PrivateKeyMaterial` | No | No | Yes | No (only public-key hex crosses) | Low — mature | Out of scope (no gap found — see §5) |
| `crypto::conversation_key::ConversationKey` | wraps `SecretHandle`, kind `ConversationKeyMaterial` | No | No | Yes | No | Low | Read-only inspection |
| `crypto::message_key::MessageKey` | wraps `SecretHandle`, kind `MessageKeyMaterial` | No | No | Yes | No | Low | Out of scope |
| **`crypto::nip44_message_keys::Nip44MessageKeyDecision.bytes`** (`nip44_message_keys.rs:92-96`) | **plain `Option<Vec<u8>>`** — three per-message HKDF-Expand outputs (`chacha_key` 32B, `chacha_nonce` 12B, `hmac_key` 32B) | **Yes (`Vec<u8>` is `Clone`)** | No | **No — never zeroized once it escapes the function** | No (`pub(crate)` only) | **Real gap** — `chacha_key`/`hmac_key` are genuine confidential key material sitting in ordinary heap `Vec<u8>` with no zeroize wiring at all | **IN SCOPE — Phase H migration target** |
| `FedosMasterSeedAuthority::seal`/`restore_sealed` passphrase param (`lib.rs:11229,11315`) | `&[u8]` — already bytes, not `String`, over the WASM boundary | n/a (borrowed) | No | Local copies inside `generate()` already `.zeroize()`d (`lib.rs:11206-11210`) | Yes — input only, never returned | Low | Audited (Phase G), no code change needed beyond documentation confirmation |
| `random_bytes_32()` WASM export (`lib.rs:10378`) | `-> Option<Vec<u8>>` | n/a | n/a | n/a (transient CSPRNG output, not a stored secret) | Yes | Low — general entropy export, not itself a stored secret | Out of scope, noted for completeness |

## 5. Explicitly deferred (not migrated this Arc)

- **Direct Ratchet root/chain/ephemeral-private keys** — already fully
  `SecretHandle`-backed. No raw-`Vec<u8>`/`String` gap found anywhere in
  `direct_ratchet.rs`/`direct_ratchet_session.rs`. This Arc's own mission
  named "one Direct Ratchet temporary message-key path" as a *preferred*
  migration target on the assumption a gap existed there — direct
  inspection found none. Re-stating a migration that already happened
  would be fabrication; this report instead documents the REAL gap found
  (§4, NIP-44) as the higher-value, mission-aligned substitute (it matches
  preferred target #3, "newly-created derived key material before handle
  insertion," exactly).
- **Master Seed / passphrase paths** — already `&[u8]`-typed and already
  zeroize-disciplined at every call site inspected. No code change
  required; Phase G's contribution here is the audit record itself (§8 of
  the execution spec), not new code.
- **`FedosNostrSecretKeyHandle` / Nostr signing** — already `SecretHandle`-
  backed, already zero-derives, already uses a narrow, single-purpose
  internal accessor plus a constant-time comparison. No gap found.
- **Every other WASM-crossing `Vec<u8>`/`String`** (`random_bytes_32`,
  ciphertext/plaintext bytes on `encrypt_aead`/`decrypt_aead`/Ratchet
  `encrypt`/`decrypt`) carries ciphertext, plaintext, or fresh CSPRNG
  output — never long-lived key material — and is correctly out of this
  Arc's scope.
- **Native page locking (`mlock`/`VirtualLock`)** — this crate's only
  build target relevant to Electron is WASM (`wasm32-unknown-unknown`);
  no native Desktop Rust host process exists in this repository today.
  Per Phase J, this Arc records capability status as `unavailable`
  honestly, and does not implement, wrap, or claim page locking.

## 6. Dependency policy (Phase B)

`packages/fedos-core-rust/Cargo.toml` already carries **`zeroize 1.9.0`**
and **`secrecy 0.10.3`** as direct production dependencies (adopted at
Stage 78, `Cargo.toml:1-4,104-118`), already consumed by the real
`secret_handle` module. **No new dependency is added by this Arc.** This
satisfies Phase B by inspection: the standard library alone would be
insufficient for compiler-resistant zeroization (a hand-rolled
`for b in buf { *b = 0 }` loop is not guaranteed to survive dead-store
elimination — `zeroize`'s whole purpose is a `#[inline(never)]`-plus-
volatile-write-equivalent guarantee the compiler will not optimize away);
the repository already made and documented this exact call at Stage 78,
and this Arc extends that existing, reviewed decision rather than
re-litigating it.

One accounting note surfaced during inspection: the crate's sole Rust-side
dependency-count guard test,
`crypto::secp256k1_dependency_guard::cargo_toml_has_exactly_ten_production_dependencies_after_k256_adoption`,
asserts exactly 10 production dependency lines, but `Cargo.toml` currently
has 11 (the guard's name predates the `wasm-bindgen` line). This Arc adds
**zero** new dependency lines, so the count itself does not change under
this Arc's own edits — the pre-existing 10-vs-11 discrepancy is a baseline
fact this report records honestly rather than silently repairs (repairing
another Arc's guard test outside this Arc's own diff would risk
misattributing a fix to the wrong commit); it is out of scope here.

## 7. Structural guard convention (Phase A item 9)

This crate's dominant guard pattern is a TWO-LAYER combination, confirmed
across `test/fedos_core_rust_secret_handle.test.ts`,
`test/fedos_core_rust_dependency.test.ts`, and `lib.rs`'s own
`#[cfg(test)]` modules (`lib_rs_public_pub_fn_surface_now_includes_the_stage_171_176_opaque_crypto_api`,
`no_raw_key_or_nonce_or_ciphertext_byte_is_reachable_through_the_opaque_types`):

1. A **Rust `#[cfg(test)]` structural/shape guard** inside the crate
   itself (compile-time non-Clone assertions, reachability checks).
2. A **TypeScript `?raw`-import source-string-scan guard**
   (`test/fedos_core_rust_<feature>.test.ts`) that regex-asserts exact
   `pub`/`pub(crate)` visibility and exact `pub fn` name lists.

This Arc's own new structural guards (§ Phase N of the execution spec)
follow this exact two-layer convention rather than inventing a third
pattern.

## 8. Conclusion — what this Arc actually builds

Given §3–§7, this Arc's real, bounded, additive contribution is:

1. **`FedosSecretHandleStore`** (new, `pub(crate)`, inline module in
   `lib.rs` beside `secret_handle`) — the genuinely missing piece: a
   bounded, generation-safe, opaque-ID handle REGISTRY wrapping
   `SecretHandle` values, giving use-after-destroy denial, wrong-kind
   denial, stale-generation denial, idempotent double-destroy, and
   bounded live-handle-count diagnostics BY ID rather than by Rust
   object lifetime alone — the one Phase E requirement nothing in the
   existing codebase provides today (confirmed: no handle-store/registry
   of any kind exists anywhere in `packages/fedos-core-rust`).
2. **NIP-44 message-key zeroization closure** (`nip44_message_keys.rs`
   + its two live consumers, `nip44_wire_encrypt.rs`/`nip44_wire_decrypt.rs`,
   plus their vector tests) — migrates `chacha_key`/`hmac_key` off raw,
   never-zeroized `Vec<u8>` into `SecretHandle`-backed storage (two new
   `SecretHandleKind` variants, one new narrow accessor). `chacha_nonce`
   deliberately stays a plain `Vec<u8>` — NIP-44's nonce is transmitted on
   the wire and ChaCha20's security depends on nonce uniqueness, never
   nonce secrecy; wrapping it would be zeroizing a value that was never
   confidential, which this report declines to claim as a security
   improvement.
3. **Page-locking capability/status type** (Phase J) — an honest
   `unavailable` status type, no `mlock`/`VirtualLock` implementation.
4. **Safe diagnostics** (Phase K) surfaced from the new Store.
5. Full documentation suite, structural guards (both layers, per §7),
   failure matrix, and a real Rust vertical slice (native `cargo test`,
   exercising the real `FedosMasterSeedAuthority` generate/seal/restore
   path plus the new Store's real generation-safe lifecycle) — see the
   execution spec for the exact bounded scope.

No `FedosSecretBuffer` type is created — `SecretHandle` already is that
type, and this report treats duplicating it as a documented, deliberate
non-action rather than a silent omission.
