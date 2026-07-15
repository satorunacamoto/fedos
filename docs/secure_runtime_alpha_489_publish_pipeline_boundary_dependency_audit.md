# Secure Runtime Alpha 489 — Publish Pipeline Boundary Dependency Audit

Stage 9 of the Alpha 481–490 Publish Pipeline Integration Review Arc.
Review only. Every edge (and every claimed NON-edge) below is verified
directly against real source — either by this Stage's own inspection or
by a prior Stage of this same Arc already cited — and mechanically
re-confirmed by `test/secure_runtime_alpha_489_...test.ts`.

## 1. Dependency diagram

```
packages/fedos-core-rust (Rust)
        ^  (wasm-bindgen)
        |
     WASM boundary (generated glue, gated behind an explicit loader)
        ^
        |
     Runtime (crypto loader, Master Seed Authority, Nostr Signing Authority
              -- src/runtime/*, src/nostr/sign/*)
        ^
        |
     Desktop (FedosRelay, FedosNostrWireEvent, FedosEventDescriptor,
              FedosDesktopHost -- src/desktop/*)
        ^                                  ^
        |                                  |
  FedosDesktopHost                  FedosRelayNostrBoardPublisher
  (owns Outbox WRITE side)          (committed, Alpha 451-460; owns Nostr
        |                            transport; no owner/caller anywhere
        |                            in production -- Alpha 488)
        v
     Board core (src/board/*.ts -- posts, identifiers, authors)
        ^
        |
     Outbox (types / codec / persistence -- src/board/outbox/*,
             depends on Board core ONLY)
        ^        ^                  ^
        |        |                  |
  Generic     Outbox            FedosPublishScheduler
  Publisher   Observation       (depends on Outbox persistence
  (Alpha 473) (Alpha 475)        + codec + Publisher + Observation,
  depends on  depends on         nothing else)
  Outbox      Outbox
  codec only  types only

     FedosDeliveryObservation (src/board/observation/*)
        -- an ISLAND. Zero incoming edges from, and zero outgoing
           edges to, any of the above. Depends on nothing; nothing
           depends on it (re-confirms Alpha 461 §3's own design intent
           and Alpha 488's own "no owner" finding, together).
```

## 2. Edges confirmed present

- Rust → (none; Rust is the base, has no repository-internal dependency).
- WASM boundary → Rust (via generated bindings; out of this Arc's own
  read scope, unchanged, not re-verified here).
- Runtime/Desktop → WASM boundary → Rust (established by Alpha
  431–450, unchanged; not re-verified this Arc since this Arc's own
  scope is the Outbox/Publisher/Observation/Scheduler pipeline only).
- `FedosDesktopHost` → Board core, Outbox persistence/types/codec
  (Alpha 488 §2).
- `FedosRelayNostrBoardPublisher` → Desktop (`FedosRelay`), Outbox
  TYPES only (never persistence — Alpha 484 §2), Nostr wire-event type.
- Generic `FedosBoardOutboxPublisher` → Outbox codec type only.
- `FedosBoardOutboxObservation` → Outbox types (`FedosBoardOutboxId`)
  only.
- `FedosPublishScheduler` → Outbox persistence, codec, generic
  Publisher, Outbox Observation — all four, all siblings under
  `src/board/outbox/` (Alpha 486 §2).

## 3. Edges confirmed ABSENT (the actually load-bearing half of an audit)

- Outbox (types/codec/persistence) → Board core is the ONLY outgoing
  edge; Outbox never reaches Publisher, Scheduler, Observation, Desktop,
  Runtime, WASM, or Rust.
- Neither Publisher implementation → Outbox PERSISTENCE (Alpha 484 §2
  — type-only or zero Outbox reference respectively).
- Neither Observation vocabulary → Publisher, Scheduler, Runtime,
  Desktop, WASM, or Rust (Alpha 485 §2).
- Scheduler → Desktop, Runtime, WASM, Rust, or any `src/nostr/*`/
  `src/board/{activitypub,atproto,session}/*` path (Alpha 486 §1).
- `FedosDeliveryObservation` (this Arc's own Alpha 461–470 output) →
  anything at all. Nothing under `src/board/observation/` imports
  outside its own directory (re-confirmed live by
  `test/secure_runtime_alpha_489_...test.ts` §3, not merely cited from
  Alpha 468).
- `FedosDesktopHost` → Publisher, Scheduler, or either Observation
  vocabulary (Alpha 488 §2).

## 4. What this confirms about the pipeline as a whole

The dependency graph is a strict, acyclic layering with NO cross-talk
between the two coexisting Publisher families and NO cross-talk between
the two coexisting Observation vocabularies — every duplication named
in Alpha 482 exists as two independent islands, never as a diamond
dependency or circular reference. The graph is clean; the problem this
Arc surfaces (Alpha 481/482/484/488) is coverage and integration, not
layering violations or cycles.

## 5. See also

- `docs/secure_runtime_alpha_481_publish_pipeline_separation_of_concerns_review.md`
- `docs/secure_runtime_alpha_484_publisher_outbox_mutation_boundary_review.md`
- `docs/secure_runtime_alpha_485_observation_publisher_awareness_review.md`
- `docs/secure_runtime_alpha_486_scheduler_protocol_agnosticism_review.md`
- `docs/secure_runtime_alpha_488_desktop_host_ownership_review.md`
