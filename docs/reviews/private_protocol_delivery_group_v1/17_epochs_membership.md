# Review 17 — Key Epoch and Membership Changes

## What exists today

**Membership generation/transitions.** Real:
`fedos_conversation_membership_transition.ts` allows exactly `null ->
active` (admit), `active -> revoked` (revoke), `active -> left` (leave)
— confirmed the only three transitions permitted; everything else
returns `false`.

**Epoch, as it exists in the Envelope today.** `FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH`
(`fedos_conversation_membership_readiness.ts:41`) fixes the only
currently-supported `keyEpoch` value to `0` — there is no epoch
*advancement* mechanism anywhere in this codebase; `keyEpoch` exists as
a field (in the Envelope, in the AAD header, `03`) but nothing ever
writes a value other than `0` to it, and nothing reacts to a
membership `revoke`/`leave` transition by incrementing it.

## Specification for a future epoch mechanism, named but not designed

**Epoch creation.** A new epoch should be minted on any membership
change that changes who can derive future keys — for B (`16`), this
means any admit/revoke/leave; for D (`15`, future), any group-key
rotation. This review does not specify the epoch's own storage shape
beyond noting the Envelope already has a field for it.

**Removal/revocation and future-message access.** Under B (pairwise
fanout, `16`), removal is structurally trivial: a revoked/left member
simply stops appearing in the fanout enumeration for future messages —
no key rotation is needed because there was never a shared key to
rotate. This is the exact structural advantage `15`'s comparison table
already named for B/Sender-Key-shaped schemes over D.

**Historical access.** Under B, a revoked member retains
mathematical ability to decrypt any Envelope pairwise-encrypted to them
before revocation (the pairwise key derivation is deterministic from
the Master Seed + their own counterparty public key, per
`docs/reviews/private_conversation_security/17_backup_multi_device.md`'s
own already-confirmed finding, re-cited here) — **removal from
Membership does not and cannot revoke already-derived key material**.
This must be stated as an explicit, permanent property, never
described as "the removed member can no longer read the conversation"
without the qualifier "cannot read *future* messages."

**New-member history policy.** Per `16`: no history access for messages
sent before a member's own admission, under B. This is the only
honest default given no re-encryption/backfill mechanism exists.

## No retroactive erasure claims

Restated as this review's own explicit, required framing, directly
from the prior Security review's own already-confirmed Master-Seed
determinism finding (`private_conversation_security/17_backup_multi_device.md`):
**revoking a member's Membership record is a database-state change,
not a cryptographic revocation.** Any future README, completion
declaration, or user-facing copy describing a "remove member" operation
must not claim that operation revokes the removed member's
mathematical ability to decrypt previously-received ciphertext — doing
so would misrepresent a security property this architecture, as
currently designed (pairwise/fanout, Master-Seed-deterministic), does
not and structurally cannot provide without a materially different
scheme (D/C/MLS, all requiring genuine forward secrecy or
post-compromise security mechanisms this review does not design, per
`15`).

## See also

- `15_group_strategy.md`, `16_pairwise_fanout.md`
- `docs/reviews/private_conversation_security/06_key_epochs.md`,
  `17_backup_multi_device.md`
