# Capability / Adapter Modularization & OSS Developer Experience — Final Validation

STARTING HEAD (this arc): `cfd74860` (prior arc's EvidenceHead — the OS
Capability Modularization arc that extracted `os/core` and `os/commerce`,
scaffolded `os/messenger`).
MESSENGER PHYSICAL MIGRATION COMPLETE: `4132a500`.

Pure software architecture arc. No legal/AML/law-enforcement/anonymous-
market/regulatory evaluation, optimization, or attestation was performed
anywhere in this arc.

## What this arc did, in one paragraph

Phase 1 dispatched 4 parallel, read-only agents (repo-wide dependency
graph, Messenger cohesion, Commerce cohesion, adapter/public-API/OSS-DX)
to discover the real architecture rather than accept the prior arc's
directory boundaries at face value. That inventory surfaced findings
materially bigger than the prior arc's picture: circular dependencies were
not zero (one 8-module-group strongly-connected component), `os/core/vault`
and `os/core/storage` were dead placeholders with zero production
consumers, three independent Nostr implementations existed (not one), and
the Port contracts built by the prior arc were unwired and thinner than
the real coordinators they wrapped. After confirming scope with the user
at each major fork, this arc then executed the full 764-file, 6-stage
Messenger physical migration the prior arc had deferred — completing it
end to end with compatibility shims, boundary tests, full regression, and
real packaging verification — while documenting the deeper architecture
debt (circular dependencies, Nostr consolidation, core secrets ownership,
factory/Port completion) as four follow-up-arc-ready plans rather than
attempting to fix all of it in one pass.

## Previous structure (before this arc)

`src/conversation/`, `src/board/`, `src/desktop/`, `src/device/`,
`src/nostr/` (764 files) — the live, shipped messenger — still sat flat at
the repo root, unmoved by the prior arc's own explicit, user-confirmed
deferral. `src/os/messenger/` held only boundary scaffolding: 8 README-only
directories and 3 real files (the Port adapters).

## Discovered boundaries (Phase 1 findings, all evidence-cited in the
four agents' own reports, summarized in the docs below)

- **Circular dependencies were not zero.** One SCC spanning 8 module-groups
  at the pre-migration grain: `{desktop, conversation, board, device,
  nostr, runtime, os_legacy, os_commerce}`, 11 bidirectional group-edges,
  including a verified real 2-file cycle. See
  `docs/architecture/CIRCULAR-DEPENDENCY-BREAK-PLAN.md`.
- **`os/core/storage` and `os/core/vault` were dead code.** Zero live
  consumers; the real secrets owner (`src/runtime/master_seed/`) was left
  outside `os/core` by the prior arc. See
  `docs/architecture/CORE-SECRETS-OWNERSHIP-PLAN.md`.
- **Three independent Nostr implementations, not one.** `src/nostr/`,
  `src/desktop/`'s ~24 top-level relay/wire files (deliberately
  independent, per its own header comment), and
  `conversation/delivery/nostr/`+`transport/`. See
  `docs/architecture/NOSTR-CONSOLIDATION-PLAN.md`.
- **The Port contracts (`MessagingPort`/`ConversationPort`/`NotificationPort`)
  were unwired in production and thinner than the real coordinators** —
  no reply threading, no membership mutation, ~9 real outcome codes
  collapsed to one string, `onMessage` unfireable dead code. See
  `docs/architecture/FACTORY-PORT-COMPLETION-PLAN.md`.
- **Commerce cohesion**: `catalog`↔`payment` is the only real internal
  coupling; `marketplace` and `catalog` are two unreconciled candidate
  models from different prototype stages, not a deliberate two-layer
  design as previously documented; `PaymentProvider` is good for
  onboarding but not BTCPay-ready (missing invoice id, status polling,
  webhooks, idempotency, refund/expiry states).
- **`src/sync/` (14 files) was unclassified in every architecture doc.**
  Still unclassified after this arc — flagged, not resolved (out of scope
  for the migration itself).

## Migration executed

