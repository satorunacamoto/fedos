# FedOS Desktop Beta — Release Notes

Human-readable, user-facing summary of what changed, most recent first.
For the full engineering-level Arc-by-Arc history, see `README.md`'s own
append-only status section. For the specific packaged-artifact release
notes tied to a published build (version, checksums, signing status),
see the `release/fedos-desktop-beta-0.1` branch's own
`docs/fedos_desktop_beta_0.1.0-beta.1_release_notes.md` — this document
is the `master`-side, product-level counterpart, not a duplicate.

## Unreleased on `master` (post Alpha 8201-8280)

- **FedOS Documentation Consolidation.** All the documents you're
  reading right now — `ARCHITECTURE.md`, `ROADMAP.md`,
  `KNOWN_LIMITATIONS.md`, `BUILDING.md`, `CONTRIBUTING.md`, and this
  Public Beta Documentation Pack — are new. No product behavior changed.
- **Device Pairing is now reachable through the Devices screen.**
  Previously the underlying crypto and IPC channels existed but no
  screen called them. See `docs/desktop_beta_user_guide_device_pairing.md`.
- **Group Messaging remains intentionally unavailable in this pilot.**
  Not a regression — the underlying transport can't yet let a recipient
  see a group thread, so no UI was built on top of it. See
  `KNOWN_LIMITATIONS.md`.
- A real, previously-undiscovered build defect was found and fixed: a
  packaged build could non-deterministically ship a broken renderer
  that hung on the loading screen forever. See `KNOWN_LIMITATIONS.md`
  for the technical detail.
- The Recovery screen's own copy was corrected to match its real three
  actions (Retry / Copy diagnostic code / Quit) — it previously implied
  a "restore from Archive" action that wasn't actually wired there.

## Alpha 8121-8200 — Security and reproducibility hardening

- The internal test-automation bridge (`window.fedosAcceptance`) is
  confirmed absent from ordinary packaged launches — verified by a real
  subprocess check, not just a code convention.
- Identity Replacement and Signed Deletion decisions are now authorized
  against the exact item you have open, never an implicit "currently
  selected" reference.
- Every decision button (Accept/Reject/Defer/Approve/Revoke) is now
  protected against rapid double-clicks.
- Locking now genuinely clears revealed message plaintext and Search
  results from the screen and from this app's own memory — proven with
  a real two-party message exchange, not merely asserted.
- The nav bar now shows real, live Relay connectivity status, with
  honest copy that this Beta does not reconnect automatically.

## Alpha 8041-8120 — the real, visible user interface

Before this update, the packaged Beta app visibly supported only profile
creation, unlock, and lock — every other already-working backend
capability was reachable only through an internal test bridge, never an
ordinary button. This update added the real navigation shell you use
today: Conversations, Search, Archive, Devices, Safety Center (with
Identity Replacement and Signed Deletion nested inside it), and
Settings — all driven through the real, production `window.fedosApp`
bridge.

## Alpha 7961-8040 — Closed Beta release candidate

The first Desktop Beta build produced from the fully-landed Secure
Runtime lineage: real WASM cryptography, real Direct Double Ratchet +
NIP-17 encrypted messaging, real Device Trust/Sync, Conversation
Invitation, Search, Archive export/restore, Identity Transition, Signed
Deletion, Peer Capability, and a Safety Center overview. Also fixed a
release-blocking defect where one unreachable Relay could crash the
entire application's startup instead of degrading gracefully.

## Older history

See `README.md`'s own status section for the complete Arc-by-Arc record
back through this project's original, broader "nostr-window" vision and
its pivot to the current Secure Messenger product (see `ARCHITECTURE.md`
for that history's short version).
