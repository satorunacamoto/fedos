# Secure Runtime Alpha 718 — Structural Security Guards

Stage 18 of Phase B. Confirmed by
`test/secure_runtime_alpha_718_structural_security_guards.test.ts` (7
tests, direct source inspection with comments stripped so thorough prose
documentation never trips a check meant for actual code):

- No raw secret field in any config (`FedosDesktopRuntimeConfig`'s two new
  fields carry only object/number dependencies).
- No signer reference in the Outbox (`FedosBoardOutboxIntent` unchanged;
  `FedosSigningAuthorityBoardPostEventSource` is never persisted, only
  held in memory by the running Local Runtime).
- No policy reference in the Publisher (`FedosRelayOkCorrelatedNostrBoardPublisher`'s
  own imports never reach `runtime/identity`, `runtime/policy`, or
  `runtime/eligibility`).
- No Relay reference in the Binding Authority
  (`FedosSigningAuthorityNostrAuthorBinding`'s own imports never reach
  `fedos_relay.js`, `outbox`, or `persistence`).
- No `p2p/` import anywhere in any file this Arc added.
- No Worker coupling — no file this Arc added imports `worker.js`.
- No ActivityPub/AT Protocol/Session outbound import anywhere in any file
  this Arc added.
- No private/direct message path touched — no file this Arc added
  references DM/private-group/session-private concepts.
- No automatic target inference — `boardPostToNostrUnsignedEventRequest()`'s
  own function body never reads `post.author` or `post.source`.
- No generic signing API — no `sign(hash)`-shaped method, no `nsec`
  field/assignment, anywhere in actual code (not merely absent from
  prose).
- No new dependency of any kind — `package.json`/`Cargo.toml` are
  untouched by this Arc except the one reviewed, additive `pub fn` in
  Rust (Alpha 685).
