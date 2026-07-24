# 15 — Automatic Update Decision

## Comparison

| | A. No automatic update | B. Manual update check only | C. Notification-only availability | D. Automatic download, manual install | E. Fully automatic update | F. Other |
|---|---|---|---|---|---|---|
| Signing dependency | none | none | none | strongly recommended (unsigned auto-downloaded binaries are a real attack surface, `17`) | REQUIRES signing to be responsible (`17`) | — |
| Trusted metadata | none needed | a simple "latest version" fetch, still needs a trusted source | same | needs a trusted update-feed format (e.g. `electron-updater`'s own YAML feed) + signature/checksum verification of the fetched update | same, at higher stakes (auto-INSTALLED) | — |
| Update-server compromise blast radius | none — no update server exists | low (worst case: a fake "latest version" string misleads the user into manually downloading a malicious file from wherever THEY choose, no different from any phishing risk already present) | same as B | HIGH — a compromised update server could push a malicious binary users' machines auto-download | HIGHEST — auto-download AND auto-install | — |
| Rollback | trivial (`13`, manual reinstall of an older artifact) | same | same | requires the update client itself to support rollback (not evidenced anywhere in this codebase) | same, at higher stakes | — |
| Profile compatibility | user consciously chooses when to upgrade, can read release notes first (`12`) | same | same | user may not read release notes before an auto-downloaded update is later installed | user has NO opportunity to review compatibility notes before an incompatible schema bump lands | — |
| Offline operation | fully unaffected | requires occasional connectivity for the check | same | requires connectivity | requires connectivity | — |
| User consent | full — every step is user-initiated | full for the install step | full | partial (download without explicit consent) | minimal/none | — |
| Bandwidth | none consumed unless the user chooses to download | negligible (a version-string check) | negligible | consumed whether or not the user wants the update yet | consumed | — |
| Privacy | no network calls to any FedOS-controlled endpoint for update purposes at all | a version-check call reveals "this installation exists and checked at time T" to whatever endpoint answers it | same as B | same as B, plus the download itself | same | — |
| Implementation complexity | none | low (a single endpoint + a version-compare) | low-medium (same, plus a UI notification) | medium-high (`electron-updater` integration, differential/full update packaging, signing) | high (`electron-updater` full auto-update flow, silent install, restart orchestration) | — |

## Decision for Beta 0.1

**A — no automatic update, manual download with published checksums.**
This is not merely "the strong default suggested" — it is the ONLY
option consistent with the ALREADY-FROZEN, accepted source fact
`autoUpdateEnabled: false` in `fedos_desktop_beta_release_configuration.ts`
(`10`), and consistent with this project's own Absolute Prohibitions list
("do not add auto-update dependencies") repeated across multiple prior
Arcs' own specs. Verified against actual architecture (per this
document's own instruction to verify before deciding, not merely accept
the suggested default): no `electron-updater` (or any auto-update
package) dependency exists anywhere in `package.json`/`package-lock.json`
in either the root or the Electron package (`01`); no update-server
endpoint, update-feed config, or update-check code exists anywhere in
`src/` or `packages/`. The architecture is not merely compatible with
"no automatic update" — it currently has ZERO code that would need to be
removed to honor this decision; adopting anything beyond A would be
NEW, unbuilt work.

**B/C (manual/notification-only checks) are explicitly deferred, not
adopted, for Beta 0.1** — even a simple "check latest version" call
requires a real, hosted endpoint (`16`) this project has not yet stood
up, and is unnecessary complexity for a first Beta whose primary
distribution loop is "tell people where the release notes are." Revisit
once `16`'s own distribution host is real and stable.

**D/E (automatic download / fully automatic) are explicitly rejected for
Beta 0.1** and require, at minimum, code signing (`05`, not available)
and a trusted update-server infrastructure (`16`, not yet built) before
they could be responsibly considered — this review does not recommend
either even as a future default without those prerequisites in place
first.
