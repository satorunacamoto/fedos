# Electron Dependency and Desktop Packaging V1 — Specification Review

Review only. No production source, README, `package.json`,
`package-lock.json`, or `Cargo.toml` change is made anywhere in this
review. Every file this review adds lives under
`docs/reviews/electron_dependency_packaging_v1/` or
`test/reviews/electron_dependency_packaging_v1/`; every test inspects
real, unmodified, currently-checked-out source and never asserts that any
future implementation (Electron or otherwise) already exists. `p2p/` and
`.tmp_gen/` are untouched, as are Ontology/Humanizer/AI/Sender-Key/Device
Transfer code — none of that source is read or referenced anywhere in
this review.

## Base commit and branch reconciliation

This review's own worktree (`review/electron-dependency-packaging-v1`) is
branched directly from `arc/desktop-electron-host-boundary` @ `7b72a3e`
(the Desktop Host Boundary Foundation Arc) — no merge was required. Every
precondition this review's own task names (Desktop Local Runtime, Desktop
Application Shell, Desktop Conversation Content Accessor, Desktop
Presentation/ViewModel boundary, Desktop Renderer boundary, Archive CLI
executable) is real source on this SAME base, verified directly (`01`),
not inferred from commit titles. `src/sync/` (the "Device Runtime"
precondition, named as an optional neighboring capability) is confirmed
present but wired into nothing reachable from the Desktop Host stack —
treated as an inert neighbor throughout this review (`01`).

## The one finding every other document in this review is downstream of

**No Electron dependency exists anywhere in this repository** —
confirmed by direct inspection of `package.json`, `package-lock.json`,
and a fresh `node_modules` install in this exact worktree (`01`). The
repository's own Desktop stack (Runtime → Shell → ViewModels → Renderer →
framework-neutral Host Bridge) is real, complete, and already
Electron-agnostic by design (`FedosDesktopHostPort` names nothing
Electron-specific) — this review evaluates whether and how Electron
should become its first concrete adapter, and installs nothing.

## How to navigate the 20 documents

| # | Document | Answers |
|---|---|---|
| 01 | `01_current_desktop_stack_inventory.md` | Real inventory of Runtime/Shell/ViewModels/Renderer/Host, build scripts, dependencies, Node requirements; confirms Electron's absence |
| 02 | `02_product_host_requirements.md` | Separates evidenced requirements (filesystem access, eventually a window) from unevidenced assumptions (tray, notifications, deep links, auto-start) |
| 03 | `03_options_comparison.md` | A–F compared against the actual TypeScript/Rust repository |
| 04 | `04_electron_dependency_blast_radius.md` | The real, unminimized cost across package.json, build, test tooling, CI, artifact/install size |
| 05 | `05_process_model.md` | Minimum accepted main/preload/renderer split and ownership |
| 06 | `06_ipc_command_boundary.md` | One channel, named preload methods, main-process validation; rejects arbitrary channels/generic invoke |
| 07 | `07_ipc_response_boundary.md` | Reuses the existing `FedosDesktopHostResponse<T>` verbatim — already JSON-safe, already tested |
| 08 | `08_electron_security_configuration.md` | Minimum mandatory settings table; confirms every real requirement is compatible with the strictest settings |
| 09 | `09_filesystem_authority.md` | Recommends a native file picker over the current validated-path-string model |
| 10 | `10_secret_input_and_master_seed_unlock.md` | Names the real, unresolved secure-unlock-input gap honestly; corrects the "native secure prompt" assumption |
| 11 | `11_local_data_location.md` | Real vs. non-existent data locations; most of the config model needs no change |
| 12 | `12_packaging.md` | Declines to select a packaging tool; recommends a portable build as the first milestone |
| 13 | `13_windows_path_and_onedrive_risks.md` | The real, observed Windows/OneDrive/path environment and its risks |
| 14 | `14_code_signing_and_distribution.md` | Distinguishes application/installer signing from this codebase's own unrelated Nostr/message signing |
| 15 | `15_updates.md` | Recommends no auto-update for V1 |
| 16 | `16_logging_and_crash_reports.md` | Local-only, secret-redacted, no automatic telemetry |
| 17 | `17_threat_model.md` | Covers the required threat categories; states plainly what Electron cannot protect against |
| 18 | `18_testing_strategy.md` | Separates already-done unit-level tests from future packaged-app tests |
| 19 | `19_implementation_arc_packaging.md` | Packages A–D; recommends against one giant Arc given confirmed tooling uncertainty |
| 20 | `20_final_recommendation.md` | Chooses D — an Electron dependency/build spike first |

## Summary of this review's conclusions

- **No Electron code is installed or implemented by this review.** Every
  deliverable is a specification document or a source-inspecting test;
  `src/`/`package.json`/`package-lock.json`/`Cargo.toml` are untouched.
- **Electron is the technology this review recommends preparing for**,
  ahead of Tauri (whose cost lands mostly on this repository's own
  strictly-guarded Rust crate, `03`) and every other option compared —
  but NOT by installing it directly. The real, confirmed tooling
  uncertainty (no bundler, no CI, a step-change dependency addition)
  means the smallest safe next step is a build/tooling SPIKE (`19`
  Package A), not a full implementation Arc.
- **A separate, equally real blocker exists independent of this
  decision**: no secure Master Seed passphrase-input boundary exists
  anywhere in this stack (`10`). It does not block the recommended
  spike, but it DOES block any future renderer page that wants to expose
  Archive/production-crypto features interactively, and is named here so
  it is not silently assumed solved.
- **Every existing security/response/command guarantee this stack already
  built (Alpha 3081-3160 through 3561-3640) survives an Electron adoption
  unchanged** — the IPC command/response boundaries (`06`/`07`) are
  reuses, not redesigns, of what already exists and is already tested.
