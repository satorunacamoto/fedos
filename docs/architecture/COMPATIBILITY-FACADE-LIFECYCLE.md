# FedOS — Compatibility Facade Lifecycle

Status: written this arc (Compatibility Facade Reduction + Package
Extraction Readiness + Remaining Architecture Debt Closure, Agent F). Pure
software architecture, no legal/AML/regulatory content. This arc did NOT
attempt a mass deletion of the 811 compatibility shims the prior arc
(Architecture Dependency Closure) deliberately left in place "purely for
any external/unknown consumer" — see that arc's own
`ARCHITECTURE-DEPENDENCY-CLOSURE-FINAL-VALIDATION.md`. This document
records the machine-generated inventory this pass built, the strict
removal criteria applied, exactly what was removed and why, what was
deprecation-marked, and the policy going forward.

## What a "compatibility shim" is, precisely

A `.ts` file under `src/` or `packages/<name>/src/` whose entire
non-comment content is exactly one `export * from "...";` (or `export {
default } from "...";`) statement, pointing at the file's canonical
post-migration location. All 811 shims discovered by this arc's own fresh
scan are the `export * from` shape — none use the `default` form.

## Method: machine-generated, not hand-built

A Node script (`scripts`-equivalent, run this pass, not committed as a
permanent script since its one-time inventory output is what matters —
see "Generated data file" below) walked every `.ts`/`.tsx` file under
`src/` and `packages/*/src/`, structurally identified every shim (single
non-comment statement, `export * from` shape), and for each recorded:

- **OLD PATH** / **NEW AUTHORITATIVE PATH** (the re-export target,
  resolved to a real file on disk, mirroring this repo's own NodeNext
  `.js`-suffixed-specifier-resolves-to-sibling-`.ts` convention).
- **EXPORTED SYMBOLS** (parsed from the target file's real `export`
  statements).
- **INTERNAL IMPORT COUNT** — every `src/`, `test/`, `packages/*/src/`
  file whose relative import specifier resolves to the OLD path, computed
  via a SINGLE global import graph (not a per-shim rescan — the first
  implementation attempt of this rescanned the whole repo per shim, which
  was pathologically slow on this repo's OneDrive-synced filesystem;
  rewritten to build the graph once and reverse-index it).
- **TEST IMPORT COUNT** — same, restricted to `test/`/`packages/*/test/`,
  covering `import`, dynamic `import()`, and `require()`.
- **LITERAL TEST STRING REFERENCE COUNT** — a separate, broader check:
  does the OLD path's repo-relative string (with or without extension)
  appear ANYWHERE in a test file's source, catching `?raw` imports and
  other non-import literal references a live-import check alone would
  miss.
- **DOC REFERENCE COUNT** — every `docs/**/*.md` file containing the OLD
  path string.
- **PUBLIC BARREL CLOSURE** — is the shim's target reachable by
  transitively following every `from "..."` specifier starting at the 3
  public barrels (`src/os/core/index.ts`, `src/os/messenger/index.ts`,
  `src/os/commerce/index.ts`)?
- **EXISTING `@deprecated` STATUS** — before this pass, **0 of 811** shims
  carried a `@deprecated` tag.

### Generated data file

The full per-shim table (807 rows, post-removal) is committed at
[`docs/architecture/compatibility-facade-inventory.generated.json`](./compatibility-facade-inventory.generated.json)
rather than inlined here — 811 rows is too much for a readable Markdown
table. It carries its own `meta` block (generation timestamp, bucket
counts, scope note). This document's own counts below are the
authoritative summary; the JSON is the detail.

## Fresh count vs. the prior arc's claim

**811** — this arc's own independent fresh scan found exactly 811 shims,
matching the prior arc's own claimed count exactly (764 Messenger-migration
+ 43 Core-extraction + 4 `master_seed`-move shims). No drift.

## Re-verification of "internal old-path imports: 0"

The prior arc's `ARCHITECTURE-DEPENDENCY-CLOSURE-FINAL-VALIDATION.md`
claimed **"INTERNAL OLD-PATH IMPORTS: 0"** — every `src/`/`test/`
importer of any of the 811 shims repointed to the canonical location.

