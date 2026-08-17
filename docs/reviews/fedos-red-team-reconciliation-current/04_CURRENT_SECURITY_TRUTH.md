# Current Security Truth (as of CandidateHead 8712add7 / EvidenceHead f57812a0)

## Identity / Device

- WRONG ACCOUNT ACCEPTANCE: old-key trust-record auto-accept is real and unchanged
  (`autoAcceptOldKeyContinuity: true`), but no longer cascades into an automatic
  cryptographic mutation — Ratchet Reset requires two explicit human confirms. Net: P1,
  not P0.
- WRONG DEVICE ACCEPTANCE: not found. Device replacement remains atomic
  (register-then-revoke); ratchet-reset device-signature check is best-effort/optional
  when no device key is on file (P1, disclosed in-code).
- ROLLBACK: not found (unchanged from prior audit — deletion, backup restore, device
  replacement, and ratchet-reset generation/nonce checks are replay-safe).
- DEVICE LOSS: revoke does not retroactively quarantine live Ratchet sessions with that
  device (P1, unchanged). Own-Device Sync (separate from peer-device pairing) is enabled
  by default but its transport was never wired into production — status is now at least
  truthfully reported as "failed" rather than falsely "running."

## Secrets

Not re-audited this pass (out of scope for the 4 reconciliation agents; the original
audit found NO P0 across private key / master seed / passphrase / secret logging / temp
secret, and nothing in this reconciliation contradicts that). Recommend a fresh sweep
before final release given how much new code has landed since.

## Messenger

- FALSE SENT: **still current, P0.** Delivery-truth data now flows correctly through the
  content-accessor → coordinator → shell → IPC layers (fixed by the Outbox Flush
  Reliability arc), but the renderer's `onChatSend()` never reads `result.value.delivery`
  and unconditionally shows "Sent." on local-persist success. Reject and
  transport-unavailable outcomes are both still mis-displayed as "Sent."
- DIRECT RATCHET FALSE GREEN: fixed for the Security State panel specifically
  (`forwardSecrecyLiveConfirmed` gate). Broader claim that "active" doesn't imply
  "this specific message was ratchet-routed" is architecturally still true, since the
  default send route remains legacy NIP-17 for ordinary launches.
- REPLAY: inbound dedup still keys on the attacker-controlled `event.id` with no
  signature/id verification on the real Direct Conversation path (P1, unchanged in
  substance from the original audit).

## Tor / Network

- A real, tested Tor/SOCKS5 strict-transport implementation now EXISTS in this lineage
  (it did not exist at all in the stale origin/main audit) — validated with a real
  installed two-process proof and a real public-Tor round trip. It is disabled by
  default, has no Settings/renderer UI, and is reachable only via undocumented env
  vars. Current pilot-facing docs still claim "no onion routing... outside anything
  this project has tested," which is now inaccurate as a capability claim (though low
  practical exposure, since an ordinary user can't reach the feature anyway). P2.
- Inbound WebSocket message-size cap: still absent (P2, DoS-class, bounded by needing a
  hostile/misbehaving relay).
- `ws://` still accepted without warning (P2). NIP-42 AUTH still unimplemented (P2).

## Commerce

Not re-audited in depth this pass. The old audit found Commerce entirely absent from
origin/main; this lineage has a full, real Commerce implementation (Order/Payment/
Delivery/Receipt/Reputation) validated across many arcs. Recommend a dedicated Commerce
red-team pass before final release, since none of the four reconciliation agents were
scoped to it and the original audit's Commerce findings (all describing unmerged
branches) do not transfer.

## Recovery

- Corrupted profile: **fixed** (real, tested reset path).
- Backup guidance: the improved recovery-notice content is computed correctly but
  silently dropped before reaching the renderer — the fix from the Product Durability
  Mega-Arc is currently invisible to real users (P1).
- No full-profile in-app backup (manual copy only) — deliberately deferred, disclosed
  in-repo, P2.
- No passphrase-attempt lockout — unchanged, P2, mitigated by Argon2 cost.
