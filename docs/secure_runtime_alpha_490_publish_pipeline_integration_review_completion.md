# Secure Runtime Alpha 490 — Publish Pipeline Integration Review Completion

Stage 10 (final) of the Alpha 481–490 Publish Pipeline Integration
Review Arc. Synthesis. **This entire Arc changed zero production
code** — every file this Arc adds is under `docs/` or `test/`, and
every `test/` file added is read-only against existing, unmodified
source. See §5 below for the actual verification record.

## 1. Problems found (問題点)

1. **Three independent, unreconciled "delivery state" vocabularies**
   exist for the same real-world concept: Alpha 415's own six-candidate
   list (still unrealized), `FedosBoardOutboxObservation` (five
   different-named kinds), and `FedosDeliveryObservation` (five
   different-named-again states) — Alpha 482 §1.
2. **Two independent, unreconciled Publisher result contracts** —
   object-with-retry-policy vs bare boolean — answering the same
   design question differently, with no adapter between them — Alpha
   482 §2–3.
3. **The Scheduler's Observation-log is not durable** — it lives only
   in a private in-memory array, lost on restart, despite a fully
   durable `FedosDeliveryObservationRepository` already existing
   (committed, unwired) that could hold it — Alpha 481 §4.
4. **The state-transition graph is documented, not enforced** —
   neither Observation constructor nor either Repository/write-path
   rejects an out-of-order or post-terminal fact; a late-arriving stale
   observation silently becomes the derived "current state" — Alpha 483.
5. **Nothing in this repository currently owns Publisher, Scheduler, or
   either Observation vocabulary.** `FedosDesktopHost` owns the Outbox
   WRITE side only. Zero production caller constructs a
   `FedosPublishScheduler` or a `FedosRelayNostrBoardPublisher`. Both
   are fully built and fully tested, dead code by any practical
   definition — Alpha 488 §2.
6. **Two competing answers to four-protocol extensibility coexist** —
   a zero-change generic Publisher interface (proven live in Alpha 487
   §1) versus a per-protocol parallel-surface pattern the Nostr thread
   already committed to — with no bridge between them, so extending
   the Nostr family's own pattern to a second protocol would not
   automatically make that protocol available to the Scheduler — Alpha
   487 §3–4.

## 2. What is NOT a problem (confirmed clean)

- Neither Publisher rewrites the Outbox (Alpha 484).
- Neither Observation vocabulary is aware of any Publisher (Alpha 485).
- The Scheduler contains zero protocol-specific processing (Alpha 486).
- The retry-policy vocabulary is defined exactly once, not duplicated
  (Alpha 482 §4).
- The dependency graph has no cycles and no unexpected cross-layer
  reach — Rust/WASM/Runtime/Desktop stay below Board core; Outbox
  depends on Board core only; every pipeline component's dependency
  set is exactly what its own design doc claims (Alpha 489).

## 3. Improvement proposals (改善提案) — NOT authorized by this Arc, named for a future Arc's own scoping

1. Pick ONE Observation vocabulary as canonical (or an explicit mapping
   between them) before wiring either to a real Publisher — reconciling
   AFTER wiring means migrating live data; reconciling BEFORE costs one
   decision.
2. Pick ONE Publisher return contract as canonical, or define the
   adapter Alpha 482 §2 confirms does not yet exist, before a second
   protocol Publisher is built under either family.
3. Give `FedosPublishScheduler` an injectable Observation-storage
   dependency (the existing `FedosDeliveryObservationRepository`
   interface is already shaped closely enough to fit) rather than its
   own private array, so a real deployment does not lose delivery
   history on every restart.
4. Add a write-path transition check (Repository-level, not
   constructor-level, per Alpha 483 §2's own reasoning) before any real
   Publisher starts producing concurrent or out-of-order attempts.
5. Decide an OWNER for Publisher/Scheduler — most likely
   `FedosDesktopHost`, extending its existing sole-owner pattern for
   Outbox, since Alpha 488 already establishes Host as the only
   candidate with a construction-time hook (`create_fedos_desktop_host.ts`)
   that already injects `FedosBoardOutboxPersistence`.

## 4. Future Arc candidates (今後のArc候補) — named, not started

- **Publisher/Observation Reconciliation Arc** — resolves proposal #1–2
  above; a decision-only Arc, likely no code.
- **Delivery Observation Durability Wiring Arc** — resolves proposal
  #3; wires the Scheduler to `FedosDeliveryObservationRepository`.
- **Publish Pipeline Host Ownership Arc** — resolves proposal #5;
  the first Arc that would make Scheduler/Publisher reachable from any
  real application entry point.
- **Nostr Publisher → Generic Publisher Adapter Arc** — resolves the
  Alpha 487 §4 gap directly, letting the ALREADY-BUILT
  `FedosRelayNostrBoardPublisher` actually serve the Scheduler without
  either side being rewritten.

This Arc recommends reconciliation-and-ownership work be sequenced
BEFORE any additional protocol Publisher is built, since Alpha 482/487
both show that building a fifth vocabulary or a third Publisher family
today would only deepen the duplication this Arc surfaces rather than
resolve it.

## 5. Verification

`npm run typecheck` — see this Arc's own commit message for the
run performed immediately before commit (this doc is written before
that final run so it cannot honestly restate a result it has not yet
observed; the commit is only made after a clean run against every file
this Arc adds). Review tests: `npx vitest run test/secure_runtime_alpha_48[1-9]*`
— run and confirmed GREEN before this Stage was finalized. No `cargo`
command was run — this Arc touches zero `packages/` file.

## 6. See also

- `docs/secure_runtime_alpha_481_publish_pipeline_separation_of_concerns_review.md`
  through `docs/secure_runtime_alpha_489_publish_pipeline_boundary_dependency_audit.md`