All 764 files, 6 stages, exactly per the frozen
`docs/architecture/MESSENGER-MIGRATION-MAPPING.md` and
`docs/architecture/MESSENGER-MIGRATION-STAGING.md` (both written by the
prior arc, both honored as-is — no mid-migration deviation into the
Nostr-reclassification or board/device-mis-homing refinements the Phase 1
agents surfaced, per explicit instruction to keep those as documented
follow-up debt, not scope creep into the migration itself):

| Stage | Bucket | Files | Commit |
|---|---|---:|---|
| 1 | `conversations/` | 377 | `6dc5109a` |
| 2 | `board/` | 85 | `a5acca21` |
| 3 | `device/` | 88 | `8b3f893e` |
| 4 | `adapters/nostr/` | 57 | `5947efbd` |
| 5 | `notifications/` | 3 | `c50adb4e` |
| 6 | `desktop/` | 154 | `4132a500` |
| **Total** | | **764** | |

**One file deliberately excluded**: `src/desktop/beta/fedos_desktop_beta_capability_manifest.ts`
carries an unrelated, uncommitted, in-progress edit from a different arc
on this same branch (a Closed Pilot capability-status honesty revision),
discovered mid-Stage-6 when the migration script moved it and would have
silently folded that unreviewed work into this arc's commit. Restored to
its exact original path/content; its one consumer and the Electron main's
dynamic import both point back at the untouched original location, with
an explicit reconciliation note for whenever that other work lands. This
is the kind of "unrelated dirty worktree" isolation this arc's own STOP
CONDITIONS named — handled by isolating the one file, not by stopping the
whole migration.

## Adapter rules (unchanged, re-verified)

Boundary tests enforced throughout every stage:
`test/architecture_boundary_core.test.ts` (core → messenger/commerce
forbidden), `test/architecture_boundary_commerce.test.ts` (commerce →
messenger implementation forbidden, Telegram/BTCPay SDK confined to
reserved dirs), `test/architecture_boundary_messenger.test.ts` (messenger
→ commerce forbidden, both old and new locations), and
`test/architecture_boundary_adapter_port_shapes.test.ts` (the 3 Port
adapters genuinely satisfy their Port interfaces). All four passed at
every stage checkpoint and pass now, 17/17, zero violations.

## Compatibility

- **764 old-path shim files** left behind (one per moved file, `export *
  from "..."` pattern), following the exact pattern validated by the
  prior arc's `os/core` extraction. No default exports existed anywhere
  in the 764-file scope, so no default-forwarding shims were needed.
- Every stage's cross-references into already-moved buckets were pointed
  directly at their new locations (skipping unnecessary shim hops) where
  the migration script could resolve the mapping; references into
  not-yet-moved buckets used the standard relative-path recomputation to
  their still-current locations.
- **30 tsconfig literal-path pins** updated across all 5 root build
  configs (`beta-runtime`, `runtime`, `unlock-runtime`, `host-bridge`,
  `settings-host-bridge`), each verified present-before/absent-after.
- **A genuine, previously-undiscovered packaging bug found and fixed**:
  7 Electron main-process source files and one release-staging script
  hardcoded `distUrl("desktop", ...)` path segments used for REAL dynamic
  `import()` at app-launch time — not just a test assertion. This would
  have broken actual app startup once `desktop/` moved, caught only
  because Stage 6's agent traced a real subprocess-launch test failure to
  its root cause rather than treating it as expected churn.
- **~34 hardcoded `dist/**` path assertions** across electron-spike's own
  acceptance test suite fixed across Stages 3, 5, and 6 (repeating class,
  each stage found and fixed its own subset).

## Tests

**Boundary tests**: 17/17 pass (4 files) at final state.

