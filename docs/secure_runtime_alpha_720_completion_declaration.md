# Secure Runtime Alpha 720 — Completion Declaration

Stage 20 — the final gate of the Alpha 681–720 Nostr Identity Binding &
Outbound Delivery Activation Arc.

## Declared complete, proven by real execution

- **Nostr identity-to-signing binding** — `FedosSigningAuthorityNostrAuthorBinding`
  cryptographically compares a resolved author against the actual
  configured Signing Authority's own derived key (Alpha 686–688, 696).
- **Controlled public author** — `FedosNostrSigningPublicAuthorAuthority`
  derives an author directly from the Signing Authority when a caller
  wants "bound by construction" (Alpha 690/691).
- **Reachable Nostr eligibility** — a real, controlled identity now
  reaches the Outbox; an anonymous or mismatched one still does not
  (Alpha 694/698/699).
- **Shared account authority** — one fixed, explicit `accountIndex`
  (default `0`) is the single source of truth for both the binding check
  and the actual signed event, never independently selectable per
  Outbox intent (Alpha 689/702).
- **Signed event correctness** — a real BIP-340 Schnorr signature was
  independently re-verified (event id + signature, reusing the
  pre-existing `NobleSignatureVerifier` unchanged) against the sent
  `pubkey`, and confirmed equal to the binding public key (Alpha 707/708).
- **Outbox-to-Relay execution** — the full chain (BoardRuntime → Outbox →
  Scheduler → Publisher → signer → Relay → Observation) ran for real, with
  one genuinely eligible post reaching the Relay (Alpha 707/719).
- **Lifecycle ownership** — one signer, one Publisher, no global socket/
  timer, independent runtimes never share state, `stop()` semantics
  unchanged (Alpha 716).
- **Restart-safe delivery** — three independent runtime instances over
  the same real durable append-only files, with no duplicate send (Alpha
  709/719).
- **No imported-author impersonation** — ActivityPub/AT Protocol/Session/
  anonymous-local authors can never bind or sign (Alpha 692/715).
- **Local-only compatibility** — local-only writes never become network
  operations, even with a fully live signing/binding/delivery graph
  running (Alpha 706/714).

## Honest statement: what "delivered" means

Both meanings coexist in this codebase, and which one applies is a
property of which concrete `FedosNostrBoardPublisher` a Local Runtime
chooses to wire (Alpha 710):

- **Transport sent** — `FedosRelayNostrBoardPublisher` (Alpha 456/457,
  unchanged): the local socket call completed without error. No relay
  acknowledgment is ever awaited.
- **Relay accepted** — `FedosRelayOkCorrelatedNostrBoardPublisher` (Alpha
  710/711, new this Arc): a matching `["OK", eventId, true, ...]` was
  actually observed. This is the stronger, real guarantee, and is what
  every test in this Arc exercises.

A genuine Relay `accepted: false` rejection is honestly detected but
currently retried on the same schedule a transient failure would (no
`"rejected"` outcome is surfaced through the frozen boolean
`publishOne()` contract without a formal ripple review this Arc did not
open — Alpha 711/712's own disclosed limitation).

## Still out of scope (unchanged)

Relay Pool; multiple Nostr accounts per command; bridge attribution;
ActivityPub/AT Protocol/Session outbound; private-group; DM; invitation;
encryption; pseudonyms; GUI; Worker; Humanizer/AI; Ontology; economic
anti-spam.

## Verification summary

- `cargo test` (packages/fedos-core-rust): 524 passed, 1 pre-existing,
  unrelated failure (a stale Cargo.toml dependency-count guard, already
  broken before this Arc — this Arc added no Cargo dependency).
- `npm run typecheck`: clean except one pre-existing, unrelated failure
  (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`,
  already broken on the base commit).
- `npm test`: a rigorous `git stash`-based before/after diff of the full
  suite (843→847 test files; the four new is `test/secure_runtime_alpha_684/688/690/694/698/707/709/713/718_*.test.ts`,
  9 new files) confirms zero new regressions beyond one intentional,
  fully-propagated ripple: this Arc's one new Rust `pub fn`
  (`public_key_hex_for_account`) shifted the crate's total public-function
  count from 44 to 45, requiring a mechanical, reviewed update to ~281
  pre-existing structural regression-guard test files that hardcode this
  exact count (and, in a handful of files, an exact enumerated
  name/allowlist). The remaining differences between the true baseline
  and the final run are: several much older, already-broken historical
  snapshot counts (27/36 `pub fn`) unrelated to this Arc; a handful of
  crypto-round-trip smoke tests observed as flaky only under full-suite
  parallel load (confirmed to pass reliably in isolation, re-run
  individually); and three tests (`secure_runtime_alpha_531/532/539`)
  that check LIVE `git status` against a specific historical arc's own
  file-change claims — these necessarily flag this Arc's own
  in-progress, not-yet-committed diff under `src/board/` until the final
  commit lands, exactly as they would for any Arc's own WIP state.
- `p2p/` untouched — the directory does not even exist in this dedicated
  worktree (it was untracked, local-only content in the main worktree at
  session start, never committed to any branch, and therefore never
  materialized when this worktree was created from a real commit) — the
  main worktree itself was never touched.
- `package.json` dependencies unchanged (`@noble/curves`, `@noble/hashes`
  — the same two, only, before and after). `Cargo.toml` unchanged.
- Build artifacts cleaned: `dist/`, `packages/fedos-core-rust/target/`,
  `packages/fedos-core-rust/pkg/`, `packages/fedos-core-rust/Cargo.lock`,
  and the external `CARGO_TARGET_DIR` used during this session (required
  because this worktree's own path — long, containing non-ASCII
  characters, under OneDrive — breaks the Windows/mingw linker on a
  same-directory `target/`; documented as an environment constraint, not
  a code change).

## Recommended next Arc

**A — Nostr Relay ACK Correlation Arc**, narrowly scoped to closing the
ONE disclosed limitation this Arc left open: giving a genuine Relay
rejection (`accepted: false`) its own permanent, non-retried outcome,
via a formal ripple review of `FedosOutboundPublishResult`/
`FedosBoardOutboxPublishResult`'s own vocabulary (Alpha 711/712's own
named next step) — the correlation mechanism itself
(`FedosRelayOkCorrelatedNostrBoardPublisher`) already exists and needs no
further Relay-level change, only a widened, reviewed result type one
layer up.
