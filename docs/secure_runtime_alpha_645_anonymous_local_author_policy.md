# Secure Runtime Alpha 645 — Anonymous Local Author Policy

Stage 5. Compares:

- **A.** Require a resolved identity, reject otherwise.
- **B.** Continue explicit anonymous-local mode (Alpha 627's own
  existing behavior).
- **C.** Generate a new persistent local identity automatically —
  **FORBIDDEN** by this Arc's own instruction.
- **D.** Accept caller-supplied identity — **FORBIDDEN**.

## Decision: B remains, made explicit and separately constructible

Public V1 does NOT require a resolved identity — every
`FedosPublicAuthorAuthority` still resolves either `"resolved"` or
`"anonymous-local"`, never rejects a post command for lack of identity.
`AnonymousLocalPublicAuthorAuthority`
(`src/board/runtime/identity/anonymous_local_public_author_authority.ts`)
makes this an explicit, independently-selectable implementation, rather
than only an implicit fallback branch inside one function
(`resolvePublicAuthorReference()`, Alpha 627 — left unchanged,
superseded as the production call path).

## Confirmed properties of anonymous-local authorship

- **Explicitly identifiable**: `protocol: "fedos"`,
  `publicIdentifier: "local-anonymous"` — a fixed, well-known,
  non-secret sentinel (Alpha 627's own constant,
  `FEDOS_BOARD_RUNTIME_ANONYMOUS_LOCAL_AUTHOR_PUBLIC_IDENTIFIER`, reused
  verbatim, not duplicated).
- **Never falsely presented as Nostr/ActivityPub/ATProto/Session**: its
  own `protocol` field is always `"fedos"`, never any of the four
  outbound protocol values.
- **Never eligible for protocol publishing**:
  `evaluateFedosOutboundEligibility()`
  (`src/board/runtime/eligibility/fedos_outbound_eligibility_evaluator.ts`,
  Phase C) rejects every `"anonymous-local"` `authorResolution` with
  reason `"anonymous-author"`, unconditionally, for every target
  protocol.
- **Stable only for its intended scope**: the sentinel is FIXED, not
  random-per-instance or random-per-post — a random-but-stable value
  would look like a persistent, distinguishable identity without any
  real authentication backing it, which is exactly the misleading
  pseudo-identity this Arc's own instruction warns against.
- **Never confused with a thread-local pseudonym**: no display name, no
  per-thread scoping, no per-conversation rotation of any kind exists
  anywhere in this Arc.

No silent promotion of an anonymous-local post to an externally
publishable one occurs anywhere in this codebase — confirmed
structurally by the eligibility evaluator's own unconditional rejection
(Alpha 665/669).
