# 16. Logging and Crash Reports

## Specification

- **Local-only logs.** Any future logging implementation must write to a
  local file only (see `11` — no such implementation exists yet). No
  network transport of logs is in scope for this stack under any
  circumstance (matches "no hidden network activity," already a real,
  tested guarantee of `FedosDesktopHostBridge`, Alpha 3561-3640).
- **Coarse error codes.** Reuse the EXISTING closed
  `FedosDesktopHostDiagnosticCode`/Shell `FedosDesktopShellOutcomeKind`
  vocabulary for anything user- or log-facing — never a raw stack trace
  by default (already this stack's own standing rule, `07`).
- **Secret redaction.** Never log a passphrase, key, or bearer secret —
  matches every existing Authority's own already-audited "never logs a
  secret" guarantee across this entire stack (Master Seed Authority,
  Envelope/Payload encryption, Invitation Capability bearer secrets — all
  independently confirmed elsewhere in this lineage's own tests).
- **Plaintext message exclusion.** Never log decrypted message text —
  matches the Search Index's own already-adopted "never persists
  plaintext" precedent (Alpha 2501-2580, unchanged) applied one layer
  further out.
- **User-controlled export.** A future "export logs for support" action
  should be an explicit, user-initiated action (mirroring how Archive
  export already works — a deliberate command, never automatic).
- **No automatic telemetry by default.** Matches the Host's own already-
  tested "no hidden network activity" guarantee (`06`/`17`) — no crash
  report, usage metric, or diagnostic payload should ever be transmitted
  without an explicit, separate, clearly-labeled user opt-in this review
  does not design.

## Conclusion

No logging/crash-report implementation exists in this stack today (`11`).
Every principle above is a restatement of guarantees this codebase
already enforces elsewhere (no plaintext persistence, no secret logging,
no hidden network activity) — a future logging Arc's job is applying
them, not inventing new ones.
