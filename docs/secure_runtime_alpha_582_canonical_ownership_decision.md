# Secure Runtime Alpha 582 — Canonical Ownership Decision

Stage 2 of the Alpha 581–600 Durable Retry Registry & Delivery Recovery
Arc.

## Options compared

- **Option A** (new dedicated durable Retry Registry store): a brand
  new persistence port + backend specifically for retry/delivered/
  abandoned state, written to on every attempt, read back at startup.
  Rejected — creates a SECOND durable store that must stay in lock-step
  with the Observation history (item 3, Alpha 581), a dual-write
  consistency risk with no upside: every fact a dedicated store would
  hold is already derivable from Observation history alone.
- **Option B** (extend `FedosBoardOutboxPersistence` with a
  `"delivered"` flag per intent): rejected — `FedosBoardOutboxPersistence`
  is explicitly append-only with no mutation method (Alpha 415/417's
  own established separation of "what was requested" from "what
  happened to it"); adding one would cross a boundary five prior Arcs
  have each independently respected.
- **Option C** (the EXISTING durable Observation history is the
  canonical source of truth; Scheduler/Registry state becomes a
  rebuildable CACHE) — chosen.

## Decision: Option C

`FedosDeliveryObservationPersistence`/`FedosDeliveryObservationRepository`
(Alpha 464/466, UNCHANGED) is declared the ONE durable record of
delivery/retry truth. `FedosPublishScheduler`'s own `#delivered`/
`#abandoned`/`#completedAttempts` and `FedosDeliveryRetryRegistry`'s own
`#counts` are DERIVED, rebuildable caches — correct as long as they can
be reconstructed from Observation history at any time, never
independently authoritative. This Arc's entire remaining scope (Alpha
583–590) is the READ-BACK path this decision requires and nothing else:
no new schema, no new persistence backend, no new npm dependency.

## Consequence for "durable"

Per this repository's own established vocabulary (re-confirmed reading
`docs/secure_runtime_alpha_545_publish_runtime_recovery_audit.md`),
"survives a restart" means "survives construction of a fresh instance
over the SAME injected durable backend" — never necessarily a real
on-disk/cross-OS-process artifact. `InMemoryFedosDeliveryObservationPersistence`
already satisfies this definition for anything that shares the SAME
instance across `startDelivery()` calls or across two `FedosDesktopHost`
instances a caller constructs over it (exactly Alpha 589's own "real
restart" test shape). A genuinely cross-OS-process durable backend
(e.g. a file/DB-backed `FedosDeliveryObservationPersistence`
implementation) remains possible future work, entirely orthogonal to
this Arc's own scope, and requires no interface change to adopt later
— the port (Alpha 464) already supports it.

## See also

- `docs/secure_runtime_alpha_581_retry_state_inventory.md`
- `docs/secure_runtime_alpha_583_durable_retry_record_schema.md`
