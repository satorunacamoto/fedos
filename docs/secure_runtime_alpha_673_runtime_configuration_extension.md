# Secure Runtime Alpha 673 — Runtime Configuration Extension

Stage 3. `FedosDesktopRuntimeConfig` gains exactly four new, optional
fields:

- `publicAuthorAuthority?: FedosPublicAuthorAuthority`
- `conversationPolicyAuthority?: FedosConversationPolicyAuthority`
- `idGenerator?: FedosBoardRuntimeIdGenerator`
- `clock?: FedosBoardRuntimeClock`

All four are OBJECT/function dependencies, passed straight through to
`createFedosBoardRuntime()` — never interpreted, transformed, or
validated by this file.

Deliberately NOT added: a raw identity value, a secret key, a policy
JSON bag, a UI setting, or an arbitrary untyped callback. In
particular, no `publicIdentity` field of any kind was added — see
Alpha 674 for why a real, resolved identity is injected via
`publicAuthorAuthority`, never via a raw identity snapshot threaded
through `createDesktopApplication()`.
