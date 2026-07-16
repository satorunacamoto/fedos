# Secure Runtime Alpha 642 — Public Author Authority Responsibility Decision

Stage 2. Compares:

- **A.** `FedosBoardRuntime` reads `DesktopApplication` identity directly
  — Alpha 627's own existing shape today.
- **B.** Inject a dedicated `FedosPublicAuthorAuthority` into
  `FedosBoardRuntime`.
- **C.** Caller supplies `FedosBoardAuthorReference` — **REJECTED**
  (lets a caller impersonate any identity; forbidden by this Arc's own
  instruction).
- **D.** `FedosDesktopHost` constructs author references — rejected;
  Host is a lifecycle/resource owner (Alpha 336/337/385), not an
  authorship-policy owner.
- **E.** Publisher determines the author — **REJECTED** (a Publisher is
  protocol-specific delivery only, per this Arc's own Permanent
  Boundaries; it must never decide canonical authorship).

## Decision: B

Reasons (matching the Arc's own preferred-candidate rationale exactly):

- The command caller (`CreatePublicThreadCommand`/`ReplyToPublicThreadCommand`,
  Alpha 625) cannot impersonate an author — no author field exists on
  either command type, and the Authority is never caller-reachable.
- `FedosBoardRuntime` does not need the entire `DesktopApplication` — it
  already holds only `FedosDesktopHost` (Alpha 623's own ownership
  boundary), and the new `FedosDesktopPublicAuthorAuthority` (Alpha 647)
  wraps that SAME `FedosDesktopHost`, adding no new dependency surface.
- `FedosDesktopHost` remains a pure lifecycle/resource owner — it never
  gains authorship-policy logic (Option D correctly rejected).
- `FedosBoardOutboxPublisher` (`src/board/outbox/fedos_board_outbox_publisher.ts`)
  never sees an Authority reference of any kind — confirmed unchanged.
- Testability: `StaticFedosPublicAuthorAuthority`/
  `AnonymousLocalPublicAuthorAuthority` (Alpha 646) let a test fix an
  author outcome without constructing a real `DesktopApplication`.
- A future private mode can supply an entirely different
  `FedosPublicAuthorAuthority` implementation without touching
  `FedosBoardRuntime`'s own command logic at all.

`FedosBoardRuntimeDependencies` (`fedos_board_runtime.ts`) gains an
optional `publicAuthorAuthority?: FedosPublicAuthorAuthority` field,
defaulting to `new FedosDesktopPublicAuthorAuthority(dependencies.host)`
— mirroring the existing `idGenerator?`/`clock?` optional-with-explicit-
default pattern (Alpha 626/625) exactly.
