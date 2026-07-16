# Review 14 — Implementation Arc Packaging

## Packages compared

**Package A — Conversation Identity + Record + Public Policy reuse.**
`03`+`04`+`05` as specified: `FedosConversationId`, the V1 Conversation
record, a `FedosConversationPersistence` port (`08`), zero changes to
the Policy Arc's own `FedosConversationPolicy`. No blockers — every
prerequisite is either already shipped (Policy Arc) or already
confirmed absent-and-buildable (this spec's own `03`/`04`/`08`).
**Buildable immediately, independent of every other package and
independent of the in-progress Nostr Identity Binding Arc's outcome.**

**Package B — Membership + Capability.** `10`+`12` made real:
`FedosConversationMembershipAuthority` implemented, `FedosConversationParticipantRef`
chosen, `FedosConversationInviteAuthority` widened past its single
`"none"` value. Blocked on Package A shipping first (every membership
record needs a real `FedosConversationId` to reference — Package A is
what creates that). Also blocked on a **product decision**, not just
engineering: which single redemption authority model to adopt (`12`'s
single-authority requirement) is a choice this spec cannot make for a
future Arc. The interface *shape* from `10` can be drafted as
documentation in parallel with Package A, but no real implementation
can start meaningfully before A ships.

**Package C — Private Message Envelope + Encryption Authority.**
`11` made real: WASM artifact compiled, conversation-key derivation
exported past `pub(crate)`, a production-gating decision made (SEC's
BLOCK-3), and the envelope wired to real sender/recipient membership
context. Blocked on **two independent prerequisites**: (1) the
crypto-export track (compiling the WASM artifact, exporting the
conversation-key function, deciding production gating) — this track has
no dependency on Packages A/B and could start in parallel with either;
(2) Package B's real output (a message needs a real membership/participant
context to encrypt for, not just B's interface shape). **C must wait
for B's real implementation, not merely B's interface sketch** — this
is stricter than "B and C in parallel," because an envelope built
against B's placeholder interface would repeat exactly the
mislabeling risk SEC §19 warns about (a type that looks wired but
isn't).

**Package D — Private Storage + Retention.** SEC §07's dedicated
backend design, made real, plus a product decision on which of SEC
§08's eight deletion meanings a V1 private-delete action performs.
Needs `FedosConversationId` (Package A) as a foreign key, but needs
**nothing** from Package B or C to be designed and largely built — a
storage backend's schema and file-permission hardening do not require
membership or encryption to exist, only somewhere for a future
ciphertext to eventually be written. **Can proceed in parallel with
Package B**, and must complete before Package C's ciphertext-writing
path is real (C needs somewhere to write to).

## Parallelizable vs. sequential

```
Package A (unblocked, start now)
    |
    +--> Package B (membership/capability; also needs a product decision on redemption authority)
    |         |
    |         v
    +--> Package D (storage/retention; parallel with B, no B/C dependency)  --> Package C (needs REAL B output + independent crypto-export track + Package D's backend)
```

- Nothing may start meaningfully before Package A — every later package
  references `FedosConversationId`.
- B and D may proceed in parallel once A ships; neither depends on the
  other.
- C depends on both B (real, not sketch) and D (a place to write
  ciphertext), plus its own independent crypto-export prerequisite,
  which may itself be worked in parallel with A/B/D since it touches
  only `packages/fedos-core-rust/` and WASM build tooling, not the
  Conversation model at all.
- The in-progress, unmerged Nostr Identity Binding Arc is orthogonal to
  all four packages — it concerns public-mode Nostr delivery, not
  Conversation Identity, membership, encryption, or storage — and
  blocks none of them. See `15_normative_v1_specification.md` for how
  its outcome affects sequencing *after* Package A regardless.

## This spec's own scope

This review specifies Package A in full (`03`/`04`/`05`/`08`) as the
next implementation Arc. Packages B/C/D are scoped and ordered here but
not designed to implementation-ready detail — each still has an open
product decision (redemption authority choice, deletion-meaning choice,
production crypto-gating choice) that an engineering Arc alone cannot
resolve.
