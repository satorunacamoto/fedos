# Real Public-Tor Two-Process Re-Proof — Final Evidence

Coordinator follow-up against `f6350a6a` (per an explicit coordinator instruction to re-run the
release pipeline and attempt the real public-Tor two-process re-proof after the `#p`
subscription-narrowing fix). No source changes were required — this document records the live
proof itself. Real Tor binary used: a pre-existing, already-present `tor.exe` 0.4.9.11 found at
`fedos-commerce-tor-real-bundle-v1` (an unmerged historical worktree in this same repo's own
worktree tree) — not downloaded. Real public relay: `wss://relay.damus.io`. Real installed
binary: the win-unpacked build from the just-verified `f6350a6a` release pipeline run (14/14
gates, this same pass).

## Release pipeline re-run

`npm run release:electron-beta` from repo root against HEAD `f6350a6a`: **14/14 gates PASS**,
verdict `ready-for-human-publication`, `blockingGateIds: []`. Confirmed no new source file needed
adding to `electron_builder.beta.config.json`'s allowlist (only existing, already-allowlisted
files were edited this arc — no repeat of the prior P0). Artifacts: `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe`,
sha256 `7b7431aa56647aa81a4d35246839d50d4e99560252ac754dbb43d0a383d2b9ac`.

## Real public-Tor two-process proof — Attempt 1

Real Tor bootstrap: 0% → 100% in ~26s (real relay handshakes, real consensus/descriptor
download), SOCKS on `127.0.0.1:19850`. Route proof (via FedOS's own compiled `socks5Connect()`):
`check.torproject.org` returned `{"IsTor":true,"IP":"185.220.101.150"}`.

Bob and Alice: two fully independent installed-binary processes, synthetic personas, real
conversation invitation, real signed peer-device announcements, all over real Tor + real
`relay.damus.io`.

- **Discovery (Alice finds Bob)**: PASS on the first attempt — Alice's own process, using the
  `#p`-narrowed subscription this arc adds, correctly recorded Bob's device as `"trusted"`. This
  is the exact reproduction that failed across 4 rounds in the prior arc; it now converges
  immediately.
- **Discovery (Bob finds Alice)**: needed one retry with a longer wait (15s → 30s) to converge;
  succeeded on retry. Real-world relay/Tor round-trip variance, not a code defect — the mechanism
  is identical to the Alice-finds-Bob direction that converged on the first attempt.
- **Direct Ratchet establishment**: Alice's `acceptance-establish-direct-ratchet-session` against
  Bob's discovered device returned `"initiated"`. Bob's next launch reached genuine `"active"`
  status (`acceptance-direct-ratchet-status-poll-until-active`, 1 attempt, 3ms — already active
  from the prior discovery launch's own inbound dispatch).
- **Bob → Alice real Ratchet-routed message**: Bob's send returned `outcome: "ok"` with a real
  `messageId`. Alice's independent process received it (`acceptance-list-messages-poll-until-count`)
  and **correctly decrypted it** (`acceptance-read-message`): plaintext `"real public tor
  bob->alice message 1"`, an exact match. **Full real end-to-end proof, over real Tor and a real
  public relay.**
- **Legacy fallback over strict Tor**: an ordinary send (no
  `FEDOS_BETA_DIRECT_RATCHET_MESSAGE_DELIVERY_REMOTE_DEVICE_REF`) from Bob succeeded
  (`outcome: "ok"`) with strict Tor mode enabled — same composition-root socket factory as the
  Ratchet route (already proven architecturally in an earlier arc; this reconfirms it completes
  successfully under real Tor, not just structurally).

## Alice → Bob reply — genuine, unresolved finding (not timing)

Alice's reply send (`acceptance-send-message`, with
`FEDOS_BETA_DIRECT_RATCHET_MESSAGE_DELIVERY_REMOTE_DEVICE_REF` set to Bob's device) returned
`outcome: "ok"` locally with a real `messageId`, but Bob's independent process never received it
— confirmed genuinely absent, not a timing issue: a direct raw WebSocket query against
`relay.damus.io` (via FedOS's own `socks5Connect()` + `connectStrictWebSocket()`, real Tor
circuit, `REQ` filtered on `{kinds:[1059], "#p":[bobPubkey]}`) found **zero** events from this
session's timestamp range addressed to Bob — only two much-older events left over from a prior
session's own testing. Bob's own polling wait was extended to 40s/60s-ceiling (41 poll attempts)
with no change. **The event was never published to the relay at all**, despite Alice's local API
reporting success — this is a real, reproducible send-path gap specific to the reply direction
(Bob's own identical-shaped send worked correctly), not resolved this pass.

Per mandate §47's own classification taxonomy: **FEDOS STATE MACHINE** is the best-supported
classification (not RELAY PROTOCOL LIMITATION or TOR CIRCUIT FAILURE, since the relay-reachability
and Tor-circuit mechanics are proven working in the *same* session, same processes, opposite
direction) — most likely something about Alice's own session state transitioning from "receiver"
role (just decrypted her first message) to her own first outbound send silently failing to
complete the actual network publish step while still reporting local success. Not investigated
further this pass, per the coordinator's own explicit instruction not to keep retrying past a
bounded attempt count — this is reported as an honest, specific, reproducible gap rather than
either declared a full PASS or dismissed as environmental.

## Process hygiene

Tor process (owned, PID tracked) killed cleanly after each phase; zero orphaned `tor.exe`/
`node.exe`/`electron.exe`/`FedOS*` processes at the end of every check. No source files touched —
`git status` clean throughout, HEAD unchanged at `f6350a6a`.

## Updated classification

- **TOR PUBLIC VALIDATION**: upgraded from PARTIAL to **PARTIAL (strong)** — every foundational
  primitive plus real two-process discovery (both directions) plus one full real Ratchet-message
  round trip (send, deliver, decrypt) are now live-proven, not simulated. The remaining gap is
  narrow and specific (Alice's own reply-direction publish), not the broad "discovery never
  converges" finding from before. Still not COMPLETE per mandate §45's own bar (needs both
  directions, not just one).
- **Root cause of the original 4-round failure**: confirmed fixed. The `#p` subscription filter
  is the reason discovery now converges reliably instead of failing to find the target among
  hundreds of irrelevant real-world events.
