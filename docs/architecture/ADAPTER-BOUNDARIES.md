# FedOS — Adapter Boundaries

Status: architecture note for the "OS Capability Modularization" arc. Pure
software architecture — no legal/compliance/regulatory content.

This document covers every adapter-shaped seam this arc found or reserved:
Nostr, Telegram, BTCPay, Tor/onion, and local-AI. The common rule across
all five: **an adapter directory is the only place allowed to know a
transport/SDK's concrete shape; domain code depends only on a Port or a
domain-owned type.**

## Nostr

**Status update: the physical migration below is now complete, but Nostr
is NOT one implementation — it is three, unconsolidated.** A follow-up
arc's Phase 1 audit found a THIRD Nostr implementation this document
originally missed entirely: `src/os/messenger/desktop/`'s ~24 top-level
files (`websocket_relay.ts`, `fedos_nostr_wire_event.ts`, etc.) are a
deliberately independent second wire/relay implementation, not part of
`src/nostr/`'s primitives. See `docs/architecture/NOSTR-CONSOLIDATION-PLAN.md`
for the full three-implementation inventory, the duplication between them,
and the recommended consolidation (not executed — documentation only).

Nostr is not a third-party SDK in this codebase — every type
(`NostrEvent`, `NostrTag`, relay/crypto/signature types) is this repo's own,
hand-rolled, with no external Nostr package dependency. Whether Nostr
counts as "generic transport" or "Messenger-specific" was an open question
at the start of the original arc; the audit resolved it empirically: Nostr
is consumed by the live messenger and, before that arc's fix, was also
consumed directly by the dormant commerce prototype — see the Commerce
section below. It is not consumed by anything that would make it a true
core-generic seam today (no second, non-Nostr transport exists to abstract
against — only competing Nostr-specific implementations, per the
consolidation plan above), so it stays classified as a **Messenger
adapter**: `src/os/messenger/adapters/nostr/` (physically populated as of
the Messenger migration, `4132a500`) plus the still-unconsolidated
`src/os/messenger/desktop/` top-level files — see
`MESSENGER-MIGRATION-MAPPING.md` for the historical move record and
`NOSTR-CONSOLIDATION-PLAN.md` for what remains.

