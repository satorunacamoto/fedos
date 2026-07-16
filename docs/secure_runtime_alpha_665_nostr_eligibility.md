# Secure Runtime Alpha 665 — Nostr Eligibility

Stage 5. For a `"nostr"` target, `evaluateFedosOutboundEligibility()`
requires, in order: public policy permits federation, an explicit
target, a non-anonymous author, and an author whose own `protocol` is
`"nostr"`. Even after ALL FOUR pass, the function returns
`{ outcome: "ineligible", reason: "identity-not-controlled" }`,
unconditionally — see Alpha 649's own confirmed blocker: no signing
authority anywhere in this codebase exposes a way to verify that the
account it would sign with actually controls the resolved author's
`publicIdentifier`.

**Matching strings is not proof of key control** —
`author.publicIdentifier` is already-public data (Alpha 028); anyone
could state the same npub. Fail closed rather than weakening this rule
to "same string = same key." No bridge/attribution model is introduced
to work around this (out of scope, Absolute Prohibitions).
