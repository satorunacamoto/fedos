# Private Group Pairwise Fanout — Specification Review

Review only. No production source, README, `package.json`,
`Cargo.toml`, or dependency change is made anywhere in this review.
Every file this review adds lives under
`docs/reviews/private_group_pairwise_fanout/` or
`test/reviews/private_group_pairwise_fanout/`; every test inspects
real, unmodified, currently-checked-out source and never asserts that
any future implementation exists. No Alpha number is assigned to this
review or to any Arc it recommends. `p2p/`, Ontology, Humanizer/AI, and
GUI/Worker code are untouched — none of that source is read or
referenced anywhere in this review. No new cryptography is designed;
`FedosConversationDirectActivationCoordinator`, the Encryption/Decryption
Coordinators, and `MembershipFedosConversationParticipantResolver` are
treated as frozen throughout.

## Base commit

This review's own worktree (`review/private-group-pairwise-fanout-v1`)
is branched from **`d8f01cf`** (`arc/private-conversation-activation-direct-messaging`,
"Secure Runtime Alpha 1111–1180: Private Conversation Activation and
Direct Messaging Runtime Arc") — the tip commit at the time this
worktree was created, integrating the Identity Resolution/Encryption
Coordinator Arc, the Invitation Transport/Draft Management Arc, and the
new Activation/Messaging layer onto one branch. This is a materially
different, more advanced base than the prior review in this lineage
(`docs/reviews/private_protocol_delivery_group_v1/`), which was written
against `d15a107` before Alpha 1111–1180 existed — that prior review's
own task explicitly anticipated this: "After Alpha 1111–1180 lands,
rebase and revalidate the review before merge." This review IS that
revalidation, narrowed to the pairwise-fanout question specifically.

## The one finding every other document in this review is built on

**Direct-mode private messaging is now genuinely real, end to end**
(activation, send, read, list, restart-survival, tamper-evidence,
retention-on-read — all verified against real append-only backends and
the real `startFedosDesktopRuntime()` entry point, with injected Fake
crypto Authorities standing in for the still-unbuilt WASM artifact).
**Private-group activation remains permanently, deliberately rejected**
(`"unsupported-mode"`, Alpha 1123's own "Private-Group Gate") — a
`private-group` Conversation can be constructed, membered, and
invited-to, but can never itself send or read a message. Every
document below specifies how group messaging becomes possible WITHOUT
ever widening that gate or any other frozen file — by composing the
real Direct-mode pipeline N times, once per member pair, under a new,
additive orchestration layer.

## How to navigate the 20 documents

| # | Document | Answers |
|---|---|---|
| 01 | `01_nip17_inventory.md` | Reconfirms zero NIP-17 code exists; names why fanout does not need it |
| 02 | `02_gift_wrap_inventory.md` | Reconfirms zero gift-wrap code exists; separates transport-layer from content-layer concerns |
| 03 | `03_runtime_compatibility.md` | The load-bearing finding: Direct mode is real, private-group activation is permanently gated |
| 04 | `04_pairwise_fanout_architecture.md` | The core design: a group container + N synthetic, independently-activated Direct Conversations |
| 05 | `05_recipient_planning.md` | How active recipients are enumerated per send, without modifying the frozen participant resolver |
| 06 | `06_conversation_generation_boundaries.md` | When/how synthetic per-pair Conversations are created — lazily, deterministically |
| 07 | `07_group_membership_evolution.md` | Where membership-change signal lives (the group roster only) |
| 08 | `08_history_semantics.md` | Why there is no single group history, only a local union of pairwise histories |
| 09 | `09_member_removal.md` | Removal excludes from future fanout; cannot revoke already-derived keys |
| 10 | `10_member_addition.md` | New members get no historical access; synthetic Conversations form lazily |
| 11 | `11_offline_delivery.md` | Confirms no offline/queue/store-and-forward exists; fanout does not close this gap |
| 12 | `12_expiration_strategy.md` | Confirms `expiresAt` exists only on Capability/Invitation; recommends no new message expiration |
| 13 | `13_relay_trust_assumptions.md` | Confirms the single-relay assumption is a repeated, deliberate hard guardrail |
| 14 | `14_local_canonical_history.md` | "Canonical" means local-deterministic, never cross-participant-agreed |
| 15 | `15_backup_model.md` | No backup exists; states what a future design must preserve (whole logs, not just keys) |
| 16 | `16_sender_key_comparison.md` | Sender Key remains the standards-track alternative; comparison against fanout |
| 17 | `17_mls_comparison.md` | MLS remains entirely absent and out of scope; comparison against fanout |
| 18 | `18_migration_path.md` | Fanout history does not auto-convert to a future Sender-Key/MLS scheme |
| 19 | `19_threat_model.md` | What fanout protects and explicitly does not protect against |
| 20 | `20_final_recommendation.md` | The single normative recommendation: build the Fanout Coordinator, nothing more |

## Summary of this review's conclusions

- **No group messaging is implemented by this review.** Every
  deliverable is a specification document or a source-inspecting test;
  `src/` is untouched.
- **Direct messaging's own newly-real, verified architecture is the
  correct and sufficient foundation for pairwise fanout** — no new
  cryptographic primitive, Coordinator, or persistence format is
  needed; only a new, additive orchestration layer composing existing
  machinery N times per group message.
- **The Private-Group Gate must never be widened** — it is a
  deliberate, reviewed boundary (`03`), and this review's own
  recommendation (`20`) is designed specifically to never require
  touching it.
- **Protocol delivery remains entirely unbuilt**, for Direct mode and
  therefore for fanout too (`11`/`13`) — this review's own
  recommendation makes group messaging a real LOCAL capability, not an
  end-to-end usable feature; that requires a separate, already-named
  Protocol Delivery Boundary Arc in addition.
- **Sender Key and MLS remain the correct standards-track future
  direction** (`16`/`17`), unimplemented, with no automatic migration
  path from fanout-era history (`18`) — named, not built.
