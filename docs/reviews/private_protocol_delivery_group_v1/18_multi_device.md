# Review 18 — Multi-Device Constraints

## What exists today: nothing, confirmed directly

**Identity per device.** Does not exist. `FedosConversationLocalAccountIndexAuthority`'s
only shipped implementation, `FixedFedosConversationLocalAccountIndexAuthority`
(referenced in `fedos_conversation_runtime.ts`'s own assembly, `01`), is
a single fixed configuration value — there is no concept of "this
device" as distinct from "this account" anywhere in the Conversation
domain.

**Key backup.** Named, evaluated, and left as a future design by the
prior Security review (`private_conversation_security/17_backup_multi_device.md`,
re-cited, not re-derived): deterministic-from-seed recovery covers
pairwise keys; group keys (if D/C ever ship) and message
ciphertext/membership/capability/epoch history do not recover
deterministically and need a separate mechanism this review does not
design.

**Device addition/removal.** Does not exist — no multi-device concept
exists at all (see "identity per device" above), so there is nothing
to add or remove a device *from*.

**Conversation history portability across devices.** Does not exist —
follows directly from the same absence; a second device configured
with the same Master Seed could, in principle, re-derive the same
pairwise keys (deterministic ECDH, confirmed `17`), but has no
mechanism to obtain the actual ciphertext bytes or Envelope/Membership
records a first device already received, since those are not
seed-derived (`private_conversation_security/17_backup_multi_device.md`'s
own "No" rows, restated: message ciphertext bodies, membership state,
capability state are all history, not derivation).

**Capability portability.** Does not exist — `FedosConversationCapabilityDescriptor`
records are tied to whichever persistence backend issued/redeemed
them; no cross-device sync mechanism exists.

**Recovery.** Only the Master-Seed-deterministic half is real
(`FedosMasterSeedAuthority.seal`/restore, per the prior Security
review); the data half (message history, membership/capability state)
has no recovery mechanism of any kind in this codebase.

## Explicit refusal to claim multi-device support

**This review does not claim multi-device support exists, is close to
existing, or would be a small extension of anything reviewed above.**
A second device with the same Master Seed can re-derive the *same
cryptographic keys* (an accident of the deterministic-ECDH design,
not a designed multi-device feature) but cannot obtain any of the
*data* a first device already holds without a key-distribution and
data-sync design this review explicitly does not attempt, consistent
with the task's own instruction not to claim multi-device support
"without a real key-distribution design." Any future Arc proposing
multi-device support must treat it as a from-scratch design exercise,
not a checklist item unlocked by anything named in `14`–`17`.

## See also

- `17_epochs_membership.md`
- `docs/reviews/private_conversation_security/17_backup_multi_device.md`
