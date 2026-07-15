# Secure Runtime Alpha 471 — Existing Scheduler and Publisher Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change.** Stage 1
of the Alpha 471–480 Canonical Publish Scheduler Foundation Arc.

## 1. Method

Direct inspection of `src/board/outbox/*`, `src/nostr/*`, `src/desktop/*`
(Relay/websocket files), `docs/secure_runtime_alpha_4[0-5]*` design docs,
`README.md`'s own current Status banner, and — per this Arc's own
instruction that findings be confirmed, not assumed — the actual `git
status --short` of this working tree at the time this Stage was
written.

## 2. Findings

1. **No Scheduler exists.** No file anywhere in a committed revision of
   this repository contains `Scheduler`, `FedosPublishScheduler`, or any
   periodic/interval-driven Outbox-flow abstraction. `git grep -c
   FedosPublishScheduler` against `HEAD` returns zero matches.
2. **`FedosBoardOutboxPersistence` (Alpha 417,
   `src/board/outbox/fedos_board_outbox_persistence.ts`) exposes exactly
   `putIntent`/`getIntent`/`listIntents` — no query for "pending" vs.
   "delivered."** Alpha 415 deliberately shipped no Observation/state
   field. A Scheduler reading `listIntents()` today gets EVERY intent
   ever written, with no durable signal for which are already handled —
   confirmed by re-reading `fedos_board_outbox_persistence.ts` directly,
   not merely recalled from the Alpha 415 doc.
3. **The committed history's own last Arc (Alpha 431–450) ends with a
   "Next Arc recommendation" naming Alpha 451–460
   ("Nostr Outbound Board Publisher & Delivery Observation Arc"), not
   this Arc's own number range.** This Arc's own instruction is
   self-contained and does not require Alpha 451–470 to exist or be
   complete first.
4. **A working-tree finding, not a committed-history one: at the time
   this Stage was written, `git status --short` shows untracked,
   uncommitted files for a `Alpha 451–460 Canonical Nostr Outbound
   Publisher Foundation Arc` in progress** — `docs/secure_runtime_alpha_451_*`
   through `_453_*`, matching `test/` files, and
   `src/board/publish/nostr/{fedos_nostr_board_publisher,
   fedos_relay_nostr_board_publisher,
   fedos_nostr_wire_event_to_event_descriptor}.ts`. None of this is part
   of any commit this Arc builds on. Direct inspection of
   `src/board/publish/nostr/fedos_nostr_board_publisher.ts` shows its own
   `FedosNostrBoardPublisher.publishOne`/`publishBatch` take a
   `FedosNostrBoardPublishEntry` — an Outbox intent PAIRED WITH an
   already-signed `FedosNostrWireEvent` — and return a bare `boolean`,
   with that Arc's own Alpha 452 decision doc explicitly REJECTING any
   `outcome`/`retryPolicy` result-object field as "Observation
   vocabulary... explicitly prohibited" under ITS OWN scope.
5. **This Arc cannot honestly depend on that in-progress `FedosNostrBoardPublisher`,
   for two independent reasons.** First, it is Nostr-specific and
   requires an already-signed `FedosNostrWireEvent` this Arc has no
   access to without a Nostr Signing Authority call — forbidden by this
   Arc's own `Nostr変更禁止`/`Publisher内部変更禁止` instructions.
   Second, it is a SEPARATE, uncommitted, still-in-progress piece of work
   this Arc has no authority to finish, modify, or assume the final
   shape of. This Arc therefore treats `src/board/publish/*` as
   completely out of scope: not read again after this Stage, not
   imported, not modified, not referenced by any new file this Arc adds.
6. **A protocol-agnostic Publisher port does NOT exist anywhere,
   committed or uncommitted.** Every Publisher-shaped type found this
   Stage (`RelayPublisher`, `src/nostr/publish.ts`, Alpha 216;
   `FedosNostrBoardPublisher`, uncommitted Alpha 455 above) is
   Nostr-specific. This Arc's own instruction to build a Scheduler that
   "uses a Publisher Interface" therefore requires DEFINING that
   interface, not merely reusing one — mirroring the exact situation
   Alpha 411 §7 already faced for Outbox persistence itself ("a separate
   persistence port IS required").
7. **Retry Policy vocabulary (`Immediate`/`Later`/`Never`) exists nowhere
   in this repository before this Arc.** Alpha 415 named Observation
   vocabulary but explicitly zero retry policy ("This Arc introduces NO
   retry policy, scheduled or automatic, of any kind"). The uncommitted
   Alpha 452 decision (finding 4, above) explicitly rejects retry
   vocabulary from ITS OWN scope. This Arc is the first to define it.
8. **Exact ripple scope**: three new files under the existing
   `src/board/outbox/` directory (`fedos_board_outbox_publisher.ts`,
   `fedos_board_outbox_observation.ts`, `fedos_publish_scheduler.ts`) —
   no existing file under `src/board/outbox/` is modified. Zero files
   under `src/nostr/`, `src/desktop/`, `src/board/` (outside
   `src/board/outbox/`), `p2p/`, or any GUI/Ontology location are read
   for anything other than this inventory, and none are modified.

## 3. Conclusion

No Scheduler and no protocol-agnostic Publisher port exist in any
committed revision of this repository. A separate, uncommitted,
Nostr-specific Publisher Arc is independently in progress in this
working tree but is out of this Arc's scope entirely — not depended on,
not modified. This Arc defines its own minimal, generic
`FedosBoardOutboxPublisher` port and a `FedosPublishScheduler` that
depends on it, exactly mirroring the "new sibling port" precedent Alpha
411–417 already established for Outbox persistence itself.

## 4. See also

- `docs/secure_runtime_alpha_415_outbox_state_observation_separation.md`
- `docs/secure_runtime_alpha_417_outbox_persistence_port_memory_backend.md`
- `docs/secure_runtime_alpha_450_master_seed_authority_and_nostr_signing_activation_completion.md`
