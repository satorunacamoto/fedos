# Secure Runtime Alpha 682 — Binding Architecture Decision

Stage 2 of Phase A of the Alpha 681–720 Arc.

## Options compared

- **A.** Signing Authority exposes the public key for an account index; a
  separate binding evaluator compares it to the canonical author.
- **B.** Signing Authority accepts a `publicIdentifier` and internally
  confirms ownership.
- **C.** Public Author Authority is constructed directly from Signing
  Authority.
- **D.** Caller asserts the binding.
- **E.** Publisher checks the binding.

## Decision

**A, combined with C as an additive option** — matching the task's own
preferred architecture exactly:

- The Signing Authority exposes only a non-secret derived public identity
  (`FedosNostrSigningPublicIdentity`, Alpha 683/684).
- A narrow `FedosNostrAuthorBindingAuthority`
  (`src/board/runtime/identity/fedos_nostr_author_binding_authority.ts`,
  Alpha 688) performs the comparison.
- `FedosBoardRuntime` consumes only the binding result (Alpha 694/698) —
  it never reaches into the Signing Authority itself.
- The Publisher (Phase B) remains entirely unaware of this decision — it
  never sees a `FedosNostrAuthorBindingResult` or a signing authority
  reference of its own beyond what it already needed to sign/publish.
- Additionally, `FedosNostrSigningPublicAuthorAuthority` (Alpha
  690/691) is provided as an optional, additive `FedosPublicAuthorAuthority`
  that derives its author directly FROM the Signing Authority — giving a
  caller a "trivially bound by construction" option alongside the general
  binding-authority check, which still applies uniformly regardless of
  which `FedosPublicAuthorAuthority` produced the resolved author.

**B is rejected** — folding ownership confirmation into the Signing
Authority itself would require it to accept caller-supplied identifiers
and would blur "signs" with "verifies," widening its trust surface for no
benefit over a separate, narrow evaluator.

**D and E are rejected**, exactly as instructed — a caller-asserted binding
proves nothing, and a Publisher is not the right owner of identity policy
(Permanent Security Invariant #10).
