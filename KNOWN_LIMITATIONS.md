# FedOS Desktop Beta — Known Limitations

Canonical, consolidated limitations list. Organized by consequence to a
user, not by engineering Arc. Supersedes `docs/desktop_beta_known_limitations.md`
(kept as a pointer stub, not deleted, so existing cross-references don't
break). Consolidates: `docs/reviews/public_docs_security_claims_audit_v1/07_known_limitations.md`
(`dbc1386`), the FedOS Validation Program V1 (`9b9ce27`) and V2 (`09140dd5`),
the FedOS Secure Runtime Architecture Conformance Review V1 (`17c6cef6`),
the Desktop Beta UX Acceptance Review (`9c238a11`), the Technical Debt,
Persistence, and Performance Audit V1 (`1e4d68d4`), and this Arc's own
Phase A findings — every item below is re-verified against landed
source, not carried forward unverified. See `ROADMAP.md` for
forward-looking items NOT yet verified either way, and
`docs/secure_runtime_documentation_consolidation_v1_review_index.md` for
the full source-to-doc mapping.

## Reachability

1. **Real Beta UI reaches Relay Settings, Invitation, Conversations/Chat,
   Search, Archive, Devices, Identity Replacement, Signed Deletion, and
   Safety Center** — all through `window.fedosApp`, never the internal
   `fedosAcceptance` test-automation bridge (structurally guard-tested
   absent from ordinary packaged launches).
2. **`redeemInvitation()` is a permanent backend stub.** There is no
   manual "paste/import an invitation code" UI. Conversation acceptance
   is automatic real-time delivery only — if the recipient's Runtime
   never receives the real-time event, there is currently no fallback
   path to accept.
3. **Search only indexes messages you have actually opened.** A message
   you received but have not read will not appear in search results
   until you open it. Search is a plaintext, in-memory-only keyword
   index — never persisted to disk, never an encrypted blind index.

## Cryptographic scope

4. **Group conversations have no forward secrecy or post-compromise
   security, and are receive-blind.** The transport is independent
   pairwise Double-Ratchet fanout (N separate 1:1 sends), not a group
   ratchet and not Sender-Key. Worse than a security-model gap: only a
   group message's own sender can currently render a group thread —
   recipients receive it as an ordinary 1:1 message. No Group
   Conversation UI is exposed, deliberately, because building one on top
   of this would misrepresent a feature that doesn't work for anyone but
   its creator. A real, tested but permanently unmerged Sender-Key
   prototype exists (Alpha 2121-2200, `01fef390`) with a disclosed CSPRNG
   flaw and zero production callers — see `ROADMAP.md`.
5. **Reproducing "real crypto" test results requires a local WASM build
   step.** The compiled Rust/WASM crypto core is not committed; without
   it, affected test suites skip closed, never a silent placeholder
   success. See `BUILDING.md`.
6. **Per-Device signing keys are checked only during Ratchet session
   reset, on a best-effort basis** — not during initial session
   establishment.
7. **"Double Ratchet" means this codebase's own protocol implementation**
   of the algorithm, not the Signal Protocol library — not interoperable
   with Signal or other Double-Ratchet messengers. NIP-17 transport
   carries proprietary additive extensions (real-time invitation
   delivery, an authenticated route-binding field) — a generic NIP-17
   client will not understand them.
8. **A Relay operator or network observer can see who is messaging whom
   and when**, and correlate that pattern over time. Encryption protects
   contents, not this metadata; no onion-style routing or mixing exists
   in this codebase (design-only, unimplemented).

## Device Pairing

9. **Device Pairing binds a second Device's own key as trusted under the
   FIRST Device's account — it does not merge or share message history**
   between the two Devices' own separate local profiles. There is no
   "restore an existing account from a seed" onboarding flow. The
   Joining Device's own pairing keypair lives only in that process's
   memory, so the pairing request is lost if the app closes before the
   final step completes.
