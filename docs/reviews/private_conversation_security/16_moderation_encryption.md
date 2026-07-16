# 16 — Moderation and Encryption Tension

## The tradeoff, stated without evasion

**If the operator/server cannot read plaintext, the operator cannot run
automatic content moderation over that plaintext.** This is not a gap
to be engineered around; it is a direct, structural consequence of the
same property (§01's confirmed real AEAD + real conversation-key
derivation) that makes the confidentiality guarantee real in the first
place. Any design claiming BOTH "fully E2EE" AND "we automatically scan
message content for policy violations" is claiming two mutually
exclusive properties at once, and this review states that plainly
rather than gesturing at "client-side scanning" as if it dissolves the
contradiction (client-side scanning, discussed below, changes WHERE
plaintext is briefly visible, not WHETHER the tension exists).

## Options compared

- **Client-side report.** A participant, having already decrypted a
  message locally, voluntarily submits it (or a reference to it) to a
  moderator/Authority. This is the ONLY mechanism that preserves full
  E2EE end-to-end while still allowing SOME moderation signal to reach
  an Authority — the plaintext crosses the confidentiality boundary
  only when, and because, a participant themselves chooses to disclose
  it, not as an ambient server capability.
- **Voluntarily disclosed message.** A generalization of the above — a
  participant sharing conversation content outside the conversation
  itself (screenshotting, forwarding) is always possible regardless of
  what this codebase does, and is not something E2EE was ever designed
  to prevent (E2EE protects transit/storage confidentiality, never a
  participant's own subsequent choices about content they already
  legitimately hold).
- **Room-admin moderation.** A conversation's own admin/owner role
  (§04/§12 — meaningful for `private-group`, structurally absent for
  `direct`) can remove a member (§04's `revokedAt`) or, per §06, choose
  whether to rotate keys — but an admin who is NOT also a message
  recipient has no more access to plaintext than anyone else outside
  the conversation; "room-admin moderation" is therefore membership/key
  authority, never content authority, unless the admin happens to also
  be a normal recipient (which for `private-group` they typically are).
- **Metadata-only abuse signals.** §14/§15's own already-confirmed
  finding applies directly: even fully-encrypted content still leaves
  observable metadata (timestamps, cadence, participant identities,
  §07's own confirmed plaintext-metadata leak) — a metadata-only
  anomaly signal (e.g. "this participant is sending messages at an
  inhuman rate") can inform Gateway/Ontology-layer abuse defense (§15)
  WITHOUT ever reading content, and is the one moderation-adjacent
  signal fully compatible with E2EE.
- **Server-readable private groups.** A design where the server (or
  operator) DOES hold a decryption key for private-group content — e.g.
  key escrow, or simply not using real E2EE for group conversations at
  all. This is a genuine, honest alternative — it enables real,
  automatic content moderation — at the direct cost of the entire
  confidentiality property §01-§13 build toward. Naming it here as a
  real option a product decision could choose, not dismissing it,
  because some products legitimately prioritize moderation over
  confidentiality for group spaces specifically (as distinct from DM).
- **Full E2EE.** No automatic content moderation is possible; only
  client-side report and metadata-only signals remain available.

## No resolution offered — a product decision, not a technical one

This review does not choose among these options. The choice between
"private-group is server-readable for moderation" and "private-group is
full E2EE with only client-side reporting" is a PRODUCT decision about
which property (moderatability vs. confidentiality) the feature
prioritizes, for WHICH conversation mode — and per §12's own finding,
`direct` and `private-group` could legitimately make DIFFERENT choices
here (a DM plausibly staying full-E2EE always, while a `private-group`
intended for larger, more public-adjacent communities might reasonably
trade some confidentiality for moderatability) — this review names the
option space and its exact tradeoffs; a future Arc, informed by actual
product requirements this review cannot supply, must decide.

## What this review does assert plainly

**No future design may claim "private and moderated" without
specifying, explicitly, which of the options above it uses and what
that choice costs.** An unqualified claim of both properties
simultaneously is either describing client-side reporting (a real, but
much weaker, moderation capability than server-side content scanning)
or describing a system that is not actually fully E2EE — this review
requires either be named honestly, never elided.

## See also

- `docs/reviews/private_conversation_security/08_deletion_retention.md`
- `docs/reviews/private_conversation_security/14_operator_non_linkability.md`
- `docs/reviews/private_conversation_security/15_bot_abuse_layers.md`
