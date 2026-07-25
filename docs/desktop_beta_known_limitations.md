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

## Device Pairing and Group Messaging (Secure Runtime Alpha 8201-8280)

This Arc's own Phase A reconciliation report
(`docs/secure_runtime_alpha_8201_8280_phase_a_reconciliation_report.md`)
re-verified both areas directly against source rather than trusting prior
review wording.

17. **RESOLVED as of Secure Runtime Alpha 8201-8280.** Device Pairing (create
    a pairing request on a new Device, inspect/approve it on an existing
    trusted Device, complete it back on the new Device) is now reachable
    through the real Devices screen — previously the crypto and IPC
    channels were real and production-wired but no renderer code called
    them. Pairing requires both Devices to already have their own separate
    local profile; there is no "restore an existing account from a seed"
    onboarding flow in this Beta, so pairing binds a second Device's own
    key as trusted under the FIRST Device's account — it does not merge or
    share message history between the two Devices' own local profiles.
    Because the Joining Device's own pairing keypair lives only in that
    process's memory, the pairing request is lost if the app is closed
    before Step 3 completes — the Devices screen's own copy states this.
18. **RESOLVED as of Secure Runtime Alpha 8201-8280 (real, previously
    undiscovered build defect, not a Rust/protocol change).**
    `packages/fedos-desktop-electron-spike/tsconfig.json`'s own `exclude`
    list omitted `src/fedos_electron_beta_renderer.ts` — the ONE Beta
    renderer file — even though the sibling `tsconfig.browser-scripts.json`
    (the config meant to compile it, unwrapped, for plain `<script>`-tag
    loading) already included it, and every other browser-context renderer
    file was already correctly excluded from `tsconfig.json`. Because
    `npm run build`'s two `tsc` invocations both target the same `dist/`
    path and TypeScript's incremental output caching does not reliably
    guarantee the second pass re-emits a file it considers unchanged, the
    shipped `dist/fedos_electron_beta_renderer.js` would intermittently end
    up as the WRONG, CommonJS-wrapped compile (`Object.defineProperty(exports,
    "__esModule", ...)`) — which throws `Uncaught ReferenceError: exports is
    not defined` in the real page and leaves it stuck on the loading screen
    forever. This is the SAME defect class Alpha 4101-4180 already fixed
    once for the older spike scripts (`docs/secure_runtime_alpha_4101_4180_execution_spec.md`)
    but never propagated to this later-added Beta renderer file. Found via
    this Arc's own real visible-control pairing test failing unpredictably
    (sometimes passing in under 7s, sometimes hanging until timeout) even
    though the underlying feature code was independently verified correct
    both ways; root-caused by inspecting the actual compiled `dist/` output
    byte-for-byte rather than assuming environmental flakiness. Fixed by
    adding the missing exclusion.
19. **Group Messaging is not exposed in this pilot, and this is intentional,
    not merely undone.** The current transport is independent pairwise
    Double-Ratchet fanout (N separate 1:1 sends), not a group ratchet and
    not Sender-Key (no Sender-Key code is present in `master` at all).
    Worse than a mere security-model gap: the **receive side was never
    built** — a group message lands on a recipient's device as an ordinary
    1:1 message; only the sender's own device can render a group thread.
    Exposing a Group UI on top of that would misrepresent a feature that
    does not work for anyone but its creator, so this Arc deliberately did
    not build one. Reconstructing the receive side is real, necessary
    future work — it touches the NIP-17 inbound decode path, a
    protocol-frozen boundary this Arc's own mission does not permit
    redesigning — and is named as a recommended next Arc, not attempted
    here.
