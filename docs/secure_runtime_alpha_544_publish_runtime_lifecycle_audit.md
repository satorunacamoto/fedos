# Secure Runtime Alpha 544 — Lifecycle Audit

Stage 4 of the Alpha 541–560 Publish Runtime Operational Review Arc.
Review only. Catalogs every independent lifecycle/state machine across
the reviewed stack and compares their shapes.

## Catalog

| Owner | State shape | Tokens/fields | Restart rule |
|---|---|---|---|
| `FedosDesktopHost` | Closed 6-token union (`FedosDesktopHostState`, Alpha 333) | `constructed → starting → ready → stopping → stopped`; `failed` from `starting` | Permanent once `failed`/`stopped` — no in-place reset, a NEW instance is required (Alpha 333's own forbidden-transition table). |
| `DesktopApplication` | One boolean, `#started` | `false → true` | PERMANENT one-way — `start()` throws on any second call, from ANY state; there is no `stop()`/reset method on this class AT ALL (re-confirmed, `desktop_application.ts`, `grep -c "stop("` = 0). |
| `FedosPublishScheduler` | One boolean, `#running` | `false ⇄ true` | REVERSIBLE — `start()`/`stop()` can cycle indefinitely (`stop()` is explicitly idempotent, unlike Host's `stop()` which throws when not `"ready"`). |
| `FedosBoardOutboxRetryPolicy` (per-intent, tracked in Scheduler's own `#delivered`/`#abandoned` `Set`s) | Implicit three-state (pending / delivered / abandoned), never a named type | No formal union type exists for this — it is two `Set<string>` membership checks, not a state machine with a name. | PERMANENT once `delivered`/`abandoned`, for the lifetime of ONE Scheduler instance — reset to "pending" on every fresh Scheduler construction (no persistence, Alpha 547). |

## Three genuinely different reversibility rules, one layer apart

`FedosDesktopHost` (top of the OWNED chain, Alpha 543) is the STRICTEST
— permanent failure, no restart without a new instance.
`DesktopApplication` (a component Host owns) is EQUALLY strict but for
a different reason — it was never given a `stop()` at all, so "does it
restart" is not merely forbidden, it is not an operation that exists.
`FedosPublishScheduler` (a component NEITHER Host nor anything else
currently owns, Alpha 543) is the ONLY lifecycle in this table that
tolerates repeated start/stop cycles.

This is not, by itself, a defect — a Scheduler cycling on a single
long-lived process is a reasonable design. But it means: **the moment a
future Arc wires `FedosPublishScheduler` under `FedosDesktopHost`
(per the Host Ownership Review's own Option B recommendation), Host's
OWN state machine gains no matching concept for "delivery is
stopped but Host is still ready"** — `FedosDesktopHostState` has no
seventh token, and Alpha 333's own permanent guardrail forbids adding
one lightly ("`FedosDesktopHostState` is the ONLY export... exactly
six tokens"). A future wiring Arc must decide whether Scheduler's own
`isRunning()` becomes a SEPARATE, Host-exposed signal (matching the
(unmerged) Host Ownership Review's own `deliveryStatus().running`
recommendation) rather than folded into `FedosDesktopHostState`
itself — this Stage confirms that recommendation is the only one
consistent with Alpha 333's own closed-vocabulary guardrail.

## See also

- `docs/secure_runtime_alpha_333_desktop_host_state_model.md`
- `docs/secure_runtime_alpha_543_publish_runtime_ownership_audit.md`
- `docs/secure_runtime_alpha_557_publish_runtime_state_machine_contradiction_review.md`