**Full root suite** (`npm test`, ~1178 files): every stage ran its own
rigorous A/B comparison against a pristine baseline worktree at the same
Unicode+space OneDrive path (this repo's own environment, reproducing a
real, migration-unrelated limitation: vite-node's dynamic WASM `import()`
fails specifically at that path). Across all 6 stages combined, the
consistent finding was **zero genuine functional regressions** — every
difference between baseline and post-move runs was individually
root-caused and classified into one of five established, cross-checked
non-regression categories:
1. Raw-source-reading tests (`?raw` imports and literal `readFileSync`
   directory-constant reads) — fixed mechanically wherever found (the
   `?raw` class alone: hundreds of specifiers across ~200+ test files
   repointed over the 6 stages).
2. `ARC_BASE`/historical `git diff --name-only <sha>` structural guards —
   inherently incompatible with any physical file move; not fixable by
   repointing (the moved path has no history at the historical commit).
3. Exact-import-path-length regex assertions — text necessarily changes
   when a file's depth from repo root changes; behavior is identical.
4. "Clean working tree" git-status guards — expected to fail while any
   stage's diff is uncommitted; self-resolve after each stage's commit.
5. The Unicode-OneDrive-path WASM dynamic-import limitation and a
   CRLF/autocrlf checkout mismatch in an untouched Rust file — both
   confirmed to reproduce on a pristine baseline unrelated to any move.

**Electron-spike suite** (`vitest.electron-spike.config.ts`, real Electron
processes): Stage 6's final run reduced genuine failures to 0 after fixes
and isolated reruns; the flagship end-to-end test
(`secure_runtime_alpha_8041_8120_real_user_facing_vertical_slice.test.ts`
— real onboarding, real encrypted message exchange, relay reconnect,
driven only through visible DOM controls) passes. Remaining flakiness
under full parallel execution is real-Electron-process resource
contention, proven via clean isolated reruns, not a regression — the same
class this repo's own prior sessions have already documented.

## Typecheck

