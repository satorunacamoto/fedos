# FedOS Desktop Beta — Known Limitations

Organized by consequence to a user, not by engineering Arc. This document
reconciles `docs/reviews/public_docs_security_claims_audit_v1/07_known_limitations.md`
(commit `dbc1386`) against the current build; each item below is re-verified
against the landed source at Secure Runtime Alpha 8041-8120, not carried
forward unverified.

## Reachability

1. **RESOLVED as of Secure Runtime Alpha 8041-8120.** The prior claim ("the
   shipped Beta app has no Settings screen or feature UI... reachable only
   through an internal test/automation IPC surface") is no longer accurate.
   Relay Settings, Invitation, Conversations/Chat, Search, Archive, Devices,
   Identity Replacement, Signed Deletion, and Safety Center are all now
   reachable as real screens through the ordinary application UI, driven
   through a dedicated, non-test-branded `window.fedosApp` bridge — never
   the internal acceptance/automation bridge.
2. **Search only indexes messages you have actually opened.** A message you
   received but have not read will not appear in search results until you
   open it. (Still accurate — this Arc did not change the Search Runtime.)

## Cryptographic scope

3. **Group conversations have no forward secrecy or post-compromise
   security.** Only Direct (1:1) conversations use the Ratchet session.
   This Beta's UI only exposes Direct conversations for exactly this
   reason — no group-messaging screen was added.
4. **Reproducing "real crypto" test results requires a local build step.**
   The compiled Rust/WASM crypto core is not committed to this repository;
   cloning it and running the test suite without first building that
   artifact will show the affected suites as skipped or failing closed,
   never a silent placeholder success.
5. **Per-Device signing keys are checked only during Ratchet session
   reset, on a best-effort basis** — not during initial session
   establishment.

## Deletion, retention, and Archive

6. **Deletion is access-control, not erasure.** No secure-overwrite, SSD
   erasure, cloud-backup deletion, or remote/peer-side deletion is
   performed or claimed anywhere in this UI's own copy.
7. **Live message-existence metadata is not removed by deletion today** —
   only ciphertext access is gated for live deletion. Metadata protection
   currently applies only to Archive export/restore.
8. **No return-acknowledgement exists for Archive Suppression facts.** The
   strongest status obtainable is that a suppression fact reached a relay
   — never confirmation a specific other Device received or applied it.
9. **A Device not yet paired at the time a suppression fact was sent will
   legitimately still restore pre-deletion content** if it later restores
   an Archive taken before that point — a disclosed, honest boundary, not
   a bug. The Archive restore screen's own copy states this.

## Distribution and release process

10. **Release binaries are not code-signed** unless independently verified
    otherwise for the specific artifact you obtained. Expect Windows
    SmartScreen warnings on first run. Checksums verify integrity, not
    authenticity.
11. **No independent external security audit has been performed on this
    codebase.** All verification to date is internal (see the Completion
    Declaration for this Arc's own verification scope).
12. A "zero security-correctness FAIL" summary in any completion document
    has a narrow definition (security-correctness failures only) and can
    coexist with disclosed, honestly-labeled gaps elsewhere in the same
    document.

## Documentation hygiene

13. **This repository contains an earlier, unrelated prototype
    ("Stage 1-133") whose documentation, read in isolation, describes a
    product with no real cryptography at all.** That description is
    accurate for the prototype snapshot it documents and inaccurate for
    the current build. Readers should treat any document describing a
    "Stage 1-133" prototype as historical, superseded by the Secure
    Runtime Alpha lineage described in this repository's own `README.md`.

## New, disclosed limitations from this Arc (Secure Runtime Alpha 8041-8120)

14. **No automated screen-reader verification.** `role="alert"`/
    `aria-live` usage in the new screens is correct per the ARIA
    specification but has not been independently run against a real
    assistive technology.
15. **The chat view's live-update mechanism is a bounded 2-second poll**,
    not a push/event subscription — a new message may take up to ~2
    seconds to appear in an already-open conversation. No new IPC event
    channel was added for this (out of this Arc's own scope).
16. **Identity Replacement items with no resolvable peer-Device evidence
    pair are shown as non-openable** rather than silently omitted or
    fabricated — a real, disclosed boundary of how this Arc reconciled the
    inbox listing against the peer-capability listing (see the Completion
    Declaration).