**This arc's fresh, independent re-verification found this claim is NOT
exactly true: 2 internal old-path imports exist.** Both are inline
TYPE-POSITION `import("...").TypeName` expressions (not `import ... from
"..."` statements), which is almost certainly why the prior arc's own
sweep — built around standard import-statement rewriting — missed them:

1. `src/os/messenger/conversations/deletion/fedos_deletion_status.ts:76`
   ```ts
   readonly target: import("../../../../conversation/deletion/fedos_deletion_target.js").FedosDeletionTarget;
   ```
   references the OLD shim `src/conversation/deletion/fedos_deletion_target.ts`
   instead of the canonical `src/os/messenger/conversations/deletion/fedos_deletion_target.ts`
   (a sibling file in the SAME directory as the importing file).

2. `src/os/messenger/conversations/deletion_request/fedos_persisted_deletion_recipient_decision_record_v1.ts:18`
   ```ts
   readonly decisionState: import("../../../../conversation/deletion_request/fedos_deletion_recipient_decision_state.js").FedosDeletionRecipientDecisionState;
   ```
   references the OLD shim `src/conversation/deletion_request/fedos_deletion_recipient_decision_state.ts`
   instead of the canonical sibling file.

Both lines were committed as part of the original "Messenger migration
Stage 1/6: conversations/ (377 files)" commit (`6dc5109a`) and were never
touched by the later "Architecture Dependency Closure" commit
(`1369dc79`) that claimed 0 internal imports. **Per this arc's own binding
instruction, these were NOT silently fixed** (an inline type-only
reference is trivially correctable, but the instruction is explicit: report
file/line, do not treat a live finding as license to edit unrelated code
in the same pass without separate review). **Both shims therefore stay —
they fail the "0 internal imports" removal criterion outright.** This is
flagged prominently for the Coordinator as a real, if narrow (2 lines out
of 6,596 originally-repointed occurrences), correction to the prior arc's
own claim.

## Classification

Every one of the 811 shims was classified into exactly one bucket. Given
the review's own findings (below), the working set narrowed to 807 after
this pass's 4 removals.

| Bucket | Count (of 811, pre-removal) | Count (of 807, after this pass) | Definition |
|---|---:|---:|---|
| **PUBLIC COMPATIBILITY** | 393 | 393 (now all `@deprecated`-marked — see below) | 0 internal imports; not reachable from a public barrel; but has SOME live signal (a non-historical doc reference, a real test import, or a literal test string reference) suggesting a real or plausible external consumer still exists. |
| **HISTORICAL** | 414 | 414 | 0 internal imports, 0 test imports/references, 0 barrel reachability; every doc reference is to a POINT-IN-TIME record (the migration mapping table, a numbered "Alpha NNN" completion-declaration/execution-spec/reconciliation-report doc, `ALPHA_HISTORY.md`, or the original-prototype historical reference) — never a live guidance doc. |
| **INTERNAL UNUSED** | 2 | 0 (removed) | 0 signal of ANY kind — 0 internal imports, 0 test imports, 0 literal test references, 0 doc references, not barrel-reachable. Genuinely, provably dead. |
| **TEST-ONLY** | 2 | 0 (removed, after a trivial test-import migration — see below) | 0 internal imports, 0 doc references, not barrel-reachable; the ONLY reference anywhere is a test import. |
| **DEPRECATED PUBLIC** | 0 | 393 (all of PUBLIC COMPATIBILITY, marked this pass) | Already carried a `@deprecated` tag before this pass. **0 shims had one.** After this pass, the entire former PUBLIC COMPATIBILITY bucket does. |
| **UNKNOWN** | 0 | 0 | Target file missing, or genuinely ambiguous signal. None found — every one of the 811 shims' targets resolved to a real file. |

(393 + 414 + 2 + 2 = 811 before; 393 + 414 = 807 after.)

No `os/commerce` shim exists at all (0 of 811 resolve under
`os/commerce/**`) — `os/commerce`'s current location was never migrated
from an old top-level path, so it has no compatibility-shim surface to
classify.

## Removal criteria (applied strictly)

A shim was removed ONLY if it met **every** one of:

