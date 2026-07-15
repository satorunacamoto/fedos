# Secure Runtime Alpha 555 — Unnecessary Repository Investigation (不要なRepository)

Stage 15 of the Alpha 541–560 Publish Runtime Operational Review Arc.
Review only. This Arc's own single most concrete finding.

## Finding: `PersistedFedosBoardRepository` (Alpha 317) is built, tested, and never wired into any real construction path

Confirmed by exhaustive search (Alpha 542 §): `new PersistedFedosBoardRepository(`
appears NOWHERE in `src/` — its only construction sites are its own
test file (`test/secure_runtime_alpha_317_persisted_board_repository.test.ts`)
and later tests exercising it directly for their own purposes. The ONE
place a `FedosBoardRepository` implementation is actually chosen for a
live `FedosBoardService` — `hydrateFedosBoardService`
(`fedos_board_hydration.ts:124`) — constructs `FedosBoardService` with
**zero arguments**, always resolving the DEFAULT `InMemoryFedosBoardRepository`.

## How this happened (reconstructed from the historical record, not guessed)

`PersistedFedosBoardRepository` (Alpha 317) was built as part of the
Alpha 311–320 Canonical Board Persistence Boundary Arc, implementing
the frozen `FedosBoardRepository` contract directly against
`FedosBoardPersistence` — one candidate architecture for "how does
Persistence become a Repository." Alpha 318 (the VERY NEXT Stage of the
SAME Arc) instead built `hydrateFedosBoardService` — a DIFFERENT
architecture: replay Persistence records into a FRESH, always-in-memory
`FedosBoardService` at startup, then treat that hydrated service as the
live Repository, with Persistence written to SEPARATELY on every
mutation (`FedosDesktopHost.submitPost()`'s own two-step write, Alpha
395, built four Arcs later). Both architectures solve the same problem;
only the SECOND was ever connected to a real Host. Alpha 330's own
completion doc even lists `PersistedFedosBoardRepository` in its own
"what this Arc built" summary without ever flagging that it would go
unused — the gap was never named until this Stage.

## Is it "unnecessary" in the sense this investigation asks?

**Yes, as currently positioned.** It is not WRONG code — its own test
suite (Alpha 317) passes, and it correctly implements the contract it
claims to. But it duplicates a responsibility
(`FedosBoardRepository`-backed-by-Persistence) the ACTUALLY-WIRED
architecture (hydrate-once, write-through-separately) already
discharges via a different mechanism, and — per Alpha 553's own finding
— it does so with WEAKER guarantees (no thread-integrity enforcement)
than the mechanism that IS wired. A caller who reached for it, seeing
it pass its own tests and implement the "obvious" contract, would get a
silently less-safe Repository than `FedosBoardService`'s own default.

## Recommendation (review-level, not implemented by this Arc)

Do not delete it in a Review Arc (out of scope by this Arc's own
prohibition). A future Arc should choose exactly one of: (a) formally
retire it — mark it superseded in its own doc header and stop testing
it as if it were a live candidate, or (b) give it a real caller by
making it the alternative `FedosBoardRepository` a durable-backend Host
configuration could inject into `FedosBoardService`'s constructor
(closing Alpha 553's own semantics gap FIRST, since as-is it would
still silently skip thread-integrity checks if wired naively).

## See also

- `docs/secure_runtime_alpha_317_persisted_board_repository.md`
- `docs/secure_runtime_alpha_330_durable_backend_selection_completion.md`
- `docs/secure_runtime_alpha_553_publish_runtime_responsibility_duplication_investigation.md`
