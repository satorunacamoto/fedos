# FedOS — Roadmap

Consolidates deferred, forward-looking findings from nine review efforts
(Validation V1, Validation V2, Security Review, Performance Review,
Architecture Review, UX Review, Release Review, Technical Debt Review,
Dead Runtime Review) plus this Arc's own Phase A findings. **Nothing in
this document is implemented.** It is a record of what a future Arc
should consider, not a commitment or a plan of record. See
`docs/secure_runtime_documentation_consolidation_v1_review_index.md` for
which source commit each item traces back to.

## Immediate gate before any wider release

1. **Run the Closed Beta pilot and commission an independent security
   audit.** Unchanged recommendation across every review that reached a
   verdict (Validation V1, Validation V2, this Arc's own Completion
   Declaration).
2. Decide whether to merge the two already-written, already-reviewed,
   docs-only external-security-audit-prep commits (`8e730f25`,
   `6873d24f`) into `master` — a real human decision, not a technical
   task; explicitly not done automatically by this consolidation.
3. Fill `SECURITY.md`'s vulnerability-reporting contact placeholder with
   a real channel once one exists.
4. Select a project license (or explicitly decide to remain
   proprietary) — see `LICENSE_STATUS.md`. Blocks Public Beta;
   does not block the Closed Beta pilot.
5. Complete a human/legal decision on code-signing before Public Beta —
   see the HUMAN DECISION REQUIRED section this Arc added on that topic
   (release-artifact provenance docs).
6. Complete real legal review and human ownership assignment for the
   Privacy Policy and Terms drafts before presenting either as approved
   policy — see each draft's own DRAFT status header.

## P0 / P1 — real, measured, not yet fixed

- **Append-only persistence: full-log-replay on every write, repo-wide.**
  ~52 of 53 append-only backends have no write-time index (only
  `AppendOnlyFedosDeliveryObservationPersistence` does, since Alpha
  7881-7960). Measured real cost: 8.35 / 95.62 / 648.32 ms per full
  replay at n=1k/10k/100k records. Recommended: port the
  `#ensureIndex()` lazy-index pattern already proven in that one backend
  to the rest, plus pagination for anything UI-facing.
- **Conversation Outbox / Board Outbox: still no per-call index**, distinct
  from the restart-replay-storm bug already fixed at Alpha 7561-7640. The
  underlying `listIntents()`/`putIntent()` calls remain O(T) per call —
  covered by the same fix above, just confirmed still open specifically
  for these two backends as of this writing.
- **Append-only backends crash-brick on corruption.** No crash-safe
  recovery path exists for a corrupted append-only log. Recommended next
  Arc: crash-safe append-only recovery, paired with completing the
  Recovery screen's own real "restore" action (see next item).
- **Recovery screen has no real repair path beyond Retry / Copy
  diagnostic code / Quit.** Its copy no longer overpromises (fixed this
  Arc), but the underlying capability — an actual `recoverProfile()` or
  guided Archive-restore-from-Recovery flow — still doesn't exist.

## P1/P2 — architecture and code hygiene, not urgent

- Remove the redundant, zero-external-reader
  `assembleFedosConversationProductionCryptoGraph()` / `FedosWasmLoaderSkeleton`
  call in `fedos_desktop_runtime.ts` — real dead work executed on every
  startup with no observable effect, safe narrow-blast-radius cleanup.
- A product decision (not a code decision) on `src/worker.ts`'s
  Cloudflare Worker fate: restore a real deploy path for the original
  vision, or formally archive it. Narrowing `FedosDesktopHost`'s
  dependency on `DesktopApplication` is gated on this decision.
- Full `package.json` / package-scope migration from `nostr-window` /
  `@nostr-window/...` to FedOS-branded naming — real, mechanical, but a
  breaking change deserving its own dedicated Arc, independently
  recommended by both the Dead Runtime review and the Original
  Vision/Expected-Behavior V2 review.
- Reconcile the two unrelated `CryptoProvider` seams
  (`src/crypto/fedos_core_adapter.ts` vs. the `src/runtime/` Facade
  chain) — architectural cleanup, not a bug.
