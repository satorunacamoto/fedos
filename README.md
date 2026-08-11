# FedOS

**A local-first, privacy-oriented toolkit for messaging, commerce,
pseudonymous identity, signed credentials, QR proofs, and
offline-verifiable trust — built in the open, on Nostr.**

[![CI](https://github.com/satorunacamoto/fedos/actions/workflows/ci.yml/badge.svg)](https://github.com/satorunacamoto/fedos/actions/workflows/ci.yml)
[![License: MPL 2.0](https://img.shields.io/badge/License-MPL%202.0-brightgreen.svg)](LICENSE)

> ⚠ **Experimental, unaudited software.** FedOS Desktop — the one
> application actually shipped from this repository — is in a small
> **Closed Pilot**, not a public beta or a finished product. **No
> independent security audit has ever been performed.** Windows
> artifacts are unsigned, so SmartScreen will likely warn you. Do not
> use it for irreplaceable secrets or high-risk operational work. Full
> detail: [`docs/pilot/KNOWN_RISKS.md`](docs/pilot/KNOWN_RISKS.md).

## What it is

FedOS is **local-first** and **fully open source (MPL-2.0)**, in full,
unconditionally — there is nothing paywalled or crippled about the OSS
tree. There is **no mandatory FedOS server or API**: messaging runs over
Nostr relays you choose, and every Trust artifact (a signed credential,
entitlement, or QR proof) verifies entirely offline, on your own
machine, with no network call anywhere in that verification path.

- **Messenger** — a real, shipped, end-to-end encrypted 1:1 messenger
  over Nostr **NIP-17**. This is **FedOS Desktop**, the one application
  in this repository you can actually install and run today.
- **Trust** — signed envelopes, pseudonymous credentials,
  proof-of-possession, capability grants, and offline-verifiable
  subscription entitlements and contract-artifact proofs, all
  verifiable without a network call. See ["Trust / Signed
  QR"](#trust--signed-qr) below.
- **Commerce** and **Core** — real, tested code that lives in this
  repository (see "What works today" just below) but is **not yet
  wired into the shipped desktop app**.

**FedOS Desktop Messenger is the one shipped product; Core, Messenger,
Commerce, and Trust are the repository's underlying capabilities, at
different readiness levels.** Don't assume Commerce or Trust are
reachable from the app you install just because their code exists here
— "What works today" states exactly what's wired to what.

## What works today

FedOS's source is organized into four capabilities under `src/os/`, at
very different stages of readiness. Read this before assuming any
capability besides Messenger ships in the app you install.

### Core (`src/os/core/`)

The foundation the other capabilities sit on: identity, cryptography, and
settings primitives, plus a `ports/` seam other capabilities are meant to
talk through instead of importing each other's internals directly.
Identity and crypto are live and used throughout the shipped app;
settings is live for the desktop app. `storage/` and `vault/` also live
in this directory but currently have no production consumer anywhere in
the repository — present, not wired to anything yet, not deleted. See
`docs/architecture/CAPABILITY-MAP.md` for the measured ownership picture.

### Messenger (`src/os/messenger/`) — the real shipped product

This is what FedOS Desktop actually is today: direct (1:1) encrypted
conversations over Nostr NIP-17, NIP-44 v2 encryption inside a NIP-59
gift wrap, plus invitations, search, archive, multi-device pairing,
identity replacement, and signed deletion. A real Double Ratchet
implementation exists and is exercised by the test suite, but it is
**not** the delivery route the pilot build uses by default — see "What it
currently does" below and [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md).
This is the only one of the four capabilities reachable from the packaged
Electron app.

### Commerce (`src/os/commerce/`)

Real code — a product catalog, a `PaymentProvider` seam with two
no-charge implementations, a protocol-neutral marketplace/creator model —
carried forward from FedOS's pre-pivot prototype (`"nostr-window"`).
**Not reachable from the shipped FedOS Desktop app:** none of it is wired
into the packaged Electron app's runtime, IPC surface, or build tsconfigs.
It is inert scaffolding, not a stub — the code is real and exists to give
this prototype-era capability a proper home, but nothing in the product
you install calls it. See `src/os/commerce/README.md`.

### Trust (`src/os/trust/`)

Real, newly written, tested code — signed envelopes, subscription
entitlements, pseudonymous credentials, proof-of-possession, capability
grants, contract-artifact proofs, and signed-QR encode/decode, all local
and offline with no network calls anywhere in the directory (see
`test/trust_*.test.ts`, `test/architecture_boundary_trust.test.ts`).
**Also not reachable from the packaged Electron app** — nothing in the
app's entry tsconfigs or its runtime composition root references it yet.
The one real, runnable entry point today is a standalone CLI:
`npm run trust:issuer -- <subcommand>`. See `src/os/trust/README.md` and
[`docs/architecture/TRUST-MODEL.md`](docs/architecture/TRUST-MODEL.md).

---

## Architecture

[`ARCHITECTURE.md`](ARCHITECTURE.md) has the full system design,
trust-boundary map, and primitive inventory for the shipped product.
[`docs/architecture/`](docs/architecture/) holds the deeper design
documents, including
[`docs/architecture/TRUST-MODEL.md`](docs/architecture/TRUST-MODEL.md),
[`docs/architecture/OFFLINE-MONETIZATION-MODEL.md`](docs/architecture/OFFLINE-MONETIZATION-MODEL.md),
and
[`docs/architecture/CAPABILITY-MAP.md`](docs/architecture/CAPABILITY-MAP.md).

## Quick start

Build from source, run the packaged app, and confirm the test suite is
green. This is the condensed path — full detail, including
pilot-participant install steps, SmartScreen handling, and checksum
verification, is in [`BUILDING.md`](BUILDING.md) and
[`docs/pilot/INSTALLATION.md`](docs/pilot/INSTALLATION.md).

### Install

```sh
npm ci                       # install from lockfile
npm run build:wasm           # Rust -> WebAssembly core
```

Pinned toolchain: **Node 24.x**, **npm 11.12.1**, **Rust 1.95.0**
(`rust-toolchain.toml`), **wasm-bindgen 0.2.126**.

### Run

```sh
npm run release:electron-beta   # unsigned installer + portable ZIP
```

For a development run instead of a packaged build, see
[`BUILDING.md`](BUILDING.md#building-the-electron-app-for-development) for
the `build:beta-runtime` → `build --prefix packages/fedos-desktop-electron-spike`
→ `start:electron-beta` sequence, including a known footgun around
browser-context renderer files and the two-pass `tsc` build.

### Test

```sh
npm run test:current
```

This is the **current supported test surface** — architecture boundary
guards, the cycle detector, the Trust capability's own suite, and every
other test whose import graph touches current, shipping source (as
opposed to the dead `src/os/_legacy_prototype/` tree). It is expected to
be, and is verified to be, **100% green** (132 files / 1902 tests as of
this writing).

Plain `npm test` also exists and runs the FULL historical suite (~1198
files) — a chronological archive of every prior development arc's own
regression guards, going back to this project's earliest stages. It is
**not** the "is this repo healthy" signal for a new contributor: it
currently reports several hundred failing tests, almost all of them
stale hardcoded exact-count snapshots (e.g. "Rust has exactly N `pub fn`"
assertions written years before the codebase legitimately grew past that
count) rather than real functional regressions. See
[`docs/release/TEST-SURFACES.md`](docs/release/TEST-SURFACES.md) for the
full three-way breakdown (current supported / historical regression /
known legacy failures) and the honest current failure count.

Also relevant:

```sh
npm run typecheck                                              # root + electron-spike package
cargo test --release --manifest-path packages/fedos-core-rust/Cargo.toml
npx vitest run --config vitest.electron-spike.config.ts --no-file-parallelism
                                                                # packaged-app acceptance tests;
                                                                # serialize to avoid Windows
                                                                # resource-contention flake
```

A large historical/legacy test surface also exists in this repository
(much of it exercising the pre-pivot prototype product, `src/worker.ts`
and its own dependency tree, rather than the shipped Messenger) and is
**not** expected to be 100% green. *(Note: where exactly that
legacy-vs-current split gets documented is also part of the parallel
documentation workstream referenced above; this README will be updated
with a direct pointer once that document lands.)* Before trusting any test
result, read [`BUILDING.md`](BUILDING.md)'s "single most common false
regression" section — the compiled Rust/WASM core is not committed, and
without it real-crypto suites silently skip rather than fail.

## Trust / Signed QR

FedOS's Trust capability (`src/os/trust/`) is a standalone, offline,
signed-artifact toolkit — usable today via its own CLI even though it
isn't yet wired into the desktop app (see "What works today" above). It
covers: `SignedEnvelope`s, pseudonymous credentials, proof-of-possession,
capability grants, offline-verifiable subscription entitlements, signed
QR encode/decode, and contract-artifact proofs. Every one of these
verifies **entirely locally, with no network call** — see
`test/trust_*.test.ts` and
[`docs/architecture/TRUST-MODEL.md`](docs/architecture/TRUST-MODEL.md).

**FedOS Official is one optional issuer, not a universal root of
trust.** A verifier chooses which issuer key(s) to trust; nothing about
FedOS's design privileges FedOS Official's key over anyone else's
self-run issuer.

### Verify a credential or QR

Every signed artifact FedOS's Trust capability produces — a subscription
entitlement, a pseudonymous credential, a proof-of-possession response —
shares one verification path: construct a `TrustPolicy` naming which
issuer key(s) you trust, then verify the envelope against it, entirely
locally. `src/os/trust/README.md`'s own "Example: self-signed round trip"
walks through generating a keypair and verifying an entitlement end to
end. For the subscriber-facing walkthrough of importing and verifying a
FedOS Official-issued entitlement specifically (file or QR), see
[`docs/user/SUBSCRIPTION-ENTITLEMENT.md`](docs/user/SUBSCRIPTION-ENTITLEMENT.md).

### Create your own issuer

Anyone can run their own issuer — for themselves, their household, their
company, or their community — using the same offline signer tooling
FedOS Official itself uses. Nothing about this requires FedOS Official's
involvement or approval:

```sh
npm run trust:issuer -- generate-key --out ./issuer-key.json
```

The full operator procedure — receiving a request, verifying payment (or
skipping that step if you're not charging), signing, rotating, and
responding to key compromise — is in
[`docs/operations/OFFLINE-ISSUER-RUNBOOK.md`](docs/operations/OFFLINE-ISSUER-RUNBOOK.md).
**Before generating a production key, read that runbook's key-custody
section.** In short: generate it outside this repository and outside any
cloud-synced or version-controlled path (OneDrive, Dropbox, Google Drive,
or similar) — see `docs/architecture/TRUST-MODEL.md`'s "Official issuer
key boundary" section for exactly what's public and what must never leave
your own device.

### How the FedOS Official subscription works

FedOS itself is OSS, in full, unconditionally. **Anyone may self-sign or
operate an issuer** — self-signing your own credentials and entitlements,
and running your own issuer for yourself or your community, is the
complete product, not a trial or a crippled tier, and requires no
payment, account, or FedOS Official involvement whatsoever.

**An optional FedOS Official entitlement may be offered separately**: a
signed `fedos.subscription.v1` envelope for a stated set of scopes and a
stated validity period, issued by a human operator running an offline
CLI after manually confirming payment — no activation server, no
recurring network check after import, no hardware fingerprint, and no
usage-quota enforcement (hard usage quotas cannot be securely enforced in
a serverless, offline-verifiable model — see
[`docs/architecture/OFFLINE-MONETIZATION-MODEL.md`](docs/architecture/OFFLINE-MONETIZATION-MODEL.md)
for why, and the time/scope-bounded entitlements this design uses
instead).

**What a verified FedOS Official signature means, precisely, and no
more:** *"this public key has a valid FedOS-issued entitlement for these
scopes and this validity period."* It does **not** mean legal identity
verification, that any content the subject later signs or sends is true,
that a transaction or contract the subject participates in is safe or
legal, or any financial guarantee of any kind. This exact boundary is
defined once, canonically, in `docs/architecture/TRUST-MODEL.md`
(`FEDOS_OFFICIAL_ENTITLEMENT_MEANING_STATEMENT`) — see that document and
`docs/architecture/OFFLINE-MONETIZATION-MODEL.md` for the full design.

## Contributing

Contributions are welcome — [`CONTRIBUTING.md`](CONTRIBUTING.md) covers
licensing (MPL-2.0, inbound=outbound, no CLA/DCO), where to send what
(security reports go through GitHub Private Vulnerability Reporting,
never a public Issue or PR — see [`SECURITY.md`](SECURITY.md)), and how
to get a change accepted. Ordinary bugs and feature ideas are public
Issues; questions and design discussion are Discussions.

## No mandatory FedOS server

**There is no FedOS server or API that this software requires you to
use.** Messaging runs over Nostr relays you choose. Trust verification is
entirely local. The optional FedOS Official subscription is issued by a
human running an offline CLI, not a hosted activation service. Every one
of FedOS's free features works completely and indefinitely with zero
dependency on FedOS Official, or any server FedOS's maintainers operate,
ever being reachable.

## License

**MPL-2.0** — Mozilla Public License, Version 2.0. Full text in
[`LICENSE`](LICENSE); the decision record and exactly what it does and
does not cover (dependencies, `test-vectors/`) is in
[`LICENSE_STATUS.md`](LICENSE_STATUS.md).

## Reporting bugs and vulnerabilities

**Security vulnerabilities — never open a public Issue.**
Use **GitHub Private Vulnerability Reporting**
(*Security → Advisories → Report a vulnerability*).
Read [`SECURITY.md`](SECURITY.md) first, including its safe-first-report
checklist.

> **Repository owner:** Private Vulnerability Reporting is **off by
> default** and must be enabled in **Settings → Security** before the
> pilot is announced. Until then that channel is not live.

**Ordinary bugs** — a public Issue, using the bug report template.
**Questions and design discussion** — Discussions.

Never include a private key, `nsec`, Master Seed, passphrase, profile
directory, Archive export, message plaintext, relay credential, or any
Trust issuer private key in any report.

---

## What it currently does (Messenger, in detail)

These are implemented and exercised by the test suite — not planned:

- **Direct (1:1) encrypted conversations** over Nostr **NIP-17** private
  direct messages. Every message is end-to-end encrypted with NIP-44 v2
  inside a NIP-59 gift wrap.
- **A Double Ratchet implementation**, real and exercised by the test
  suite, for Direct conversations — **but it is not the delivery route
  the pilot build uses by default.** Ordinary sending goes over the
  plain NIP-17 route unless a build explicitly opts a conversation into
  the ratchet route, so **forward secrecy and post-compromise recovery
  are not active for ordinary pilot messages.** See
  [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md).
- **Local, passphrase-protected profile.** A Master Seed is derived with
  Argon2id and held under an explicit lock/unlock boundary; the app
  starts locked.
- **Invitations** to establish a conversation with another user.
- **Search** across your own local message history.
- **Archive** — export and restore your conversation history, gated by
  the retention rules that were in force.
- **Devices** — pair additional devices to one account, with a durable
  registration journal and revocation.
- **Identity replacement** — move to a new identity with a verifiable,
  signed transition record. (Note: *replacement*, not rotation — the
  original identity stays immutable.)
- **Signed deletion** requests.
- **Safety Center** — the app's own in-product statement of what it does
  and does not protect.
- **Relay configuration**, including handling of relays that are offline
  or unreachable.

## What it deliberately does not do

Named non-goals for this stage, not oversights:

- **No group messaging.** The UI does not expose it.
- **No anonymity and no onion routing.** FedOS does not hide your IP
  address from relays and does not attempt traffic-analysis resistance.
  **Relays can see metadata**, including which npubs are exchanging
  events and when.
- **No remote deletion.** Signed deletion is a request. It cannot reach
  into someone else's device, or a relay you do not control, and erase
  anything.
- **No Signal, Matrix, or WhatsApp interoperability.** FedOS's ratchet
  is its own integration over NIP-17. It is **not** the Signal Protocol
  and does not interoperate with Signal.
- **No telemetry, analytics, crash reporting, or auto-update.** The app
  does not phone home. Network traffic goes to the relays you configure
  and nowhere else.
- **No guaranteed erasure from RAM.** Secrets are zeroized on a
  best-effort basis. There is no `mlock`, and the OS may page memory to
  disk outside the application's control.
- **No forward secrecy for groups**, since there are no groups.

The complete, maintained list is
[`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md).

## Security model, briefly

- **Encryption happens locally**, in a Rust core compiled to
  WebAssembly. Relays see ciphertext and the metadata NIP-17 exposes.
- **Your passphrase never leaves your machine**, and there is **no
  recovery mechanism** — no key escrow, no password reset, and no
  maintainer who can restore access. **If you lose your passphrase, your
  data is gone.**
- **Relays are untrusted** for confidentiality and integrity. They are
  trusted only to relay.
- **The threat model does not include** a compromised operating system,
  malware with access to your profile directory, or physical access to
  an unlocked machine.

[`SECURITY.md`](SECURITY.md) is the full, current status.
[`ARCHITECTURE.md`](ARCHITECTURE.md) has the trust-boundary map and the
primitive inventory.

## Explicit non-guarantees

Stated plainly, because these are the claims a messenger is most often
assumed to make:

| | |
| --- | --- |
| Independent security audit | **None.** Never performed. |
| Forward secrecy for your messages | **Not active by default.** The ratchet exists; the pilot build does not route ordinary messages through it. |
| Code signing | **None.** Windows artifacts are unsigned. |
| Anonymity / IP protection | **None.** |
| Onion routing | **None.** |
| Metadata privacy from relays | **None** beyond what NIP-17 provides. |
| Signal / Matrix interoperability | **None.** |
| Group messaging | **Not exposed.** |
| Remote / server-side deletion | **Not possible.** |
| Guaranteed RAM erasure | **Not guaranteed.** Best-effort only. |
| Passphrase recovery | **None.** Loss is permanent. |
| Reproducible installer builds | **Not proven.** |
| Public Beta readiness | **Not reached.** |
| A FedOS Official subscription is required to use FedOS | **False.** See "How the FedOS Official subscription works" above — every free feature works fully without one. |

## Interface

FedOS Desktop is an Electron application with a single main window. The
current pilot build presents: first-run profile creation, an unlock
screen, a conversation list with a message view, and screens for relay
settings, invitations, search, archive, devices, identity replacement,
deletion, and the Safety Center.

*No screenshots are included here yet — the ones this repository could
honestly publish have not been captured against the current build, and a
stale screenshot is worse than none.*

## First run walkthrough (Messenger)

1. Install, or build and launch, the app.
2. **Create a profile** and choose a passphrase. Write it down somewhere
   safe — it cannot be recovered.
3. **Add at least one relay** in Settings.
4. **Send or accept an invitation** to start a conversation.
5. **Message.**

Walkthroughs for each feature live in the
`docs/desktop_beta_user_guide_*` documents.

## Documentation

| Document | What it covers |
| --- | --- |
| [`SECURITY.md`](SECURITY.md) | Security status, threat model, how to report |
| [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md) | The full honest limitations list |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System design and trust boundaries |
| [`docs/architecture/TRUST-MODEL.md`](docs/architecture/TRUST-MODEL.md) | The Trust capability's design: issuers, envelopes, rotation, key boundary |
| [`docs/architecture/OFFLINE-MONETIZATION-MODEL.md`](docs/architecture/OFFLINE-MONETIZATION-MODEL.md) | The optional FedOS Official subscription model, in full |
| [`docs/architecture/CAPABILITY-MAP.md`](docs/architecture/CAPABILITY-MAP.md) | Current vs. target shape of `src/os/*` and how the capabilities relate |
| [`docs/operations/OFFLINE-ISSUER-RUNBOOK.md`](docs/operations/OFFLINE-ISSUER-RUNBOOK.md) | How to run your own (or FedOS Official's) issuer |
| [`docs/user/SUBSCRIPTION-ENTITLEMENT.md`](docs/user/SUBSCRIPTION-ENTITLEMENT.md) | How a subscriber gets and verifies an entitlement |
| [`BUILDING.md`](BUILDING.md) | Build and release process |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to contribute |
| [`ROADMAP.md`](ROADMAP.md) | Deferred and future work |
| [`LICENSE_STATUS.md`](LICENSE_STATUS.md) | Licensing decision record |
| [`docs/pilot/`](docs/pilot/) | The Closed Pilot package |
| [`docs/ALPHA_HISTORY.md`](docs/ALPHA_HISTORY.md) | Append-only development chronology |
| [`docs/commerce/FEDOS-COMMERCE-END-TO-END.md`](docs/commerce/FEDOS-COMMERCE-END-TO-END.md) | Code-audited answer to "what happens when someone buys something with FedOS?" (short answer today: nothing — see below) |

## How a purchase flows through FedOS

A `src/os/commerce/` domain and a `src/os/trust/` capability both exist as real,
tested TypeScript — but neither is wired into the shipping Desktop app today.
There is no product screen, no order, no payment rail, and no QR/credential
handoff reachable from the running product:

```
Customer          FedOS Desktop (shipping)      Commerce domain
   |                       |                      (os/commerce)
   | look for a product -> |  no product screen    real code,
   |                       |  exists (ABSENT)       zero callers
   |                                                outside tests
```

This was verified by code inspection, not inferred from intent. Full detail,
including per-flow file:line citations, a tabletop simulation, a gap table,
and the recommended next bounded implementation arc:
[`docs/commerce/FEDOS-COMMERCE-END-TO-END.md`](docs/commerce/FEDOS-COMMERCE-END-TO-END.md)
· [`COMMERCE-E2E-SWIMLANE.md`](docs/architecture/COMMERCE-E2E-SWIMLANE.md)
· [`CUSTOMER-COMMERCE-FLOW.md`](docs/architecture/CUSTOMER-COMMERCE-FLOW.md)
· [`MERCHANT-COMMERCE-FLOW.md`](docs/architecture/MERCHANT-COMMERCE-FLOW.md)
· [`PAYMENT-FLOW.md`](docs/architecture/PAYMENT-FLOW.md)
· [`PRODUCT-SURFACE-AUDIT.md`](docs/commerce/PRODUCT-SURFACE-AUDIT.md)

## Roadmap

Near-term priorities are pilot feedback, an independent security review,
and code signing — not new features. See [`ROADMAP.md`](ROADMAP.md).

## Project history

FedOS began as **`nostr-window`**, a much broader "Reddit-style window
into Nostr" — communities, channels, digital goods, a Cloudflare-backed
hybrid architecture. That vision is **not** what ships today; the
project narrowed deliberately to a single well-scoped problem: private
1:1 messaging that works. What remained of the original vision's
commerce-shaped ideas now lives, unwired, as `src/os/commerce/` (see
"What works today" above) rather than being deleted outright.

- The original prototype's own technical reference — including its
  now-obsolete security section, which describes an entirely different,
  unencrypted product — is preserved unmodified at
  [`docs/fedos_original_prototype_reference_historical.md`](docs/fedos_original_prototype_reference_historical.md).
  **It has no bearing on the current product's security posture.** For
  that, read [`SECURITY.md`](SECURITY.md), never that document.
- The full development chronology is
  [`docs/ALPHA_HISTORY.md`](docs/ALPHA_HISTORY.md). Entries there are
  point-in-time and are not updated when later work supersedes them.
