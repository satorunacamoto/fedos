# Secure Runtime Alpha 113 — Identity Flow Review

**Status: this Stage is REVIEW / DECISION ONLY. It makes NO code
change of any kind — no file under `src/` is touched. This document
and its own guard test are the entire deliverable. This is Stage 3 of
the Alpha 111–115 Identity Authority Design Arc.**

## 1. Why now

Alpha 111 fixed Runtime as the sole Authority. Alpha 112 fixed Reader
and Provider as permanently independent. Neither Stage drew the
complete picture — this Stage fixes the full Identity Data Flow, as a
diagram, covering BOTH paths at once and how they relate to the single
Authority.

## 2. Candidates considered

- **Desktop → Reader → Provider → Runtime.** A single, linear chain
  where Reader feeds Provider, which feeds Runtime. Rejected in
  advance by Alpha 112 (Reader is not Provider's input) — included
  here only for completeness, not as a live candidate.
- **Desktop → Runtime → Provider.** A single, linear chain omitting
  Reader entirely. Does not reflect that Reader is a real, currently
  Desktop-held component (Alpha 103) with its own real data path — an
  incomplete picture, not an adopted one.
- **Two independent paths, both Desktop-rooted, converging only at
  Desktop's own ownership, never at shared data.** Matches the actual,
  confirmed architecture (Alpha 105/110/112) precisely.

## 3. Adopted Flow, with diagram

```
                              Desktop
                        (DesktopApplication)
                         constructs & owns
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
        FedosRuntimeIdentity      FedosPublicIdentityReader
         (the Identity            (e.g. NostrPublicIdentityReader)
          AUTHORITY, Alpha 111)
                    │                       │
                    ▼                       ▼
        FedosIdentityService      (reads its own Source directly)
                    │                       │
                    ▼                       ▼
        FedosIdentityProvider      FedosNostrPublicIdentitySource
         (e.g. NostrIdentityProvider)  (e.g. StaticNostrPublicIdentitySource
                    │                    or NullNostrPublicIdentitySource)
                    ▼
        FedosNostrPublicIdentitySource
         (a SEPARATE instance from
          the Reader's own, per
          Alpha 105/110)
```

Two paths, both rooted at Desktop, both eventually reaching a
`FedosNostrPublicIdentitySource`-shaped read — but NEVER converging
with each other (Alpha 112). Only the LEFT path (through
`FedosRuntimeIdentity`) writes any persistent state; the RIGHT path
(through Reader) performs a stateless read on demand and writes
nothing anywhere.

## 4. What happens after Provider resolves, on the Authority path only

```
FedosIdentityProvider.describeIdentity()
  → reads its own Source                          [READ]
  → FedosIdentityService receives the Descriptor
      → registry.register(record), if non-null     [WRITE: Registry]
      → returns the Descriptor to its own caller
  → FedosRuntimeIdentity.#completeBootstrap(descriptor)
      → this.#descriptor = descriptor               [WRITE: Runtime's own state]
      → this.#bootstrapped = true                   [WRITE: Runtime's own state]
```

This is the ONLY point anywhere in the entire Identity Flow where
persistent state is written — confirmed unchanged since Alpha 069, and
untouched by every Stage since, including this whole Arc.

## 5. Decision

**The Identity Data Flow is permanently fixed to the diagram in §3:
TWO independent paths, both rooted at Desktop's own ownership — one
through `FedosRuntimeIdentity` (the Authority, Alpha 111), one through
`FedosPublicIdentityReader` (Desktop's own convenience read, Alpha
112) — that never converge. Only the Authority path ever writes
persistent state, and only at the single point shown in §4.**

## 6. What this Stage does NOT do

- Does **not** modify any file under `src/desktop/*`, `src/identity/*`,
  or `src/runtime/*`.
- Does **not** connect the two paths shown in §3.
- Does **not** modify `create_runtime.ts`, `types.ts`, `src/worker.ts`,
  Storage, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, Nostr communication,
  signing, secret-key handling, GUI, or Observation of any kind.

## 7. See also

- `docs/secure_runtime_alpha_069_identity_bootstrap_state_consolidation.md`
- `docs/secure_runtime_alpha_105_integration_verification.md`
- `docs/secure_runtime_alpha_110_integration_verification.md`
- `docs/secure_runtime_alpha_111_identity_authority_review.md`
- `docs/secure_runtime_alpha_112_reader_provider_relationship_review.md`
