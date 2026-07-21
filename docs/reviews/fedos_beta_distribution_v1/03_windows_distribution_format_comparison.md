# 03 — Windows Distribution Format Comparison

Compares six candidate Windows distribution formats against this
repository's own actual, proven electron-builder configuration (`01`),
not generic Electron folklore.

| | A. NSIS installer | B. Portable `.exe` | C. ZIP of unpacked dir | D. MSI | E. MSIX | F. Squirrel.Windows |
|---|---|---|---|---|---|---|
| Implementation cost from THIS repo's current state | low — electron-builder built-in target, only a `win.target` config change + real testing | low — electron-builder built-in target | near-zero — the `dir` target already works (`01`); archiving is a packaging-script addition | high — requires WiX toolchain / separate electron-builder config surface, unproven here | high — requires a Store/sideloading trust chain, unproven here | medium — a different, less-maintained electron-builder target |
| Administrator/elevation requirement | optional (per-user or per-machine install, configurable) | none | none | typically yes (per-machine) | no (sandboxed) | no (per-user) |
| Install location | user- or machine-chosen via installer UI | wherever the user places/runs it (no install) | wherever the user extracts it | Program Files (typical) | sandboxed per-app container | `%LOCALAPPDATA%` |
| Update compatibility | supports a future `electron-updater`-driven NSIS delta/full update flow (not implemented in V1, `15`) | none built-in; a new exe replaces the old manually | none built-in; user re-extracts | supports MSI major-upgrade patterns | supports Store-driven updates | designed FOR Squirrel's own auto-update (not adopted, `15`) |
| Uninstall behavior | real Windows "Add/Remove Programs" entry, clean uninstall | none (delete the file) | none (delete the folder) | real, registry-tracked | real, Store-managed | real, registry-tracked |
| Profile-data preservation across update/uninstall | preserved (`app.getPath("userData")` lives outside the install directory; `01`) | preserved (same reason) | preserved (same reason) | preserved (same reason) | preserved (sandboxed per-app data) | preserved (same reason) |
| SmartScreen behavior | subject to reputation like any unsigned/newly-signed exe (`06`) | same | same (though a ZIP itself is not an executable SmartScreen gates the same way) | same | Store apps bypass SmartScreen entirely (Store's own vetting instead) | same |
| Code-signing support | yes, standard electron-builder `win.certificateFile`/`CSC_LINK` hooks (unconfigured today, `05`) | yes | n/a (archive, not an executable installer) | yes | yes (Store-mediated) | yes |
| Windows version support | Windows 10/11 (matches this project's own accepted `minimumSupportedPlatform: "windows-x64"`, `10`) | same | same | same | Windows 10 1709+ only | Windows 7+ (irrelevant — same floor as others here) |
| User friction | one double-click, standard "Windows protected your PC" SmartScreen click-through if unsigned (`06`) | one double-click, no install step, same SmartScreen exposure | requires manual extraction first, then the same SmartScreen exposure on the exe inside | double-click, more Windows-native trust UI | Store install flow (requires a Store listing, not evidenced) | one double-click |
| Artifact size | unpacked size + NSIS wrapper overhead (small) | unpacked size + tiny wrapper | unpacked size (no wrapper, but no compression benefit beyond `"compression": "store"` already configured, `01`) | typically larger due to MSI database overhead | comparable to NSIS | comparable to NSIS |
| Rollback behavior | installer can be re-run with an older artifact (manual); no automatic rollback (`13`) | replace the file with an older one (manual) | replace the folder (manual) | MSI major-upgrade rollback is real but requires careful versioning discipline this project has not built | Store-managed (not applicable, no Store evidence) | manual |
| Path-length risk | installer chooses a short default path; low risk | user-chosen; could be a long OneDrive path, but the EXECUTABLE's own working files are packaged inside it, not affected | user-chosen extraction path; same OneDrive risk as B | Program Files default; low risk | sandboxed; N/A | `%LOCALAPPDATA%` default; low risk |
| OneDrive interaction | installer default path avoids OneDrive; not blocked if user chooses one | if extracted/run from within an OneDrive-synced folder, Windows file locking during active use can conflict with OneDrive's own sync process — a real, documented general Windows/OneDrive interaction, not specific to this app | same risk as B | avoided by default install location | N/A | avoided by default install location |
| Japanese-path handling | Node/Electron correctly handles UTF-8 paths (`01`'s own citation of `fedos_local_profile_paths.ts`); the INSTALLER's own default path is ASCII-only regardless | same underlying Node/Electron UTF-8 handling; user-chosen run location could be Japanese-named and still work | same | same | same | same |

## Decision

**Primary format: NSIS installer**, built via electron-builder's own
built-in `nsis` target (`win.target: ["nsis"]`, replacing/alongside
`"dir"`). Rationale: zero new npm dependency (electron-builder already
declares and bundles NSIS support), the most familiar Windows install
experience for ordinary Beta testers, real uninstall/Add-Remove-Programs
support, and a proven upgrade path once signing/auto-update are
eventually added (`15`, deferred). This is a real, well-trodden
electron-builder configuration change — not yet made in this review
(Absolute Prohibition: no production edits), a required task of the next
implementation Arc (`19`).

**Secondary format: ZIP of the unpacked `dir` build.** Rationale: this is
the ONLY format with zero new implementation cost — the `dir` target
already builds successfully (`01`, prior execution evidence) — making it
available as a portable/developer option and a fallback if NSIS
packaging or its own testing slips before a desired release date. Never
promoted to primary: it has no uninstall story and no update
compatibility of its own.

**Rejected for V1**: MSI and MSIX (real, unproven implementation cost,
no evidenced enterprise/Store distribution need). Squirrel.Windows
rejected (less-maintained electron-builder target, no advantage over
NSIS for this project's needs). Portable `.exe` (option B) is not chosen
as the secondary format in preference to the ZIP, because the ZIP
requires literally zero new electron-builder target configuration while
`portable` does; both remain available to reconsider in a later Arc if
real user demand for a single-file portable exe emerges.
