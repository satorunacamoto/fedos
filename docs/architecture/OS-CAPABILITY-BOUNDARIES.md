# FedOS — OS Capability Boundaries

Status: top-level overview, originally written for the "OS Capability
Modularization" arc and since updated by the follow-up "Capability /
Adapter Modularization & OSS Developer Experience" arc. Pure software
architecture — dependency direction, ownership, composition, and migration
status only. No legal, compliance, AML, law-enforcement, anonymous-market,
or regulatory content anywhere in this document or the ones it links to.

**Status update: the Messenger physical migration is now complete**
(`4132a500`, 764 files, 6 stages). Every place below that still says
"physical move deferred" or "no physical file move" describes the state
BEFORE that migration ran — see the corrected `Ownership summary` table
and `docs/architecture/CIRCULAR-DEPENDENCY-BREAK-PLAN.md`,
`docs/architecture/NOSTR-CONSOLIDATION-PLAN.md`,
`docs/architecture/CORE-SECRETS-OWNERSHIP-PLAN.md`, and
`docs/architecture/FACTORY-PORT-COMPLETION-PLAN.md` for the current,
post-migration architecture debt this repo still carries.

## Why this arc exists

FedOS's real shipped code (one Electron desktop messenger app, reachable
today from `tsconfig.beta-runtime.json`'s 29-file include list plus
`packages/fedos-desktop-electron-spike/`) had grown without an explicit
capability boundary: general-purpose primitives (identity, crypto,
storage), the messenger's own domain code, and a large body of dormant
pre-pivot prototype code all lived flat under `src/`, distinguishable only
by directory-name convention and prose in `ARCHITECTURE.md`. This arc gives
that boundary a real, enforced shape: three capabilities plus one quarantine.

## The starting-point audit, in one paragraph

