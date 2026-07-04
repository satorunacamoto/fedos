# Implementation Phase Roadmap — Stage 134 and beyond (docs only, no code)

**Status: this document adds no code.** It is Stage 133 of the **Boundary
Phase index + Implementation readiness checklist + Phase transition
roadmap** docs-only batch. It fixes the recommended ORDER for the
Implementation Phase (Stage 134+) — the phase that starts landing real,
production-reachable primitives instead of label-only boundaries — and the
rules for splitting, not combining, and rolling back that work. It changes
nothing under `src/`, `packages/`, `Cargo.toml`, or `test/`.

This restates and extends, rather than replaces,
`docs/fedos_core_architecture_freeze_v1.md` §11 ("Recommended next-phase
order") and `docs/fedos_core_rust_safety.md` §11 ("Future implementation
order") — where this document's order differs from those, it is because it
folds in storage/federation sequencing those two (crypto-only) documents
did not cover, and because Stage 131's readiness review (see
`docs/implementation_readiness_checklist.md`) surfaced the nonce-policy gap
as the correct Stage 134 starting point instead of `randomBytes`. Nothing
here overrides `docs/fedos_core_rust_safety.md`'s binding rules (§3–§9): the
`unsafe` ban, one-dependency-per-stage, vectors-at-adoption, and WASM
policy stay exactly as fixed.

---

## 1. Recommended order

Each numbered item is its own reviewed stage — never bundled with its
neighbors — starting at Stage 134:

1. **Nonce generation policy (docs only).** Fix, in writing, which nonce
   scheme this codebase uses (random vs. counter), how a nonce is sourced,
   and how (key, nonce) reuse is prevented across a process restart —
   closing the gap `docs/implementation_readiness_checklist.md` §1 names.
   **Moved ahead of `randomBytes`** relative to the plain adoption-order
   list in `docs/fedos_core_architecture_freeze_v1.md` §11: `getrandom` is
   already adopted (Stage 104), so a `randomBytes` implementation is close,
   but fixing nonce discipline in writing FIRST prevents the exact accident
   that discipline exists to prevent — a real AEAD implementation (item 5)
   reusing a (key, nonce) pair because no policy said otherwise yet.
2. **Rust `randomBytes` implementation.** Wire `getrandom` (Stage 104) to
   `random_bytes_placeholder`'s eventual real body, following the nonce
   policy item 1 just fixed. Output is CSPRNG bytes only — no key
   derivation, no AEAD call.
3. **`SecretHandle` real-byte implementation.** Extend Stage 79's
   `secret_handle` module to hold a real secret byte buffer, landing
   together with its `zeroize`-on-drop guarantee in the same stage — per
   `docs/fedos_core_rust_safety.md` §6, these may never be split across
   stages.
4. **HKDF internal implementation.** Wire the already-adopted `hkdf` crate
   (Stage 76) to a real `pub(crate)` key-derivation function, consuming a
   `SecretHandle` (item 3) as input and a fixed `domain_label` (Stage 88)
   as context — still no public API.
5. **AEAD internal implementation.** Wire `chacha20poly1305`/`aes-gcm`
   (Stage 74/101) to a real `pub(crate)` seal/open function, consuming the
   nonce policy (item 1), a `SecretHandle`-derived key (items 3–4), and
   producing an authenticated ciphertext — still no public API.
6. **Public `encrypt`/`decrypt`/`deriveKey`: skeleton → real
   implementation.** Replace `encrypt_placeholder`/`decrypt_placeholder`/
   `derive_key_placeholder`'s fixed bodies with calls into items 4–5,
   using the label vocabulary already fixed Stage 102–106
   (`docs/fedos_core_public_api_design.md`,
   `docs/public_capability_matrix.md`). This is the first stage where the
   crate's public surface does real cryptographic work.
7. **WASM build boundary.** Produce a real `.wasm` artifact (a `cdylib`
   target) behind `docs/fedos_core_wasm_safety.md`'s existing safety rules
   — provenance/pinned-digest first, still not loaded anywhere.
8. **Runtime crypto opt-in.** Wire `selectCryptoProvider`
   (`src/runtime/create_runtime.ts`, Stage 65) to actually load the item 7
   WASM artifact and call the item 6 real functions, gated behind an
   explicit opt-in flag — `NoopCryptoProvider` stays the default.
