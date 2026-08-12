# FedOS — Architecture

This document describes the real, current architecture of the shipped
product: **FedOS Desktop**, a focused end-to-end encrypted Direct-message
Secure Messenger. It consolidates the FedOS Secure Runtime Architecture
Conformance Review V1 (`17c6cef6`), the Desktop Beta external security
audit preparation package (`8e730f25`) and its Alpha 8041-8120 delta
(`6873d24f`), the Dead Runtime Paths / Production-Path Consolidation V1
review (`ad3c400e`), and this repository's own landed source, re-verified
against current `master`. See `docs/secure_runtime_documentation_consolidation_v1_review_index.md`
for exactly which historical finding fed which paragraph below.

## Two products in one repository

This repository contains **two, mostly disconnected products**:

1. **The original vision** (`"nostr-window"`, still the root `package.json`
   `name` and this package's own `@nostr-window/...` scope): a
   Reddit-style window into Nostr, targeting a Cloudflare Workers + D1 +
   KV + R2 deployment (`src/worker.ts`). No deploy path for it currently
   exists in this repository (no `wrangler.toml`, no deploy script).
2. **The shipped product** (what actually ships and what this document
   describes): **FedOS Desktop**, an Electron application under
   `packages/fedos-desktop-electron-spike/`, built on a private-messaging
   "Secure Runtime" that was deliberately pivoted to at Stage 996-997 of
   this repository's history, away from the original broader vision.
   `README.md`'s own opening section explains this pivot; `ROADMAP.md`
   records what of the original vision remains a live future option.

Board, Marketplace, Commerce, Creator, Payment, Promotion, Community, and
Federation code all exist somewhere in this repository's history as
real-but-dormant scaffolding from before the pivot. **Commerce is now a
partial exception**: as of the Commerce E2E Completion arc, a real Order →
TEST/LOCAL payment → Delivery → signed Trust receipt vertical slice under
`src/os/commerce/` is wired into the Desktop UI and reachable from the
shipped Electron app (see `README.md`'s "Commerce" section and
`docs/commerce/FEDOS-COMMERCE-END-TO-END.md`) — a real payment rail,
Nostr publication of Commerce events, and reputation/persona UI remain
unwired. Board, Marketplace, Creator (beyond what Commerce reuses),
Promotion, Community, and Federation remain fully dormant and never wired
into the Desktop UI. Treat any other reference to them elsewhere in this
repository's docs as historical, not shipped, unless that doc says
otherwise.

## The shipped product's real architecture

### Boundary layering

```
OS / Electron main process
  └─ contextIsolation:true, sandbox:true, nodeIntegration:false
  └─ preload script exposes a small, fixed set of contextBridge globals
       (window.fedosApp — production; window.fedosAcceptance — test-only,
       see "Two preload bridges" below)
  └─ IPC (ipcMain.handle / ipcRenderer.invoke), one channel per command
       (not a single generic dispatcher)
       │
       ▼
FedosDesktopApplicationShell (packages/.../src/desktop/shell/)
  └─ the ONE composition point behind the preload bridge; owns no crypto,
     delegates every mutating call to the Runtime layer below
       │
       ▼
FedosDesktopRuntime (src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts)
  └─ the ONE assembly point wiring: Profile/Master Seed, Device Registry
     & Trust, Conversation Runtime (Direct Ratchet + NIP-17 delivery),
     Archive, Search, Identity Transition, Deletion Request, Safety
     Center, Device Pairing, Settings
       │
       ▼
WASM crypto boundary (packages/fedos-core-rust/, cdylib via wasm-bindgen)
  └─ #![forbid(unsafe_code)] unconditional; SecretHandle (pub(crate)-only
     container, no Clone/Debug/Serialize) is the only way secret bytes
     cross this boundary; three narrow, named accessors expose bytes to
     JS for signing/derivation operations, never a raw getter
```

### Domain model

- **Conversation** (`src/os/messenger/conversations/`) — Direct (1:1) conversations use
  a real Double-Ratchet session per conversation (this codebase's own
  FedOS-protocol implementation, not the Signal Protocol library) over
  NIP-17 (Nostr gift-wrapped Direct messages), with an authenticated
  route-binding field inside the encrypted Rumor content for same-peer
  multi-conversation routing — a proprietary, additive extension to
  standard NIP-17, not a new NIP. Group conversations are **independent
  pairwise Double-Ratchet fanout** (N separate 1:1 sends of the same
  plaintext), not a group ratchet and not Sender-Key — see
  `KNOWN_LIMITATIONS.md` for the receive-side gap this implies.
- **Device** (`src/os/messenger/device/`) — an event-sourced Device Registry
  (`FedosDeviceBindingV1` records: deviceId, accountRef, trustState,
  devicePublicKeyRef), a per-Device signing keypair independent of the
  account's Master Seed, and a real BIP-340/Schnorr pairing
  offer/approve/complete protocol (`FedosDevicePairingFacade`) — reachable
  through the real Devices screen as of Secure Runtime Alpha 8201-8280.
  Trust is always a LOCAL fact per Device; there is no cross-Device
  Registry synchronization.
- **Archive / Search** — Archive export/restore is retention-gated;
  Search is a plaintext, in-memory-only keyword index over messages you
  have actually opened (never persisted to disk, never an encrypted
  blind index — a disclosed limitation, not a defect).
- **Identity Replacement / Signed Deletion / Safety Center** — Identity
  rotation uses a Replacement model (a new identity supersedes the old
  one; the old identity is never mutated in place), not a Rotation model
  — a deliberate decision recorded in this repository's own identity
  review history. Both surface as inboxes nested inside the real Safety
  Center screen.
- **"Capability" is two unrelated concepts** in this codebase, by
  deliberate naming choice, not confusion: `src/os/messenger/conversations/capability/`
  (invitation/membership authorization tokens) is unrelated to Direct
  Ratchet "Peer Capability" (per-peer negotiated feature capabilities).

### Two preload bridges — by design, not oversight

`window.fedosApp` is the real, always-present production bridge every
ordinary screen calls. `window.fedosAcceptance` is a second bridge,
exposed only when `FEDOS_ELECTRON_BETA_AUTOTEST` is set to a recognized
test mode, carrying a wider, lower-level command vocabulary the test
harness uses to drive scenarios no ordinary user screen needs directly.
Its production absence is structurally guard-tested (real subprocess
check of `typeof window.fedosAcceptance`), not merely a convention.

### `create_runtime.ts` / `AppRuntime` — a real, harmless fossil

`src/runtime/create_runtime.ts`'s `AppRuntime.initializeCrypto()` always
returns `{allowed:false, initialized:false, reason:"PrototypeDisabled"}`
and has done so unchanged since long before the pivot. It is reachable
only from `src/worker.ts` (the original product's own entry point, which
has no deploy path) and from ~295 test files — **never** from the shipped
Desktop app, which imports exclusively from
`src/os/messenger/desktop/production_activation/`. Recommended treatment (from the
Dead Runtime review, not implemented by that read-only review nor by any
later Arc as of this writing): a narrow naming/discoverability fix so a
new contributor doesn't mistake it for the real crypto entry point —
explicitly **not** deletion, since ~295 tests still exercise it and its
own domain logic is real and self-consistent, just disconnected from the
shipped product.

A second, narrower instance of the same "real but disconnected" class:
`fedos_desktop_runtime.ts` calls both the canonical crypto-graph resolver
(the one that matters) and a second, superseded
`assembleFedosConversationProductionCryptoGraph()` /
`FedosWasmLoaderSkeleton` resolution on every real startup, with zero
external readers of its result. Executes on every launch, has no
observable effect — a safe, narrow cleanup candidate, not a bug.

## Threat model summary

Full detail lives in the (unmerged, docs-only) external security audit
preparation package, `8e730f25` — this is the canonical trust-boundary
map it documents, re-stated here since that package has not been merged
to `master`:

| Boundary | Enforcement | Caveat |
|---|---|---|
| OS ↔ Electron main | OS process isolation | compromised OS/kernel/hypervisor out of scope |
| Renderer ↔ main (IPC) | `contextIsolation`, `sandbox`, fixed command set | no generic dispatcher; each channel is a named, typed command |
| Account signing authority ↔ Device | per-Device signing keypair, independent of Master Seed | pairing approval is a local fact, not cross-Device-verified |
| Local ↔ Relay | NIP-17 gift-wrap encrypts content | Relay/network observers see who messages whom and when — see `SECURITY.md` |
| Peer Device ↔ local | Double Ratchet forward secrecy + PCS | Direct conversations only; group fanout has neither |
| Counterparty ↔ local | Ratchet session establishment | Device-signature evidence checked on session reset, best-effort, not at initial establishment |
| Disk ↔ memory | `SecretHandle`, zeroize/secrecy crates | no OS-level `mlock`/`VirtualLock`; best-effort JS-side clearing on lock, not a guaranteed erasure |

Crypto primitives in production use: ChaCha20-Poly1305, AES-256-GCM
(present in the dependency graph; confirm reachability if auditing),
HKDF-SHA256, Argon2id, secp256k1/k256 (Schnorr signatures only — no
ECDSA), a CSPRNG (`getrandom`), `zeroize`/`secrecy`/`subtle` for
constant-time and best-effort-erasure handling, `wasm-bindgen` for the
JS/Rust boundary. All from the RustCrypto/dalek/rust-random ecosystem;
none of this codebase's own use of them has had an independent external
audit.

## What's well-conformant (not just gaps)

The Architecture Conformance Review found zero FAIL rows across every
freeze/acceptance gate it checked, at the commit it reviewed. Real bugs
were caught and fixed pre-ship by genuine vertical-slice tests (a Ratchet
header overflow, a send-counter reset bug, a deletion-authority
hardcoding bug, three Peer Capability bugs, an Identity Transition
restart-persistence bug, a duplicate Device Registry construction bug —
this document does not re-litigate each, they are historical and fixed).
`SecretHandle`'s extension mechanism, Electron-over-Tauri (a real staged
design decision, not a reversal), and the release engineering pipeline
(channel policy, checksums, secret-scanning — see `BUILDING.md`) were all
rated as fully meeting their own original design goals.

## Historical note on this document's sources

The Architecture Conformance Review (`17c6cef6`) was written against a
much earlier commit than current `master`, before the full Secure Runtime
lineage (Alpha 931 through Alpha 7960) was landed. Its list of "8 of 14
subsystems exist only on unmerged branches" and "691 commits ahead of
master, never merged" is **stale** — that lineage landed at Alpha
7961-8040 (`81b5f0d1`). Its structural/architectural description (the
layering, the WASM boundary, the domain model, the two-bridge design) is
NOT time-bound and remains an accurate description of current `master`,
independently re-confirmed while writing this document. Its one
non-stale product finding — `redeemInvitation()` is a permanent stub, so
conversation acceptance is automatic real-time delivery only, never a
manual paste/import flow — is still true on current `master` and is
recorded in `KNOWN_LIMITATIONS.md`.
