# 17. Threat Model

## Covered

- **Malicious renderer content.** Mitigated by `contextIsolation:true` +
  `nodeIntegration:false` + strict CSP + zero remote content ever loaded
  (fully offline, bundled app, `08`).
- **Preload compromise.** Minimized by keeping the preload allowlist to
  exactly `FedosDesktopHostPort`'s own public methods (`05`/`06`). The
  REAL backstop is deeper: even a fully compromised preload/renderer can
  only ever call `dispatch()`, which independently re-validates and
  re-authorizes every command in the MAIN process, through the SAME
  Shell/Accessor checks that exist regardless of Electron (Membership,
  activation, retention — all already real, already tested, unchanged by
  this review).
- **Arbitrary IPC.** Prevented structurally: one channel, closed command
  union, main-process validation (`06`).
- **Path traversal.** Prevented by the already-implemented, already-tested
  `isSafeArchivePath()` check (`09`).
- **Malicious Archive.** The Archive Runtime's own existing manifest/
  integrity verification (Alpha 1541-1610/1691-1760, unchanged) is the
  real defense — a malicious archive file is plain JSON/ciphertext, never
  executable content; it fails closed at decode/decrypt, never executes
  or crashes the host.
- **XSS.** Not yet applicable — no renderer PAGE exists (`05`'s own
  Package C, not built by this review). When one is built: strict CSP,
  and every user-supplied string (message bodies are always
  user-authored text) must be rendered as a text node, never
  `innerHTML`/`dangerouslySetInnerHTML`-equivalent, in whatever UI
  framework or vanilla DOM code the eventual renderer page uses.
- **Supply-chain dependency risk.** Electron itself is a large dependency
  tree (`04`) — a real, quantifiable increase in supply-chain surface
  versus this repository's current 2-package production footprint. This
  is exactly why this review exists rather than installing it directly,
  and is weighed explicitly in `20`.
- **Local malware / unlocked desktop session.** Named honestly as OUT OF
  SCOPE for any application-level mitigation: if the OS user account or
  running process is already compromised, or the machine is left
  unlocked while the app holds decrypted Master Seed material in memory,
  no Electron configuration (or any other host technology's
  configuration) protects against it. This is a fundamental limit of any
  desktop application, not a gap specific to this review's own
  recommendation.
- **Update-channel compromise.** Moot for V1 given `15`'s own "no
  auto-update" recommendation; flagged as a real, unaddressed concern for
  whenever auto-update is eventually built (signed feed integrity,
  update-server compromise, etc. — not designed here).

## What Electron cannot protect against (stated plainly, per this
## document's own required topic)

Electron provides NO protection against: a compromised OS user account,
an already-unlocked machine accessed by another physical party, a
malicious OS-level keylogger capturing a typed passphrase before it ever
reaches the app, or a supply-chain-compromised Electron/npm dependency
itself (mitigated only by normal dependency-pinning/audit hygiene, not by
any Electron-specific feature). These are the SAME limits any desktop
application built on any technology in `03` shares.
