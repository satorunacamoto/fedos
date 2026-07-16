# Review 16 — Revocation and Leave

## What `revoke()`/`leave()` already, really do

`PersistedFedosConversationMembershipAuthority.revoke()`/`.leave()`
(`src/conversation/membership/persistence/persisted_fedos_conversation_membership_authority.ts`,
confirmed real in `01`) transition a Membership's `state` from
`"active"` to `"revoked"`/`"left"` and set `endedAt`. Per
`fedos_conversation_membership_transition.ts`'s own closed rule, this
transition is PERMANENT — `revoked → active`/`left → active` are both
structurally forbidden ("a revoked or left membership never silently
reactivates"). This is real, already-shipped behavior this review
inherits, not something it designs.

## Effects, named per this review's own required list

- **Future writes** — per `15`'s own authorization chain step 2, a
  Membership no longer `"active"` fails the chain immediately; no
  message write should be attempted or accepted. This is a REQUIRED
  consequence of `15`'s chain, not new behavior `revoke()`/`leave()`
  themselves need to implement — Membership state alone is sufficient
  input for a correctly-built authorization chain to reject future
  writes.
- **Future decrypt requests** — analogous to future writes: `15`'s
  chain step 2 gates step 3/4 (encryption readiness, envelope/storage)
  identically for read as for write. A non-active Membership should
  fail a future decrypt authorization check the same way it fails a
  write check — this review names the SAME chain as governing both
  directions, per `15`.
- **Future key epochs** — per `08`'s own finding, NO key epoch concept
  exists anywhere in this checked-out tree. There is nothing for
  `revoke()`/`leave()` to affect here TODAY; this review names the gap
  rather than inventing epoch-rotation behavior that would require
  encryption primitives this review is forbidden from implementing.
  A future Arc that DOES introduce key epochs must decide whether
  `revoke()` triggers rotation — a product/security decision this
  review explicitly does not make on that future Arc's behalf.
- **Historical ciphertext** — `FedosPayloadRetentionAuthority`'s own
  header is directly on point and is quoted here rather than
  restated in weaker terms: retention/removal claims "MUST NOT claim
  secure physical overwrite... cryptographic erasure without a key
  lifecycle (none exists in this Arc)." Since NO key lifecycle exists
  at all (`08`), there is no mechanism by which `revoke()`/`leave()`
  could cause historical ciphertext to become unreadable even in
  principle — this review does NOT claim historical-key erasure, per
  its own required prohibition, and names this as a fact rather than a
  future promise.
- **Invitation authority** — a revoked/left participant's own prior
  `inviteAuthority` (if `07`'s private-group policy ever granted them
  one) is not automatically revisited by `revoke()`/`leave()` today —
  `FedosConversationCapabilityIssuerAuthority.issueJoinCapability()`'s
  own injected `FedosConversationCapabilityIssuanceAuthorizationCheck`
  is consulted FRESH on every issuance attempt (`01`), so a
  correctly-implemented check (one that itself queries current
  Membership state, which this review recommends but does not
  mandate a specific implementation of) would naturally reject a
  revoked participant's future issuance attempts without requiring
  `revoke()` itself to touch the Capability domain at all — the two
  domains stay decoupled, matching this codebase's own "one authority
  per concern" discipline.
- **Conversation ownership** — `FedosConversationRole` has no
  transfer-of-ownership operation anywhere in this checked-out tree
  (`01`). If the SOLE `"owner"` Membership is revoked or leaves, the
  Conversation is left with no owner — a genuine, real gap this review
  names rather than papers over. `20` folds this into the next-Arc
  discussion as a product decision (does ownership transfer
  automatically to the longest-standing `"moderator"`? does the
  Conversation become un-administerable until a manual intervention?)
  this review does not resolve, since resolving it would require
  either a Membership Authority change (production source, out of
  scope) or a policy this review has no grounded precedent to select
  from.

## No historical-key erasure claim

Restated once more, standalone, per this review's own required
explicit prohibition: **this review makes no claim, anywhere, that
revocation or leaving causes any previously-written ciphertext,
payload, or key material to become cryptographically inaccessible.**
The prior Security review's own §06 finding ("the 'removal wipes
history' misconception named and corrected") is reaffirmed here
against this later commit's own source, unchanged.
