# Third-Party Inventory

Third-party *services, infrastructure, and runtimes* this product
depends on at build time or run time — distinct from the code-level
dependency/license inventories in
[`10_dependency_manifest.md`](10_dependency_manifest.md),
[`14_sbom.md`](14_sbom.md), and
[`15_license_inventory.md`](15_license_inventory.md). An external auditor
assessing supply-chain and operational trust boundaries needs this list
separately, since "which packages does it import" and "which outside
parties does it actually talk to or rely on" are different questions.

## Runtime third parties (what the shipped application itself relies on while running)

| Party | Role | Trust posture |
|---|---|---|
| **Nostr Relay(s)** (user-configured `wss://`/`ws://` endpoints, operator identity not fixed by this project) | Message/invitation transport | **Untrusted for confidentiality** (NIP-44/NIP-17 encryption assumes this); **partially trusted for availability/ordering** (no relay-side replay/censorship resistance beyond NIP-01 itself). A Relay operator can observe who-messages-whom-and-when (traffic metadata) even though content is encrypted — disclosed plainly in `SECURITY.md`. No default Relay is bundled or hardcoded — the user must supply their own, so this project itself does not designate a specific third-party operator to trust. |
| **Electron / Chromium / Node.js runtime** (bundled inside the packaged app via `electron@43.1.1`) | Hosts the entire application (main process + renderer) | Fully trusted — a compromise of the Electron/Chromium/Node runtime itself is **explicitly out of this application's own protection boundary** (`SECURITY.md`: "a compromised operating system, kernel, hypervisor... is entirely outside this application's protection boundary"). |
| **Windows OS** (the only supported platform, `minimumSupportedPlatform: "windows-x64"`) | Process isolation, filesystem, `Notification`/tray APIs, SmartScreen reputation gating on first run | Trusted for the same reason as Electron above — no application-level defense against a compromised OS is claimed. |

**No cloud service, analytics/telemetry endpoint, crash-reporting
service, CDN, font-loading service, or ad/tracking network is contacted
by the shipped application** — confirmed by this bundle's own
(`01_architecture.md`) trust-boundary mapping and by the absence of any
`fetch`/`XMLHttpRequest`/analytics-SDK import outside the Nostr Relay
WebSocket transport itself (not independently re-grepped fresh this
specific pass — carried from prior review work, flagged as worth a fresh
grep in [`19_reviewer_checklist.md`](19_reviewer_checklist.md)).

## Build-time third parties

| Party | Role | Notes |
|---|---|---|
| **npm registry** (`registry.npmjs.org`, implicit) | Source of all 378 resolved npm packages across both `package-lock.json` files | Both lockfiles are committed/tracked — a build does not need live registry trust for *which* versions to use, only to fetch the already-decided bytes (registry compromise could still serve different bytes for a pinned version+integrity-hash pair; npm's own `integrity` field in the lockfile is the actual defense here, not re-verified independently by this bundle). |
| **crates.io** (implicit) | Source of all 82 resolved Rust crates | **No committed `Cargo.lock`** (deliberate policy) — unlike npm, a Rust build's dependency *versions* themselves are not pinned by a tracked file, only by the range constraints in `Cargo.toml` plus the separately-pinned-by-hash graph recorded in `docs/secure_runtime_alpha_8121_8200_cargo_lock_policy_decision.md` and reproduced in [`12_hashes.md`](12_hashes.md). This is a real, disclosed, greater reliance on crates.io/registry-index good behavior than the npm side has. |
| **`wasm-bindgen-cli`** (external binary, installed via `cargo install`, not itself a `Cargo.toml` dependency) | Post-processes the compiled `.wasm` into JS-callable glue | Version-pinned by convention (must match the `wasm-bindgen` crate version exactly, `0.2.126` — confirmed matching in this environment, [`08_version_manifest.md`](08_version_manifest.md)); a mismatch is a documented historical failure mode (`docs/runtime_wasm_bindgen_version_policy.md`), not itself a security risk. |
| **Windows SDK `signtool.exe`** (optional, only relevant if/when code signing is configured) | Would perform Authenticode signing | Not currently used — no certificate is configured (see [`13_release_artifact_inventory.md`](13_release_artifact_inventory.md)). |
| **7-Zip (`7za.exe`, cached binary)** | Used by the release pipeline's ZIP-building step | `BUILDING.md` discloses this has shown transient crashes (`0xC0000005`) resolved on retry — a build-tooling flakiness note, not a security finding. |
| **GitHub / any CI service** | — | **None configured** — confirmed this pass (`find .github -type f` and a repo-root scan for `*.yml`/`*.yaml` CI configs both return zero matches). Every build/test/release run to date has been a local, manual, human- or agent-invoked process. This means: no CI-runner supply-chain exposure (no third-party-hosted build minutes, no CI-secret-exfiltration surface) today, but also no automated, reproducible-on-every-push build/test gate exists — a real trade-off worth naming for an auditor assessing release-process maturity, not only security surface. |

## Explicit non-dependencies (named because the product's own history could
suggest otherwise)

- **Cloudflare Workers/D1/KV/R2** — named in the product's own original,
  broader "Reddit-style window into Nostr" vision (`README.md`'s
  "Original project vision" section) but **no code for any of it exists
  in this repository** at `68e7be16`. Not a third party this build
  actually depends on today.
- **Signal Protocol / libsignal** — `SECURITY.md` explicitly disclaims
  any relationship: "'Double Ratchet' here means this codebase's own
  FedOS protocol implementation... it is not the Signal Protocol library,
  and it is not interoperable with Signal."
- **Any third-party identity/authentication provider (OAuth, SSO, etc.)**
  — none exists; account identity is a locally-generated Nostr keypair
  sealed by a local passphrase, with no external identity-provider
  dependency of any kind.
