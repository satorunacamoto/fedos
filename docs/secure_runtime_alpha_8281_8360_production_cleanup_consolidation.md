# Secure Runtime Alpha 8281-8360 — Production Cleanup and Repository Consolidation Arc

**Mandate**: implement ONLY what multiple independent reviews agree is
safely organizable — role clarification and naming/visibility fixes, never
deletion of anything still reachable. No new features. No Crypto/Protocol/
Rust/WASM/Electron-UX change. Worktree
`C:/wt/fedos-production-cleanup-consolidation`, branch
`arc/8281-8360-production-cleanup-consolidation`, based on master at
`81305b37`.

## Reviews consulted (real documents, read directly, not summarized secondhand)

- `docs/reviews/fedos_validation_program_v1/` (commit `9b9ce274`) — "Validation Program V1"
- `review/fedos-dead-runtime-production-path-v1` (commit `ad3c400e`) — "Dead Runtime Review," the source of this Arc's own concrete Steps 1-3
- `docs/secure_runtime_alpha_8201_8400_session_e_technical_debt_review.md` (branch `worktree-agent-a97aeceb8c9eaab58`) — "Technical Debt Review"
- `docs/reviews/fedos_consolidation_arc_8201_8400_session_c_architecture_validation_v2/` (branch `worktree-agent-aef8b4ef39d6dd532`) — "Architecture Validation V2"

All four independently converge on the same root finding: `src/runtime/create_runtime.ts`'s
`AppRuntime`/`initializeCrypto()` (`PrototypeDisabled`) is real, tested
(108-295 test files), and belongs to a SEPARATE, undeployed original
product (`src/worker.ts`) — never dead code to delete, only a naming/
discoverability problem to fix. This Arc implements exactly the Dead
Runtime Review's own recommended Steps 1 and 3 (`10_recommended_cleanup_sequence.md`),
and explicitly declines Step 2 after this Arc's own direct re-verification
found it riskier than the review assumed — see below.

## What changed