9. **Local encrypted storage.** Wire `StorageBackend`'s local candidates
   (`local_sqlite_placeholder`/`local_mesh_placeholder`, Stage 107) to a
   real local backend that stores ciphertext sealed by item 6/8 — never a
   remote backend (Google Drive, a relay) first, per
   `docs/implementation_readiness_checklist.md` §2's "local-only first"
   item.
10. **Nostr signing / publish.** Only after 1–9, consider whether any
    in-app signing (NIP-06-derived keys, per `docs/vault_crypto_identity.md`
    §2) should exist at all, and if so wire it to the existing
    `RelayPublisher` write path (Stage 12) and outbound queue (Stage 118) —
    still without weakening the "app never holds a key directly unless a
    reviewed stage says otherwise" posture that has held since Stage 10.

## 2. Why each stage is split, not merged

- **Item 1 (nonce policy) is docs-only and precedes any byte-producing
  code** so that item 5 (AEAD) has a written contract to implement against,
  instead of inventing nonce handling ad hoc under implementation pressure
  — the exact failure mode `docs/vault_crypto_identity.md` §3 warns about.
- **Items 2–6 are ordered as a strict dependency chain** (`randomBytes` →
  secret storage → KDF → AEAD → public API): each later item consumes the
  previous item's output, so building them out of order would mean
  designing a public API before its own building blocks exist — the same
  mistake `docs/fedos_core_architecture_freeze_v1.md` §11 already avoided
  once by ordering AES-GCM adoption before public API design.
- **Item 3 (`SecretHandle` real bytes) is inseparable from its own
  zeroize guarantee** per the existing binding rule
  (`docs/fedos_core_rust_safety.md` §6) — this is not a new rule, just this
  roadmap's restatement of where in the sequence it lands.
- **Item 7 (WASM) is separated from item 6 (real crypto)** because
  producing a `.wasm` artifact and loading it at runtime are, per
  `docs/fedos_core_rust_safety.md` §8, "distinct, later, explicitly-reviewed
  Stages — never folded into a crypto-implementation Stage." Item 8
  (Runtime opt-in) is the loading step, kept separate again for the same
  reason.
- **Item 9 (local storage) is ordered after real AEAD exists (items 5–6)**
  because an "encrypted packet format" cannot be designed, let alone
  implemented, before there is a real seal/open function to format around
  — reversing this order would produce a storage format that has to be
  redesigned once real AEAD lands.
- **Item 10 (Nostr signing/publish) is last** because it is the highest
  blast-radius item (a real private key existing anywhere in this
  codebase for the first time) and should only be attempted once the
  crypto core it would depend on (items 2–8) is real, tested, and
  WASM-loadable — not before.

## 3. What must NOT be combined into one stage

