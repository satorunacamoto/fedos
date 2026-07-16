# 05 — Key Ownership and Distribution

This review does not design or invent a new cryptographic scheme —
every option below is a named, standard construction, evaluated only
against what §01 confirmed actually exists in this codebase's own Rust
core today.

## Options compared

**A. One shared Group Key**, distributed to every current member,
rotated on membership change.

**B. Each message encrypted individually per-member** (N ciphertexts
per message, one per recipient's own key).

**C. Sender Key** (each sender maintains their own symmetric key,
distributed once to the group; messages are encrypted once per sender,
not per recipient — the Signal/MLS-adjacent "sender key" pattern).

**D. Pairwise channels + group distribution** (every pair of members
shares a pairwise-derived key via §01's own real ECDH conversation-key
primitive; a per-message or per-epoch group key is then distributed to
each member over their own pairwise channel).

**E. Full delegation to protocol-native mechanism** (e.g. rely entirely
on Nostr NIP-44/NIP-17 gift-wrap's own key handling, with no FedOS-level
key management at all).

## Evaluation

- **Group size.** A/C scale delivery cost O(1) per message regardless
  of size (one ciphertext, or one-per-sender); B scales O(N) per
  message (real cost for large groups); D's per-message cost is O(1)
  once the group key is distributed, but distribution itself is O(N)
  pairwise operations, paid once per epoch (§06) rather than per
  message.
- **Member addition.** A requires re-distributing the CURRENT key to
  the new member only (§06: new member gets the current epoch,
  historical epochs stay out of reach unless separately granted); C
  requires the new member to receive every OTHER member's own sender
  key (or none, if new members only decrypt future sender-key
  messages); D requires one new pairwise ECDH + one new group-key
  delivery over it.
- **Member removal.** A/D require rotating to a NEW epoch key and
  redistributing to every REMAINING member (§06); C requires each
  remaining member to independently stop trusting the removed member's
  own sender key (no re-encryption of past content needed, but future
  messages from that sender key must be rejected) — this is C's real
  structural advantage for removal specifically.
- **Forward secrecy** (a past key compromise must not reveal FUTURE
  messages). None of A/B/C/D as stated here provide it by default — all
  are "epoch"-shaped (a key valid until the next rotation), not
  message-ratcheted. A true ratchet (Signal Double Ratchet / MLS TreeKEM)
  is a materially larger, protocol-formal undertaking this review does
  not scope.
- **Post-compromise security** (recovery after a key compromise, once
  detected). Same limitation — epoch rotation (§06) provides a coarse
  version (rotate, and the compromised key stops being useful for
  FUTURE messages) but nothing here provides it automatically or
  per-message.
- **Implementation complexity, against §01's own real Rust boundary
  specifically.** §01 confirmed a real, vector-verified NIP-44-style
  **pairwise ECDH conversation-key** primitive already exists
  (`conversation_key.rs`), `pub(crate)`-only, unexported. This is
  EXACTLY Option D's own building block (pairwise channel derivation) —
  **already implemented, already correct, zero new cryptography
  required to expose it.** Options A/B/C would each require designing
  and implementing a NEW primitive (group-key wrapping, per-recipient
  fan-out encryption, or sender-key distribution respectively) that
  does not exist in the Rust core today, in addition to formal review
  this codebase's own established "no code before formal design"
  discipline (Alpha 142-144's own decide-first-implement-later pattern,
  §01) would require.
- **Multi-device.** D's pairwise-channel foundation extends naturally
  to "one pairwise channel per (member, device)" — each device is just
  another ECDH counterparty; A/C would need a separate multi-device
  key-sync mechanism layered on top regardless of which base scheme is
  chosen.
- **Offline member.** All four require SOME durable delivery of the
  key material to an offline member once they reconnect — this is a
  Private Storage (§07) / Outbox (§11) concern, not a difference among
  A-D themselves; a pairwise-delivered group key (D) piggybacks
  naturally on the SAME Outbox-intent-shaped delivery mechanism this
  codebase already has for messages.
- **Backup/recovery.** See §17 in full — D's pairwise-derivation
  approach means a device holding the Master Seed can, in principle,
  re-derive its OWN side of every pairwise channel deterministically
  (§01's own Alpha 144 finding: everything under the Master Seed is
  deterministically reconstructible), but the GROUP key itself (however
  distributed) is not deterministically re-derivable from the seed
  alone — it must be recovered via re-delivery from a still-live peer,
  or via a separately-designed backup mechanism (§17 evaluates both).

## Recommendation: **D (Pairwise channels + group distribution) for DM specifically; D generalized as the group-distribution mechanism for private-group, with Option C flagged as the standards-track upgrade path**

For `direct` (exactly two participants, prior review's own §04): D
degenerates to a SINGLE pairwise channel — the SAME real, already-
implemented ECDH conversation-key primitive §01 found, requiring **zero
new key-distribution logic** beyond exposing the existing `pub(crate)`
Rust function across the WASM boundary (§01's own "unexported, not
unimplemented" finding).

For `private-group`: D (pairwise-distribute a group key over each
member's own pairwise channel) is the smallest extension of the SAME
already-real primitive, at the cost of the removal-doesn't-need-
re-encryption advantage C offers. This review names **C (Sender Key)
explicitly as the standards-track evaluation a future Arc should make**
once group sizes/removal-frequency in practice are better understood —
Sender Key is the pattern real, formally-specified protocols (Signal
groups, MLS's own simpler predecessor) use for exactly this tradeoff,
and this review's own instruction to name where "existing standard
protocols or a formal spec are required" applies squarely here: **a
Sender Key or MLS-style implementation should not be hand-designed by a
future FedOS Arc from scratch — it requires adopting an existing,
formally-specified scheme (e.g. implementing MLS per RFC 9420, or
reusing a vetted Sender Key construction), not inventing one.**

## Explicit refusal to invent

This review invents no new cryptographic construction anywhere above —
every option named (Group Key, per-recipient fan-out, Sender Key,
pairwise+group-distribution, protocol delegation) is a standard,
publicly-documented pattern; §01's own real primitive (ECDH
conversation-key, NIP-44-compatible) is reused as the D building block,
not modified or extended with any FedOS-specific cryptographic logic.

## See also

- `docs/reviews/private_conversation_security/01_existing_crypto_inventory.md`
- `docs/reviews/private_conversation_security/06_key_epochs.md`
- `docs/reviews/private_conversation_security/18_protocol_mapping.md`
