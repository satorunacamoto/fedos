# Private Message Envelope and Encryption Activation V1 — Specification Review

Review only. No production source, README, `package.json`, `Cargo.toml`,
or dependency change is made anywhere in this review. Every file this
review adds lives under `docs/reviews/private_message_envelope_v1/` or
`test/reviews/private_message_envelope_v1/`; every test file inspects
real, unmodified, currently-checked-out source — it never assumes any
future implementation exists. No Alpha number is assigned to this
review or to any Arc it recommends. `p2p/` (absent from this worktree)
is untouched.

## Base and Prerequisite Note

The task that seeded this review originally instructed that this work
"MUST run in a separate Git worktree and branch from Alpha 821–850."
**That branch/range does not exist anywhere in this repository.** A
direct search of every branch and worktree in this repository found the
highest existing Alpha range to be **791–820**, itself sitting on an
unmerged worktree branch — `master`'s own merged history reaches only
Alpha 621–640 (`8a718b0`, "Public Board Runtime Application API
Foundation Arc," merged into `master` at `9c1f52c`).

The user was informed of this discrepancy and **explicitly decided:
branch from current `master` HEAD instead.** This worktree
(`worktree-private-message-envelope-v1-review`, branched from `master`
at `9c1f52c`) already reflects that decision — it is not a workaround
this review invented unilaterally, and it is not a fabrication of an
Alpha 821–850 that does not exist. No file in this review claims Alpha
821–850 exists, was read, or was branched from. Everywhere the original
task text referred to "after Alpha 821–850," this review instead
anchors sequencing to the concrete Arc that fills the equivalent role —
namely, the **Conversation Identity & Record Foundation Arc**
(`conversation_foundation_v1`'s own Package A, `15_normative_v1_specification.md`
in that review), the actual next Arc recommended by the most recent
prior review in this lineage. See `19_arc_packaging.md` and
`20_normative_next_arc.md` for how this affects sequencing.

This substitution does not narrow this review's scope: everything asked
for below is derivable from current source (`src/`) and the two prior
review passes, not from anything that would have lived in a hypothetical
Alpha 821–850.

## What this review builds on

Two prior, never-merged review passes, each read in full (every
numbered doc plus its index) via direct `Read` access to their sibling
worktrees, never by checking them out or modifying them:

1. **`docs/reviews/private_conversation_security/`** (worktree
   `private-conversation-security-review`, 21 files, 01–20 + index) —
   the deep crypto/storage/capability security review. Its headline,
   load-bearing finding: this codebase has a real, RFC/NIST-vector- and
   NIP-44-vector-verified AEAD/HKDF/ECDH conversation-key pipeline in
   `packages/fedos-core-rust/`, but it is `pub(crate)`-only (never
   `#[wasm_bindgen]`-exported) and has no compiled WASM artifact in any
   checked-out tree — an **export-and-wire gap, not a from-scratch
   cryptography problem.** Cited throughout this review as **SEC §NN**.
2. **`docs/reviews/conversation_foundation_v1/`** (worktree
   `conversation-foundation-v1-review`, 16 files, 01–15 + index) —
   reconciled SEC against a since-shipped-but-unmerged Policy Arc
   (`arc/public-identity-conversation-policy` @ `f90ad71`) and cut the
   smallest safe next V1 slice: a `FedosConversationRecordV1` and
   `FedosConversationId`, public-mode only, with every private/
   membership/envelope/encryption concept explicitly out of scope and
   explicitly not faked. Cited throughout this review as **CFv1 §NN**.

**Neither prior review is re-derived here.** This review's own job,
stated by the task that commissioned it, is narrower: turn the
already-converged design conclusions of SEC and CFv1 into a precise,
implementation-ready specification specifically for **the Private
Message Envelope format and the activation of real encryption for
Direct Conversations** — treating Private Group key-management as a
decision to name, not solve.

## A genuinely new finding neither prior review made

Both SEC and CFv1 focus on `src/board/` and the not-yet-built
"Conversation" vocabulary. Neither inspects `src/chat/`,
`src/storage/`, or `src/runtime/crypto_provider.ts` in any depth (SEC's
own `boundary_guards.test.ts` touches `src/chat/types.ts` once, for one
fact, and goes no further). This review does, per its own required
reading list, and finds:

- **`src/chat/*` (Stage 16/27/111) is a second, independent,
  already-real, already-wired "private message" surface** —
  `ChatKind = "dm" | "group"`, a real `InMemoryChatDirectory`, real
  read/post policy (`src/chat/policy.ts`), already feeding
  render/notification — but `ChatMessage.content` is plain `string`,
  sourced directly from an already-signed `NostrEvent`, with **no**
  encryption field and an explicit "no NIP-04/NIP-44 decryption" scope
  note. This is structurally distinct from, and not reconciled with,
  the Board/Thread-rooted `FedosConversationMessage`/envelope vocabulary
  SEC and CFv1 both design. `03_envelope_boundary.md` resolves which
  lineage the V1 envelope belongs to and why.
- **`src/runtime/crypto_provider.ts` (Stage 249) is a *third*,
  independent placeholder crypto seam** (`RuntimeCryptoProvider`),
  deliberately separate from `src/crypto/types.ts`'s `CryptoProvider`
  (Seam 1, SEC §01) and from the real, WASM-gated
  `fedos_runtime_encrypt.ts`/`fedos_wasm_loader.ts` pipeline (Seam 2,
  SEC §01) — its own header states it is a "SEPARATE seam ... never
  reused or merged with" `CryptoProvider`. `01_crypto_inventory.md`
  documents all three seams so a future Arc does not conflate them.
- **`src/storage/*` (Stage 107/182–191) is a fourth, independent,
  Google-Drive-replacement-oriented storage placeholder**, whose own
  `reviewStoragePacket`/`reviewEncryptedPayloadDescriptor` policy
  functions **actively reject** any metadata key/value containing
  `"message"`, `"content"`, `"dm"`, `"body"`, `"chat"`, or `"private"` —
  meaning this seam, as it stands today, is structurally incompatible
  with carrying anything envelope-adjacent even as opaque metadata.
  `02_storage_alignment.md` covers this in full.

## How to navigate the other 20 docs

| # | Document | Answers |
|---|---|---|
| 01 | `01_crypto_inventory.md` | What crypto-related source exists today, real vs. placeholder, across all four seams found |
| 02 | `02_storage_alignment.md` | How `src/storage/` aligns or conflicts with SEC §07/CFv1 §08's own storage recommendations |
| 03 | `03_envelope_boundary.md` | Where the V1 envelope boundary sits — Board/Conversation lineage vs. `src/chat/` lineage |
| 04 | `04_envelope_v1.md` | The concrete Envelope v1 field shape, grounded in real wire types already in `src/runtime/fedos_wasm_loader.ts` |
| 05 | `05_encryption_suites.md` | Candidate cipher suites given the real vs. placeholder `AeadAlgorithm` unions found |
| 06 | `06_encryption_authority.md` | The Encryption Authority boundary, mirrored off the proven Master Seed Authority pattern |
| 07 | `07_decryption_authority.md` | The Decryption Authority mirror; failure modes and key lookup |
| 08 | `08_membership_readiness.md` | What membership/authorization must exist before Direct encryption activates |
| 09 | `09_direct_key_strategy.md` | Key strategy for 1:1 Direct Conversations specifically |
| 10 | `10_group_key_strategy.md` | Decision-only: Private Group key management, explicitly not solved here (Package C4) |
| 11 | `11_key_epochs.md` | How key epochs interact with the new Envelope, including an open question specific to Direct mode |
| 12 | `12_wasm_export_gap.md` | The exact `#[wasm_bindgen]` export gap, grep-verified against current `packages/fedos-core-rust/` |
| 13 | `13_runtime_activation_gate.md` | The explicit checklist before encryption can be flipped on for real |
| 14 | `14_associated_data.md` | What AEAD associated data the envelope needs bound to it |
| 15 | `15_nonce_replay.md` | Nonce/replay considerations, grounded in the real Rust nonce-generation policy comment |
| 16 | `16_failure_vocabulary.md` | A proposed, consistent failure-state vocabulary for this boundary |
| 17 | `17_retention_erasure.md` | How retention/erasure (SEC §08, CFv1 §09) interacts with encrypted envelopes |
| 18 | `18_protocol_mapping.md` | Future protocol-mapping constraints, all research-required items marked explicitly |
| 19 | `19_arc_packaging.md` | Safe Arc packages C1–C4 and their dependency order relative to CFv1's own Package A–D |
| 20 | `20_normative_next_arc.md` | The single implementation-ready recommendation for the next Arc |

## Summary of this review's conclusions

- **No encryption is activated, and no envelope is implemented, by this
  review.** Every deliverable is a specification document or a
  source-inspecting test; `src/` is untouched.
- The path to real Direct-Conversation encryption is **narrower than a
  blank slate**: a real AEAD pipeline, a real Master Seed Authority, and
  a real (but unexported) NIP-44-compatible pairwise conversation-key
  primitive already exist. The work remaining is export, wiring, and
  policy decisions — not new cryptography (SEC §01, reconfirmed by this
  review's own `01_crypto_inventory.md`/`12_wasm_export_gap.md`).
- **Two genuine blockers remain untouched by anything in this review**:
  no compiled WASM artifact exists in this tree (`packages/fedos-core-rust/pkg/`
  is absent, confirmed directly), and the conversation-key ECDH function
  remains `pub(crate)`-only. Both are named, not worked around.
- **Private Group key management is deliberately not solved** —
  `10_group_key_strategy.md` names the option space (SEC §05) and
  defers to a standards-track scheme (Sender Key / MLS) as a future
  Arc's own decision, packaged separately as Package C4.
- The single next-Arc recommendation (`20_normative_next_arc.md`) is
  **unconditional**: begin the crypto-export track (compiling the WASM
  artifact and exporting the conversation-key ECDH function across
  `#[wasm_bindgen]`) — the one package that depends on nothing from the
  Conversation model and can proceed regardless of whether CFv1's own
  Package A has shipped yet.
