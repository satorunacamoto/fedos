# Private Conversation Security, Storage & Capability Boundary Review — Index

Review only. **No production source is modified anywhere in this
review** — every file it adds is under `docs/reviews/private_conversation_security/`
or `test/reviews/private_conversation_security/`, and every test file
is read-only against existing, unmodified source. No Alpha number is
used. `README.md`, `package.json`, `Cargo.toml`, `p2p/`, and every other
worktree are untouched.

Performed in its own dedicated worktree/branch
(`worktree-private-conversation-security-review`), separate from the
concurrent Alpha 641–680 Public Identity/Policy implementation worktree
(which did not yet exist when this review began — `git worktree list`
was checked at the start of this pass) and from every other worktree
this repository currently holds, per this review's own instruction.

## Relationship to prior reviews

This review builds on, and does not repeat in full, two prior
review-only passes performed on the separate `review/board-runtime-api`
branch (read here via `git show review/board-runtime-api:...`, never by
switching into that worktree):

- **Board Runtime Application API & Conversation Model Review**
  (`docs/reviews/board_runtime_application_api_*` on that branch) —
  established `FedosConversationMode`, the six-axis Visibility model,
  the Membership/Participant-ref union, thread-local pseudonym
  (random-assignment recommendation), the Invitation Capability shape,
  and the Outbound Eligibility gate placement.
- **Board Runtime Application & Conversation Foundation Review**
  (`docs/reviews/board_runtime_conversation_foundation_*` on that
  branch) — named five architectural blockers, **B2** (encryption
  scheme undecided), **B4** (append-only persistence has no
  deletion/compaction), and **B5** (distributed exactly-once redemption
  undecided) among them.

**This review's own job is to turn B2/B4/B5 from named gaps into
source-grounded, concrete findings** — reading the actual crypto,
storage, and protocol code those prior reviews did not investigate in
depth — and to extend the same rigor to key distribution, membership
authorization, operator non-linkability, and moderation/encryption
tension, none of which the prior reviews covered.

## Headline finding this review adds, not present in either prior review

**This codebase has TWO separate, non-overlapping crypto seams, and
conflating them would be a serious error:**

1. `src/crypto/{types,noop_crypto,fedos_core_adapter}.ts` — still fully
   placeholder/denied-by-design (confirmed again this pass, unchanged).
2. `packages/fedos-core-rust/` + `src/runtime/fedos_runtime_*.ts` — a
   **real, working, RFC/NIST-vector-tested AEAD implementation**
   (ChaCha20-Poly1305, AES-256-GCM), a **real** Master Seed Authority
   (Argon2id-sealed), a **real** HKDF-SHA256 root-derivation hierarchy,
   and a **real, cryptographically correct, NIP-44-vector-verified
   conversation-key/ECDH pipeline** — but this last piece is
   `pub(crate)`-only in Rust (`Nip44OpaqueStatus::Unimplemented` is its
   own public-API status), never exported across the WASM boundary, and
   the whole Runtime Service layer above it fails closed to `null` in
   this checked-out tree because `packages/fedos-core-rust/pkg/` (the
   compiled WASM artifact) does not exist here — not because the
   underlying cryptography is fake.

Neither prior review investigated `packages/fedos-core-rust/` or
`src/runtime/*.ts` at all — §01 corrects the record.

## Sections

1. `01_existing_crypto_inventory.md` — the full crypto/secret-handling
   inventory summarized above, in detail.
2. `02_private_canonical_model.md` — Option A–E comparison for where
   private content lives; one recommendation, not implemented.
3. `03_conversation_identity.md` — new id types; Board/Thread id reuse
   evaluated and rejected.
4. `04_membership_authorization.md` — participant/role/authority model;
   no permanent account id required.
5. `05_key_distribution.md` — Option A–E key-ownership comparison
   against the real crypto primitives §01 found.
6. `06_key_epochs.md` — membership-change key rules; the "removal wipes
   history" misconception named and corrected.
7. `07_at_rest_storage.md` — append-only backend leakage surface;
   Option A–E storage-boundary comparison.
8. `08_deletion_retention.md` — seven distinct meanings of "deleted";
   the honest V1 contract.
9. `09_capability_invitation.md` — Capability record shape; prohibited
   shapes named explicitly.
10. `10_one_time_redemption.md` — Option A–E exactly-once comparison;
    Option E rejected per this review's own instruction.
11. `11_outbound_eligibility.md` — the gate chain, extended to Private
    mode; protocol-by-protocol fail-closed status.
12. `12_dm_group_separation.md` — shared vs. divergent structure; is
    member-count=2 sufficient to define DM.
13. `13_thread_local_pseudonym.md` — re-evaluated with the real crypto
    inventory in hand (seed-leak blast radius for deterministic
    derivation).
14. `14_operator_non_linkability.md` — the observability surface a
    "the operator can't tell who you are" claim must survive.
15. `15_bot_abuse_layers.md` — layering for private spaces specifically,
    with named anti-claims.
16. `16_moderation_encryption.md` — the moderation/E2EE tradeoff,
    stated without evasion.
17. `17_backup_multi_device.md` — deterministic-from-seed vs.
    wrapped-random-key backup, against the real Master Seed Authority.
18. `18_protocol_mapping.md` — Nostr/ActivityPub/AT Protocol/Session
    private-mode matrix; official-spec-research items flagged, not
    guessed.
19. `19_dependency_order.md` — twelve-candidate implementation order;
    largest safe single Arc.
20. `20_blockers_recommendation.md` — final classification and the one
    recommended next Arc.

## See also

- `docs/reviews/board_runtime_application_api_00_index.md` (prior
  review, branch `review/board-runtime-api`)
- `docs/reviews/board_runtime_conversation_foundation_00_index.md`
  (same branch)
