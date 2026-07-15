# Secure Runtime Alpha 488 — Desktop Host Ownership Review

Stage 8 of the Alpha 481–490 Publish Pipeline Integration Review Arc.
Review only.

## 1. Question

Is `FedosDesktopHost` the only Owner (constructor/caller) of the
pipeline components?

## 2. Finding: Host owns the Outbox WRITE side only — Publisher, Scheduler, and both Observation vocabularies currently have NO owner at all

`src/desktop/host/fedos_desktop_host.ts` imports and owns exactly:
`FedosBoardOutboxPersistence` (constructs a default
`InMemoryFedosBoardOutboxPersistence` when none is injected),
`createFedosBoardOutboxIntent`, `serializeFedosBoardOutboxIntent` — all
Outbox-write-side. `test/secure_runtime_alpha_488_...test.ts` §1
confirms this is the Host's ENTIRE Outbox-adjacent surface, and §2
confirms zero reference to `Publisher`, `Scheduler`, or `Observation` in
the Host source.

A repository-wide search (§3) for `new FedosPublishScheduler`, `new
FedosRelayNostrBoardPublisher`, or a real (non-Mock) construction of
`FedosBoardOutboxPublisher` outside `src/board/outbox/`,
`src/board/publish/`, and test files finds **zero matches**. Concretely:

- Nobody constructs a `FedosPublishScheduler` anywhere outside its own
  tests.
- Nobody constructs a `FedosRelayNostrBoardPublisher` anywhere outside
  its own tests.
- `FedosDesktopHost.submitPostWithOutbox()` writes an Outbox intent and
  returns — it never triggers, starts, or is aware that a Scheduler or
  Publisher could exist.

**"Is DesktopHost the only Owner" is not yet a question with a
meaningful answer** — ownership of Publisher/Scheduler/Observation
is currently NOBODY's, not Host's and not anyone else's. All three are
fully-built, fully-tested, standalone components with no production
caller anywhere in this repository. This is the single most consequential
finding of this Arc for Alpha 490 §3's own future-Arc recommendation.

## 3. See also

- `docs/secure_runtime_alpha_401_host_write_surface_inventory.md`
- `docs/secure_runtime_alpha_419_host_submit_outbox_coordination.md`
