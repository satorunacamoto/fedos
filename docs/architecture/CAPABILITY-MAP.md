# FedOS — Capability Map

Status: architecture note for the "Capability / Adapter Modularization &
OSS Developer Experience" arc. Pure software architecture — no legal/AML/
regulatory content. This document shows two diagrams on purpose: the
**target** shape this repo is aiming for, and the **current, measured**
shape as of this arc's inventory (`cfd74860`). They differ, and that
difference is the point — earlier architecture docs presented the target
as if it were already achieved in places it wasn't. Every claim below
without a citation was measured (Grep/import-resolution), not assumed.

## Target shape (aspirational — not yet fully real)

```
                    ┌───────────────────────┐
                    │        os/core         │
                    │ identity · crypto ·    │
                    │ settings · ports/      │
                    └───────────┬────────────┘
                                │ (sink — nothing here imports out)
                    ┌───────────┴────────────┐
                    │                         │
            ┌───────┴───────┐         ┌───────┴────────┐
            │  os/messenger  │         │   os/commerce   │
            │  conversations │◄──Port──┤  catalog        │
            │  board/device  │         │  payment        │
            └───────┬────────┘         │  marketplace    │
                    │                  │  creator        │
                    │                  └───────┬─────────┘
            ┌───────┴────────┐                 │
            │ adapters/nostr  │        ┌────────┴────────┐
            │ (one impl.)     │        │ reserved:        │
            └────────────────┘        │ telegram, btcpay  │
                                       └──────────────────┘
                    ┌────────────────────────┐
                    │   apps/desktop          │
                    │   (composition root)    │
                    └────────────────────────┘
```

This is the direction — Core as a true dependency sink, Messenger and
Commerce as siblings talking only through Ports, one Nostr adapter, a
composition root that's the only place concrete adapters are chosen. **Do
not read this diagram as the current state.**

## Current, measured shape (this arc's actual finding)

```
   os/core (sink — verified clean, 0 reverse edges)
     ├─ identity/   live, 94 external consumers via shim
     ├─ crypto/     live, thin (1 real consumer)
     ├─ settings/   live, 12 consumers (desktop-only)
     ├─ storage/    ORPHANED — 0 live consumers (only dead code + tests)
     ├─ vault/      ORPHANED — 0 production consumers anywhere
     └─ ports/      4 files, UNWIRED — nothing in production
                     constructs the 3 Port adapters that use them

   ┌─────────────────────────────────────────────────────────────┐
   │  ONE STRONGLY-CONNECTED COMPONENT — 8 module-groups,         │
   │  11 bidirectional group-edges (measured, not assumed):        │
   │                                                                │
   │    desktop ⇄ conversation ⇄ board ⇄ device ⇄ nostr            │
   │       ⇅            ⇅                                          │
   │    os_legacy ⇄ os_commerce      conversation ⇄ runtime        │
   │       ⇅                                                       │
   │      nostr                                                    │
   │                                                                │
   │  Real file-level cycle (not just group-grain):                 │
   │  conversation/encryption/production/…crypto_authority_factory  │
   │    ⇄ desktop/production_activation/…encryption_runtime_boundary│
   └─────────────────────────────────────────────────────────────┘

   os_legacy (should be a thin, inbound-only quarantine)
     └─ actually: 23 files import src/nostr/ directly, 16 files
        bidirectionally coupled with os/commerce — NOT thinly isolated

   os/commerce (inert, but genuinely clean toward messenger)
     └─ 0 files import os/core/ports/* — the "Commerce → Port" story
        is 100% aspirational; no real Commerce code uses a Port yet

   os/messenger (scaffolding only)
     └─ 3 real files (Port adapters), imported by 1 test file only —
        zero production runtime constructs them

   THREE independent Nostr wire implementations exist, not one:
     1. src/nostr/                              12 files, primitives
     2. src/desktop/*.ts (24 top-level files)    deliberately separate
        (own header: "shares NO code, NO type... with src/nostr/ws_relay.ts")
     3. conversation/delivery/nostr/ + transport/ 45 files, wire adapter
```

## Circular dependency baseline

**Before this arc: 1 SCC covering 8 of ~15 module-groups** (measured).
**After this arc: unchanged — 1 SCC, same 8 groups.** No cycles were
broken and none were introduced; this arc made no source code changes
that touch the dependency graph, only documentation. Breaking this SCC is
substantial, cross-cutting work (see `CAPABILITY-MODULARIZATION-FINAL-VALIDATION.md`
"Known limitations / deferred work") and is explicitly deferred to a
follow-up arc, not attempted here.

## Cross-capability direct imports (before/after)

| Boundary | Files | Note |
|---|---|---|
| Messenger ↔ Commerce | 0 | Genuinely clean, both directions, verified |
| Messenger → Core | 17 files (31 imports) | Mostly via old shim paths |
| Core → Messenger | 0 | Clean — core is a real sink |
| Commerce → Core | 0 | Aspirational — no real Commerce code references a Port |
| Legacy ↔ Commerce | 16 files (13+3) | Bidirectional, documented but real |
| Legacy → Nostr | 23 files | Not previously counted as a "messenger" exposure |
| Commerce → Nostr | 2 files | The one documented, enforced, intentional exception |

**Total: 58 files cross a capability boundary directly today.** Unchanged
by this arc (no source touched). This is the "before" number a future
staged-refactor arc should measure itself against.

## Pointers

- `docs/architecture/CAPABILITY-CATALOG.md` — every capability, tabulated
- `docs/architecture/ADAPTER-CATALOG.md` — every adapter (including the
  three-Nostr-implementations finding), tabulated
- `docs/architecture/OS-CAPABILITY-BOUNDARIES.md` — corrected this arc
  (ownership table no longer claims `os/core` owns a working vault)
- `docs/architecture/CAPABILITY-MODULARIZATION-FINAL-VALIDATION.md` — full
  evidence, metrics, and known-limitations record for this arc