1. 0 internal imports (verified fresh via a global import graph, not
   assumed from the prior arc's claim).
2. 0 test imports (or safely migrated — see below).
3. 0 runtime string/path references anywhere (docs, config, packaging
   scripts, dynamic `import()`, `?raw` imports) — checked as a literal
   substring search across `docs/**/*.md` and every test file's raw
   source, not just resolved imports.
4. NOT re-exported from any of the 3 public barrels (transitively).
5. 0 doc references in `docs/` (including historical/point-in-time docs —
   the HISTORICAL bucket, despite the name, still FAILS this criterion
   and was NOT removed; only 4 shims had truly zero doc references of any
   kind).

**Exactly 4 of 811 shims met all 5 criteria** — confirming the arc brief's
own expectation ("the number of provably-dead facades" would be "small;
that's fine and expected, not a shortfall").

## What was removed (4 shims)

| Old path | New (canonical) path | Why removable |
|---|---|---|
| `src/identity/provider_bridge.ts` | `src/os/core/identity/provider_bridge.ts` | 0 internal imports, 0 test imports, 0 literal test references, 0 doc references, not barrel-reachable. |
| `src/identity/vault_bridge.ts` | `src/os/core/identity/vault_bridge.ts` | Same — 0 across every signal. |
| `src/vault/memory_vault.ts` | `src/os/core/vault/memory_vault.ts` | 0 internal imports, 0 doc references, not barrel-reachable; ONE test import (`test/reviews/private_message_envelope_v1/crypto_boundary_invariants.test.ts`, a dynamic `import()` testing `InMemoryVaultBoundary`'s behavior, not its path). Migrated to the canonical path first (a 1-line mechanical change — the test only asserts behavior, never asserts anything about the OLD path itself), THEN removed. |
| `src/vault/noop_vault.ts` | `src/os/core/vault/noop_vault.ts` | Same as above — same test file, same treatment, `NoopVaultBoundary`. |

Both test-import migrations were verified safe before removal: the same
test file's test #14/#15 (secret-literal scans over `src/vault/` by
`readdirSync`) assert only `offending === []`, with no fixed file-count
expectation, so removing 2 of the (now 1 remaining, `types.ts`) files
under `src/vault/` does not change their pass/fail outcome. Confirmed
by running the full test file after the edit — 15/15 pass.

No shim was removed on the strength of a "trivially migrate the doc/config
reference too" argument — every removed shim already had 0 doc
references before any migration.

## What was deprecation-marked (393 shims)

Per this arc's own instruction, every shim classified **PUBLIC
COMPATIBILITY** (this arc's synonym for "this is what the prior arc meant
by 'purely for any external/unknown consumer'") got a low-noise
`@deprecated` marker. **HISTORICAL**, **TEST-ONLY**, and **INTERNAL
UNUSED** shims were deliberately NOT marked (no external-consumer-facing
deprecation notice makes sense for a shim nothing live actually points
at, and the latter two categories were removed anyway).

The marker pattern (2-3 lines, consistent everywhere):

```ts
/** @deprecated Compatibility shim -- import from "../../os/messenger/board/activitypub/fedos_activitypub_board_adapter.js" instead. See docs/architecture/COMPATIBILITY-FACADE-LIFECYCLE.md. */
export * from "../../os/messenger/board/activitypub/fedos_activitypub_board_adapter.js";
```

For the ~75 shims that already carried a NON-`@deprecated` explanatory
header comment (e.g. the Stage-6 "Shim — physically moved to..." comment
block, or the Core Secrets Ownership move's "Architecture Dependency
Closure Arc — moved to..." line-comment header), the existing comment was
preserved VERBATIM and exactly one `@deprecated ...` line was inserted
into it (as the first line of a `/** */` block, or appended to a `//`
line-comment block) — never a wholesale rewrite, so no prior context was
lost.

**317** shims had no pre-existing header (bare `export * from` only) and
got the full 2-line pattern above. **75** had an existing header and got
the 1-line insertion. **1** (`src/identity/fedos_noop_identity_provider.ts`)
was classified HISTORICAL at the start of this pass but was reclassified
to PUBLIC COMPATIBILITY mid-pass once this arc's own new representative
contract test (below) began importing it — it received the same marker
for consistency, bringing the total to **393**.

## Deprecation policy going forward

- Any NEW compatibility shim created by a future migration should be
  classified using this document's own 6-bucket scheme before deciding
  whether to mark it.
- A shim only needs the `@deprecated` marker if it is PUBLIC COMPATIBILITY
  (plausible external consumer) or already DEPRECATED PUBLIC (improve the
  marker if it's missing the replacement path — none needed that this
  pass, since 0 had a marker at all before this pass).
- Do not mark HISTORICAL/TEST-ONLY/INTERNAL-UNUSED shims — they are either
  already scheduled for removal or carry no external-consumer signal
  worth surfacing.
- Removal criteria (this document's own 5-point list) are permanent policy,
  not a one-time gate — re-apply them before removing ANY compatibility
  shim in any future pass, and re-run
  `test/architecture_compatibility_shim_audit.test.ts` (below) as the
  first check after any shim addition/removal.

## Shim-generated validation (`test/architecture_compatibility_shim_audit.test.ts`)

One test file, walking every shim discovered LIVE from disk on each run
(not a hard-coded 811/807 list, so it stays correct as shims are
added/removed/migrated by this or any future — including concurrently
running — arc). Asserts, for every discovered shim:

1. Its re-export target file exists on disk.
2. It is genuinely a thin facade — its only non-comment content is the
   single `export * from "...";` statement.
3. It participates in no circular RUNTIME dependency (reuses the real
   Tarjan-SCC graph from `scripts/architecture_cycle_detector.mjs`, not a
   second hand-rolled cycle check).
4. Its re-export target is actually importable at runtime (a real dynamic
   `import()`, not just a string that happens to parse). ONE documented
   exception: `src/os/messenger/desktop/runtime/run_fedos_desktop_runtime.ts`
   (the real CLI entrypoint one shim targets) has an intentional top-level
   side effect (`main().catch(...)`, which can call `process.exit(1)`) —
   actually importing it in a test would run a real CLI. Verified
   statically instead (target-file existence, already covered by check
   #1) rather than executed.

## Representative compatibility contract tests

`test/architecture_compatibility_shim_representative_contracts.test.ts` —
9 tests across `os/core` (3), `os/messenger` (4), and `os/commerce` (2,
via the barrel rather than an old-path comparison, since `os/commerce` has
no old-path shim — see above). Each proves the OLD path's OBSERVABLE
identity/behavior matches the NEW path exactly (`===` class/function
identity, plus a behavioral assertion for the stateful ones), not just
"the file exists":

- `[core]` `NoopCryptoProvider`, `FedosIdentityRegistry`,
  `NoopFedosIdentityProvider`.
- `[messenger]` `validateActivityPubBoardPost` +
  `mapValidatedActivityPubPostToBoardPostInput` (board),
  `FEDOS_DELETION_TARGETS` + `isFedosDeletionTarget` (conversations),
  `WebSocketRelay` (desktop), `isFedosDeviceTrustTransitionAllowed` +
  `FEDOS_DEVICE_TRUST_STATES` (device).
- `[commerce]` `NoopPaymentProvider`, `InMemoryProductDirectory` (barrel
  vs. direct-path identity, since no old path exists to compare against).

## Public API barrel changes made this pass

`src/os/core/index.ts` and `src/os/messenger/index.ts` were reviewed but
NOT changed by this pass — both were found, on fresh re-read, to have
ALREADY been widened correctly by concurrent work in this same arc (Agent
P's `TransportPort` addition: the core barrel exports only the new Port's
TYPES, the messenger barrel exports the new `NostrTransportAdapter`
adapter + `NoopTransportPort` default, matching this repo's own
"Ports/factories/adapters only, never internals" barrel discipline
already established). No over-exported repository/low-level-helper/
private-adapter symbol was found in either.

`src/os/commerce/index.ts` — **one addition**: `PaymentEvidence` (from
`./payment/types.js`) was missing from the barrel's type export list even
though `PaymentProvider.observePayment()`/`ingestCallback()` (added this
arc by concurrent Agent P work, BTCPay-readiness) both return/consume it
— a consumer importing `PaymentProvider` from the barrel had no way to
name the type either method requires. Added alongside `PaymentProvider`
itself.

## Validation

- `npm run typecheck:core`: 4 pre-existing baseline errors, confirmed
  unchanged before and after every change in this pass (checked
  repeatedly through the pass, not just at the end). One transient
  reading of 16 errors was observed mid-pass, root-caused to concurrent
  Agent P work on `PaymentProvider` (test consumers not yet updated for
  the widened interface) that resolved itself once that agent's own pass
  landed its consumer-side fixes — not caused by, or related to, this
  arc's own changes.
- `npm run typecheck:electron`: 0 errors throughout.
- All 9 pre-existing architecture/boundary test files: 73-87 tests pass
  (count varies slightly run-to-run as concurrent agents land their own
  new tests in the same suite; 0 failures attributable to this pass in
  any run).
- `test/architecture_compatibility_shim_audit.test.ts`: 5/5 pass.
- `test/architecture_compatibility_shim_representative_contracts.test.ts`:
  9/9 pass.
- `test/vault_boundary.test.ts` (14 tests),
  `test/identity_provider_boundary.test.ts` (21 tests),
  `test/reviews/private_message_envelope_v1/crypto_boundary_invariants.test.ts`
  (15 tests, including the 2 migrated imports): all pass.
- Broad sweep: all 114 `test/*identity*|*vault*|*crypto*` files run
  together (3021 tests). 155 failures found, ALL confirmed pre-existing
  and topically unrelated to this pass — frozen point-in-time
  file-count/text assertions (e.g. "still exactly 57 files",
  Rust `pub fn` counts) that drift as the repo grows over many
  intervening arcs, not from anything this pass touched. Zero "Cannot
  find module" errors anywhere in the sweep; zero failures reference any
  of the 4 removed files.

## Concurrent work observed (flagged for the Coordinator)

This arc ran in the same working tree as at least two other concurrent
agents:

- **Agent D** (StorageBackend/`src/sync`, per the Coordinator's own
  briefing): partway through this pass, 14 files under `src/sync/`
  (previously real implementation files, per `git log`) turned into
  `export * from "../os/messenger/sync/....js"` shims, with a new,
  untracked `src/os/messenger/sync/` directory appearing as their
  target — i.e., Agent D appears to be executing exactly the
  `src/sync/`-classification-gap fix the prior arc's own
  `ARCHITECTURE-DEPENDENCY-CLOSURE-FINAL-VALIDATION.md` flagged as
  unresolved ("`src/sync/` (14 files) — still unclassified... Not
  touched"). **These 14 shims are DELIBERATELY EXCLUDED from this arc's
  811/807-shim inventory and were not touched, classified, or
  deprecation-marked** — they were not part of the 811-shim baseline this
  arc was scoped to, and Agent D's own migration may still be in
  progress. `docs/architecture/compatibility-facade-inventory.generated.json`
  documents this exclusion in its own `meta.note` field.
- **Agent P** (TransportPort/package extraction, per the Coordinator's own
  briefing): landed a real `TransportPort`
  (`src/os/core/ports/transport_port.ts`, `NoopTransportPort`,
  `src/os/messenger/adapters/nostr_transport_adapter.ts`) and a
  BTCPay-readiness widening of `PaymentProvider`
  (`observePayment`/`ingestCallback`/`cancelPayment`/`refundPayment`/
  `PaymentEvidence`) during this pass, including correctly updating both
  the `os/core` and `os/messenger` barrels themselves. This directly
  resolves two of the "known limitations" the prior arc's own
  `FACTORY-PORT-COMPLETION-PLAN.md` had left open (`TransportPort` did not
  exist; `PaymentProvider` was not BTCPay-ready). This arc's own barrel
  review found and fixed one small gap in that otherwise-clean work (the
  missing `PaymentEvidence` barrel export, above) but did not otherwise
  touch Agent P's files.
- No concurrent Agent N (Nostr relay/socket) activity was observed in this
  session.

No overlap resulted in a conflicting edit — this arc's own file changes
(4 shim removals, 393 deprecation markers, 1 barrel addition, 2 new test
files, this document, the generated inventory JSON) touched no file any
concurrent agent's `git status` showed as modified at the time of edit.
