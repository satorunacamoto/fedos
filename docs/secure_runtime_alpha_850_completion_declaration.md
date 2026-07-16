# Secure Runtime Alpha 850 — Completion Declaration

## Achieved

- Membership durability inventory (Alpha 821) and Capability durability
  inventory (Alpha 822) — the frozen Alpha 761–790 contracts
  (`FedosConversationMembershipAuthority`, `FedosConversationCapabilityIssuerAuthority`,
  `FedosConversationCapabilityRedemptionAuthority`) inspected and preserved
  verbatim by every adapter this Arc adds.
- Persistence ownership decision (Alpha 823) and cross-authority
  coordination decision (Alpha 824) — see
  `docs/secure_runtime_alpha_823_824_persistence_and_coordination_decisions.md`.
- Versioned Membership persistence (Alpha 825–829) —
  `FedosPersistedConversationMembershipV1`, a fail-closed codec, a
  dedicated `FedosConversationMembershipPersistence` port, and both an
  in-memory and a zero-dependency append-only backend.
- Durable Membership Authority (Alpha 830) —
  `PersistedFedosConversationMembershipAuthority`, restart-verified (Alpha
  831): active/revoked/left state, role, timestamps, deterministic
  identity, and invalid-resurrection rejection all survive a fresh
  instance over the same backend.
- Membership corruption semantics (Alpha 832) — one corrupt log record
  voids the whole append-only backend (fail closed, no per-record
  quarantine, matching this codebase's own established Alpha 752/796
  precedent); a `"revoked"`+`"left"` collision for the same id throws
  rather than silently picking a winner.
- Versioned Capability persistence (Alpha 833, 836–838) — an
  issued/redeemed EVENT model (never a rewritten mutable record — no
  append-only backend in this codebase supports rewrite), a fail-closed
  codec, and a reconstructed current-state view (`currentUses` is always
  COUNTED from events, never a separately-trusted stored counter).
- Bearer verification persistence (Alpha 834/835) — SHA-256 one-way
  verifier (`@noble/hashes`, already an existing dependency — no new
  dependency added), never the plaintext bearer; a verifier cannot itself
  be presented as a bearer secret.
- Capability Persistence Port + backends (Alpha 837, 839–840) — in-memory
  and append-only, both restart-verified.
- Durable Capability Authority (Alpha 841), restart-verified (Alpha 842) —
  `PersistedFedosConversationCapabilityAuthority`: descriptor, verifier,
  expiry, intended recipient, current use count, exhaustion, duplicate
  rejection, and wrong-bearer rejection all survive a fresh instance over
  the same backend. No distributed exactly-once is claimed anywhere.
- Redemption Coordination Record (Alpha 843) and Coordination Persistence
  (Alpha 844) — a five-phase, deterministically-keyed record; in-memory
  and append-only backends, both consumed only by the coordinator itself.
- Durable Redemption Coordinator (Alpha 845) —
  `FedosConversationDurableRedemptionCoordinator.redeemAndAdmit()`, the
  literal 8-step conceptual order, layered ON TOP of Alpha 841/830 rather
  than folded into the frozen `redeem()` contract.
- Crash-window recovery (Alpha 846) — tested at every required boundary
  (before prepared / after prepared / after Capability consumption /
  before Membership admission / after Membership admission / before the
  completion marker); no duplicate active Membership, confirmed Capability
  consumption never silently restored, already-admitted Membership
  recognized idempotently, corrupted coordination state fails closed.
- Exactly-once contract (Alpha 847) — documented and tested: restart-stable,
  idempotent redemption within one durable backend set and one
  single-writer model; explicitly does NOT claim distributed exactly-once,
  cross-replica safety, or multi-process concurrent-writer safety.
- Ownership and activation decision (Alpha 848) — ports/backends/coordinator
  only (Option A); no default Local Runtime wiring added, since no real
  production caller (no private Conversation command) exists yet. No new
  runtime timers, no bearer secret exposed through any Runtime
  configuration shape.
- End-to-end durable verification (Alpha 849) — a single real
  filesystem-backed test exercises the full 13-step restart sequence from
  the spec (issue → redeem → restart → duplicate-reject → revoke →
  restart → revocation preserved), plus wrong bearer, expiry, recipient
  mismatch, exhaustion, post-revocation redemption conflict, and
  independent-backend-set isolation. No private message is created
  anywhere in this Arc's own source (`test/secure_runtime_alpha_843_849_redemption_coordination.test.ts`'s
  own Alpha 848 structural guard block).

## Remaining blockers

- Distributed/multi-writer redemption — not designed, not attempted; this
  Arc's own guarantee is explicitly single-writer, single-backend-set only.
- Invitation URL/QR/HTTP transport — a bearer secret still has no way to
  reach a recipient outside a test.
- Private Conversation construction — `FedosConversationPolicy.mode` still
  accepts only `"public"`.
- Private message envelope, encryption, key distribution — zero
  cryptography beyond the existing SHA-256 bearer-verifier hash exists
  anywhere in this Arc.
- Direct/DM, private groups — no construction path exists.
- GUI, Worker integration, protocol mapping (Nostr/ActivityPub/AT
  Protocol wire representation of Membership/Capability) — none.

## Public mode

Unaffected — every new file lives under
`src/conversation/membership/persistence/`,
`src/conversation/capability/persistence/`, or
`src/conversation/capability/coordination/`; zero changes anywhere under
`src/board/runtime/`.

## Recommendation

**Conversation Private Readiness Gate & Private Construction Foundation
Arc.** Membership/Capability durability — the blocker Alpha 790's own
completion declaration named as primary — is now genuinely closed:
restart-stable, crash-recoverable, corruption-honest, with no fake
distributed guarantee. The next blocker is no longer durability but
*activation*: `FedosConversationPolicy.mode` still has nowhere to go
beyond `"public"`, and no private Conversation construction command exists
to call any of this Arc's own new durable Authorities from. Private
Message Envelope work is NOT recommended next — encryption/key
distribution is a separate, independent blocker or two Arcs of its own,
and building an envelope before there is any private Conversation to send
it into would be exactly the kind of premature, ungrounded layering this
Arc's own "no speculative abstractions" instruction forbids.