Consistent with `docs/fedos_core_rust_safety.md` §4–§5 ("adopt per
feature, per Stage... never a bulk 'add all crypto' commit"), the
following combinations are explicitly forbidden for Stage 134+:

- **Crypto + storage + federation in the same stage.** Each is its own
  domain with its own review; a single stage touching all three would make
  it impossible to bisect a regression to one domain, and would violate
  the one-concern-per-stage convention this codebase has followed since
  Stage 1.
- **Payment + entitlement in the same stage.** `docs/creator_monetization_flow.md`
  already fixes their sequencing (listing → purchase → payment →
  entitlement); implementing both at once would make it impossible to
  verify entitlement's "never checks a real payment" guardrail
  (`src/creator/subscription_policy.ts`, Stage 125) independently of
  payment actually existing.
- **NIP-44 + chat in the same stage.** Chat's plaintext-only posture
  (`src/chat/*`, Stage 16 — "nothing is sent and no DM is encrypted... NIP-04/
  NIP-44 are out of scope") and a real NIP-44 implementation are
  independently risky; combining them would mean the first stage that
  introduces real DM encryption is also the first stage that changes the
  chat transport contract, doubling the blast radius of a single review.
- **Any two items from §1's numbered list in one stage**, even adjacent
  ones (e.g. items 4 and 5, HKDF and AEAD) — each has its own test-vector
  surface and its own "what does this NOT yet do" boundary that must be
  independently reviewable, matching every prior crypto stage's pattern
  (`chacha20poly1305` Stage 74 separate from its vector-wiring Stage 75,
  `hkdf` Stage 76 separate from Stage 77, `argon2` Stage 84 separate from
  Stage 85).

## 4. Rollback strategy

- **Every stage in §1 must be revertible independently.** Because each
  stage is scoped to one concern (per §3), reverting a single commit/PR
  must not require reverting a later stage's work — the same property
  that has held for all 130 boundary stages, where reverting e.g. Stage 118
  (outbound queue) would not require touching Stage 122 (its preview) if
  the preview stage itself needs to roll back.
- **Every opt-in flag defaults OFF, so reverting the flag is always
  sufficient before reverting the code.** Item 8 (Runtime crypto opt-in)
  and item 9 (local encrypted storage selection) must both follow the
  existing `select*`-function convention (`ENABLE_MESHKV_ASSET_CACHE`-style
  env gate) — if a real implementation misbehaves in production, flipping
  the flag off is the first rollback step, full code revert the second.
- **Test-vector stages (items 2, 4, 5) are the lowest-risk to roll back**
  since they land behind `#[cfg(test)]` or `pub(crate)` only, matching
  every Stage 74–101 crypto stage's actual production blast radius (zero,
  until item 6 exposes a public API).
- **Item 10 (Nostr signing) requires an explicit kill switch design as
  part of the stage itself**, not an afterthought — given it is the first
  stage where a real private key could exist in this codebase, its own
  PR must state how signing is disabled/reverted without leaving key
  material in an inconsistent state (e.g. a partially-written encrypted
  seed). This is a new requirement this roadmap adds, since no prior stage
  needed it.
- **No stage may be rolled back by deleting test vectors or weakening a
  guard test.** If a stage must be reverted, the revert removes the
  implementation and its wiring — it never removes or loosens the
  RFC/NIST vector check or the Runtime/Worker "not auto-wired" guard test
  that would have caught the regression.

## 5. Test gates (must pass before advancing to the next item in §1)

- `npm run typecheck` — GREEN, no new `any`/unchecked cast introduced to
  paper over a type mismatch.
- `npm test` — GREEN, with the full existing count plus whatever new tests
  the stage adds; no existing test is deleted or weakened to make a new
  stage pass.
- `cargo check` — GREEN (this environment currently has no `cargo` on
  `PATH`; re-confirm in an environment that does before Stage 134 lands
  any Rust change, per `docs/implementation_readiness_checklist.md` §6).
- `cargo test` — GREEN, and the RFC 8439 / RFC 5869 / RFC 9106 / NIST
  AES-256-GCM vector tests specifically must still pass unmodified —
  a new item in §1 must never edit an existing vector-verification module
  to make room for itself; it adds a new module instead (the same pattern
  Stage 75→77→85→101 already used).
- **A dedicated Runtime/Worker source-string guard test per stage** —
  the same pattern every Stage 34–130 boundary used — asserting the new
  primitive is NOT auto-called from `src/runtime/create_runtime.ts` or
  `src/worker.ts` unless that stage's own explicit opt-in flag is set.
  This gate applies to every item in §1 except item 1 (docs-only) and
  item 6 while it remains behind the item 8 flag.
- **`git status` clean** (aside from the stage's own intended files) before
  every commit, and a review confirming no secret/test-vector/key material
  was accidentally added to a commit, per
  `docs/fedos_core_rust_safety.md` §9's build-artifact policy.

## 6. Conclusion

- Stage 134 begins with **nonce generation policy docs**, not
  `randomBytes` — a deliberate reordering of
  `docs/fedos_core_architecture_freeze_v1.md` §11's plain adoption order,
  justified by the accident it prevents in item 5 (AEAD).
- Ten items carry the crypto → storage → federation implementation arc
  from Stage 134 through the first real Nostr signing stage; each is its
  own reviewed stage, none may be combined with its neighbors, and §3
  names three cross-domain combinations that are forbidden outright
  (crypto+storage+federation, payment+entitlement, NIP-44+chat).
- Every stage must be independently revertible (§4) and must pass the
  same test gates (§5) that every Stage 1–130 boundary already passed —
  the Implementation Phase does not relax any existing guardrail, it only
  starts landing real bytes behind them.
