# FedOS — Circular Dependency Break Plan

Status: follow-up-arc-ready plan, written after the Messenger physical
migration (`4132a500`) completed. Pure software architecture — no legal/
compliance content. This document exists so a future arc can start
breaking cycles with zero open questions: every edge below is a real,
grep-verified file pair at its POST-migration path, classified along the
dimensions a break-sequence decision needs.

## Headline change from the migration itself

Before the Messenger physical migration, Phase 1 analysis (this arc's own
Agent A) found **one strongly-connected component spanning 8 module-groups**:
`{desktop, conversation, board, device, nostr, runtime, os_legacy,
os_commerce}`. Physically moving `conversation/`, `board/`, `device/`,
`nostr/`, and `desktop/` into one capability (`os/messenger/`) did not
break any individual file-level cycle — cycles between files that used to
sit in different top-level directories still exist, byte-for-byte, at the
same call sites. But it **did structurally collapse 5 of those 8
module-groups into one capability**, so what were cross-directory cycles
are now intra-capability implementation detail. The remaining
CROSS-CAPABILITY footprint is smaller and simpler:

```
Before (8 groups, 11 bidirectional edges):
  desktop ⇄ conversation ⇄ board ⇄ device ⇄ nostr
     ⇅            ⇅
  os_legacy ⇄ os_commerce      conversation ⇄ runtime
     ⇅
    nostr

After (4 groups, 3 bidirectional edges — measured fresh, post-migration):
  os/messenger ⇄ runtime
  os/messenger ⇄ os_legacy   (down from 5 separate incoming edges to 1)
  os_legacy ⇄ os_commerce    (unchanged — neither side moved this arc)
```

**This is real progress, not just a relabeling** — os/commerce and
os/messenger no longer have any path into each other except the one
documented, tested, intentional Nostr exception (unchanged, verified
`test/architecture_boundary_commerce.test.ts` still passes 0 violations).
But it is not "cycles fixed" — three real cross-capability cycles remain,
plus the file-level cycles now living inside `os/messenger/` itself. Both
are catalogued below.

## Cross-capability edges (post-migration, fresh-measured)

### Edge 1: `os/messenger` ⇄ `runtime` (NOT moved this arc)

**os/messenger → runtime: 35 files** (grep: `from "..."../.../.../runtime/`
or `.../src/runtime/` patterns under `src/os/messenger/**`).
**runtime → os/messenger: 2 files**:

| File | Imports | Kind |
|---|---|---|
| `src/runtime/master_seed/fedos_wasm_master_seed_authority.ts` | `FedosDirectRatchetSealingAuthority` from `src/os/messenger/conversations/ratchet/**` | **domain dependency** — the real secrets authority reaches into a specific Messenger ratchet type, not a generic contract |
| `src/runtime/master_seed/fedos_passphrase_provider.ts` | (same family — passphrase-gated seed access referencing ratchet-adjacent types) | domain dependency |

**Classification:**
- **Runtime-only or domain?** Domain — `runtime/master_seed/` is reaching for a specific Messenger type (`FedosDirectRatchetSealingAuthority`), not a generic crypto primitive.
- **Production-activation-derived?** No — this is `master_seed/`, not `production_activation/`.
- **Compatibility-shim-derived?** No — both ends are real, non-shim files.
- **Legacy-derived?** No.
- **Breaks via adapter-ification?** Partially — `runtime/master_seed` could depend on a narrow `RatchetSealingPort` (a NEW port, not one of the 4 existing ones) instead of the concrete `FedosDirectRatchetSealingAuthority` type. This is plausible but requires understanding exactly which methods `master_seed` actually calls (not audited in this pass — flagged as the first task for whoever picks this up).
- **Should lift to composition root?** Partially — `src/desktop/runtime/fedos_desktop_runtime.ts` (now `src/os/messenger/desktop/runtime/...`) already wires both `master_seed` and the ratchet session together; the composition root already KNOWS about both. The question is whether `master_seed`'s own module code should depend on the concrete type directly (current state) or receive it injected by whatever constructs `FedosMasterSeedAuthority` (composition root's job).
- **Should become Port-based?** Yes, recommended — this is exactly the shape `os/core/ports/` should grow: not one of the 4 existing Ports (Messaging/Conversation/Notification/LocalAI), but a 5th, narrower "SealingAuthorityPort" or similar, IF `master_seed` truly needs the ratchet's sealing behavior at the type level and not just data it could receive already-sealed.

### Edge 2: `os/messenger` ⇄ `os/_legacy_prototype`

