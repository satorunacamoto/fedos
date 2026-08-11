# FedOS — Core Secrets Ownership Plan

Status: **EXECUTED** (Architecture Dependency Closure arc). Pure software
architecture, no legal/compliance content. This plan's own "minimal safe
migration order" (bottom of this doc) was carried out step by step:

1. Investigated the exact `FedosDirectRatchetSealingAuthority` surface —
   narrow (two methods, `sealDirectRatchetSecret`/`restoreDirectRatchetSecret`),
   and the coupling was TYPE-ONLY: `FedosWasmMasterSeedAuthority` never
   CALLS anything on a `FedosDirectRatchetSealingAuthority` instance — it
   IMPLEMENTS that interface. Core PROVIDES this capability; only the
   Messenger ratchet runtimes (`FedosDirectRatchetStateRuntime`,
   `FedosDirectRatchetConversationRuntime`) hold a value of this type and
   CALL its methods. The only other implementer,
   `FedosProductionMasterSeedAuthority`, already lives inside
   `os/messenger/desktop/production_activation/` (intra-domain, not a
   boundary issue).
2. Added `SealingAuthorityPort` to `src/os/core/ports/sealing_authority_port.ts`
   — same two methods, identical names/signatures (a pure dependency-
   direction fix, not a rename, to avoid rippling into every consumer call
   site).
3. `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_sealing_authority.ts`
   now re-exports `SealingAuthorityPort` under its original name
   (`export type { SealingAuthorityPort as FedosDirectRatchetSealingAuthority }`)
   — every existing Messenger-side import of this type, unchanged, still
   resolves to the identical structural shape.
4. `src/runtime/master_seed/` (5 files) moved to `src/os/core/vault/wasm/`,
   old paths shimmed (`export * from "...";`). `fedos_wasm_master_seed_authority.ts`
   now imports `SealingAuthorityPort` from `../../ports/sealing_authority_port.js`
   instead of the concrete Messenger type — `os/core` no longer has any
   import reaching into `os/messenger`.
5. `test/architecture_boundary_core.test.ts` (which now genuinely scans
   `os/core/vault/wasm/`, unlike before the move) confirms 0 reverse edges.

`os/core/storage/`'s disposition was addressed separately: relabeled as an
honestly-documented reserved seam (`src/os/core/storage/README.md`), the
lowest-risk of the three options below given it's independent of the
secrets-authority move and a real `AppendOnlyPersistence<T>` extraction
deserves its own reviewed arc.

## The problem, stated precisely

`docs/architecture/OS-CAPABILITY-BOUNDARIES.md`'s ownership table (written
by a prior arc) claims `os/core` owns "vault (secret store)". This is
false in practice: `src/os/core/vault/` (`InMemoryVaultBoundary`,
`NoopVaultBoundary`) has **zero production consumers anywhere in the repo**
— its own doc comment says it "models the LOCKED↔UNLOCKED lifecycle
WITHOUT any cryptography... NOT wired into the runtime." Its only importer
is `test/vault_boundary.test.ts`. Similarly `src/os/core/storage/` has
zero live-messenger consumers — only `os/_legacy_prototype/` and tests use
it; the real messenger (42 files under `os/messenger/conversations/`
alone) hand-rolls its own `node:fs`-based append-only persistence instead.

**The real secrets/key-material owner is `src/runtime/master_seed/`**
(`FedosMasterSeedAuthority`, `FedosSealedMasterSeedEnvelope*`,
`FedosWasmMasterSeedAuthority`, `FedosPassphraseProvider`) — a directory
that was explicitly NOT moved into `os/core` by the prior arc ("deferred:
`src/runtime/`'s remaining core-candidate pieces... deliberately left
untouched this arc"). This arc corrected the DOCUMENTATION to match this
reality (see `OS-CAPABILITY-BOUNDARIES.md`'s corrected ownership table,
committed this arc) but did not move any code.

## Current owner (measured, fresh post-migration)

`src/runtime/` — 76 files, NOT under `src/os/` at all. Subdivided:
- `master_seed/` — the real secrets authority (per above).
- WASM crypto loader/facade, AEAD encrypt/decrypt/export/import — the
  runtime-side wrapper around `packages/fedos-core-rust/`'s WASM crate.

Imported by **59 files repo-wide** (Agent A's Phase 1 count, still accurate
— `runtime/` itself was not touched by the Messenger migration). Heaviest
non-test dependency in the repo after `conversation`/`desktop` (now
`os/messenger/conversations`/`os/messenger/desktop`).

## Relationship to `os/core/storage` and `os/core/vault`

**None, currently — they are unconnected.** `os/core/storage` and
`os/core/vault` were built as forward-looking placeholder seams during the
prior arc's Core extraction, apparently WITHOUT auditing whether they
matched what the real secrets/persistence code actually does. They don't.
A follow-up arc has three honest options, not two:

1. **Delete `os/core/storage`/`os/core/vault`** as dead scaffolding and let
   `runtime/master_seed/` become the real `os/core` secrets module once
   moved (see below) — cleanest, but loses whatever forward-looking design
   intent motivated building them.
2. **Move `runtime/master_seed/` INTO `os/core/vault/`**, replacing the
   current placeholder content, and keep `os/core/storage` separately
   addressed (it's a genuinely different concern — generic byte
   persistence vs. secret/key material specifically).
3. **Keep both, explicitly reconciled**: `os/core/vault/` becomes a real
   Port/interface `master_seed/`'s concrete implementation satisfies (i.e.
   `os/core/vault/types.ts` defines the contract, `runtime/master_seed/`
   moves to become `os/core/vault/wasm/` or similar as the one real
   implementation) — this is the option most consistent with the
   Ports-and-Adapters framing the rest of this arc's documentation uses.

