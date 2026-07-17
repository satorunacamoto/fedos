# Review 19 — Threat Model

## What pairwise fanout protects, inherited directly from Direct mode's own already-verified guarantees

Each of the N synthetic per-pair Conversations (`06`) is, from a
cryptographic standpoint, indistinguishable from a hand-constructed
Direct Conversation — it inherits every property `docs/secure_runtime_alpha_1111_1180_completion_declaration.md`
§8 already verified for Direct mode: content confidentiality between
exactly the two pairwise participants (once real WASM crypto replaces
the Fake test Authorities, `03`), tamper-evidence (a modified ciphertext
byte fails closed, never producing partial plaintext), and
authorization enforcement (a revoked/left local Membership denies both
send and read, `09`).

## What pairwise fanout does NOT protect against — named explicitly, not silently assumed away

- **Group-membership/size inference from delivery metadata.** N
  simultaneous per-recipient deliveries from one sender directly reveal
  a lower bound on group size to any observer positioned to see more
  than one of them (`13`, restated from the prior review's own
  `16_pairwise_fanout.md` finding) — this is a real, acknowledged cost,
  not a false claim of anonymity.
- **Cross-message linkability by a compromised local Runtime.** Because
  every synthetic Conversation's own pairwise key derives from the SAME
  Master Seed (`15`/`09`), compromising one local Runtime instance
  compromises the ability to derive EVERY pairwise key that Runtime's
  own account participates in — group or not, this is unchanged from
  Direct mode's own already-acknowledged single-point-of-compromise
  property, simply multiplied across N channels rather than one.
- **No transcript/consistency proof that all N recipients received
  identical content.** Fanout sends N independently-encrypted copies of
  logically-identical plaintext (`04`) — nothing in this design
  cryptographically proves to any recipient that every OTHER recipient
  received the same bytes (no shared transcript hash, no group MAC).
  A malicious or buggy sender could, in principle, send different
  content to different recipients under the guise of one "group
  message," and no mechanism here would detect it. This is named as an
  explicit, unaddressed limitation — designing a transcript-consistency
  proof is a real cryptographic construction this review does not
  invent.
- **No forward secrecy or post-compromise security** (`16`/`17`,
  restated) — a compromised Master Seed at any point compromises past
  AND future pairwise keys derivable from it; fanout does not change
  this in either direction relative to plain Direct mode.
- **No deniability/repudiation analysis performed.** Whether a
  recipient can cryptographically prove a message's authorship to a
  third party (or, conversely, whether a sender can deny authorship) is
  not evaluated by this review — the underlying AEAD/ECDH primitives'
  own deniability properties (if any) are inherited unchanged from
  Direct mode and were not analyzed by the prior reviews either.
- **No protection against a malicious existing group member silently
  forwarding fanout content outside the group.** This is an inherent
  property of ANY content-confidentiality-only scheme (Sender Key and
  MLS share it too) — a legitimate recipient can always exfiltrate
  decrypted plaintext. Named for completeness, not a fanout-specific
  weakness.

## Trust boundary, stated once, plainly

Fanout's own trust boundary is **identical to Direct mode's**: every
security property is anchored to (a) the Master Seed's own secrecy on
each participant's device, and (b) the correctness of the pairwise
ECDH + AEAD primitives already reviewed in the prior Security review.
Fanout adds an orchestration layer on top; it adds no new trust anchor
and removes none of the existing ones.

## See also

- `09_member_removal.md`, `13_relay_trust_assumptions.md`
- `16_sender_key_comparison.md`, `17_mls_comparison.md`
- `docs/reviews/private_conversation_security/` (full crypto threat basis, unchanged)
