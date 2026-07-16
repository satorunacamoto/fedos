# 10 — Group Key Strategy (Decision Only — Not Solved Here)

Per this review's own objective, Private Group key-management is
explicitly **a decision to make, not something to fully solve** in this
review. This document exists only to keep that decision visible and
correctly framed as **Package C4** (`19_arc_packaging.md`), not to
narrow or pre-empt it.

## The option space — SEC §05, unmodified

SEC §05 already compared the standard, publicly-documented options: a
shared Group Key rotated on membership change (Option A), per-message
per-recipient fan-out (Option B), Sender Key (Option C), pairwise
channels + group-key distribution (Option D), and full delegation to a
protocol-native mechanism (Option E, rejected). Its own conclusion for
Private Group specifically:

> "D (pairwise-distribute a group key over each member's own pairwise
> channel) is the smallest extension of the SAME already-real primitive
> ... This review names **C (Sender Key) explicitly as the
> standards-track evaluation a future Arc should make** ... a Sender Key
> or MLS-style implementation should not be hand-designed by a future
> FedOS Arc from scratch — it requires adopting an existing,
> formally-specified scheme (e.g. implementing MLS per RFC 9420, or
> reusing a vetted Sender Key construction), not inventing one." — SEC §05

This review re-confirms nothing has changed at the source level to
alter that conclusion: no multi-recipient encryption primitive exists
anywhere in `packages/fedos-core-rust/` today (`01_crypto_inventory.md`,
item 7), and no group-key-distribution logic exists in `src/` at all.

## Why this review does not go further

Three reasons, all inherited from SEC §05/§19 and CFv1 §14/§15,
unmodified:

1. **No real primitive exists to build on**, unlike Direct mode
   (`09_direct_key_strategy.md`), where the underlying ECDH primitive is
   real and only unexported. Group key management for this codebase
   would be new cryptographic engineering, not an export-and-wire task —
   a materially different, larger undertaking this review's own scope
   (encryption *activation*, not new cryptographic design) excludes.
2. **Adopting MLS/RFC 9420 or a formally-specified Sender Key
   construction requires official standards research** this review
   cannot perform from repository source alone — marked here explicitly
   as such, per this review's own instruction to flag (not guess at)
   anything requiring external protocol/cryptography research.
3. **CFv1 §14's own packaging discipline already isolates this
   correctly** — Package C ("Private Message Envelope + Encryption
   Authority") in CFv1's own dependency graph is scoped to what "needs
   REAL B output" (real membership), and even there CFv1 does not
   attempt group key-distribution design. This review's own
   `19_arc_packaging.md` keeps that isolation, naming it Package C4
   specifically so a future Arc can schedule the standards research and
   design work as its own, separately-reviewed unit.

## What this document commits to, and what it explicitly does not

**Commits to:** naming the option space (above, unchanged from SEC §05)
and flagging the standards-track direction (Sender Key/MLS) as the
recommended evaluation target for whichever future Arc takes this on.

**Does not:** choose between Option D (extend the pairwise primitive) and
Option C-standards-track (adopt MLS/a vetted Sender Key scheme) as a
final V1 answer; specify wire formats, group-key rotation cadence, or
membership-change semantics for groups; or estimate the size/scope of
the eventual Arc that resolves this. Package C4
(`19_arc_packaging.md`) is deliberately left as a placeholder package —
not sequenced against C1–C3 with a specific dependency arrow beyond
"comes after Direct-mode activation proves the underlying pairwise
primitive end-to-end."

## See also

- `docs/reviews/private_conversation_security/05_key_distribution.md`
- `05_encryption_suites.md`, `09_direct_key_strategy.md`, `19_arc_packaging.md`