**Recommendation: option 3.** It's the only one that doesn't throw away
either side's design intent, and it matches the pattern already
successfully used for `PaymentProvider` (`os/commerce/payment/types.ts`
defines the contract; `NoopPaymentProvider`/`PlaceholderPaymentProvider`
are current implementations; a future BTCPay adapter would be a third).

## The reverse dependency into `conversation/ratchet` (now `os/messenger/conversations/ratchet`)

Measured fresh, post-migration (see `CIRCULAR-DEPENDENCY-BREAK-PLAN.md`
Edge 1 for the full classification):

- `src/runtime/master_seed/fedos_wasm_master_seed_authority.ts` imports
  `FedosDirectRatchetSealingAuthority` from
  `src/os/messenger/conversations/ratchet/**`.
- `src/runtime/master_seed/fedos_passphrase_provider.ts` — same family.

This is the concrete evidence that `runtime/master_seed/` is NOT actually
a clean, generic core primitive today — it already depends on a specific
Messenger type. **Any plan to move `master_seed/` into `os/core` must
resolve this first**, or `os/core` would gain a real import into
`os/messenger`, breaking the one boundary rule (`os/core` is a verified
sink, 0 reverse edges) that `test/architecture_boundary_core.test.ts`
currently, correctly enforces.

**Investigation needed before any move (not done this pass):** what does
`FedosWasmMasterSeedAuthority` actually call on
`FedosDirectRatchetSealingAuthority`? If it's a narrow surface (e.g. "seal
this seed material using the ratchet's own sealing primitive"), the fix is
a new Port (`SealingAuthorityPort` or similar) in `os/core/ports/` that
`os/messenger/conversations/ratchet/` implements and `master_seed/`
depends on instead of the concrete type — inverting the dependency
direction cleanly. If the coupling is deeper (multiple methods, shared
state expectations), the fix may require redesigning which side owns
which responsibility, not just a Port wrapper.

## Correct ownership boundary (recommended)

```
os/core/
  vault/               <- Port/contract (types.ts: the SealingAuthorityPort
                          shape, VaultBoundary-equivalent lifecycle)
    wasm/                <- runtime/master_seed/ moves here, becomes the
                            real implementation, AFTER the ratchet reverse
                            dependency above is resolved via a Port
  storage/              <- separately addressed; either wired to the real
                          node:fs-based persistence conversation/board/device
                          already hand-roll (extract their common
                          append-only-log pattern into this seam — see the
                          "persistence triad" finding in this arc's Phase 1
                          Agent A report, ~15+ near-identical
                          interface/append-only-impl/in-memory-double
                          triads repeated across the codebase, a strong
                          candidate for one shared `AppendOnlyPersistence<T>`
                          primitive here) or explicitly relabeled as a
                          reserved/unwired seam (matching how
                          `os/messenger/onion/` is honestly documented
                          today) if no consolidation work is planned soon
```

## Shims / Port / import changes needed at move time

1. Old path shims at every `src/runtime/master_seed/*.ts` location
   (same pattern as the completed Messenger migration's Core stage) — 5
   files, small, low-risk mechanically.
2. A NEW Port in `os/core/ports/` for the ratchet-sealing dependency
   (design work, not mechanical — the real prerequisite).
3. Update `src/os/messenger/conversations/ratchet/**`'s own build to
   IMPLEMENT that Port (a new `implements` clause on whatever class
   currently exposes `FedosDirectRatchetSealingAuthority`'s surface) —
   this is the one place the Messenger side needs a change, not just Core.
4. `packages/fedos-core-rust/` (the WASM crate) stays physically in place
   regardless of this move — it's referenced by literal relative path in
   `electron_builder.beta.config.json`'s `extraResources`, unrelated to
   where its TypeScript-side wrapper (`runtime/`) lives.
5. Packaging audit: check all 5 root tsconfigs for literal `runtime/master_seed/`
   path pins before moving (not done this pass — `MESSENGER-MIGRATION-STAGING.md`'s
   own note flags one such pin, `src/runtime/master_seed/fedos_sealed_master_seed_envelope_persistence.ts`,
   appearing in `tsconfig.beta-runtime.json` and `tsconfig.unlock-runtime.json`,
   explicitly out of scope for the Messenger migration but relevant here).

## Minimal safe migration order

1. Investigate the exact `FedosDirectRatchetSealingAuthority` surface
   `master_seed/` calls (read-only, no code change).
2. Design and land the new Port in `os/core/ports/` (new file, zero
   existing-file edits — same low-risk pattern the original Messenger
   Port adapters used).
3. Make `os/messenger/conversations/ratchet/**`'s relevant class
   `implements` the new Port (one class, additive).
4. Move `runtime/master_seed/` → `os/core/vault/wasm/` with shims at old
   paths (mechanical, once steps 1-3 have removed the reverse-dependency
   blocker).
5. Update `runtime/master_seed/fedos_wasm_master_seed_authority.ts` and
   `fedos_passphrase_provider.ts` to depend on the new Port instead of the
   concrete ratchet type (now trivial, since step 3 already built the
   `implements` side).
6. Re-run `test/architecture_boundary_core.test.ts` — should still report
   0 reverse edges, now genuinely true rather than true-by-omission (the
   real secrets code is finally inside `os/core` and still doesn't reach
   back into Messenger).
7. Decide `os/core/storage`'s fate (delete, wire to a real
   `AppendOnlyPersistence<T>` extraction, or relabel as reserved) —
   independent of steps 1-6, can run in parallel.
