# Secure Runtime Alpha 541 — Publish Runtime Operational Review: Inventory

Stage 1 of the Alpha 541–560 Publish Runtime Operational Review Arc.
**Review only — no production code is modified anywhere in this Arc.**
Confirms, by direct inspection at the time this Stage was written, what
"現在完成している" (currently complete) actually means for each of the
nine named systems, and states this Arc's own headline finding up
front rather than burying it in a later Stage.

## 1. What exists, committed, today

| System | Representative files | Committed since |
|---|---|---|
| Host | `src/desktop/host/fedos_desktop_host.ts`, `fedos_desktop_host_state.ts`, `create_fedos_desktop_host.ts` | Alpha 331–340, extended through Alpha 401–410 |
| Board (core model) | `src/board/fedos_board_post.ts`, `fedos_board_identifiers.ts`, `fedos_board_author.ts`, `fedos_board_source.ts` | Alpha 251–260 |
| Persistence | `src/board/persistence/fedos_board_persistence.ts`, `in_memory_fedos_board_persistence.ts`, `append_only_fedos_board_persistence.ts`, `fedos_board_hydration.ts` | Alpha 311–320 |
| Query | `src/board/query/fedos_board_query.ts`, `fedos_board_query_types.ts` | Alpha 371–380 |
| Outbox | `src/board/outbox/fedos_board_outbox_types.ts`, `_codec.ts`, `_persistence.ts`, both in-memory/append-only backends | Alpha 411–420 |
| Publisher | Generic: `fedos_board_outbox_publisher.ts` (Alpha 471–480). Nostr-specific: `src/board/publish/nostr/*` (Alpha 451–460) | Two independent implementations, both committed |
| Observation | Outbox-embedded: `fedos_board_outbox_observation.ts` (Alpha 471–480). Standalone durable: `src/board/observation/*` (Alpha 461–470) | Two independent vocabularies, both committed |
| Scheduler | `src/board/outbox/fedos_publish_scheduler.ts` | Alpha 471–480 |
| Retry | `FedosBoardOutboxRetryPolicy` (Alpha 473/474), applied inside the Scheduler | Alpha 471–480 |

Every one of these is REAL, committed, typechecked, and covered by its
own passing test suite — "完成している" is accurate in that narrow
sense.

## 2. This Arc's own headline finding: none of it has a production caller

`grep -rl "FedosDesktopHost\|createFedosDesktopHost" src` (excluding
`src/desktop/host/` itself) finds exactly THREE matches — all three are
doc-comment PROSE mentions (`fedos_publish_scheduler.ts:130`,
`fedos_board_reader.ts:20`, `fedos_board_service.ts:24,106`), never a
real `import`. `src/worker.ts` — the one real, deployed entry point
this repository has (Cloudflare Workers, per
`docs/secure_runtime_alpha_321_board_deployment_runtime_inventory.md`'s
own confirmed inventory) — renders Board pages from its own separate
`SAMPLE_BOARDS`/`BoardData` sample-data path
(`src/render/board_preview.ts`), never from `FedosBoardService`,
`FedosDesktopHost`, or any Persistence backend.

**Every system in the table above is fully built and fully tested, but
as of this Stage, zero real running process anywhere in this
repository ever constructs a `FedosDesktopHost`, hydrates a
`FedosBoardService` from durable Persistence, writes an Outbox intent,
calls a Publisher, records an Observation, or starts a Scheduler,
outside of `test/`.** This directly extends the prior (also review-only)
Publish Pipeline Integration Review's own Alpha 490 finding ("nothing
owns Publisher, Scheduler, or either Observation vocabulary") one level
further up: nothing owns HOST either, in the one sense that actually
matters for a running system — a real caller.

This changes how every later Stage in this Arc must be read: Memory
(Alpha 547), Resource Leak (Alpha 548), Thread Safety (Alpha 549), and
Shutdown (Alpha 546) risks identified below are **latent**, not
currently observed in production — because there is no production
instance of this stack running anywhere yet. They are real risks for
the day a caller (Worker route, Desktop shell, or otherwise) is wired
in, not incidents that have happened.

## 3. Scope boundary for this Arc

This Arc reviews the NINE systems named in its own instruction. It does
NOT re-review Rust/WASM/Nostr signing (Alpha 431–450, out of scope —
unchanged, not touched), ActivityPub/AT Protocol/Session adapters
(reviewed only where they intersect Board/Outbox typing, never their
own protocol logic), or `p2p/` (untouched, as always).

## 4. See also

- `docs/secure_runtime_alpha_490_publish_pipeline_integration_review_completion.md`
- `docs/secure_runtime_alpha_321_board_deployment_runtime_inventory.md`
- `docs/secure_runtime_alpha_330_durable_backend_selection_completion.md`
