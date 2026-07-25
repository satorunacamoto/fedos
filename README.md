# FedOS Desktop

**An end-to-end encrypted direct-message client for Windows, built on
Nostr, with a Double Ratchet session per conversation.**

FedOS is a focused secure messenger: 1:1 private conversations, and the
things a real messenger needs around them — search, archive, multiple
devices, identity replacement, signed deletion. It is not a social
client, not a feed reader, and not a group chat.

> ## ⚠ Closed Pilot — experimental, unaudited software
>
> FedOS is in a small **Closed Pilot**. It is **not** a public beta and
> **not** a finished product.
>
> - **No independent security audit has ever been performed.** The
>   cryptography has been reviewed only by its own authors.
> - **Windows artifacts are unsigned.** There is no Authenticode
>   signature, so **SmartScreen will likely warn you** when you run the
>   installer. That warning is legitimate and expected.
> - **Back up anything you care about**, outside FedOS. Data loss during
>   the pilot is possible.
> - **Do not use this build for irreplaceable secrets or high-risk
>   operational work.** If disclosure of a message would seriously harm
>   you or someone else, use something audited instead.
>
> Read [`docs/pilot/KNOWN_RISKS.md`](docs/pilot/KNOWN_RISKS.md) before
> installing.

---

## What it currently does

These are implemented and exercised by the test suite — not planned:

- **Direct (1:1) encrypted conversations** over Nostr **NIP-17** private
  direct messages, with a **Double Ratchet** session per conversation
  providing forward secrecy and post-compromise recovery.
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

## Interface

FedOS Desktop is an Electron application with a single main window. The
current pilot build presents: first-run profile creation, an unlock
screen, a conversation list with a message view, and screens for relay
settings, invitations, search, archive, devices, identity replacement,
deletion, and the Safety Center.

*No screenshots are included here yet — the ones this repository could
honestly publish have not been captured against the current build, and a
stale screenshot is worse than none.*

## Install or build

### Install (pilot participants)

Artifacts are an **unsigned NSIS installer** and an **unsigned portable
ZIP**, for **Windows x64**. They are not published in this repository —
your pilot coordinator provides them, with checksums.

Step-by-step, including SmartScreen and checksum verification:
[`docs/pilot/INSTALLATION.md`](docs/pilot/INSTALLATION.md).

### Build from source

Everything needed to reproduce a build yourself is in
[`BUILDING.md`](BUILDING.md). In short:

```sh
npm ci                       # install from lockfile
npm run build:wasm           # Rust -> WebAssembly core
npm run typecheck
npx vitest run               # TypeScript tests
cargo test --release --manifest-path packages/fedos-core-rust/Cargo.toml
npm run release:electron-beta   # unsigned installer + portable ZIP
```

Pinned toolchain: **Node 24.x**, **npm 11.12.1**, **Rust 1.95.0**
(`rust-toolchain.toml`), **wasm-bindgen 0.2.126**.

## Quick start

1. Install, or build and launch, the app.
2. **Create a profile** and choose a passphrase. Write it down somewhere
   safe — it cannot be recovered.
3. **Add at least one relay** in Settings.
4. **Send or accept an invitation** to start a conversation.
5. **Message.**

Walkthroughs for each feature live in the
`docs/desktop_beta_user_guide_*` documents.

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
directory, Archive export, message plaintext, or relay credential in any
report.

## Documentation

| Document | What it covers |
| --- | --- |
| [`SECURITY.md`](SECURITY.md) | Security status, threat model, how to report |
| [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md) | The full honest limitations list |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System design and trust boundaries |
| [`BUILDING.md`](BUILDING.md) | Build and release process |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to contribute |
| [`ROADMAP.md`](ROADMAP.md) | Deferred and future work |
| [`LICENSE_STATUS.md`](LICENSE_STATUS.md) | Licensing decision record |
| [`docs/pilot/`](docs/pilot/) | The Closed Pilot package |
| [`docs/ALPHA_HISTORY.md`](docs/ALPHA_HISTORY.md) | Append-only development chronology |

## Roadmap

Near-term priorities are pilot feedback, an independent security review,
and code signing — not new features. See [`ROADMAP.md`](ROADMAP.md).

## License

**MPL-2.0** — Mozilla Public License, Version 2.0. Full text in
[`LICENSE`](LICENSE).

MPL-2.0 is a **file-level** copyleft: modify an MPL-covered file and
that file stays MPL-2.0, but combining FedOS with your own separately
licensed files does **not** relicense them.

This covers FedOS's own code only. Dependencies keep their own licenses
([`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)), and the
third-party cryptographic test vectors under `test-vectors/` are **not**
covered by it — see [`LICENSE_STATUS.md`](LICENSE_STATUS.md) §4.

## Project history

FedOS began as **`nostr-window`**, a much broader "Reddit-style window
into Nostr" — communities, channels, digital goods, a Cloudflare-backed
hybrid architecture. That vision is **not** what ships today; the
project narrowed deliberately to a single well-scoped problem: private
1:1 messaging that works.

- The original prototype's own technical reference — including its
  now-obsolete security section, which describes an entirely different,
  unencrypted product — is preserved unmodified at
  [`docs/fedos_original_prototype_reference_historical.md`](docs/fedos_original_prototype_reference_historical.md).
  **It has no bearing on the current product's security posture.** For
  that, read [`SECURITY.md`](SECURITY.md), never that document.
- The full development chronology is
  [`docs/ALPHA_HISTORY.md`](docs/ALPHA_HISTORY.md). Entries there are
  point-in-time and are not updated when later work supersedes them.
