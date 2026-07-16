# 17 — Backup and Multi-Device Recovery

## What §01 already confirmed, applied here directly

Alpha 144's own recovery/threat model (`docs/secure_runtime_alpha_144_recovery_threat_model_decision.md`,
re-read this pass): **everything derived from the Master Seed is
deterministically reconstructible from seed + parameters. Ciphertext
BODIES and Relay/server data are explicitly NOT recoverable this way.**
This single fact governs every comparison below.

## What recovers deterministically from the Master Seed, and what does not

| Item | Deterministically recoverable from Master Seed alone? |
|---|---|
| Identity/Application/Protocol Root keys, Nostr signing key | **Yes** — confirmed, §01, this is the entire point of the HKDF hierarchy. |
| A DM's own pairwise conversation key (§05 Option D) | **Yes, in principle** — if both counterparties' own public keys are independently known/recorded, the pairwise ECDH key is re-derivable from the Master Seed + the counterparty's public key alone, with no separate backup needed for the KEY itself. |
| A private-group's own distributed group key (§05) | **No** — a group key, however distributed (pairwise-delivered or Sender-Key), is NOT a deterministic function of the Master Seed alone; it was generated/received at some point in time and must be separately preserved to survive loss, exactly like Alpha 144's own "server data" category. |
| Message ciphertext bodies (§02's `FedosConversationMessage.ciphertext`) | **No, explicitly, per Alpha 144** — recovering the ABILITY to decrypt (the key) is not the same as recovering the CIPHERTEXT BYTES themselves; if a device holding the only copy of a message's ciphertext is lost, the message is gone regardless of key recovery, unless another participant's device (or §07's own backup mechanism) independently retained a copy. |
| Membership state (§04) | **No** — who is currently a member, and their role, is conversation history, not seed-derived; requires its own durable record, recoverable only from wherever that record lives (§07). |
| Invitation/Capability state (§09/§10) | **No** — same category as membership; a redemption record's existence is a historical fact, not a seed-derived one. |
| Key epoch history (§06) | **No** — WHICH epoch existed when, and what triggered each transition, is history, not derivation. |

## Two backup strategies compared

**Deterministic-from-seed derivation** (recover everything by
re-running the HKDF chain from a recovered Master Seed) — works ONLY
for the "Yes" rows above. Cannot recover group keys, message
ciphertext, membership state, capability state, or epoch history — the
majority of what a real conversation-recovery experience needs.
**Insufficient alone**, confirmed directly from Alpha 144's own stated
scope.

**Wrapped-random-key backup** (the group key / epoch key / whatever
non-deterministic secret exists is itself encrypted — "wrapped" — under
a key the user can separately back up or recover, e.g. via the SAME
Master-Seed-derived wrapping key `FedosMasterSeedAuthority.seal()`
already uses for the seed's own backup, §01) and stored ALONGSIDE the
data it protects. This covers the "No" rows for KEYS specifically
(group keys, epoch keys) but still requires a SEPARATE backup of the
actual DATA (message ciphertext, membership records, capability/epoch
history) — key recovery and data recovery are two different problems,
and this comparison must not conflate them.

## Recommendation: both, for different halves of the problem, never one alone

- **Keys** (Master Seed-derived roots, Nostr signing key, DM pairwise
  keys): deterministic-from-seed recovery, reusing §01's own real,
  already-implemented mechanism (`FedosMasterSeedAuthority.seal`/
  `restore_sealed`, Argon2id + AEAD) — no new cryptographic primitive
  needed for this half.
- **Non-deterministic keys** (group keys, epoch keys): wrapped-random-
  key backup, using the SAME Master-Seed-derived wrapping key as the
  transport for the wrap — again reusing §01's own existing primitive,
  never inventing a second backup mechanism.
- **Data** (message ciphertext, membership/capability/epoch history):
  neither strategy above recovers this — it requires §07's own Private
  Storage boundary to have SOME durability/sync story of its own (e.g.
  multiple participant devices independently holding copies, or a
  dedicated backup export flagged out of scope by §07 for THIS review
  to design) — named here as the third, unaddressed leg of recovery
  this review does not solve, only correctly separates from the two
  key-recovery halves above.

## Protocol Root leak containment must not be broken by a Conversation backup design

Per Alpha 144's own containment property (re-confirmed §01/§13): a
single Protocol Root or Account Key leak is contained by HKDF's
one-way domain separation; a Master Seed leak is not. **Any future
Conversation-key backup mechanism must derive its own wrapping key from
a domain-separated LEAF of the hierarchy (mirroring §13's own
"never derive pseudonym keys directly from the Master Seed" finding),
never bypass the hierarchy by backing up conversation keys under a key
derived directly from the Master Seed itself outside the existing
domain-separated chain** — doing so would recreate the exact "one leak,
total compromise" failure mode §13 already named as the wrong shape for
pseudonym derivation, here for conversation-key backup instead. This
review does not design the specific domain; it names the containment
property any future design must preserve.

## See also

- `docs/reviews/private_conversation_security/01_existing_crypto_inventory.md`
- `docs/reviews/private_conversation_security/05_key_distribution.md`
- `docs/reviews/private_conversation_security/07_at_rest_storage.md`
- `docs/secure_runtime_alpha_144_recovery_threat_model_decision.md`