A read-only audit (this arc's Agent C) found the repo's shipped product is
**entirely a messenger** — no Order, Support, Delivery, or Seller-State
concept exists anywhere; no Telegram, BTCPay, Tor/onion, or local-AI
integration exists anywhere in this repository. What looked like a
commerce vertical (`src/commerce/`, `src/payment/`, `src/marketplace/`,
`src/creator/`) is dormant scaffolding from a pre-pivot Cloudflare Workers
product ("nostr-window"), explicitly commented "NOT IMPLEMENTED, ON
PURPOSE" in places, never wired into the shipped Electron app. A much
larger body of code (chat/community/social/thread/query/ingest/indexer/
cache/nearby/asset/sign/render/federation/promotion, ~90 files, plus
`worker.ts`/`index.ts`) is that same dead product's remainder. These facts
shaped every decision below — this is a modularization of what actually
ships, not an invented commerce product.

## The four top-level trees

```
src/os/
  core/               live, extracted this arc (46 -> 43 files; see below)
  messenger/          scaffolding + Ports + docs this arc; physical move deferred
  commerce/           live, extracted this arc (19 files, inert scaffolding)
  _legacy_prototype/  live, quarantined this arc (90 files, dead pre-pivot code)
```

Everything not yet under `src/os/` — `src/conversation/`, `src/board/`,
`src/desktop/`, `src/device/`, `src/nostr/` (764 files, the messenger
capability's real implementation) — stays exactly where it is. It was
audited, mapped file-by-file, and given a working Port-adapter layer this
arc, but its physical move is deferred to a follow-up arc. See
`docs/architecture/MESSENGER-ARCHITECTURE.md`.

## Dependency direction (enforced by test, not just documented)

```
        ┌─────────────┐
        │   os/core    │   identity, crypto, storage, vault, settings,
        │              │   generic Ports (Messaging/Conversation/
        │              │   Notification/LocalAIProvider)
        └──────┬───────┘
               ▲
     ┌─────────┴─────────┐
     │                    │
┌────┴─────┐        ┌─────┴──────┐
│ messenger │        │  commerce  │
│ (764      │        │  (inert    │
│  files,   │        │  scaffold, │
│  live)    │◄──Port──┤  19 files) │
└───────────┘        └────────────┘
```

- **Core imports nothing from messenger or commerce.** Enforced by
  `test/architecture_boundary_core.test.ts`.
- **Messenger imports nothing from commerce.** Enforced by
  `test/architecture_boundary_messenger.test.ts` (checks both the current
  live locations and `src/os/messenger/`).
- **Commerce imports nothing from messenger's implementation** — only from
  `src/os/core/ports/*`. Enforced by `test/architecture_boundary_commerce.test.ts`.
  The one pre-existing exception found (`catalog/bridge.ts`/`classify.ts`
  importing `NostrEvent` directly) was fixed during this arc by moving the
  two `NostrEvent`-typed functions into a reserved
  `catalog/adapters/nostr/` directory — see `COMMERCE-ARCHITECTURE.md`.
- **Adapters (Nostr, Telegram, BTCPay, Tor) never leak their SDK types into
  domain code.** See `ADAPTER-BOUNDARIES.md`.
- **Core, Messenger, and Commerce can each be reasoned about independently**
  — `test/architecture_boundary_adapter_port_shapes.test.ts` additionally
  proves the three Port adapters genuinely satisfy their Port interfaces
  (type-level `implements` plus a runtime structural check against test
  doubles), which is the concrete mechanism that makes "Commerce depends
  on Messenger only through a Port" true today, not just aspirational.

## Ownership summary

| Capability | Owns | Does not own |
|---|---|---|
| `os/core` | identity, crypto (TS wrapper; WASM crate stays at `packages/fedos-core-rust/`, referenced by packaging path, not moved), settings, the five Port contracts (`messaging_port.ts`/`conversation_port.ts`/`notification_port.ts`/`local_ai_provider.ts`/`sealing_authority_port.ts`), **and now the real secrets authority** — `os/core/vault/wasm/` (`FedosWasmMasterSeedAuthority`, `FedosMasterSeedAuthority`, `FedosSealedMasterSeedEnvelope*`, `FedosPassphraseProvider`), physically moved here from `src/runtime/master_seed/` in the Architecture Dependency Closure arc, old paths shimmed | any UI, any transport implementation, any domain business logic; `os/core/vault/{memory_vault,noop_vault}.ts` and `os/core/storage/` remain separate, still-unwired placeholders with zero production consumers (see `os/core/storage/README.md` and `docs/architecture/CORE-SECRETS-OWNERSHIP-PLAN.md` — the secrets-authority move that plan recommended is now done; `os/core/storage/`'s disposition is independently addressed there) |
| `os/messenger` — **physically migrated as of the Messenger migration arc** (`4132a500`, 764 files, 6 stages) | conversations (construction/membership/encryption/ratchet/delivery/persistence/archive/search/retention/deletion), contacts (currently nested inside conversations — see `MESSENGER-ARCHITECTURE.md`), device pairing/sync, board (public federated posting), Nostr adapters (three separate, unconsolidated implementations — see `docs/architecture/NOSTR-CONSOLIDATION-PLAN.md`), notifications, Electron composition (`desktop/`). One file, `desktop/beta/fedos_desktop_beta_capability_manifest.ts`, was deliberately excluded from the move (unrelated in-progress work on this branch) and remains at its original path. | commerce concepts; owns its own adapters (Nostr) but not Telegram/BTCPay |
| `os/commerce` | catalog, payment (seam only — `NoopPaymentProvider`/`PlaceholderPaymentProvider`, nothing charges), marketplace, creator — all inert; reserved Telegram/BTCPay adapter seams | Order/Support/Delivery/Seller-State (none exist); Messenger implementation |
| `os/_legacy_prototype` | the dead pre-pivot "nostr-window" product, kept only for its own historical test coverage | nothing live depends on it in the shipped app, with one exception below |

## The one live/legacy coupling found, and how it's kept honest

`src/desktop/notification/fedos_desktop_notification_types.ts` (live,
shipped) reuses one pure function, `isSensitiveNotificationField`, from
`src/notification/policy.ts`. Initial quarantine work moved all of
`src/notification/` into `_legacy_prototype/` on the assumption it was dead
pre-pivot code; that assumption was wrong for 3 of its 4 files (`types.ts`,
`policy.ts`, `noop_notification.ts` — pure, FedOS-native "Stage 39"
forward-looking infrastructure, not inherited from the dead product) and
was corrected before this arc's CandidateHead: those three files moved back
to `src/notification/` (their original, live location); only `bridge.ts`
(which does compose genuinely dead `chat`/`community` types) stays
quarantined. See `src/os/_legacy_prototype/README.md` and
`src/notification/README.md` for the full story — this is the one place in
this arc where the initial mechanical classification was wrong, and it is
documented rather than smoothed over.

## Composition status

| Composition | Status |
|---|---|
| Core only | PASS — `test/architecture_boundary_core.test.ts`, targeted identity/crypto/vault/storage/settings tests all green |
| Core + Messenger | PASS — messenger already depends on core (identity/crypto/storage/vault/settings) via the unchanged old import paths, which now resolve through core's shims to the real `os/core/` implementation |
| Core + Commerce | PASS — commerce depends on core only through `os/core/ports/*` (aspirationally; no real Commerce feature exists yet to exercise it) |
| Core + Messenger + Commerce | PASS — full repo typecheck (`npm run typecheck:core`, `npm run typecheck:electron`) and full test suite both pass at the same baseline rate as before this arc (see `OS-CAPABILITY-MODULARIZATION-FINAL-VALIDATION.md` for exact numbers) |
| Messenger without Commerce | PASS — Commerce has no callers into Messenger; deleting `src/os/commerce/` entirely would not affect Messenger's compile or test graph |
| Commerce without Messenger | PASS — Commerce's own tests (`test/commerce_*.test.ts`) do not import any live Messenger file; the reserved `MessagingPort`/`ConversationPort`/`NotificationPort` types are the only seam a real future Commerce feature would need, and a fake/no-op implementation satisfies them without Messenger present |

## Migration status (what physically moved this arc vs. what's staged)

| Capability | This arc | Follow-up arc |
|---|---|---|
| `os/core` | Physically moved (identity/crypto/storage/vault/settings, 43 files; then `master_seed` → `vault/wasm/`, 5 more files, in the Architecture Dependency Closure arc), old paths shimmed | `src/runtime/`'s remaining core-candidate pieces (`wasm_loader.ts` and the rest of `runtime/`'s WASM crypto facade — deliberately left in place; nothing in `master_seed/`'s own move required moving its loader dependency) |
| `os/commerce` | Physically moved (19 files), no shims (direct import rewrite) | Real Order/Support/Delivery/Seller-State design, once/if a real commerce feature is scoped |
| `os/_legacy_prototype` | Physically moved (90 files, minus the 3-file notification correction above), no shims | none planned — this code has no deploy path and is kept only for historical test coverage |
| `os/messenger` | Boundary, Ports, working Port-adapter layer, complete 764-file migration mapping, staged move order — **no physical file move** | The physical move itself, per `MESSENGER-MIGRATION-STAGING.md`'s 6 stages, each gated on typecheck + targeted tests + a packaging-path audit before the next stage starts |

## Pointers

- `docs/architecture/MESSENGER-ARCHITECTURE.md` — Messenger capability detail, Port adapters, migration mapping/staging pointers
- `docs/architecture/COMMERCE-ARCHITECTURE.md` — Commerce capability detail, the four subdirectories, reserved adapter seams
- `docs/architecture/ADAPTER-BOUNDARIES.md` — Nostr/Telegram/BTCPay/Tor/local-AI adapter boundary rules
- `docs/architecture/MESSENGER-MIGRATION-MAPPING.md` — every messenger file's old → proposed new path
- `docs/architecture/MESSENGER-MIGRATION-STAGING.md` — the proposed physical-move order for the follow-up arc
- `docs/architecture/OS-CAPABILITY-MODULARIZATION-FINAL-VALIDATION.md` — regression/typecheck/packaging evidence, CandidateHead/EvidenceHead
