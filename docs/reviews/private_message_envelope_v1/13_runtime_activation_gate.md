# 13 — Runtime Activation Gate

## Purpose

A single, explicit checklist of what must be true before Direct-mode
encryption can be flipped on for real, replacing today's
`noop_crypto`/`noop_storage`/`noop_vault` path with genuine ciphertext.
Extends CFv1 §07's conceptual `FedosPrivateConversationReadiness`
interface (never implemented there, per CFv1's own instruction) with
Envelope/Runtime-specific items this review's own deeper source reading
surfaced.

## The gate, as a checklist (design-level only — no interface or stub is added to `src/` by this review)

| # | Item | Status at this commit | Owning document |
|---|---|---|---|
| 1 | Conversation-key ECDH exported past `pub(crate)` | **Not done** | `12_wasm_export_gap.md` |
| 2 | Compiled WASM artifact present (`packages/fedos-core-rust/pkg/`) | **Not done** (absent from every checked-out tree this review inspected) | `12_wasm_export_gap.md` |
| 3 | Production-runtime gating decision made (SEC BLOCK-3: Seam 2 is Development-Runtime-only by design today) | **Not done** — no code path anywhere flips this gate for production | `01_crypto_inventory.md` |
| 4 | `FedosConversationId`/`FedosConversationRecordV1` exist (CFv1 Package A) | **Not done** | CFv1 §03/§04 |
| 5 | Real `FedosConversationMembershipAuthority` (not a sketch) exists for Direct mode | **Not done** | `08_membership_readiness.md` |
| 6 | Envelope type (`FedosConversationMessageEnvelopeV1`) exists, with `ciphertext`/`algorithm`/`aadDomain`/`keyEpoch` fields resolved to real types | **Not done** | `04_envelope_v1.md` |
| 7 | A dedicated private ciphertext storage backend exists (SEC §07 Option B) — confirmed neither Board/Outbox persistence nor `src/storage/*` nor Seam 2's `MemoryStorageBackend` qualifies | **Not done** | `02_storage_alignment.md` |
| 8 | Associated-data binding decided (conversation id / epoch / sender bound into AAD, beyond the coarse `"Conversation"` domain label) | **Not done** | `14_associated_data.md` |
| 9 | Key-epoch semantics for Direct mode decided (does it ever rotate?) | **Not done** — open question, not merely unimplemented | `11_key_epochs.md` |
| 10 | Failure vocabulary for envelope decrypt defined (distinguishing key-resolution failure from AEAD failure without creating a tamper oracle) | **Not done** | `16_failure_vocabulary.md` |
| 11 | Outbound Eligibility gate extended with the Encryption/Envelope-readiness stage (SEC §11, CFv1 §13) | **Not done** — CFv1 §13 confirms this stage is currently absent, not merely inapplicable, for any mode beyond public | SEC §11 / CFv1 §13 |

**Every item is `false`/`not done` at this commit.** This mirrors CFv1
§07's own honest table exactly — this review adds items 6–11 (Envelope-
and Runtime-specific) to CFv1's original 8 identity/crypto/storage/
retention/eligibility items, without altering CFv1's own findings for
the items it already covered (items 1–5 above map onto CFv1 §07's
Identity/Membership/Message-envelope/Encryption-authority/Key-distribution/
Private-storage rows).

## What this checklist deliberately does not include

Item 9's own Private-Group counterpart (`10_group_key_strategy.md`) is
**not** on this checklist — this gate is scoped to Direct-mode
activation specifically, per this review's own objective. A Private
Group activation gate would need every item above plus a resolved
`10_group_key_strategy.md` decision, and is not designed here.

## No stub, interface, or default value is added anywhere for this gate

Consistent with CFv1 §07's own instruction (*"This spec does not
implement this interface, a function that produces it, or any stub/
default value for it"*), this review adds no
`FedosPrivateConversationReadiness`-shaped type, function, or constant
to `src/`. `test/reviews/private_message_envelope_v1/source_alignment.test.ts`
encodes the *current, all-not-done* state as source-inspecting
assertions (each prerequisite's absence), never the interface itself.

## See also

- `docs/reviews/conversation_foundation_v1/07_private_readiness_gate.md`
- `01_crypto_inventory.md`, `02_storage_alignment.md`, `08_membership_readiness.md`, `12_wasm_export_gap.md`