- Decide the NIP-17 envelope vs. `ChatProvider`/`ChatMessageDescriptor`
  surface fork — a real unresolved architectural question, not urgent.
- Duplicate-code map: 22 Conversation-domain copies plus Board/Device/
  Relay equivalents — cleanup-class technical debt, not a defect.
- Tighten `SECURITY.md` line 19's Group Messaging wording (a real
  21-file local pairwise-fanout backend exists; the current phrasing
  could be misread as implying nothing exists) — low-priority wording
  pass, not a correction of substance.

## Group Messaging — a real product decision, not a bug fix

Master ships **independent pairwise Double-Ratchet fanout only** — no
forward secrecy or post-compromise security at the group level, and
**receive-blind** (only a message's own sender can currently reconstruct
a group thread; recipients receive ordinary 1:1 messages with no
recognition of group membership). This Arc (8201-8280) deliberately did
not build a Group Conversation UI on top of this for exactly that reason.

A real, tested Sender-Key rotation prototype exists
(`rotateSenderKeyEpoch()`, Alpha 2121-2200 "Group Sender-Key Foundation
Arc", `01fef390`, continued through a Rotation V1 review, `41da82d9`) —
but on a permanently unmerged branch, with a disclosed flaw
(`Math.random()`, not a CSPRNG, for key material) and zero production
callers even on its own branch. Before any future Arc revives it: fix
the CSPRNG flaw, and re-decide whether Sender-Key or a different
approach (the original spec explicitly considered and rejected both
"Pairwise Fanout forever" and "MLS immediately," recommending Sender-Key
as the incremental step) is still the right target. Reconstructing the
receive side is real, necessary work regardless of which crypto scheme
is chosen — it touches the NIP-17 inbound decode path, a
protocol-frozen boundary no read-only review or docs-consolidation pass
may redesign.

## UX / accessibility — status uncertain, needs direct re-verification

The UX Acceptance Review (`9c238a11`) found this product's shipped UI
missing almost entirely at the commit it reviewed. A spot-check against
current `master` while writing this roadmap shows most of its
"blocker"-level findings (no messaging UI, no Relay visibility, no
Device pairing, no Settings, no Recovery path, no Safety Center, no
Search, no Archive UI, several accessibility gaps) are now resolved —
the shipped screen set has grown substantially since that review. Two
items remain genuinely unconfirmed either way and are worth a direct
follow-up pass rather than trusting either the old review or this
roadmap's own optimism:

- Local Deletion UI — a UI-level "delete this message from my device"
  affordance, distinct from Signed (cross-device, consent-based)
  Deletion, which IS confirmed present (nested in Safety Center).
- Passphrase strength meter / upfront requirement disclosure (currently
  only length ≥ 8 is enforced, shown after failure, not before).
- `lang="en"` hardcoded, no locale detection/i18n.
- `autocomplete="off"` vs. `"new-password"` on passphrase fields (fights
  password managers either way this is set; not independently
  re-verified).

## Not required for Closed Beta, explicitly deferred

- Onion-like transport-privacy routing — extensively designed (~60 docs
  across 3 review branches), zero implementation. A genuine strategic
  choice about scope, not an oversight; out of scope for this Arc and
  any Arc operating under the "Closed Beta, focused Secure Messenger"
  mission.
- Multi-device Ratchet trust bootstrap across DIFFERENT accounts (today,
  Device Pairing only works within one account's own trust boundary).
- General Settings screen fields that are stored but not yet wired to
  any real application boundary (`archiveDirectory`, `autoStart`,
  `autoLockTimeoutMinutes`, `windowLayout` — present in the settings
  descriptor, not yet exposed in the Settings UI form).
- Board/Marketplace/Commerce/Creator/Federation verticals — real
  scaffolding exists from before the product pivot; reviving any of them
  is a strategic product decision requiring explicit authorization, not
  a technical task.

## Explicitly recommended AGAINST

- Deleting `src/runtime/create_runtime.ts` / `AppRuntime` / the
  Planning-era crypto chain. It is real, harmless, disconnected fossil
  code — ~295 tests still exercise it, and it has no path to the shipped
  product. A naming/discoverability fix is the right scope, not removal.
