# Secure Runtime Alpha 479 — Scope and Security Regression Guards

Stage 9 of the Alpha 471–480 Canonical Publish Scheduler Foundation Arc.
Mechanically re-verifies every absolute prohibition this Arc's own
instructions named — Publisher internals, Relay, Board, Nostr,
Ontology, `p2p/`, GUI, exponential backoff — against real source text
and real `git` state, not restated from earlier Stage doc comments
alone.

## 1. Working-tree accounting at the time this Stage was written

`git status --short` shows a large number of untracked/modified paths.
Sorted by authorship:

- **This Arc's own new files (18 total)**: `docs/secure_runtime_alpha_47{1..0}_*.md`
  (10), `test/secure_runtime_alpha_47{1..0}_*.test.ts` (10 once Alpha
  480 lands), `src/board/outbox/{fedos_board_outbox_publisher,
  fedos_board_outbox_observation,fedos_publish_scheduler}.ts` (3), and
  this Stage's own README update.
- **Two OLDER, COMMITTED test files with a small diff NOT authored by
  this Arc**: `test/secure_runtime_alpha_420_outbox_foundation_completion.test.ts`,
  `test/secure_runtime_alpha_421_existing_nostr_outbound_construction_inventory.test.ts`,
  `test/secure_runtime_alpha_423_nostr_signing_boundary_options.test.ts`,
  `test/secure_runtime_alpha_448_outbox_publisher_readiness_adapter.test.ts`
  — each edit is a one-assertion "ripple" update reconciling an older
  "`src/board/publish` does not exist yet" check against that
  directory's own new presence, traced (by the edit's own inline
  comment) to a separate, uncommitted `Alpha 451–460` Arc. This Arc
  makes NO further edit to any of these four files and does not stage
  them for its own commit.
- **A separate, uncommitted, in-progress `Alpha 451–460 Canonical Nostr
  Outbound Publisher Foundation Arc`** (`docs/secure_runtime_alpha_45{1,2,3}_*.md`
  and matching `test/`, plus `src/board/publish/nostr/*`) and **a
  separate, uncommitted, in-progress `Alpha 461–470 Canonical Delivery
  Observation Arc`** (`src/board/observation/*` and matching `test/`,
  including the mid-edit `test/secure_runtime_alpha_468_security_regression_guards.test.ts`
  flagged at Alpha 478 §3). Neither is depended on, read again, or
  modified by this Arc — confirmed by the import-boundary check in §2
  below.
- **The pre-existing, untouched `p2p/` directory**, unchanged before,
  during, and after this Arc, exactly as every prior recent Arc's own
  verification has also confirmed.

## 2. Import-boundary guard (Publisher/Relay/Board/Nostr/Ontology/`p2p`/GUI)

Direct grep of this Arc's own three new files' `import` statements
(`src/board/outbox/fedos_board_outbox_publisher.ts`,
`fedos_board_outbox_observation.ts`, `fedos_publish_scheduler.ts`)
confirms every import resolves to a file already inside
`src/board/outbox/` (`./fedos_board_outbox_codec.js`,
`./fedos_board_outbox_persistence.js`, `./fedos_board_outbox_types.js`,
`./fedos_board_outbox_publisher.js`, `./fedos_board_outbox_observation.js`)
— zero imports from `src/nostr/*`, `src/desktop/*` (Relay/WebSocket),
`src/board/publish/*`, `src/board/observation/*`, `src/board/*` outside
`outbox/`, `src/runtime/*` (Ontology/Master Seed), `p2p/`, or any
`src/render/*`/GUI file.

## 3. Retry policy guard

`FedosBoardOutboxRetryPolicy` (`fedos_board_outbox_publisher.ts`) is
exactly `"immediate" | "later" | "never"` — a closed, three-literal
union type, confirmed by direct source match. Neither this file nor
`fedos_publish_scheduler.ts` contains `backoffMs`, `delayMs`,
`retryAfter`, `Math.pow`, or `Math.exp` anywhere (confirmed by grep over
both files' full text, not merely their public API).

## 4. No default/concrete Publisher implementation guard

`MockFedosBoardOutboxPublisher` (test/prototype-only, per Alpha 473 §3)
is the ONLY class implementing `FedosBoardOutboxPublisher` this Arc
adds. `git grep` for `implements FedosBoardOutboxPublisher` across the
whole repository returns exactly one match — that Mock — confirming no
Nostr/ActivityPub/AT Protocol/Session-wired implementation was created.

## 5. Tracked-file diff guard

`git diff --stat` restricted to every path this Arc's own commit will
actually stage (§1's 18 files, all new/untracked — no existing tracked
file) is, by construction, empty: this Arc stages ONLY new files, never
a modification to a pre-existing tracked file. The four ripple-edited
tracked files named in §1 are explicitly excluded from this Arc's own
`git add`.

## 6. Conclusion

Every prohibition this Arc's own instruction named — no Publisher
internal change (none existed to change; the one found in-progress
elsewhere is untouched), no Relay change, no Board change (outside the
pre-existing, sibling `src/board/outbox/` directory), no Nostr change,
no Ontology change, no `p2p/` change, no GUI change, no exponential
backoff — holds, verified by direct inspection this Stage, not merely
declared.

## 7. See also

- `docs/secure_runtime_alpha_471_existing_scheduler_and_publisher_inventory.md`
- `docs/secure_runtime_alpha_472_scheduler_responsibility_decision.md`
- `docs/secure_runtime_alpha_478_publish_scheduler_implementation.md`
