# Review 15 — Group Strategy Decision

## This review reconfirms, not re-derives, the prior Security review's A–E comparison

`docs/reviews/private_conversation_security/05_key_distribution.md`
already compared **A** (shared group key), **B** (per-recipient
individually-encrypted copies), **C** (Sender Key), **D** (pairwise
channels + group distribution), and **E** (full protocol delegation),
and recommended **D** as the eventual target with **C** named as the
standards-track upgrade path. This review does not re-run that
comparison; it re-evaluates the recommendation against the source
facts `14` just reconfirmed as materially changed (a real, wired,
single-counterparty pairwise pipeline now exists, actively rejecting
>1 member) and against this review's own required framing: "choose the
safest realistic next step, not the most ambitious."

## Why D is not the safe *next* step, even though it remains the correct eventual target

D requires a genuinely new primitive that exists nowhere in this
codebase today: a **group key** — some symmetric secret independent of
any single pairwise channel, generated once and distributed over N
pairwise channels. Nothing in `packages/fedos-core-rust/` or
`src/conversation/` generates, wraps, or transports such a key (`14`).
Building D's own minimum viable form therefore requires: a new key-
generation primitive, a new wrapping/transport format, a new epoch
concept for that key specifically (distinct from the Envelope's
already-existing but currently-fixed `keyEpoch`, `17`), and a widening
of the participant resolver's own single-counterparty assumption
(`14`) to iterate over N members instead of rejecting them. That is
four new pieces of design, not one.

## Why B (pairwise fanout) is the safe next step

Option B — one separately, pairwise-encrypted copy of the SAME message
per active recipient — requires **zero new cryptographic primitives**.
It reuses the exact, already-wired, already-vector-verified pairwise
pipeline (`FedosConversationEncryptionCoordinator.encrypt()`,
14/01) called once per active other-member instead of failing closed
at `"ambiguous-counterparty"`. The only code change required is
widening `MembershipFedosConversationParticipantResolver` (or adding a
sibling multi-recipient resolver alongside it, never modifying its
existing single-counterparty contract, per this review's "prefer
adapters" instruction) to enumerate every other active member rather
than reject a count other than one. This is `16`'s own subject in
full.

## Comparative evaluation against the axes this review's own task names

| Axis | B (pairwise fanout) | D (shared group key) |
|---|---|---|
| Current Membership durability | Already real (`FedosConversationMembership`, persisted) — sufficient for either | Same |
| Member removal | Trivial — stop including the removed member's own resolver output in future fanout; no re-encryption of past content needed (same property SEC §05 already noted for Sender Key removal, applies here too since there is no shared secret to rotate) | Requires a NEW epoch rotation + redistribution to every remaining member |
| Forward secrecy | None (matches SEC §05's finding: neither option provides it) | None |
| Large groups | Explicitly NOT this review's own target shape (`16` names a hard size limit) — O(N) ciphertexts per message, real cost | Also does not scale losslessly, but O(1) per message once distributed |
| Multi-device | Not solved by either (`18`) | Not solved by either |
| History access for new members | Explicit, named policy required either way (`17`) | Same |
| Implementation dependencies | Zero new primitives | One new primitive (group key generation/wrapping) |
| Standardization | Not standards-track — an interim, explicitly-labeled V1 only (`16`) | Not standards-track either, though closer in shape to real protocols' own group-key distribution patterns |

## Recommendation

**Retain D and C (Sender Key) as the named standards-track future
direction, unchanged from the prior Security review — this review does
not overrule that conclusion.** For the **immediate next step**, this
review recommends **B, pairwise fanout, as an explicitly-labeled,
size-limited interim V1** (`16`), precisely because it is buildable
with zero new cryptographic primitives against source that already
exists and is already reviewed, and because the task's own framing
asks for the safest realistic next step rather than the most ambitious
one. **Group encryption of any kind remains recommended against for
immediate implementation** — `20` states the conditional exact
scope.

## See also

- `14_group_crypto_inventory.md`, `16_pairwise_fanout.md`
- `docs/reviews/private_conversation_security/05_key_distribution.md`
