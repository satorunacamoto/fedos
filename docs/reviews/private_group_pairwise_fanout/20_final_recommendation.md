# Review 20 — Final Recommendation

This document is the single normative reference for this review's own
recommendation, mirroring the discipline every prior review in this
lineage has established: where it repeats a conclusion from `01`–`19`,
this document governs.

## The recommendation

**Build the Fanout Coordinator (`04`) as a new, additive package,
composed entirely over the now-real, verified Direct Activation and
Messaging pipeline (`03`) — never touching `FedosConversationDirectActivationCoordinator`'s
own Private-Group Gate, `MembershipFedosConversationParticipantResolver`'s
own exactly-one-counterparty contract, or either Encryption/Decryption
Coordinator.** Concretely, the next Arc should implement:

1. A deterministic synthetic-Conversation-id mapping (`06`) from
   (group Conversation id, sorted participant pair) to a Direct
   Conversation id, as a new, small, pure module.
2. Lazy per-pair Conversation generation (`06`) — construct + activate
   a synthetic Direct draft only the first time a pair needs to
   exchange a fanout message, reusing `createDirectDraft()`/
   `activateDirectConversation()` unmodified.
3. Recipient planning (`05`) — a new, sibling enumeration function
   reading the group's own real Membership Authority for all active
   other members, never modifying the existing single-counterparty
   resolver.
4. A thin fanout send/read/list facade (mirroring
   `FedosConversationDirectMessagingCoordinator`'s own shape) that
   loops the existing `sendDirectMessage()`/`readDirectMessage()`/
   `listDirectMessages()` calls once per synthetic Conversation and
   reports a per-recipient result set (`05`), never a single collapsed
   outcome.

## What this recommendation explicitly does not authorize

- **No group key, Sender Key, or MLS implementation** (`14`/`16`/`17`)
  — fanout remains N independent pairwise channels, and this must
  never be described as providing Sender Key's or MLS's own properties.
- **No protocol delivery of any kind** (`11`/`13`) — the Fanout
  Coordinator, like Direct messaging itself today, produces only
  `"sent-locally"` results; transporting any Envelope to another
  device remains the deliberately out-of-scope "Private Conversation
  Protocol Delivery Boundary Arc" the Alpha 1111–1180 completion
  declaration itself already named as the correct next step for Direct
  mode, unchanged by this review.
- **No expiration/backup mechanism** (`12`/`15`) — both remain named,
  not designed.
- **No cryptographic invention of any kind** — no transcript-consistency
  proof (`19`), no ephemeral-key wrapping (`02`), no group ratchet of
  any kind.

## Why this is the correct next Arc, not merely a plausible one

Every property this recommendation depends on is **already real and
already verified**, not aspirational (`03`): Direct activation, send,
read, list, restart-survival, tamper-evidence, and retention-on-read
all passed real, restart-verified tests as of this review's own base
commit. The Fanout Coordinator adds pure orchestration over already-
proven machinery — the same "smallest safe package, zero new
primitives" reasoning the prior review already used to justify pairwise
fanout over any group-key scheme in the abstract
(`docs/reviews/private_protocol_delivery_group_v1/15_group_strategy.md`),
now made concrete against a codebase where that machinery is no longer
theoretical.

## What remains blocked regardless of this recommendation

Protocol delivery (`11`) — for Direct mode or for fanout — remains
entirely unbuilt. A group member cannot actually receive a fanout
message from another device until that separate Arc lands. This
review's own recommendation is therefore valuable independently (it
makes local group-message composition, storage, and multi-recipient
read/list a real, testable local capability, exactly as Alpha 1111–1180
did for Direct mode) but does not, by itself, deliver an end-to-end
usable group messaging feature — that requires this Arc AND the
Protocol Delivery Boundary Arc AND a Nostr-specific wire-mapping
decision (`01`/`02`) together, each independently valuable and
correctly sequenced by not depending on the others' completion to be
built and tested in isolation.

## See also

- `03_runtime_compatibility.md`, `04_pairwise_fanout_architecture.md`
- `19_threat_model.md`
- `docs/reviews/private_protocol_delivery_group_v1/20_normative_next_arc.md`
- `docs/secure_runtime_alpha_1111_1180_completion_declaration.md`, §16
