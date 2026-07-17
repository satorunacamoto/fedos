# Review 15 — Backup Model

## Confirmed: no backup/export/import mechanism exists anywhere for Conversation data

A direct search across `src/conversation/` for backup/export/restore
concepts (scoped to Envelope/Payload/Membership/Activation — distinct
from Master Seed sealing, which is a separate, already-reviewed
mechanism) returns zero matches. Nothing in this codebase exports or
imports an Envelope, Payload, Membership, or Activation record to or
from a file or another device. This is unchanged from the prior
review's own finding (`docs/reviews/private_protocol_delivery_group_v1/18_multi_device.md`)
and remains true at this later commit — Alpha 1111–1180 added no
backup mechanism of any kind.

## The retention authority's own security-claims discipline is the model this review adopts for fanout, unchanged

`FedosPayloadRetentionAuthority`'s own header
(`src/conversation/retention/fedos_payload_retention_authority.ts:33-54`)
already states, precisely, what a deletion-adjacent claim MAY and MUST
NOT make:

> MAY claim: once tombstoned or payload-removed, `readPayload()` will
> no longer return this payload's bytes through this Authority.
>
> MUST NOT claim: secure physical overwrite, SSD erasure, **cloud
> backup deletion**, remote peer deletion, cryptographic erasure
> without a key lifecycle, or worldwide deletion.

This review adopts the identical discipline for any future fanout
backup design: a backup mechanism, once built, MAY claim it can
reconstruct a device's own local Envelope/Payload/Activation/Membership
state after loss; it MUST NOT claim it can restore data another
participant's own device already deleted, MUST NOT claim any recovered
backup magically re-establishes delivery to members who never received
a message pre-loss, and MUST NOT claim worldwide/cross-device
consistency of any kind.

## What is deterministically recoverable vs. what requires a real backup design — restated for fanout

Reusing the prior Security review's own already-confirmed classification
(`docs/reviews/private_conversation_security/17_backup_multi_device.md`,
cited not re-derived) and applying it once per synthetic Conversation
(`06`):

| Item | Deterministically recoverable from Master Seed alone? |
|---|---|
| Each synthetic Conversation's own pairwise key | Yes, in principle — same Master-Seed-deterministic ECDH re-derivation as plain Direct mode, per counterparty public key |
| The GROUP roster itself (who is currently a member) | No — history, not derivation; requires the group Conversation's own durable Membership record |
| Which synthetic Conversations exist for a given group | No — this mapping (`06`) is itself durable state a backup must separately preserve |
| Envelope/Payload content (ciphertext) | No, explicitly, per Alpha 144's own already-established finding — key recovery is not content recovery |
| The Activation fact log per synthetic Conversation | No — restoring only the Master Seed does not restore "this Conversation was already activated"; without it, a restored device would need to re-run activation, which is safe (idempotent, `06`) but loses zero data only if the underlying Envelope/Payload/Membership/Activation files themselves were ALSO backed up |

## Recommendation: no new backup mechanism designed here; if built, it must back up whole persistence logs, never regenerate content from keys alone

Consistent with "recommend only additive evolution," this review does
not design a backup format. It states the one constraint any future
design must satisfy: because content and history are not
key-derivable (table above), a correct backup must preserve the actual
append-only persistence files (Envelope, Payload, Membership,
Capability, Activation, and this review's own new synthetic-Conversation
mapping, `06`) — not merely the Master Seed — or it will silently
under-restore fanout-era group conversations.

## See also

- `14_local_canonical_history.md`
- `docs/reviews/private_conversation_security/17_backup_multi_device.md`
- `docs/reviews/private_protocol_delivery_group_v1/18_multi_device.md`
