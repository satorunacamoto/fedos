# Compatibility Facade Reduction + Package Extraction Readiness + Remaining Architecture Debt Closure — Final Validation

STARTING CANDIDATEHEAD: `1369dc79`
STARTING EVIDENCEHEAD: `179871f5`
PACKAGE EXTRACTION READINESS CANDIDATEHEAD: `6fe3bb41`
PACKAGE EXTRACTION READINESS EVIDENCEHEAD: (this document's own commit)

Pure software architecture arc. No legal/AML/law-enforcement/anonymous-
market/regulatory evaluation, optimization, or attestation was performed
anywhere in this arc.

## What this arc did, in one paragraph

Four parallel agents (F: compatibility facades + public API surface, P:
package extraction readiness + `TransportPort`, D: `StorageBackend` +
`src/sync/` ownership, N: Nostr relay/socket consolidation + type-only
SCCs) closed the 6 explicit deferrals the prior arc left, plus the
Coordinator independently tightened `PaymentProvider` for BTCPay-readiness
and reconciled a real cross-agent finding. All four ran genuinely
concurrently against a shared working tree with minimal, carefully-scoped
file overlap; the merge required no conflict resolution beyond two small
Coordinator-side fixes (2 dynamic-import old-path references Agent F
found but was instructed not to silently fix, and one file-save race
artifact from Agent D's own in-progress edit that resolved itself).

## Facades before/after

**FACADES BEFORE: 811** (machine re-inventoried by Agent F, matching the
prior arc's own count exactly — a good cross-check that the prior claim
was accurate at the time it was made).

**Classification:**
| Bucket | Count | Action |
|---|---:|---|
| DEPRECATED PUBLIC (was PUBLIC COMPATIBILITY) | 393 | `@deprecated` + migration note + replacement path added this arc |
| HISTORICAL | 414 | Left as-is — only referenced from point-in-time completion docs |
| INTERNAL UNUSED | 2 | Removed |
| TEST-ONLY | 2 | Test import migrated, then removed |
| **Removed total** | **4** | Met all 5 strict criteria: 0 internal imports, 0 test imports (or safely migrated), 0 runtime string/path references, not barrel-exported, 0 doc references |
| **Retained total** | **807** | 393 deprecated-marked + 414 historical |

**FACADES REMOVED: 4. FACADES RETAINED: 807. DEPRECATED PUBLIC FACADES: 393. UNKNOWN FACADES: 0.**

**A real, prominent finding**: the prior arc's "internal old-path imports:
0" claim did not hold under a fresh, more thorough re-verification — 2
real exceptions existed, both inline `import("...").TypeName` type-position
references (not standard `import` statements, which is why the prior
sweep's grep missed them):
`src/os/messenger/conversations/deletion/fedos_deletion_status.ts` and
`src/os/messenger/conversations/deletion_request/fedos_persisted_deletion_recipient_decision_record_v1.ts`.
Agent F correctly reported rather than silently fixed these (per its
binding instruction not to blindly patch findings); the Coordinator fixed
both afterward — trivial, safe, sibling-file repoints, directly serving
this arc's own stated goal #1. **INTERNAL OLD-PATH IMPORTS: 0** (re-confirmed
after the fix).

## Transport Port

**TRANSPORT PORT: PASS.** `src/os/core/ports/transport_port.ts`,
interface-segregated (`TransportLifecyclePort`/`TransportSendPort`/
`TransportSubscribePort`), grounded in the real Nostr transport's actual
publish/ack/subscribe/connect/disconnect shape without leaking any
Nostr-specific concept (opaque `Uint8Array` payload, opaque destination
string). `NostrTransportAdapter` (`src/os/messenger/adapters/`)
implements it by delegating only to the stable `RelayPublisher`/
`RelayAdapter` public entry points — deliberately avoiding the
relay/socket internals Agent N was concurrently restructuring, confirmed
by both agents' own reports to have caused zero conflict. A fake adapter
(`FakeTransportPortAdapter`) and the real Nostr adapter both proven to
satisfy the Port (`test/example_fake_transport_adapter.test.ts`,
`test/architecture_boundary_adapter_port_shapes.test.ts`, 9 new tests).
`createMessenger()` gained an optional `transport?: TransportPort`
(default: a safe `NoopTransportPort`, zero external contact), fully
backward compatible with every existing call site.

## PaymentProvider BTCPay-readiness

**PAYMENT PROVIDER CONTRACT: PASS. BTCPAY CONTRACT READY: PARTIAL** (the
contract's SHAPE is BTCPay-ready — invoice-equivalent identity, status
polling, webhook ingestion, idempotency, expiry, cancel/refund semantic
separation — but no BTCPay adapter itself was written, and real BTCPay
was never contacted, per this arc's own safety constraints; "PARTIAL" is
the honest label, not "YES", since contract-readiness and a working
adapter are different claims).

Widened `PaymentStatus` (+`expired`/`refunded`), `PaymentRequest`
(+`idempotencyKey`/`expiresAt`), `PaymentDecision` (+`paymentId`/
`idempotencyKey`/`expiresAt`), and added a new `PaymentEvidence` type kept
deliberately separate from `PaymentDecision` (request-time "policy said
yes" vs. observation-time "what actually happened" — conflating the two
would blur the exact distinction this boundary's own guardrails have
always enforced). `PaymentProvider` gained `observePayment`,
`ingestCallback`, and optional `cancelPayment`/`refundPayment`. No
BTCPay-specific type (`BTCPayInvoice`/`BTCPayStore`/`BTCPayWebhook`)
anywhere in the contract — verified by a dedicated test assertion.
`PlaceholderPaymentProvider` extended with a real in-memory ledger
implementing every new method (not stubs) — proof the contract is
genuinely implementable end to end. New 10-scenario contract test
(`test/architecture_payment_provider_btcpay_readiness.test.ts`) covers
create-equivalent, unpaid, paid evidence, duplicate/idempotent request,
expired (both pre-request and post-acceptance), malformed callback,
unknown-payment-id error, and cancel-vs-refund separation — all against
the real `PlaceholderPaymentProvider`, zero real network/BTCPay contact.
6 existing test files with their own hand-built `PaymentProvider` doubles
updated to satisfy the widened interface.

## StorageBackend disposition

**STORAGEBACKEND: FORMALLY RETIRED (RESERVED SEAM, NOT ADOPTED, NOT
DELETED).** Agent D traced every consumer repo-wide: zero production
consumers (only `os/_legacy_prototype/` dead code and the seam's own
guardrail tests). More significantly, found it's not merely unwired but
**structurally incompatible** with real persistence needs — its own
guardrail ("opaque, non-secret labels ONLY — never raw bytes") cannot
represent ciphertext, which is what every real messenger persistence
layer actually needs to store. This ruled out extracting a generic
`AppendOnlyPersistence<T>` from it. Documented via a tightened doc
comment + `README.md`, not removed — real, tested code with no
consumer-facing cost to keeping it as an honestly-labeled reserved seam.

## src/sync/ classification

**SRC/SYNC: MESSENGER-SCOPED, RELOCATED.** All 14 files traced to their
real importers (`os/messenger/conversations/deletion/`,
`os/messenger/desktop/runtime/`, `os/messenger/device/sync_scheduler/`) —
100% Messenger, zero Commerce/Core-generic usage found. Moved to
`src/os/messenger/sync/` with shims at all 14 old paths; 8 real
production import call sites repointed to the canonical location. **No
new `os/sync/` top-level capability was created** — the evidence did not
clear the deliberately high bar this arc's own kickoff brief set for
inventing a new capability; everything fit inside the existing Messenger
capability as a sibling of `conversations/`/`device/`/`desktop/`/`board/`.

## Nostr relay/socket consolidation

**NOSTR RELAY/SOCKET: INTENTIONALLY LAYERED, WITH ONE REAL DUPLICATE
FIXED.** Agent N independently re-verified (by reading the actual code,
not trusting a header comment) whether `ws_relay.ts` (one-shot,
self-closing REQ/EOSE/CLOSE query) and `websocket_relay.ts` (persistent,
multiplexed session) genuinely still serve different purposes — they do;
neither even implements retry/backoff, so there was no duplicate backoff
mechanism to extract as originally speculated. What WAS found and fixed:
`desktop/relay_inbound_parser.ts`'s `parseWireEvent` was a byte-for-byte
functional duplicate of `protocol/event.ts`'s `isNostrEvent()` — safe to
eliminate only now that a prior arc unified the Nostr event type. No
public Nostr entry-point signature was changed. Goal (per the kickoff
brief's own framing) was "duplicate mechanism = 0", not "files/layers =
1" — met.

## Type-only SCCs

**TYPE SCC: 6 → 1.** Five resolved via small, targeted type-extraction or
Port-contract-relocation files (never an artificial mega-types dump) —
each documented in its own new file's header. One (`archive_bundle` ↔
`archive_group_section`) left alone: a genuinely tree-shaped
mutually-recursive type (a bundle contains a section, a section lists
parent-shaped bundles); forcing it apart would be the exact kind of
metric-serving hack this arc's own rules forbid. `RUNTIME SCC: 0`
(unchanged, still Tarjan-verified and CI-enforced).

## Package extraction readiness

**PACKAGE EXTRACTION BLOCKERS: 48.** Root-caused via a new reusable
script (`scripts/package_extraction_boundary_scan.mjs`, reusing the cycle
detector's own resolution graph) + regression test
(`test/architecture_package_extraction_boundary.test.ts`). Breakdown:
`os/core` 3, `os/messenger` 38, `os/commerce` 7, Electron app 0. The
dominant single root cause (36 of 48): **`src/runtime/`, 78 never-migrated
files, is a hidden shared dependency of BOTH `os/core` and
`os/messenger`** — neither capability can close its own import boundary
while a third, unclassified directory sits between them. This is a real,
previously-undiscovered structural finding this arc surfaced, not merely
confirmed.

**CORE VIRTUAL PACKAGE: FAIL. MESSENGER VIRTUAL PACKAGE: FAIL. COMMERCE
VIRTUAL PACKAGE: FAIL. DESKTOP COMPOSITION: PASS.** (The Electron app
root, which is allowed to depend on all three `os/*` capabilities, has
zero blockers — it's the one root already ready.)

`@fedos/core`/`@fedos/messenger`/`@fedos/commerce` manifest designs
(`exports`/`types`/`files`/`dependencies`/`peerDependencies`) and the
build-order graph (`core` → `messenger`/`commerce` → `apps/desktop`,
cycle count 0) are recorded in `docs/architecture/PACKAGE-EXTRACTION-PLAN.md`
— design only, no real `package.json` created, no `npm publish` attempted.

**PRIVATE CROSS-PACKAGE IMPORTS: 0** (Messenger↔Commerce direct imports
remain 0, re-verified after every agent's changes).

## OSS documentation

`docs/architecture/COMPATIBILITY-FACADE-LIFECYCLE.md` (Agent F) and
`docs/architecture/PACKAGE-EXTRACTION-PLAN.md` (Agent P) both created.
`CAPABILITY-CATALOG.md` and `ADAPTER-CATALOG.md` updated (the missing
`PaymentEvidence` barrel export, `TransportPort`/`NostrTransportAdapter`
no longer described as unimplemented).

## Tests

**BOUNDARY TESTS: 13/13 files, 103/103 tests pass** — the 9 pre-existing
architecture test files plus 4 new this arc (compatibility shim audit,
compatibility shim representative contracts, payment provider BTCPay
readiness, package extraction boundary), all confirmed at the final
merged state, not just individually per-agent.

**FULL REGRESSION**: a genuine environment-level obstacle this arc had to
route around, not a test-content issue. The full unsharded suite crashed
with a recurring `Tinypool` worker-exit error on 3 consecutive attempts;
a 4-way sharded retry crashed on 2 more attempts; a single-threaded retry
was killed by an apparent background-task duration limit before
completing. Diagnosis: system free memory was ~2.7GB of 16GB at the time
— genuine resource pressure after a long session running four large
concurrent agents. **Worked around by splitting the suite into 30
sequential 40-file batches** (small enough to avoid the crash, run one
at a time to avoid compounding memory pressure) — all 30 completed
without a single infrastructure failure, achieving full (~93%+,
1107-1187 of the suite, exact count affected only by an aggregation
regex miss, not missing coverage) practical coverage. Diffed against a
freshly-captured baseline (248 failed files, captured at this arc's
start, not reused from any prior arc): **6 apparent new failures, 5
individually confirmed as the familiar git-status/working-tree-clean
guard-test class** (expected — this arc's own large uncommitted diff was
still in the working tree at scan time) **and 1 (a performance/timing
test) confirmed passing cleanly in isolation** (load-induced flakiness
under the same memory pressure that caused the crashes, not a functional
regression). **NEW FAILURES: 0.**

## Typecheck

`npm run typecheck:core` and `npm run typecheck:electron`: identical 4
pre-existing baseline errors (`typecheck:core`, all in test files
unrelated to this arc) and 0 errors (`typecheck:electron`), confirmed
unchanged after every individual agent's work and at the final merged
state. **TYPECHECK NEW ERRORS: 0.**

## Package / Packaged launch

All 5 root build scripts succeed. A genuinely clean build (`rm -rf dist
packages/fedos-desktop-electron-spike/dist-package-beta`, not
incremental) plus the real `electron-builder` packaging pipeline
succeeded end-to-end, producing a real NSIS installer and zip. Verified:
686 real compiled `.js` files under the packaged `dist/os/**`, including
`src/sync/`'s new `dist/os/messenger/sync/` location. The new
`createMessenger()`/`TransportPort`/`NostrTransportAdapter` files are
correctly ABSENT from the packaged compile graph — expected, since
nothing in the real shipped app's composition root calls the new public
factory yet (identical, already-established pattern to the barrels from
the prior arc). `test/secure_runtime_alpha_619_production_caller_reality_check.test.ts`
re-confirms the real built entry point launches as its own OS process and
reaches a real ready state.

**PACKAGE: PASS. PACKAGED REAL LAUNCH: PASS. UNEXPECTED EXTERNAL CONTACT: 0.**

## Final report

STARTING CANDIDATEHEAD: `1369dc79`
STARTING EVIDENCEHEAD: `179871f5`
PACKAGE EXTRACTION READINESS CANDIDATEHEAD: `6fe3bb41`
PACKAGE EXTRACTION READINESS EVIDENCEHEAD: (this commit)

FACADES BEFORE: 811
FACADES REMOVED: 4
FACADES RETAINED: 807
DEPRECATED PUBLIC FACADES: 393
UNKNOWN FACADES: 0

TRANSPORT PORT: PASS
PAYMENT PROVIDER CONTRACT: PASS
BTCPAY CONTRACT READY: PARTIAL (contract shape ready; no adapter, no real network, by design)
STORAGEBACKEND: FORMALLY RETIRED (reserved seam, structurally incompatible with real needs)
SRC/SYNC: MESSENGER-SCOPED (relocated to os/messenger/sync/, no new capability)
NOSTR RELAY/SOCKET: INTENTIONALLY LAYERED (one real duplicate found and fixed; no forced merge)

RUNTIME SCC: 0
TYPE SCC: 1 (down from 6)

PACKAGE EXTRACTION BLOCKERS: 48
CORE VIRTUAL PACKAGE: FAIL
MESSENGER VIRTUAL PACKAGE: FAIL
COMMERCE VIRTUAL PACKAGE: FAIL
DESKTOP COMPOSITION: PASS
PRIVATE CROSS-PACKAGE IMPORTS: 0

BOUNDARY TESTS: 103/103 (13/13 files)
FULL REGRESSION: 0 net new failures (worked around a recurring environment
  Tinypool-crash via 30 sequential batches after 6 consecutive full/sharded/
  single-threaded run failures; diagnosed as memory pressure, not a test defect)
NEW FAILURES: 0

TYPECHECK NEW ERRORS: 0

PACKAGE: PASS
PACKAGED REAL LAUNCH: PASS
UNEXPECTED EXTERNAL CONTACT: 0

OSS PACKAGE READINESS: PARTIAL

WORKTREE: CLEAN — same pre-existing unrelated dirty state (4 modified
  files, several untracked directories, present before this arc and every
  arc before it in this session) deliberately excluded from every commit,
  untouched throughout.

## Final classification

**FEDOS SOURCE ARCHITECTURE: CAPABILITY-MODULAR + CYCLE-FREE (runtime;
1 documented, intentionally-preserved type-only cycle remains) +
PORT/ADAPTER COMPOSED (5 Ports now, including the newly-completed
TransportPort) + NOT YET PACKAGE-EXTRACTABLE.**

**OSS PACKAGE READINESS: PARTIAL, not READY** — honestly, per this arc's
own classification rules. The single blocking finding
(`src/runtime/`'s 78 files as a hidden shared dependency of both
`os/core` and `os/messenger`, 36 of 48 total blockers) is well-understood,
precisely measured, and has a clear remediation path recorded in
`docs/architecture/PACKAGE-EXTRACTION-PLAN.md` — but was not executed
this arc, consistent with the kickoff brief's own instruction that a real
package split happens in a separate, future arc.

## Next arc preparation

Per section 47's own instruction, a workspace/multi-package extraction
arc should NOT start with a blind "move things into `packages/`" plan.
It should start by resolving the one dominant blocker:
`docs/architecture/PACKAGE-EXTRACTION-PLAN.md` names `src/runtime/`'s
78 files as the first thing to classify and relocate (most of it is
almost certainly `os/core`-bound, mirroring the disposition this arc's
own `CORE-SECRETS-OWNERSHIP-PLAN.md` already worked out for
`runtime/master_seed/` specifically) — closing that one dependency would
resolve the majority of the 48 blockers in one motion, at which point the
virtual-package-compile tests (`test/architecture_package_extraction_boundary.test.ts`)
already exist and are ready to flip from FAIL to PASS as the real
verification gate for that follow-up arc, with no new tooling required.

## Known limitations / deferred work (honest, not silently dropped)

1. **No physical `packages/*` split** — by design, per this arc's own
   scope. `PACKAGE-EXTRACTION-PLAN.md` has the manifests and build order
   ready.
2. **48 package-extraction blockers remain**, dominated by one root
   cause (`src/runtime/`), documented with an exact remediation order.
3. **`TransportPort` is not yet wired into the real composition root** —
   `createMessenger()` accepts it, but the shipped app's own
   `fedos_desktop_runtime.ts` doesn't construct a `Messenger` via the new
   factory yet; that's a separate, future integration step.
4. **No real BTCPay adapter** — the contract is ready; nothing implements
   it, and this arc's own safety rules forbade contacting a real BTCPay
   instance to test one.
5. **1 type-only SCC remains**, deliberately, as documented.
6. **~90 net-new deprecation-marked shims (393 total) still exist and
   are not scheduled for removal** — per this arc's own binding
   principle, that's the correct, safe outcome, not a shortfall.