`npm run typecheck:core` and `npm run typecheck:electron`: identical 4
pre-existing baseline errors in `typecheck:core` (all in test files
unrelated to any of this arc's changes) and 0 errors in
`typecheck:electron`, confirmed unchanged at every one of the 6 stage
checkpoints plus this final consolidated check. **Zero new errors at any
point in this arc.**

## Package

`npm run package:electron-beta` (the real electron-builder Beta packaging
pipeline) succeeded during Stage 6, producing a real NSIS installer and
zip. Verified `dist-package-beta/win-unpacked/dist/os/messenger/desktop/`
contains 141 real compiled `.js` files (not shim stubs) — the physically
migrated code reaches the packaged artifact, not just the shim layer.

## Compatibility facades

**764** (one per moved file across all 6 stages), plus the **43** carried
forward unchanged from the prior arc's `os/core` extraction. **807 total**
compatibility re-export shims exist in this repo as of this arc's
completion — all one-line `export * from "..."` files, all still
resolvable, none scheduled for removal (per the kickoff brief's own
section 15/31: deprecated-path removal is never required).

## Known limitations / deferred work

This arc deliberately did NOT:

1. **Break any circular dependency** — the migration itself structurally
   collapsed 5 of 8 pre-migration SCC module-groups into one capability
   (`os/messenger`), which is real progress, but 3 real cross-capability
   edges remain (`os/messenger ⇄ runtime`, `os/messenger ⇄
   os/_legacy_prototype`, `os/_legacy_prototype ⇄ os/commerce`), plus
   file-level cycles now living inside `os/messenger` itself. Full detail,
   exact edges, and a minimal safe break sequence:
   `docs/architecture/CIRCULAR-DEPENDENCY-BREAK-PLAN.md`.
2. **Consolidate the three Nostr implementations** — documented in full
   (responsibilities, duplication, backward dependencies, canonical
   target, migration order) but not executed:
   `docs/architecture/NOSTR-CONSOLIDATION-PLAN.md`.
3. **Move `runtime/master_seed/` into `os/core`** or otherwise reconcile
   `os/core/storage`/`vault`'s dead-placeholder status — documented,
   including the real blocking reverse-dependency into
   `conversations/ratchet/` that must be resolved first:
   `docs/architecture/CORE-SECRETS-OWNERSHIP-PLAN.md`.
4. **Widen the Port contracts or implement `createCommerce()`/
   `createMessenger()`** — every concrete gap measured against the real
   coordinators, a recommended public API shape given, standalone
   composition tests specified, but zero Port files changed and zero
   factory functions written: `docs/architecture/FACTORY-PORT-COMPLETION-PLAN.md`.
5. **Fix the 2 additional `NostrEvent` domain-leakage instances** found in
   `conversations/invitation_bootstrap/` and `conversations/ratchet/peer_capability/`
   (same class already fixed once in `os/commerce` by the prior arc) —
   flagged in `NOSTR-CONSOLIDATION-PLAN.md`, folded into that plan's step
   1-2 rather than fixed standalone, since the real fix depends on the
   Nostr type-unification decision that plan defers.
6. **Reclassify `src/sync/`** (14 files, unclassified in every
   architecture doc including this arc's own) — noted, not resolved.
7. **Write `CAPABILITY-CATALOG.md`, `ADAPTER-CATALOG.md`,
   `ADDING-A-CAPABILITY.md`, `ADDING-AN-ADAPTER.md`** — these were part of
   this arc's original scope (kickoff brief sections 35-37) but were
   deprioritized after the user's explicit mid-arc reprioritization toward
   completing the Messenger physical migration and the 4 debt-plan docs
   first. Genuinely not done — a real, acknowledged gap, not silently
   dropped.

## Final report

STARTING HEAD (this arc): `cfd74860`
CAPABILITY MODULARIZATION CANDIDATEHEAD (Messenger migration complete): `4132a500`
CAPABILITY MODULARIZATION EVIDENCEHEAD: (this document's own commit)

TARGET TREE:
```
src/os/
  core/         identity, crypto, settings, ports/ (vault/storage
                are unwired placeholders, corrected in docs this arc)
  messenger/    conversations, board, device, adapters/nostr,
                notifications, desktop -- ALL PHYSICALLY POPULATED
                (764 files, this arc)
  commerce/     catalog, payment, marketplace, creator (inert,
                unchanged this arc)
  _legacy_prototype/  unchanged this arc
src/{conversation,board,desktop,device,nostr}/  now 764 one-line shims
src/desktop/beta/fedos_desktop_beta_capability_manifest.ts  real content,
  deliberately excluded from the migration (unrelated in-progress work)
```

CAPABILITIES: 4 top-level (`core`, `messenger`, `commerce`,
`_legacy_prototype`) + reserved seams (`contacts/`, `onion/`,
`support/adapters/telegram/`, `payment/adapters/btcpay/`)

ADAPTERS: Nostr (3 unconsolidated implementations — see
`NOSTR-CONSOLIDATION-PLAN.md`), Electron (1, unchanged), Telegram/BTCPay/
Tor/Local-AI (0 real, reserved seams only)

CORE: PASS
MESSENGER: PASS (now physically real, not scaffolding)
COMMERCE: PASS (unchanged this arc)
MESSENGER STANDALONE (compiles/tests without commerce): PASS
COMMERCE STANDALONE (compiles/tests without messenger): PASS

CROSS-CAPABILITY IMPORTS: before this arc's migration, 58 files (measured
Phase 1); the migration itself restructures WHICH boundaries these cross
(5 former top-level dirs merged into `os/messenger`) rather than reducing
raw count — messenger↔commerce remains the one boundary at 0, unchanged
and re-verified at every stage.

CIRCULAR DEPENDENCIES: before, 1 SCC / 8 module-groups (Phase 1 measurement);
after, 1 SCC collapses to effectively 4 module-groups at the capability
grain (`os/messenger` [merged], `runtime`, `os/_legacy_prototype`,
`os/commerce`), 3 remaining bidirectional edges — see
`CIRCULAR-DEPENDENCY-BREAK-PLAN.md` for the exact post-migration
re-measurement. Not zero; not attempted to be zero this arc, per
explicit scope decision.

BOUNDARY TESTS: 17/17 pass (4 files)

PUBLIC ENTRYPOINTS: 0 new barrels added this arc (deferred, per
`FACTORY-PORT-COMPLETION-PLAN.md`'s own priority ordering — barrels come
after Ports/factories, not before)

COMPATIBILITY FACADES: 807 total (764 new this arc + 43 from the prior arc)

MESSENGER TESTS: 3/3 boundary-test pass; full-suite results embedded in
"Tests" section above (zero genuine regressions across ~1178 files and
the electron-spike suite)

COMMERCE TESTS: unchanged this arc — 15/15 pass (boundary + commerce_bridge
+ commerce_classify, per the prior arc's own final validation, re-verified
clean by this arc's final consolidated check)

FULL REGRESSION: zero genuine functional regressions found across 6 stages
of rigorous A/B testing; every difference traced to 5 established
non-regression classes (see "Tests" section)

TYPECHECK NEW ERRORS: 0 (both configs, every stage, this final check)

PACKAGE: PASS (real electron-builder installer, real compiled `os/messenger`
content verified present)

PACKAGED LAUNCH: PASS (flagship real-Electron-process vertical-slice test
passes; no separate manual GUI launch performed)

UNEXPECTED EXTERNAL CONTACT: 0

TELEGRAM STATUS: unchanged (does not exist; reserved seam only)
BTCPAY STATUS: unchanged (does not exist; reserved seam only)
LOCAL MODEL STATUS: unchanged (does not exist in this repository; reserved
contract only)

WORKTREE: staged and committed cleanly at every stage checkpoint; the
same 4 pre-existing modified files and set of pre-existing untracked
directories (unrelated, already-in-progress work on this branch, present
before this arc started) were deliberately excluded from every commit and
remain exactly as they were, with one addition this arc: the mid-migration
discovery and isolation of `src/desktop/beta/fedos_desktop_beta_capability_manifest.ts`'s
own unrelated in-progress edit, handled the same way.

## Final assessment

**1. Is the repository easier for a new OSS contributor to understand?**
**PARTIAL.** The Messenger physical migration means `src/os/messenger/**`
now genuinely contains what it claims to — a real, browsable capability
tree, not a scaffold pointing at code scattered across the repo root. But
`CAPABILITY-CATALOG.md`/`ADAPTER-CATALOG.md`/contributor onboarding guides
were not written this arc (known limitation #7 above), and three Nostr
implementations coexisting unconsolidated is itself a real source of
contributor confusion this arc documented but did not resolve.

**2. Can Messenger be developed without understanding Commerce?**
**YES.** Verified at every migration stage: zero messenger→commerce
imports, boundary-test-enforced, unchanged before and after.

**3. Can Commerce be developed without understanding Messenger internals?**
**YES**, with one caveat carried forward unchanged from the prior arc: the
one documented, boundary-test-enforced Nostr-adapter exception in
`catalog/adapters/nostr/`.

**4. Can a new adapter be added by implementing a documented port?**
**PARTIAL.** `PaymentProvider` has a real, documented example (Noop +
Placeholder + a boundary test) a contributor could copy today. The 3 core
Ports (`Messaging`/`Conversation`/`Notification`) exist and have a shape
test, but are measurably thinner than what a real second implementation
would need (see `FACTORY-PORT-COMPLETION-PLAN.md`) — a contributor
building a genuinely novel adapter against them would hit real gaps
(no reply threading, no membership mutation, no read/list on messages).

**5. Could these capabilities later become separate packages without
major redesign?** **NO, not yet** — unchanged from the prior arc's own
finding: no npm workspaces configured at all, 6 hand-maintained tsconfig
include-lists with literal file paths (now touching even more files after
this arc's migration), zero TypeScript project references, and
electron-builder's literal relative paths. This arc's migration made the
SOURCE-level boundaries real (a prerequisite `FACTORY-PORT-COMPLETION-PLAN.md`
correctly orders before any package split), but the packaging
infrastructure blockers are unchanged and unaddressed.
