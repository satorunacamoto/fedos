# `src/os/messenger/desktop/` — RESERVED, highest-risk subtree

Maps 1:1 from: the rest of `src/desktop/` — 154 of its 157 files (the
remaining 3 are `desktop/notification/**`, which maps to `../notifications/`
instead). Subtrees carried over unchanged: `background/`, `badge/`, `beta/`,
`content_accessor/`, `host/`, `host_boundary/`, `navigation/`, `onboarding/`,
`presentation/` (+ its 4 feature subfolders), `production_activation/`,
`renderer/` (+ its 4 feature subfolders), `runtime/`, `settings/`, `shell/`,
`tray/`, plus the files directly under `desktop/` itself
(`websocket_relay.ts`, `node_websocket_relay_socket_factory.ts`, etc.).

This is the Electron-facing **composition layer** — `desktop/runtime/` is
the ONE assembly point for the whole application, and `host_boundary/`
(`FedosDesktopHostPort`) is already a framework-neutral host contract, the
best existing composition seam in the current tree. Composition-layer code
has, by definition, the widest inbound reference surface of any subtree
here (measured: 45 external files import something under `desktop/` today)
— see `docs/architecture/MESSENGER-MIGRATION-STAGING.md`, which places this
subtree last/highest-risk in the proposed move order for exactly that
reason.

31 files across this subtree (union of `tsconfig.beta-runtime.json`,
`tsconfig.runtime.json`, `tsconfig.unlock-runtime.json`,
`tsconfig.host-bridge.json`, `tsconfig.settings-host-bridge.json`) are
referenced by literal path in one or more of those five root build
tsconfigs — moving any of them requires a same-commit update to every
tsconfig that names it, or that build silently stops compiling the file.
See the staging doc for the exact file list and which tsconfig(s) name each
one.

RESERVED — physical migration deferred to a follow-up arc; see
`docs/architecture/MESSENGER-MIGRATION-MAPPING.md` for the full mapping.