**The one enforced exception:** `src/os/commerce/catalog/adapters/nostr/`
(`bridge.ts`'s `productFromEvent`, all of `classify.ts`) is the only place
under `src/os/commerce/` allowed to import `src/nostr/types.ts` directly —
these two functions take a raw `NostrEvent` to classify it onto a product,
which is adapter work, not catalog domain logic. Every other file under
`src/os/commerce/` is hard-forbidden from importing `src/nostr/` by
`test/architecture_boundary_commerce.test.ts`. This is a real, working
instance of the "domain code depends on a Port or stays inside a reserved
adapter directory" rule, not just a documented aspiration — see
`COMMERCE-ARCHITECTURE.md` for the before/after.

## Telegram

**Status: does not exist anywhere in this repository. No code was written
for it this arc — only a reserved location.**

`src/os/commerce/support/adapters/telegram/` holds a `README.md` and
nothing else. When a real Support domain and a real Telegram channel
adapter are eventually built, the adapter goes here — composing a
`MessagingPort`/`ConversationPort` (from `src/os/core/ports/`) with the
Telegram Bot API — and `src/os/commerce/support/`'s own domain code must
never import a Telegram SDK type directly.
`test/architecture_boundary_commerce.test.ts` checks this mechanically: any
future import specifier containing "telegram" (case-insensitive) anywhere
under `src/os/commerce/` outside this one directory fails the build.

## BTCPay

**Status: does not exist anywhere in this repository. No code was written
for it this arc — only a reserved location.**

`src/os/commerce/payment/adapters/btcpay/` holds a `README.md` and nothing
else. `src/os/commerce/payment/types.ts` already defines the
`PaymentProvider`/`PaymentRequest`/`PaymentDecision` contract (carried
forward, unmodified, from the pre-pivot prototype — still "NOT
IMPLEMENTED, ON PURPOSE"); a future BTCPay adapter implements
`PaymentProvider` from inside this reserved directory rather than
`src/os/commerce/payment/`'s own domain code learning any BTCPay-specific
type. Same mechanical enforcement as Telegram, for the literal substring
"btcpay".

## Tor / Onion routing

**Status: does not exist anywhere in this repository — design notes only.**
`docs/fedos_onion_like_routing.md` is explicitly disclaimed by its own text
as research/design notes, not an implementation, and not a Tor alternative
(a prior arc's own finding: "onion corpus is 6,050 lines of zero code" —
i.e. all of it is documentation, no source).
`src/os/messenger/onion/` is a reserved, empty directory (README only) for
if/when a real implementation is built. No adapter or Port was written for
it this arc — there is nothing yet to give a contract shape to.

## Local AI

**Status: does not exist anywhere in this FedOS repository.** The only
"Local AIP" artifact on disk is an untracked, independently `.git`-rooted
directory (`LOCAL AIP - コピー/`) sitting alongside this repo, imported by
nothing under `src/`. It is out of scope for this arc — wiring a real
local-AI integration into FedOS would be a separate, explicitly-scoped arc
against that other repository, not a file move here.

What this arc did instead: `src/os/core/ports/local_ai_provider.ts` defines
a generic `LocalAIProvider` interface (an `isAvailable()`/`complete(prompt,
context)` shape) as a **pure contract, with zero implementation** — a
placeholder seam matching the kickoff brief's `os/core/local_ai` candidate,
so a future integration (whether general-purpose or
Commerce-Support-specific) has a Port to implement rather than inventing
one under time pressure. Nothing calls this interface today. The
previously-validated safety pipeline concerns named in the kickoff brief
(hallucination guard, multi-turn context, deterministic authority rules)
do not apply here — there is no implementation in this repository to
preserve or risk breaking.

## Electron

**Status: real, live composition root — already isolated by prior
convention, unchanged by this arc.**

`packages/fedos-desktop-electron-spike/` is Electron's only foothold in
this codebase: `BrowserWindow`, `ipcMain`/`ipcRenderer`, `contextBridge`,
`Notification`, and every other Electron API live only inside this
package's `main`/`preload`/`renderer` files. `src/desktop/host_boundary/`
(`FedosDesktopHostPort`) already exists as a framework-neutral host
contract with no Electron types named in its signature — the electron-spike
package's `FedosDesktopHostBridge` is its one concrete implementation. This
arc did not touch this boundary; it is flagged here as the existing
adapter pattern the Messenger physical migration (follow-up arc) should
extend, not replace, when `src/desktop/` moves into `src/os/messenger/desktop/`.

## Summary table

| Adapter | Exists? | Location today | Enforced by |
|---|---|---|---|
| Nostr | Yes, real, live | `src/nostr/`, `conversation/delivery/nostr/`, `conversation/transport/` (Messenger, not yet physically moved); `src/os/commerce/catalog/adapters/nostr/` (Commerce, moved this arc) | `architecture_boundary_commerce.test.ts` (Commerce side) |
| Telegram | No | Reserved: `src/os/commerce/support/adapters/telegram/` | `architecture_boundary_commerce.test.ts` (SDK-name leak check) |
| BTCPay | No | Reserved: `src/os/commerce/payment/adapters/btcpay/` | `architecture_boundary_commerce.test.ts` (SDK-name leak check) |
| Tor/Onion | No | Reserved: `src/os/messenger/onion/` | none yet — nothing to enforce against |
| Local AI | No (this repo) | Contract only: `src/os/core/ports/local_ai_provider.ts` | none yet — nothing to enforce against |
| Electron | Yes, real, live | `packages/fedos-desktop-electron-spike/` (unchanged) | pre-existing repo convention (package isolation), not a new test this arc |