10. **Every Device Pairing trust fact is local.** There is no
    cross-Device Registry synchronization — each Device's own view of
    "trusted"/"revoked" is a local fact, not a guarantee the other side
    agrees. Revoking a Device removes its trust for future messages and
    Sync; it does not delete messages that Device already has, and this
    application has no way to confirm or force deletion on another
    Device. Offline is never treated as revoked.
11. **No `mlock`/`VirtualLock` guarantee exists.** Secrets held in
    process memory may be paged to disk by the OS under memory pressure.
    Locking clears visible content and this app's own in-memory state on
    a best-effort basis — not a guaranteed memory-erasure claim.

## Deletion, retention, and Archive

12. **Deletion is access-control, not erasure.** No secure-overwrite,
    SSD erasure, cloud-backup deletion, or remote/peer-side deletion is
    performed or claimed anywhere in this UI's own copy.
13. **Live message-existence metadata is not removed by deletion today**
    — only ciphertext access is gated for live deletion. Metadata
    protection currently applies only to Archive export/restore.
14. **No return-acknowledgement exists for Archive Suppression facts.**
    The strongest status obtainable is that a suppression fact reached a
    Relay — never confirmation a specific other Device received or
    applied it.
15. **A Device not yet paired at the time a suppression fact was sent
    will legitimately still restore pre-deletion content** if it later
    restores an Archive taken before that point — a disclosed, honest
    boundary, not a bug.

## Distribution, release process, and audit status

16. **Release binaries are not code-signed.** Expect Windows SmartScreen
    warnings on first run. Checksums verify integrity, not authenticity.
17. **No independent external security audit has been performed on this
    codebase.** All verification to date is internal.
18. **Version rollback during a pilot is blocked by a real structural
    fact**, not a process gap: `Cargo.lock` is deliberately not
    committed, and no schema-migration code exists for the on-disk
    profile/settings/archive formats. Back up a profile directory before
    upgrading a pilot install.
19. A "zero security-correctness FAIL" summary in any completion
    document has a narrow definition (security-correctness failures
    only) and can coexist with disclosed, honestly-labeled gaps
    elsewhere in the same document.

## Performance, at scale

20. **Append-only persistence backends repo-wide (~52 of 53) replay their
    entire history on every write/read** — no write-time index, only
    `AppendOnlyFedosDeliveryObservationPersistence` has one. Measured
    real cost: 8.35 / 95.62 / 648.32 ms per full replay at n=1k/10k/100k
    records. Not yet user-visible at typical pilot scale, but real and
    unfixed; see `ROADMAP.md`.

## Accessibility

21. **No automated screen-reader verification.** `role="alert"`/
    `aria-live` usage is correct per the ARIA specification but has not
    been independently run against a real assistive technology.
22. **The chat view's live-update mechanism is a bounded 2-second poll**,
    not a push/event subscription — a new message may take up to ~2
    seconds to appear in an already-open conversation.
23. Passphrase strength is enforced only as length ≥ 8, disclosed only
    after a failed attempt, not upfront. Interface language is hardcoded
    to English with no locale detection.

## Documentation hygiene

24. **This repository contains an earlier, unrelated prototype
    ("Stage 1-133") whose documentation, read in isolation, describes a
    product with no real cryptography at all.** Treat any such document
    as historical, superseded by the Secure Runtime Alpha lineage.
25. This repository contains two mostly-disconnected products: the
    original broader "nostr-window" vision (no live deploy path) and the
    shipped FedOS Desktop Secure Messenger this document describes. See
    `ARCHITECTURE.md`.
26. Identity Replacement items with no resolvable peer-Device evidence
    pair are shown as non-openable rather than silently omitted or
    fabricated.
27. `src/runtime/create_runtime.ts` / `AppRuntime` is real, harmless,
    disconnected fossil code from before the product pivot — reachable
    only from the original vision's own entry point and ~295 tests,
    never from the shipped app. See `ARCHITECTURE.md`.