1. **Deprecated/positioning banners** (Step 1 — zero behavior change,
   pure documentation, this Arc's own direct evidence for each):
   - `src/runtime/create_runtime.ts` — banner stating this is NOT the
     Desktop Beta's production Runtime, pointing to
     `docs/reviews/fedos_dead_runtime_production_path_v1/` and to
     `src/desktop/production_activation/*` as the real path.
   - `src/desktop/desktop_application.ts` — banner clarifying
     `DesktopApplication` is genuinely live (constructed by
     `FedosDesktopHost`) but bootstraps an unrelated Alpha-050 identity
     object, not the real profile bootstrap
     (`fedos_profile_initialization_coordinator.ts`).
   - `src/runtime/fedos_wasm_loader.ts` — banner correcting a narrower
     prior claim (see "Judgment call" below): this file/class is a real,
     still-tested LEGACY path, not dead code.
2. **`create_runtime系の役割整理`/`PrototypeDisabled系の可視化`**: satisfied
   by the `create_runtime.ts` banner above — `AppRuntime`/`initializeCrypto()`/
   `PrototypeDisabled` themselves are UNCHANGED (explicitly not recommended
   for deletion by the Dead Runtime Review, confirmed again by this Arc).
3. **`production_activationとの境界整理`**: satisfied by the same banner —
   it names `src/desktop/production_activation/*` as the real path and
   states `create_runtime.ts` is not it, in both directions.
4. **`README.md`/`package.json` self-description** (Step 3): `README.md`'s
   opening paragraph was found ALREADY rewritten to lead with the current
   product (a prior/concurrent session fixed this since the Dead Runtime
   Review's own base commit) — verified by direct read, no further change
   needed. `package.json`'s `description` field was still the stale
   "Reddit-style window into Nostr — MVP prototype" text — rewritten to
   lead with the current product, keeping the origin as a one-line
   pointer to `README.md`. `name` field (`"nostr-window"`) intentionally
   left unchanged, per the review's own Step 3 instruction (renaming is a
   separate, wider-blast-radius Step 5).
5. **`package description整理`** (electron-spike sub-package): its
   `package.json` description called itself a "build spike," while it
   ships the real signed release pipeline (`07_misleading_naming.md` item
   4). Rewrote the description to state this plainly, while explicitly
   preserving the original physical-isolation rationale (Electron's
   transitive `@types/node` never leaking into the root TypeScript graph)
   as the real reason the package stays separate. `name` left unchanged
   (renaming needs its own Arc — every `--prefix packages/fedos-desktop-electron-spike`
   script site would need updating).
6. **`Architecture図更新`**: `docs/fedos_runtime_positioning.md` (the
   document `create_runtime.ts`'s own header already pointed to) was
   itself stale — written before the real Desktop Beta product existed,
   describing only the original product's positioning. Added a "Status
   update" box at the top with a real ASCII diagram of both paths (Path A:
   the original `nostr-window`/Worker/`AppRuntime` chain; Path B: the real
   shipped Desktop Beta/`production_activation` chain), sourced directly
   from the Dead Runtime Review's own traced graphs (`01`/`02`). The
   original historical content below is preserved unchanged, per this
   repository's own established "stack newest status first" convention.
7. **`コメント更新`**: a comment in `fedos_desktop_runtime.ts` (see
   "Judgment call" below) explaining why the legacy production-crypto
   resolution path is being kept, not removed.

## Judgment call: Step 2 (code removal) NOT performed — evidence contradicted the review's own confidence

The Dead Runtime Review's `10`/`12` proposed removing the
`assembleFedosConversationProductionCryptoGraph()` call and its
`productionCryptoCapability`/`productionCryptoGraph` locals from
`fedos_desktop_runtime.ts`, gated on a stated precondition: "IF AND ONLY IF
a direct check ... confirms no test imports `fedos_wasm_loader.ts` or
`FedosWasmLoaderSkeleton` directly ... (not completed by this review)."

This Arc ran that exact verification task first, per the review's own
instructions, and found:

1. `test/fedos_ratchet_device_lifecycle_session_reset_real_vertical_slice.test.ts`
   imports `FedosWasmLoaderSkeleton` directly — real, but independent of
   `fedos_desktop_runtime.ts`'s call site, so on its own this did not block
   Step 2 (matches the review's own reasoning: the FILE stays regardless).
2. **Direct source inspection revealed something the review's own grep
   (scoped only to the private local `productionCryptoCapability`) missed**:
   the OTHER local this same call assigns, `productionCryptoGraph`, is used
   as a real `??` fallback in roughly ten places throughout
   `fedos_desktop_runtime.ts` (`masterSeedAuthority`, `creatorIdentityAuthority`,
   `encryptionAuthority`, `decryptionAuthority`, `accountIndexAuthority`,
   `nostrAuthorBindingAuthority`, `resolvedCryptoGraph`, and the shutdown
   `clear()` call) — not merely assigned and never read.
3. Three real, currently-passing tests were found supplying
   `conversationProductionCrypto` directly and exercising exactly this
   path: `secure_runtime_alpha_7081_7160_real_vertical_slice.test.ts`,
   `secure_runtime_alpha_6521_6600_failure_matrix.test.ts`,
   `secure_runtime_alpha_1261_1320_production_gate_semantics.test.ts`.

Removing the call as literally proposed would either break these three
tests' scenarios or require rewriting all ~10 fallback expressions to
preserve behavior for them — a materially larger, riskier change than "a
provably redundant 3-line removal," and squarely the kind of "new feature/
behavior change" this Arc is prohibited from making under cover of
"cleanup." **Per this Arc's own rule (act only on what reviews agree is
safe), this specific sub-recommendation is not implemented.** Instead: a
banner on `fedos_wasm_loader.ts` and a comment on the `fedos_desktop_runtime.ts`
call site both now document the legacy path's real, tested status and the
corrected evidence, so no future reader re-attempts this exact removal
without re-discovering the same three tests first.

## What was intentionally NOT touched (out of scope, per this Arc's own prohibitions and the reviews' own non-goals)

- `create_runtime.ts`, `AppRuntime`, `PrototypeDisabled`, any `fedos_*.ts`
  Planning-chain file, `src/worker.ts` — none deleted, none behaviorally
  changed. The Cloudflare Worker product's fate (Step 4) is a product
  decision, explicitly out of scope for a cleanup Arc to make unilaterally.
- `package.json`'s `name` field, `packages/fedos-desktop-electron-spike`'s
  own package name/directory — renaming either is Step 5, its own
  dedicated, wider-blast-radius Arc.
- `DesktopApplication`/`FedosDesktopHost`'s dependency contract (Step 5,
  gated on Step 4).
- No Rust, Crypto, Protocol, WASM, or Electron UX change anywhere.

## Verification performed (real, not assumed)

- `npm run typecheck:electron`: clean.
- `npm run typecheck:core` (`tsc --noEmit`): 2 pre-existing errors, confirmed
  identical to the unmodified baseline (unrelated test files, unrelated to
  this Arc — same two errors this session has now confirmed pre-existing
  on three separate occasions).
- `cargo test --release` (real run, zero Rust file touched by this Arc):
  639 passed, 1 known pre-existing dependency-count-drift failure
  (`secp256k1_dependency_guard`), identical to every prior independent run
  this project has recorded this session.
- Real production WASM artifact rebuilt from unchanged Rust source
  (`--skip-tests`, skipping only that one known pre-existing failure):
  reproduced the same `10f7fdb2e1f2e656013f68f591e452e49cfdbcf9f5822906054b02619730ff6a`
  / 385,565-byte artifact as every previous independent build.
- `npm run build` (electron-spike): clean.
- Real Electron subprocess tests (`secure_runtime_alpha_8041_8120_structural_guards.test.ts`,
  `secure_runtime_alpha_8121_8200_acceptance_bridge_isolation.test.ts`):
  pass in isolation (18/18 across both files); one transient timeout
  batch on a concurrent-load run was not reproduced on retry.
- `git diff --stat`: exactly 7 files, all documentation/description/comment
  changes plus the one clarifying comment in `fedos_desktop_runtime.ts` —
  zero behavior change anywhere, confirmed by the passing test suite above.
- Release build (`npm run release:beta`) run against the clean, committed
  tree after this commit (the release script itself refuses to build from
  a dirty working tree — a real, correct safety gate encountered directly).
