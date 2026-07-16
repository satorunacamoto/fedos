# 19 — Arc Packaging

## Reconciling with CFv1 §14's own Package A–D

CFv1 §14 already packaged the Conversation Foundation work into Package
A (Identity + Record, unblocked, recommended next), B (Membership +
Capability), C (Private Message Envelope + Encryption Authority), D
(Private Storage + Retention). This review's own task is to turn CFv1's
Package C — named but not detailed by CFv1 — into implementation-ready
sub-packages, plus split out Private Group key-management (implicit
inside CFv1's Package C, never separated) into its own package. This
review does not rename or restructure CFv1's Package A/B/D.

## Package C1 — Envelope Types + Validator + Persistence Metadata

**Scope**: `FedosConversationMessageEnvelopeV1` (`04_envelope_v1.md`),
its validator (mirroring `validateFedosBoardPost`'s own discipline —
reject malformed shapes, never interpret unknown fields), and a metadata
persistence port structurally parallel to `FedosConversationPersistence`
(CFv1 §08) — never carrying `ciphertext`, per `02_storage_alignment.md`'s
own finding that no existing seam is a safe home for it.

**Blockers**: CFv1's own Package A (`FedosConversationId` must exist
first — the Envelope's `conversationId` field has nothing to reference
otherwise). **Not blocked on**: encryption export (`12_wasm_export_gap.md`),
membership (`08_membership_readiness.md`), or the compiled WASM
artifact — C1 can be built and type-check with `ciphertext` typed as
`AeadCiphertextWire` without ever calling `encrypt()`/`decrypt()` for
real, exactly as CFv1 §02's own Option C precedent already established
(`mode` field type-admits values the validator does not yet accept).

## Package C2 — Encryption Authority Rust/WASM Boundary

**Scope**: the two independent gaps `12_wasm_export_gap.md` names —
exporting `derive_conversation_key_via_ecdh_internal` past `pub(crate)`
via `#[wasm_bindgen]` (a Rust source change, following the
`generate_aead_key_handle` pattern exactly), and producing a compiled
`packages/fedos-core-rust/pkg/` artifact (a build/tooling step, the
`build:wasm` script already exists in `package.json`). Also includes the
production-runtime gating decision (SEC BLOCK-3, `13_runtime_activation_gate.md`
item 3).

**Blockers**: **none from the Conversation model.** This is CFv1 §14's
own finding, reused unchanged: *"this track has no dependency on
Packages A/B and could start in parallel with either."* This review
reconfirms it applies identically to C2 — it touches only
`packages/fedos-core-rust/` and build tooling.

## Package C3 — Direct Conversation Encryption Activation

**Scope**: `06_encryption_authority.md`/`07_decryption_authority.md`'s
`resolveConversationKey()` made real (needs C2's export), wired to C1's
Envelope type, `09_direct_key_strategy.md`'s pairwise key resolution,
`14_associated_data.md`'s AAD-binding decision resolved, `16_failure_vocabulary.md`
adopted, the Outbound Eligibility gate extended with the
Encryption/Envelope-readiness stage (SEC §11, CFv1 §13), and a real
`FedosConversationMembershipAuthority` for Direct mode specifically
(`08_membership_readiness.md`).

**Blockers**: C1 (needs the Envelope type as a real target — mirrors
CFv1 §14's own "C must wait for B's real implementation, not merely B's
interface sketch" caution, applied here to C1), C2 (needs the real
export + artifact), a real Direct-mode membership authority (CFv1's own
Package B, at least the Direct-mode-degenerate slice of it — see
`08_membership_readiness.md`'s own finding that Direct's membership
check is structurally simpler but not exempt), and a dedicated private
storage backend (CFv1's own Package D, `02_storage_alignment.md`).

## Package C4 — Private Group Key-Management Decision

**Scope**: `10_group_key_strategy.md`'s own explicitly-deferred decision
— evaluate and adopt a standards-track scheme (Sender Key / MLS per RFC
9420, per SEC §05's own refusal-to-invent finding) for Private Group
specifically. **Requires official cryptography/standards research**,
named as such, not resolvable from repository source.

**Blockers**: conceptually needs C3 to have proven the underlying
pairwise primitive end-to-end first (per `10_group_key_strategy.md`'s
own framing) but has no direct code dependency on C1/C2/C3's own
artifacts — a future Arc could, in principle, begin the standards
research for C4 in parallel with C1–C3, even though implementing the
result would still need C1/C2's foundations.

## Dependency graph

```
CFv1 Package A (Conversation Identity & Record — not this review's own scope)
        |
        v
Package C1 (Envelope types + validator + persistence metadata)
        |
        |         Package C2 (Encryption Authority Rust/WASM export)
        |         [NO dependency on A or C1 — may start immediately, in parallel]
        |                 |
        +-----------------+
                 |
                 v
   CFv1 Package B (Membership, at least Direct-mode slice)   CFv1 Package D (Private Storage)
   [needs CFv1 Package A]                                     [needs CFv1 Package A; parallel with B]
                 |                                                      |
                 +-----------------+-----------------------------------+
                                   |
                                   v
                     Package C3 (Direct Conversation Encryption Activation)
                                   |
                                   v
                     Package C4 (Private Group key-management decision + implementation)
                     [standards research may begin earlier, in parallel]
```

## What may run in parallel once the equivalent of "Alpha 821–850" lands

Per this review's own Base and Prerequisite Note (`index.md`): the task
that seeded this review referred to sequencing "after Alpha 821–850," a
range that does not exist. This review anchors that same sequencing
point instead to **CFv1's own recommended next Arc — the Conversation
Identity & Record Foundation Arc (CFv1 Package A)** — since that is the
actual next Arc in this lineage's own dependency chain. Once Package A
lands: **C1 and C2 may both start immediately and in parallel** (C1
depends on A; C2 depends on nothing in this diagram at all and could
have started even before A, per CFv1 §14's own finding). **CFv1 Package
B and D may also start in parallel with each other and with C1/C2** once
A lands, per CFv1 §14's own unchanged finding. **C3 must wait** for C1,
C2, a real (at least Direct-mode) Package B, and Package D, all four.
**C4 must wait for C3** to implementation-complete, though its own
standards-research sub-task may begin earlier.

## See also

- `docs/reviews/conversation_foundation_v1/14_arc_packaging.md`
- `docs/reviews/private_conversation_security/19_dependency_order.md`
- `20_normative_next_arc.md`
