# Private Protocol Delivery and Group Encryption V1 — Specification Review

Review only. No production source, README, `package.json`,
`Cargo.toml`, or dependency change is made anywhere in this review.
Every file this review adds lives under
`docs/reviews/private_protocol_delivery_group_v1/` or
`test/reviews/private_protocol_delivery_group_v1/`; every test
inspects real, unmodified, currently-checked-out source and never
asserts that any future implementation exists. No Alpha number is
assigned to this review or to any Arc it recommends. `p2p/` (present
as an untracked directory in the primary worktree, absent from this
review's own worktree) is untouched, as are Ontology, Humanizer/AI, and
GUI/Worker code — none of that source is read or referenced anywhere
in this review.

## Base commit and branch reconciliation

This review's own worktree (`review/private-protocol-delivery-group-v1`)
is branched from **`d15a107`** (`arc/private-conversation-activation-direct-messaging`
at the time this worktree was created) — the most-integrated real
commit available, combining the Conversation Runtime Consolidation Arc
(`master`'s own tip, `8b65609`) with the Identity Resolution and
Encryption Coordinator Arc (`f36c334`, Alpha 931–990). This is a
deliberately different, more advanced base than plain `master`: the
Alpha 890 key-resolution blocker `master`'s own README still describes
as open is resolved in this base. A fourth prerequisite piece named by
the task (Invitation/Draft Management, `50082bc`) sits on a separate,
unmerged branch as of this worktree's creation and is inspected via
`git show` only, never merged in — `01_source_inventory.md` documents
the full reconciliation, including a further sibling commit
(`f7fbb67`) observed and confirmed immaterial while this review was
being written. See `01` for the complete account.

## The one finding every other document in this review is downstream of

**Nothing in this repository — across every branch this review
inspected — can construct an `"active"` Conversation.** The
Encryption/Decryption Coordinators are real, wired, and correctly
fail closed to `"conversation-not-active"` for exactly this reason
(`01`). Every protocol-delivery and group-encryption question this
review answers is therefore a specification for a pipeline that is
real and correctly built, but categorically unreachable today for one
named, narrow, already-identified reason — restated throughout, never
silently assumed resolved.

## How to navigate the 20 documents

| # | Document | Answers |
|---|---|---|
| 01 | `01_source_inventory.md` | Branch reconciliation; what is real vs. review-only across the integrated source |
| 02 | `02_delivery_responsibility.md` | The required delivery ordering, grounded in the board domain's own existing precedent |
| 03 | `03_internal_vs_wire_envelope.md` | Internal Envelope vs. wire representation — option A–D compared per protocol |
| 04 | `04_nostr_readiness.md` | Exactly what Nostr delivery this repository can honestly support today (neither NIP-44 DM nor NIP-17 gift wrap, yet) |
| 05 | `05_nostr_metadata_leakage.md` | What content encryption does not hide, for Nostr specifically |
| 06 | `06_activitypub_delivery.md` | ActivityPub — no outbound Publisher exists; official research required |
| 07 | `07_atproto_delivery.md` | AT Protocol — same verdict, same research gate |
| 08 | `08_session_delivery.md` | Session — the largest research gap of the four, no adjacent machinery to reason from |
| 09 | `09_delivery_eligibility.md` | Protocol-neutral eligibility inputs, mapped onto already-real Coordinator gates |
| 10 | `10_outbox_intent.md` | Why a new, sibling Outbox intent type is recommended over reusing the board type; Observation/Retry reused as-is |
| 11 | `11_delivery_results.md` | The five-plus-two result vocabulary; the four distinct notions of "success" |
| 12 | `12_retry_duplicates.md` | Deterministic IDs, resend safety, restart recovery, permanent-rejection semantics |
| 13 | `13_delivery_storage.md` | What stays durable; no plaintext duplication into transport logs |
| 14 | `14_group_crypto_inventory.md` | Confirms no Sender Key/MLS/group-key primitive exists; group encryption is actively rejected, not merely unbuilt |
| 15 | `15_group_strategy.md` | Reconfirms the prior Security review's A–E comparison; recommends B as the safe interim, D/C retained as the standards-track future |
| 16 | `16_pairwise_fanout.md` | B specified as an honest, explicitly-limited V1 |
| 17 | `17_epochs_membership.md` | Epoch/membership-change semantics; no retroactive erasure claim |
| 18 | `18_multi_device.md` | Confirms no multi-device support exists or is implied by anything above |
| 19 | `19_dependency_graph.md` | The explicit A–E package graph and the one root blocker beneath all of it |
| 20 | `20_normative_next_arc.md` | The single normative recommendation, conditioned on Alpha 1111–1180's own outcome |

## Summary of this review's conclusions

- **No protocol delivery and no group encryption is implemented by this
  review.** Every deliverable is a specification document or a
  source-inspecting test; `src/` is untouched.
- **The Identity-domain blocker this review's own predecessors named is
  resolved** in this review's own base commit — a real
  Encryption/Decryption Coordinator pair exists, correctly wired,
  correctly fail-closed.
- **A single different, structural blocker remains**: no Conversation
  can reach `"active"` lifecycle. This is the one recommendation this
  review treats as unconditional (`20`).
- **Nostr is the only protocol with any real delivery infrastructure**
  (signing, transport, ACK correlation) — but even Nostr cannot yet
  carry a private message honestly: no NIP-17/NIP-59 gift-wrap code
  exists, and the exported conversation-key primitive is not wired to
  the (also unexported) NIP-44 per-message key schedule (`04`).
  ActivityPub, AT Protocol, and Session have no outbound delivery path
  of any kind and require official specification research this review
  does not perform (`06`/`07`/`08`).
- **Group encryption should not be implemented next.** No standard
  scheme exists in this codebase (`14`), and even the safest interim
  (pairwise fanout, `16`) requires a real, reviewed Identity-domain
  code change this review does not authorize building before a single
  direct message has ever been sent end-to-end (`19`/`20`).
