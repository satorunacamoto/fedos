# Review 18 — Migration Path

## Fanout-era history does not automatically convert to a future Sender-Key/MLS scheme's own history

Because pairwise fanout stores its content as N independent Direct-mode
Envelope/Payload streams (`04`, one per synthetic Conversation, `06`),
and a future Sender-Key or MLS scheme (`16`/`17`) would introduce a
categorically different key/message model (a shared or per-sender
group-scoped key, not N independent pairwise keys), **there is no
lossless, automatic conversion from fanout's own stored ciphertext into
the new scheme's own format**. This must be stated plainly to avoid a
future Arc assuming migration is a mechanical re-encryption pass — it
is not, because the plaintext would need to be re-obtained (decrypted
under the OLD pairwise keys, which remain available per-device,
Master-Seed-deterministically, `15`) before it could even be
considered for re-encryption under a NEW group scheme, and no such
recryption pipeline is designed here.

## Recommended migration shape, named not designed

1. **Fanout-era synthetic Conversations (`06`) are archived, never
   deleted or silently hidden.** Each one remains a fully valid,
   independently readable Direct Conversation under the existing,
   unmodified pipeline (`03`) — a future scheme's own adoption does not
   require touching this data at all.
2. **A migrated group's own NEW message history starts fresh** under
   the new scheme, from the moment of migration forward. Prior fanout
   messages remain accessible only via the old per-pair synthetic
   Conversations (`08`'s own "local union" read path), not folded into
   the new scheme's own history.
3. **No automatic decrypt-and-recrypt pipeline is recommended.** If a
   future product requirement genuinely needs old fanout content
   visible inside a new scheme's own UI, that is an APPLICATION-layer
   read-time merge (read old Envelopes via the existing Direct-mode
   read path, present them alongside the new scheme's own messages) —
   never a storage-layer conversion, which would require re-encrypting
   plaintext this review's own rules (no crypto invention) forbid
   designing here.

## What must be true before ANY migration Arc is authorized

Per `16`/`17`, neither Sender Key nor MLS has any implementation in
this codebase — a migration path cannot be built before the target
scheme itself exists. This document names the shape a migration would
take; it does not authorize building either the target scheme or the
migration itself as part of this review's own recommendation (`20`).

## See also

- `16_sender_key_comparison.md`, `17_mls_comparison.md`
- `08_history_semantics.md`, `15_backup_model.md`
