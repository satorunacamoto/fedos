# 20 — Architectural Blockers and Recommendation

Final synthesis, classified per this review's own required categories.
Every item cites the section that grounds it. This section does not
assume any outcome of the concurrent Alpha 641–680 Public Identity/
Policy implementation Arc — every finding below is drawn from source
state as of this review's own commit, independent of that Arc's own
results.

## Blocking — must resolve before real Private Conversation implementation can proceed correctly

- **BLOCK-1: Real conversation-key derivation exists but is
  `pub(crate)`-only, unexported across the WASM boundary** (§01/§05).
  The primitive itself is done and vector-verified; the blocker is
  narrowly an EXPORT task (the same `#[wasm_bindgen]` pattern
  `AeadKeyHandle` already uses), not a from-scratch cryptography
  problem — a materially smaller blocker than either prior review could
  have characterized it, now that it's been investigated directly.
- **BLOCK-2: No compiled WASM artifact exists in this checked-out tree**
  (`packages/fedos-core-rust/pkg/`, confirmed absent, §01) — every real
  crypto Runtime Service call fails closed to `null` until this is
  built, independent of BLOCK-1.
- **BLOCK-3: The Runtime crypto layer is gated to Development Runtime
  only, by design** (§01) — no code path anywhere flips this gate for
  a production runtime. This is a NEW blocker this review names, not
  identified before: shipping a real Private Conversation feature
  requires an explicit decision on whether/how this gate should behave
  differently in production, which is currently unaddressed by any
  existing doc.
- **BLOCK-4: No durable Private Storage backend exists** (§07) — the
  existing append-only classes are public-Board-shaped and leak
  plaintext metadata unacceptably for private content by default; a
  dedicated backend (§07 Option B) must be built, including the
  file-permission hardening this review names as a real prerequisite.
- **BLOCK-5: Identity resolution for a Private Conversation's own
  participants** — a Private Conversation needs the SAME real,
  resolvable identity the prior review's own B1 finding named as
  missing by default; this review does not assume Alpha 641–680 has
  resolved it, per this review's own explicit instruction not to
  assume that Arc's own results.

## Non-blocking — real gaps, do not prevent starting the Conversation Core

- Session's total absence of a DM-vs-group distinction (§18) — does not
  block Nostr-first DM work.
- ActivityPub/AT Protocol outbound eligibility (§11) — moot; no
  outbound Publisher exists for either, so there is nothing to gate yet.
- Thread-local pseudonym presentation (§13) — genuinely independent,
  low-risk, startable once Membership (§19 item 4) exists.
- The device-identity participant-ref addition (§04) — additive, does
  not block anything already in the dependency chain.

## Deferred — correctly out of scope for an initial Arc

- Sender-Key/MLS-shaped group key distribution (§05's own standards-
  track recommendation) — DM does not need it; private-group can start
  with §05's own simpler Option D before a future Arc adopts a formal
  standard.
- Physical deletion/compaction (§08, meaning 5) — the honest V1
  tombstone-only contract (§08) does not require it.
- The full backup/multi-device DATA-sync story (§17's own "third leg,"
  distinct from key recovery) — named, not designed, not required for
  an initial DM slice.
- Cross-node/federated redemption consensus (§10 Option B) — Option A
  (single-Authority) is sufficient until a genuinely multi-Authority
  deployment exists, which it does not today.

## Requires official protocol research — not resolvable from this repository's own source

All six items from §18: NIP-17 gift-wrap envelope semantics beyond the
already-implemented NIP-44 conversation-key layer; Nostr group-DM
conventions; ActivityPub addressed-only delivery's actual
confidentiality guarantee; ActivityPub Group actor membership
semantics; AT Protocol's entire private-messaging story; Session's
entire private-delivery protocol (the largest gap — even the DM-vs-group
distinction is unmodeled here).

## Requires product decision — technically resolvable multiple ways, not a code question

- Moderation vs. full E2EE, per conversation mode (§16) — no technical
  answer exists; the codebase can support either, someone must choose.
- New-member access to pre-join history, default direction (§06).
- Lost-device recovery: rejoin-fresh vs. backup-recovery as the primary
  path (§06).
- Deletion promise scope — which of the eight meanings (§08) a future
  "Delete" button actually performs, and whether cryptographic erasure
  (§08 meaning 8) is offered as a distinct, honestly-named tool.
- Datacenter-IP blocking policy and Lightning-stake correlation risk
  for private-space anti-abuse (§15).
- BLOCK-3's own production-gating question, restated as a product
  decision once the underlying engineering (BLOCK-1/2) is resolved.

## Next Arc recommendation — exactly one

**A. Canonical Conversation Policy Foundation.**

Chosen because §19's own dependency graph confirms it is the single
root node every other candidate transitively depends on:
`FedosConversationId` and sibling id types (§03), and the private-mode
extension of the already-existing `FedosConversationMode`/access-policy
fields (prior review's own §04/§05, unmodified) — needs nothing from
identity resolution (BLOCK-5), the crypto export work (BLOCK-1/2/3), or
storage (BLOCK-4), and is therefore buildable in parallel with, and
independent of, whatever the concurrent Alpha 641–680 Arc concludes
about Public Identity. **B (Private Message Envelope Foundation)** is
the natural second step but needs A's own id types to exist first; **C
(Conversation Encryption Authority Boundary)** is the highest-leverage
unlock in absolute terms (BLOCK-1/2 combined) but needs B's own
envelope type to exist as a target before it has anything to wire
encryption INTO; **D (Capability Invitation Foundation)** needs a
Membership record (§19 item 4, itself needing A) to reference; **E
(Private Storage and Retention Boundary)** needs B's own record shape
to know what it is storing. A is correctly first among all five —
consistent with, and reconfirming without modification, this review's
own §19 dependency ordering.

## See also

- `docs/reviews/private_conversation_security/index.md`
- `docs/reviews/private_conversation_security/19_dependency_order.md`
