# Secure Runtime Alpha 360 — Append-only Backend Completion Declaration

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha
351–360 Append-only Durable Board Backend Arc.**

## 1. Why now

Alpha 351 confirmed no interface change was required. Alpha 352 fixed
the JSON Lines record format and disclosed the no-`fsync` crash
assumption. Alpha 353 implemented `AppendOnlyFedosBoardPersistence`.
Alpha 354 verified append-only write semantics. Alpha 355 verified
replay-based reading with no side index. Alpha 356 verified all four
`FedosBoardPersistenceWriteResult` outcomes, including the
newly-reachable `"failed"`. Alpha 357 resolved the "trailing partial
write" design gap Alpha 345 §6 left open, by fail-closed uniform
treatment. Alpha 358 confirmed `hydrateFedosBoardService` needs zero
modification. Alpha 359 verified the full pipeline end to end with
real fixtures from all four protocols, across a genuine restart. This
Stage freezes the Append-only Backend and issues the Arc's own closing
Completion Declaration.

## 2. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE.** The first real
durable backend for `FedosBoardPersistence` exists —
`AppendOnlyFedosBoardPersistence`
(`src/board/persistence/append_only_fedos_board_persistence.ts`) —
implementing the architecture Alpha 349 froze, using ONLY `node:fs`,
with:

- **Every existing public interface preserved** — `FedosBoardPersistence`
  (Alpha 315), `PersistedFedosBoardRepository` (Alpha 317),
  `hydrateFedosBoardService` (Alpha 318), and the codec (Alpha 314)
  are all byte-for-byte unchanged (Alpha 351).
- **A frozen, documented record format** — one JSON-serialized
  `FedosPersistedBoardPostRecordV1` per `\n`-terminated line, with the
  no-`fsync` durability limitation explicitly disclosed, not hidden
  (Alpha 352).
- **Correct append semantics** — append only, never rewrite, never
  truncate, never reorder, verified structurally and behaviorally
  (Alpha 354).
- **Correct, replay-based reading** with deliberately no side index
  yet (Alpha 355).
- **Correct conflict handling** — all four write outcomes verified,
  `"failed"` reachable for the first time in this repository's own
  history (Alpha 356).
- **Fail-closed crash behavior**, uniformly, across all five reviewed
  corruption shapes — resolving Alpha 345 §6's own previously-open
  design question (Alpha 357).
- **Unmodified hydration** — `hydrateFedosBoardService` works against
  the new backend with zero code change (Alpha 358).
- **End-to-end verification** with real fixtures from all four Board
  Adapters (Nostr, ActivityPub, AT Protocol, Session), across a
  genuine restart, confirming identical feed, thread grouping, source
  references, ordering, and duplicate handling (Alpha 359).

## 3. Remaining limitations, named explicitly

- **No `fsync`** (Alpha 352 §3): a true power-loss event may lose the
  last few seconds of un-flushed writes; never corrupts earlier ones.
  Deliberately not closed this Arc.
- **No compaction** (named by Alpha 344 §6, still unsolved): every
  distinct `id` is written at most once by this class's own `putPost()`
  (Alpha 354 §3), so the log does not grow from THIS class's own
  duplicate writes — but no mechanism exists to reclaim space if a
  record is ever superseded by a future update-in-place concept, which
  does not exist yet either (this port has no `delete`/update, Alpha
  315). Named as the explicit subject of the next Arc.
- **`FedosDesktopHost.start()` does not catch a THROWN exception from
  `hydrateFedosBoardService()`/`persistence.listPosts()` — only a
  RETURNED non-`"hydrated"` outcome sets `state()` to `"failed"`.**
  Confirmed by direct execution: constructing a `FedosDesktopHost`
  with an `AppendOnlyFedosBoardPersistence` pointed at a log file
  containing a malformed trailing line, then calling `start()`, causes
  `start()` to REJECT (the caller correctly learns startup failed) —
  but `host.state()` afterward reads `"starting"`, never `"failed"`.
  This is a LATENT gap in the existing, unmodified Alpha 335
  implementation (`src/desktop/host/fedos_desktop_host.ts`), invisible
  before this Arc because `InMemoryFedosBoardPersistence.listPosts()`
  can never throw. **This Arc does NOT fix it** — doing so would mean
  modifying `src/desktop/host/*`, outside this Arc's own explicit
  scope ("Only implement the append-only backend and supporting
  logic"). Named here, with a reproducing test, for whichever future
  Arc is authorized to touch `FedosDesktopHost` next.
- **No filesystem path resolution, no Host wiring**: neither
  `FedosDesktopHost` nor `createFedosDesktopHost()` is modified to
  construct or select an `AppendOnlyFedosBoardPersistence` — the
  default remains `InMemoryFedosBoardPersistence` (Alpha 334,
  unchanged). Wiring a real backend into the Host's own default
  construction path was never named as this Arc's own scope, and
  Alpha 347 §3's own storage-directory-location question remains
  exactly as open as it was two Arcs ago.
- **No concurrent-writer support**: unchanged from Alpha 322
  §"NOT YET" — this backend assumes a single writer process, matching
  every requirement this repository has frozen so far.

## 4. Still out of scope (verbatim from this Arc's own instruction,
confirmed by direct inspection)

- SQLite, D1, IndexedDB — no reference anywhere in this Arc's own
  code.
- GUI, Worker changes, Runtime changes, Relay changes, Protocol
  Adapter changes, Ontology integration — `src/worker.ts`,
  `src/runtime/*`, `src/identity/*`, every Board Adapter, and `p2p/`
  all carry zero diff from this Arc.
- New dependency of any kind — `package.json`'s `dependencies` count
  stays fixed at 2; no `Cargo.toml` change of any kind.

## 5. Next Arc recommendation

**Secure Runtime Alpha 361–370: Append-only Compaction & Integrity
Review.**

Reason: this Arc's own required recommendation, matching its own
instruction verbatim. Compaction (§3) is the one concrete, unsolved
problem this Arc's own implementation carries forward unchanged from
Alpha 344 §6 — the log has no mechanism to reclaim space, and no
requirement in this repository yet forces the question, but a future
Arc reviewing INTEGRITY (checksums? a stronger corruption-detection
scheme beyond "JSON.parse either succeeds or the whole read fails"?)
would naturally also want to design compaction alongside it, since
both require deciding how the log's own on-disk shape may legitimately
change over time — a decision this Arc deliberately left untouched
(§3's own "never rewrite, never truncate" guarantee stays intact
until a separately-reviewed Arc explicitly revisits it).

## 6. See also

- `docs/secure_runtime_alpha_359_four_protocol_append_only_verification.md`
- `docs/secure_runtime_alpha_358_hydration_review.md`
- `docs/secure_runtime_alpha_357_crash_review.md`
- `docs/secure_runtime_alpha_356_conflict_handling.md`
- `docs/secure_runtime_alpha_355_append_only_reading.md`
- `docs/secure_runtime_alpha_354_append_semantics.md`
- `docs/secure_runtime_alpha_353_append_only_persistence_implementation.md`
- `docs/secure_runtime_alpha_352_append_only_record_format.md`
- `docs/secure_runtime_alpha_351_existing_persistence_layer_inventory.md`
- `docs/secure_runtime_alpha_350_backend_reevaluation_completion.md`
