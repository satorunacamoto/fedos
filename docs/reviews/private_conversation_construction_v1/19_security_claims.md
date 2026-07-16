# Review 19 — Security Claims

## Claims that MAY be made once this construction foundation exists (per `17`'s recommended Option B)

- A `private-group`/`direct` Conversation record, once constructed,
  has exactly ONE owner Membership recorded durably before
  `"created"` is ever returned (`06`) — a caller can rely on "if I
  received `created`, an owner Membership genuinely exists," matching
  `06`'s own stricter-than-`FedosBoardRuntime` guarantee.
- A Conversation's `discoverability` is `"unlisted"` unconditionally
  for both private modes, with no caller override on either
  construction command (`07`) — "a constructed private Conversation is
  never listed" is a real, enforced claim, not aspirational.
- No bearer secret, key handle, or raw key material can ever be placed
  in a `FedosConversationRecord`, `FedosConversationPolicy`, or
  `FedosConversationCapabilityDescriptor` value — verified structurally
  in `01`/`11` (none of the three types has a field capable of holding
  one), not merely promised in prose.
- A `lifecycleState: "draft"` Conversation (`09`) is durable and has a
  real owner/policy, but is HONESTLY distinguishable, by any reader,
  from an `"active"` one — no caller can mistake a draft for a
  message-capable Conversation without deliberately ignoring the
  `lifecycleState` field.
- Revocation/leave are permanent, one-directional Membership
  transitions with no silent reactivation path — `16`'s own
  confirmation of already-shipped, already-tested behavior
  (`isFedosConversationMembershipTransitionAllowed()`).

## Claims that MUST NOT be made — restated per this review's own required list, each grounded

- **NOT "anonymous to operator"** — creator identity resolution (`02`
  axis 2, `06`) resolves a real `FedosConversationParticipantReference`
  that is durably recorded on the owner Membership; nothing in this
  construction design provides operator-side unlinkability, and this
  review makes no such claim. (The prior Security review's own §14
  "operator non-linkability" observability-surface analysis remains
  the authoritative treatment of this question; this review does not
  re-derive or weaken it.)
- **NOT "end-to-end encrypted" unless verified** — per `08`'s own
  six-sub-check finding, encryption readiness is unconditionally
  `"unavailable"` in this checked-out tree; per `09`, an unavailable
  encryption axis produces a `"draft"` Conversation, never a claim of
  encryption. Even once a future Arc lifts `08`'s blockers, "encrypted"
  may only be claimed for a SPECIFIC constructed Conversation whose own
  `lifecycleState` is `"active"` (meaning axis 6 was independently
  verified ready at construction time) — never as a blanket claim
  about `private-group`/`direct` mode itself.
- **NOT "globally one-time invite"** — `11`'s own Capability model
  provides EXACTLY-ONCE-WITHIN-ONE-AUTHORITATIVE-BACKEND-SET
  redemption, per the Durable Redemption Coordinator's own explicit,
  already-shipped limitation ("Does NOT claim: distributed
  exactly-once, safety across independent writable replicas... network
  consensus" — `src/conversation/capability/coordination/fedos_conversation_durable_redemption_coordinator.ts`'s
  own header, quoted directly). This review inherits that exact
  limitation rather than overclaiming it away.
- **NOT "remotely deleted"** — `16`'s own restated finding: retention/
  removal operations affect ONLY this Authority's own future read path
  through this one backend; the underlying JSON line remains on disk
  for the append-only backend (`FedosPayloadRetentionAuthority`'s own
  header, quoted in `16`), and NOTHING in this construction design
  reaches any remote peer, relay, or replica to delete anything there.
- **NOT "multi-device recovered"** — no device-sync, backup, or
  multi-device Membership-reconciliation concept exists anywhere in
  `src/conversation/` (`01`); this review's own construction design
  adds none. A lost device with no independent access to the creator's
  own identity/key material (itself gated by `08`'s findings) has no
  recovery path this review specifies or implies exists.
- **NOT "forward-secure group membership"** — `08`'s own finding (no
  key epoch concept exists at all) makes this claim not merely
  unearned but structurally unrepresentable in this checked-out tree;
  `16`'s own "future key epochs" row states plainly there is nothing
  for revocation to rotate. No forward-secrecy property is claimed,
  implied, or achievable by anything this review specifies.
