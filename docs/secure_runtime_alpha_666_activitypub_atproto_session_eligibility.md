# Secure Runtime Alpha 666 — ActivityPub / ATProto / Session Eligibility

Stage 6. No Publisher implementation exists for ActivityPub, ATProto,
or Session anywhere in this codebase (confirmed, Alpha 661).

- **ActivityPub**: unsupported — `evaluateFedosOutboundEligibility()`
  returns `"unsupported-target"` for every `"activitypub"` target that
  otherwise passes the author/policy checks.
- **ATProto**: unsupported — same, `"unsupported-target"`.
- **Session**: public fanout prohibited — rejected earlier, at the
  protocol-recognition check (step 3), also `"unsupported-target"`.

No permanently undeliverable intent is queued merely because the
vocabulary contains these values — `FedosBoardRuntime` (Alpha 667) runs
`evaluateFedosOutboundEligibility()` BEFORE calling
`Host.submitPostWithOutbox()`, so an ineligible target for any of these
three protocols never reaches `createFedosBoardOutboxIntent` at all,
exactly like `"nostr"`'s own `"identity-not-controlled"` case.
