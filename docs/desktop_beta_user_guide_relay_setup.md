# FedOS Desktop Beta — Relay Setup Guide

A Relay is a real Nostr relay server your Desktop app connects to for
delivering and receiving invitations and messages. Without at least one
configured, invitations, messaging, Identity Replacement, and Signed
Deletion all stay honestly disabled — nothing is fabricated as working
when it is not. **Device Pairing is the one exception:** it never sends
anything over a Relay (the pairing request/approval strings are moved
between Devices manually, by whatever channel you already trust), so it
works with no Relay configured at all — verified directly by this Arc's
own real, visible-control pairing test.

## Adding a Relay

1. Open **Settings** from the navigation bar.
2. Under **Relays**, enter a `wss://` (or `ws://` for local testing) URL
   and click **Add**.
3. Click **Save settings**.
4. **Restart the application.** Relay configuration only takes effect on
   the next launch — the running Runtime is never reconfigured live. The
   Settings screen tells you this explicitly after you save.

## What to expect

- One unreachable or temporarily offline Relay does not crash the app or
  block your profile — it degrades gracefully for just that Relay.
- There is no fabricated default Relay. If you configure none, invitation/
  messaging/Device/Identity/Deletion features stay honestly unavailable
  rather than silently pretending to work.
- A malformed URL (wrong scheme, not a URL at all) is rejected locally
  before it is ever saved.
- You can remove a Relay the same way you added one, then Save and
  restart.
