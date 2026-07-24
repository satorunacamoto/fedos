# 06 — Rotation vs. Replacement vs. Recovery vs. Migration vs. Alias

Used consistently across every document in this review; no other term
is substituted for these five.

## Rotation

**The same logical identity continues under a new cryptographic key.**
Requires an indirection layer between "the logical identity" and "the
key currently representing it" — something a verifier can consult to
learn "key K2 now speaks for the identity that used to be K1." **`05`
proves this indirection layer does not exist anywhere in this codebase.**
Building it is possible in principle (e.g., populate the already-reserved
`identityId` field as a stable anchor, and teach every consumer to
resolve `identityId → current key` rather than trusting `publicIdentifier`
directly) but is a genuinely new mechanism, not an extension of anything
live today. **This review does not recommend building it for V1** (`18`,
`20`) — the risk/complexity is disproportionate to the benefit over
Replacement, given the Master-Seed-leak-uncontained fact (`02`) already
means a compromised old key cannot safely authorize anything, rotation or
otherwise.

## Replacement

**A new logical identity is created, with an optional relationship to
the old identity.** This is what the current architecture already
supports structurally: a new profile (new Master Seed → new
account/Nostr identity), optionally accompanied by an explicit,
evidence-backed **continuity claim** (a new, additive record type this
review specifies in `08`/`20`) asserting "this new identity succeeds that
old one." The continuity claim is evidence for peers to evaluate — never
an automatic grant of the old identity's trust, Memberships, or sessions.
**This is the V1 model this review recommends** (`18`, `20`).

## Recovery

**Access to the same identity is restored from existing authorized
secret material.** Already fully live: `restoreSealed(envelope, passphrase)`
(`lib.rs:11315-11365`) recovers the SAME Master Seed (hence the same
account/Nostr identity) from its own sealed envelope and the correct
passphrase. Recovery is not rotation and not replacement — no identity
changes. This review's own Master Seed policy (`15`) leaves Recovery
exactly as it is.

## Migration

**Data or trust state moves from one identity to another.** A
consequence peers/local state may choose to apply AFTER accepting a
Replacement's continuity claim (e.g., "treat messages I exchanged with
the old identity as continuous history with the new one for display
purposes") — never automatic, never cryptographic (no message is ever
re-signed or re-encrypted under the new identity), and never a
precondition for Replacement itself to be valid. `13`/`14` specify
exactly what migrates (Conversation display continuity) and what never
does (Archive signatures, Ratchet session material).

## Alias/profile change

**Display metadata changes without cryptographic identity change** — a
label, avatar, or other non-cryptographic profile field. Entirely out of
this review's scope; no source inspected here treats display-metadata
changes as identity-relevant, and this review does not either.

## Why this vocabulary matters

Every prior review's own imprecision risk (conflating "rotation" with
"replacement," or treating a `deviceId` swap as an account-identity
concept) is exactly what caused `3ebfa37` to need its own §03 taxonomy.
This review inherits that discipline and extends it one layer up: the
distinction between Rotation and Replacement is the single most
consequential decision in this document set, because it determines
whether an old-key signature can ever be trusted evidence for a new
key (`08`, `09`) — Rotation's whole premise depends on it being trustable
under SOME assumption; Replacement never requires trusting it as
sufficient by itself.