**os/messenger → legacy: 1 file** (down from a theoretical concern to a
single, well-understood case):

| File | Imports | Kind |
|---|---|---|
| `src/os/messenger/adapters/nostr/protocol/publish.ts` | `isSignedEventLike()` from `src/os/_legacy_prototype/sign/{types,validate}.ts` | **domain dependency, but on genuinely pure/generic validation logic** |

**legacy → messenger (nostr specifically): 23 files** — this is the
INBOUND direction (dead prototype code depending on the live Nostr
primitives it was built against, pre-pivot) — already documented in
`src/os/_legacy_prototype/README.md`, unchanged by this arc, not
newly discovered.

**Classification (for the messenger → legacy edge, the more concerning
direction since it's LIVE code depending on QUARANTINED code):**
- **Runtime-only or domain?** Domain — `isSignedEventLike()` is a real, called, load-bearing validation predicate inside the live Nostr publish path (`board/outbox/` and `desktop/`'s relay files both transitively depend on `publish.ts`).
- **Production-activation-derived?** No.
- **Compatibility-shim-derived?** No — this predates any shim; it's a genuine pre-existing dependency the Phase 1 audit (Agent M) found and flagged, not introduced by any move.
- **Legacy-derived?** The TARGET is legacy (`_legacy_prototype/sign/`), but the CALLING code (`publish.ts`) is live and shipped.
- **Breaks via adapter-ification?** Yes, cleanly — `isSignedEventLike()` is a small, pure, dependency-free predicate (per the prior arc's own audit, "a genuinely pure/generic validation logic" characterization). The fix is almost certainly: copy or move this one function (not the whole `sign/` directory) into `os/messenger/adapters/nostr/protocol/` itself, or into `os/core` if it's truly generic-enough to be a core primitive. This is the SMALLEST, safest fix candidate in this entire document.
- **Should lift to composition root?** No — this is exactly the kind of leaf-level pure function that should NOT be a composition-root concern; it belongs wherever `publish.ts` itself lives.
- **Should become Port-based?** No — overkill for one pure predicate function; a direct move/copy is simpler and equally correct.

**This is the highest-value, lowest-risk single fix in this document** —
recommended first, if a follow-up arc wants exactly one quick win before
tackling anything larger.

### Edge 3: `os/_legacy_prototype` ⇄ `os/commerce` (unchanged by this arc)

**legacy → commerce: 13 files. commerce → legacy: 3 files.** Both
directions confirmed unchanged (neither side was touched by the Messenger
migration). Already documented in both `src/os/_legacy_prototype/README.md`
and `docs/architecture/COMMERCE-ARCHITECTURE.md` as an accepted, low-priority
coupling ("two capabilities with different futures... share code that
predates both moves"). No new classification needed here — the prior
arc's own documentation stands. Not re-analyzed in depth this pass since
priority was the Messenger migration; a follow-up arc doing a real
Nostr/secrets/factory pass should re-audit this edge too if it has budget,
but it is lower risk than Edges 1-2 (neither side is on any live/shipped
path — `os/commerce` is entirely inert, `_legacy_prototype` has no deploy
path).

## The file-level cycle inside `os/messenger` itself

`src/os/messenger/conversations/encryption/production/fedos_conversation_canonical_production_crypto_authority_factory.ts`
⇄
`src/os/messenger/desktop/production_activation/fedos_production_conversation_encryption_runtime_boundary.ts`

**Role in the SCC, evaluated per the Coordinator's own required test:**

1. **Does cutting it shrink the SCC?** As of this arc's migration, **no** —
   both files now live inside the same top-level capability
   (`os/messenger/`). Before the migration, this cycle was one of the
   bridges holding `desktop` and `conversation` together inside the
   8-group SCC; now that `desktop` and `conversation` are the SAME
   capability by construction, cutting this one file-level cycle would
   not detach anything from a larger cross-capability structure — the
   capability-level graph is already merged regardless of this edge.
2. **Does it match an architecture boundary?** No boundary currently
   distinguishes `conversations/encryption/production/` from
   `desktop/production_activation/` as separate enforced zones — both are
   sub-directories of one capability with no boundary test drawn between
   them.
3. **Is the change local/backward-compatible/low-regression-risk?**
   Unknown/not verified — fixing it would require understanding which of
   the two files should own `FedosProductionConversationAeadHandleSource`
   (currently defined in the `desktop/production_activation/` file and
   consumed by the `conversations/encryption/production/` file, which in
   turn is imported back by the first file for a different type) and is a
   real, if small, redesign question, not a mechanical move.

**Conclusion: none of the three conditions the Coordinator was told to
require before making an exception are met** — cutting this cycle would
not shrink any cross-capability SCC (condition 1 fails outright, which is
sufficient on its own to decline the exception). **Left unfixed, per
instruction.** Documented here in full for a follow-up arc:

- **Runtime-only or domain?** Domain — both files are production crypto
  authority wiring, not generic runtime plumbing.
- **Production-activation-derived?** Yes, one side of the cycle IS
  `production_activation/` by name.
- **Compatibility-shim-derived?** No — both are real files, this cycle
  predates any shim (confirmed present in the original, pre-migration
  source tree by Agent A's Phase 1 audit).
- **Legacy-derived?** No.
- **Breaks via adapter-ification?** Possibly — if
  `FedosProductionConversationAeadHandleSource` is treated as a Port that
  `production_activation/` implements and `encryption/production/`
  depends on (rather than a concrete type each side imports from the
  other), the cycle becomes one-directional. Not verified this pass.
- **Should lift to composition root?** Possibly — both files exist because
  SOMETHING needs to wire "production" (real, non-test) crypto authority
  together; that wiring might belong in `desktop/runtime/`
  (`fedos_desktop_runtime.ts`) instead of being spread across two
  peer files that reference each other.
- **Should become Port-based?** Most likely yes, per the adapter-ification
  note above — this looks like a natural `Port`/factory-injection
  candidate once a follow-up arc reaches Plan C (Factory/Port completion).

## Minimal safe break sequence (recommended order for a follow-up arc)

1. **Edge 2's `isSignedEventLike()` fix** (move/copy one pure function out
   of `_legacy_prototype/sign/` into `os/messenger/adapters/nostr/protocol/`
   or `os/core`). Smallest, safest, immediately actionable, removes the one
   live→legacy dependency entirely.
2. **Edge 1's `runtime/master_seed` → ratchet dependency.** Requires first
   auditing exactly what `FedosDirectRatchetSealingAuthority` surface
   `master_seed` actually calls (not done this pass) before designing a
   Port. Do this as part of Plan B (Core Secrets Ownership) below, since
   it's the same investigation either way.
3. **The intra-messenger `encryption/production` ⇄ `production_activation`
   cycle.** Lowest priority of the three — it doesn't reduce cross-capability
   coupling (per the analysis above), so it's a code-quality improvement,
   not an architecture-boundary fix. Do this only after 1-2, and only if
   Plan C's factory/Port work naturally touches this code anyway.
4. **Edge 3 (`_legacy_prototype` ⇄ `os/commerce`)** — lowest priority;
   neither side is live/shipped, so this coupling has no user-facing risk.
   Re-audit only if a future arc plans to delete `_legacy_prototype`
   entirely (its own README already flags this as a prerequisite check).

## Recommended migration order for a combined follow-up arc

Per the Coordinator's own instruction, a follow-up arc closing Circular
Dependency + Nostr Consolidation + Core Secrets Ownership + Factory/Port
Completion together should sequence work so each subtree's changes don't
block the others:

1. **Core Secrets Ownership (Plan B) first** — it's the one all three other
   plans partially depend on (Edge 1 above needs its investigation; Nostr
   consolidation's canonical location choice doesn't depend on it, but
   Factory/Port completion's `createMessenger()` needs to know whether
   `master_seed` moves into `os/core` before designing what a Messenger
   factory constructs).
2. **Nostr Consolidation (Plan A) second**, independently of Core Secrets —
   it touches `os/messenger/adapters/nostr/`, `os/commerce/catalog/adapters/nostr/`,
   and `os/messenger/desktop/`'s ~24 top-level files, none of which overlap
   Plan B's `runtime/master_seed/` scope. Safe to parallelize with Plan B
   using up to 2 of the 4 available agents.
3. **Edge 2's small fix** can happen any time, independently, in parallel
   with either of the above (1 agent, minimal scope).
4. **Factory/Port Completion (Plan C) last** — it depends on Plan A's
   canonical Nostr location (for `TransportPort`'s real implementation) and
   Plan B's secrets-ownership decision (for what `createMessenger()`/
   `createCommerce()` actually construct).

With 4 agents available: Agent 1 = Plan B (Core Secrets), Agent 2 = Plan A
(Nostr Consolidation), Agent 3 = Edge 2's small fix + circular-dependency
re-verification once 1-2 land, Agent 4 = held in reserve for Plan C once
1-2 are far enough along to unblock it (Plan C is sequenced last per the
dependency analysis above, so a 4th agent starting it concurrently with
1-2 risks designing against a moving target).
