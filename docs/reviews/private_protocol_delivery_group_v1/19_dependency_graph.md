# Review 19 — Protocol/Group Dependency Graph

## The one blocker sitting below every package named below

Confirmed in `01`/`09`: `FedosConversationEncryptionCoordinator`/
`FedosConversationDecryptionCoordinator` both fail closed to
`"conversation-not-active"` because nothing in this repository — across
`d15a107` or the further-advanced `f7fbb67` (`01`'s own addendum) — can
construct an `"active"` Conversation. **Every package below is
downstream of this one fact**; none of them change it, and none of
them are reachable end-to-end until it changes.

## The graph

```
                    [ROOT BLOCKER: draft -> active lifecycle transition]
                    (does not exist in any branch inspected by this review)
                                    |
                +-------------------+-------------------+
                |                                        |
                v                                        v
   B. Generic Private Outbox Eligibility      D. Standard Group Crypto Decision
      (09/10/11/12/13 — protocol-neutral)        (15 — research/design only,
      depends on: an active Conversation           no code dependency)
      existing to test against; the gate
      logic itself can be WRITTEN against
      the Coordinators' own real result
      unions today, but cannot be exercised
      end-to-end until the root blocker lifts
                |
                v
   A. Nostr Direct Delivery Adapter
      (03/04/05 — protocol-native wire mapping)
      depends on: B (the eligibility gate this
      Publisher sits behind), the NIP-17/NIP-59
      research question (04, E overlaps here)
                |
                v
   C. Pairwise Fanout Group Prototype
      (16 — interim V1)
      depends on: A (needs a working single-
      recipient delivery path to fan out N times),
      PLUS a widened participant resolver (14) —
      itself a real Identity-domain code change,
      not merely a config flag

   E. ActivityPub/AT Protocol/Session Research
      (06/07/08 — pure research, no code dependency)
      blocks: any future adapter analogous to A
      for those three protocols specifically;
      does not block A, B, C, or D
```

## What may run in parallel, stated explicitly

- **B and D can start immediately, in parallel with each other and with
  E** — B's eligibility-gate *logic* can be designed and even
  unit-tested against the Coordinators' own already-real result unions
  without needing a live active Conversation (the same way this
  review's own `09` reasoned about it structurally); D is pure
  design/research with zero code dependency.
- **E can run in parallel with everything** — it blocks nothing except
  its own three protocols' eventual adapters, and nothing in this
  review's own A/B/C/D packages depends on its outcome.
- **A depends on B being at least designed** (the ordering `02`
  establishes: eligibility before Publisher) and on **the root blocker
  lifting** to be exercised for real, though its own wire-mapping code
  (`03`/`04`) can be written and unit-tested against synthetic Envelopes
  in the interim, mirroring how the Coordinators themselves were built
  and tested before any caller could reach them (`01`'s own finding:
  84 tests for Alpha 931–990 exercised the Coordinators directly,
  never through a live "active" Conversation, because none could be
  constructed).
- **C depends on A** (needs a working single-recipient path to
  replicate) **and on a widened participant resolver** — the one piece
  of this whole graph that requires a genuine, reviewed Identity-domain
  code change (widening, never replacing, `MembershipFedosConversationParticipantResolver`'s
  contract) rather than pure new-package addition.

## See also

- `01_source_inventory.md`, `09_delivery_eligibility.md`
- `15_group_strategy.md`, `16_pairwise_fanout.md`
- `20_normative_next_arc.md`
