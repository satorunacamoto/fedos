# 11 — Key Epochs and the Envelope

## SEC §06, reconciled against the concrete Envelope shape

SEC §06's rules are adopted unmodified: a new member's epoch begins at
`joinedAt`, no automatic retroactive history grant; a removed member
must not receive the next epoch; rotation authority tracks removal
authority; epoch transitions are their own append-only-logged fact; key
delivery must happen strictly after membership is durably recorded. This
review's own `04_envelope_v1.md` binds `keyEpoch` directly onto every
Envelope instance, exactly as SEC §02's own illustrative
`FedosConversationMessage.keyEpoch` field already did — no change to
that decision.

## The open question this review's own Direct-mode focus surfaces

SEC §06's own rotation-authority rule states: *"rotation authority
should be narrower than, or equal to, invite authority... Recommended
default: rotation authority tracks the SAME role tier `revoke`(removal)
authority already requires, since rotation is typically triggered BY a
removal."* SEC §12 separately states Direct has **no removal concept**
short of ending the conversation entirely.

**Composing these two findings (neither SEC nor CFv1 does so explicitly)
produces a real, unresolved question: if rotation is "typically
triggered by a removal," and Direct has no removal, what — if anything —
ever triggers a Direct conversation's epoch to advance past its initial
value?**

Three honest answers, named without choosing among them (this review
does not decide product questions any more than SEC/CFv1 did for their
own undecided items):

1. **A Direct conversation's `keyEpoch` never increments** — it is fixed
   at its initial value for the conversation's entire lifetime, since no
   membership event in a two-fixed-participant conversation ever
   provides SEC §06's own natural rotation trigger. This is the simplest
   honest V1 answer and requires no new mechanism.
2. **A Direct conversation supports an explicit, user-initiated "rotate
   my key" action**, independent of any membership event, e.g. as a
   manual security hygiene action (analogous to "reset this
   conversation's key" in some real chat products). This requires new
   product-level design SEC/CFv1 never specified for Direct mode, since
   both reasoned about rotation only in the removal-triggered frame.
3. **A Direct conversation's epoch advances on device-loss recovery**
   (SEC §06's own "lost-device recovery" path, option (a): the member
   rejoins fresh, receiving only the current epoch going forward) — this
   is really a *membership* event in disguise (leave + rejoin), so it is
   arguably not a genuine exception to "Direct has no removal," merely a
   degenerate one-participant-at-a-time case of it.

**This review does not choose among the three.** It is named here
because `04_envelope_v1.md`'s `keyEpoch` field is concrete enough now
that a future Arc implementing Direct-mode encryption will hit this
question directly and must not assume option 1 by default without
recording that it did — SEC §06's own discipline ("a future Arc must
decide this as a named option, never an implicit default either way")
applies here identically.

## Epoch persistence — SEC §06, unchanged, restated against the real record shape

SEC §06 requires `FedosConversationKeyEpoch` (SEC §03's branded
`number`) to be a durable, append-only-logged fact, with epoch
transitions as their own record — mirroring CFv1's own "history
preserved, never mutated in place" discipline already established for
`FedosConversationPersistence` (CFv1 §08's `inserted`/`already-present`/
`conflict`/`failed` write-result vocabulary). This review does not
design a `FedosConversationKeyEpochPersistence` port — it is out of
scope for the same reason CFv1 §08 left `FedosConversationPersistence`
metadata-only: no key-epoch transition mechanism exists yet to produce
records for such a port to store.

## See also

- `docs/reviews/private_conversation_security/06_key_epochs.md`
- `04_envelope_v1.md`, `09_direct_key_strategy.md`, `10_group_key_strategy.md`
