# Secure Runtime Alpha 6841–6920 — Architecture Option Review

**Stage 1 / Phases B–D.**

## Phase B — the exact current graph

Confirmed by direct source read (not assumed):

```
Profile unlock (Electron main "buildFreshCoordinator()")
  → activateFedosProductionProfileMasterSeed()   [host-attestation gated, NEVER NODE_ENV]
    → FedosProductionMasterSeedFacade.constructMasterSeedAuthority()
      → ONE WASM instance A  (module.FedosMasterSeedAuthority(), Store-backed in Rust)
        → FedosProductionMasterSeedAuthority     [authority A — the ONE canonical production authority]
          → passed into new Coordinator({ masterSeedAuthority: authority A, ... })
            → Coordinator.#buildRuntimeConfig() threads authority A into:
                - conversationArchiveMasterSeedAuthority (Archive, EXISTING precedent)
                - deviceBindingAccountSigningAuthority (via accountSigningAuthority)
              but NOT into any Direct Ratchet field — none exists today.

Direct Ratchet's OWN path, entirely separate, reachable ONLY if a caller
explicitly sets config.conversationProductionCrypto (the real production
Coordinator never does):
  config.conversationProductionCrypto
    → assembleFedosConversationProductionCryptoGraph()
      → new FedosWasmLoaderSkeleton()
        → #evaluateDevOnlyGate() → determineFedosRuntimeMode()
          → NODE_ENV !== "development" → developmentAllowed: false → PERMANENTLY DENIED
        → (only if NODE_ENV === "development") ONE WASM instance B (SEPARATE
           WebAssembly.Instance / linear memory from instance A — a second,
           independent `new FedosWasmMasterSeedAuthority()`)
          → authority B → productionCryptoGraph.masterSeedAuthority
            → conversationDirectRatchetDeps.{sealingAuthority, masterSeedAuthority}
```

This confirms the mission's own framing precisely: **A and B are
genuinely separate.** Two independent WASM instances (when B is ever
reachable at all — in a real packaged build it never is, since `NODE_ENV`
is not `development`), two independent Rust authority objects, two
independent Store generations. B does not need Master Seed *ownership* —
it only ever needs two narrow operations (seal/restore of Ratchet secret
material) plus `resolveConversationKey` (used elsewhere in the crypto
graph, not by Ratchet itself — see below). Ratchet session STATE itself
remains entirely Rust-owned regardless of which authority backs it
(`FedosDirectRatchetConversationRuntime`/session objects are unaffected by
this Arc — confirmed: `conversationDirectRatchetDeps` only ever receives
`sealingAuthority`/`masterSeedAuthority` as references, never constructs
or mutates session state itself).

**Exactly which Direct Ratchet operations touch the authority at all**:
only `sealingAuthority.sealDirectRatchetSecret()`/`restoreDirectRatchetSecret()`
(seal/restore of chain-key material at rest) and, separately,
`masterSeedAuthority.resolveConversationKey()` for X3DH-style initial key
agreement (the SAME method `FedosProductionMasterSeedAuthority` already
implements and already uses in production for Direct-mode NIP-44). No
other authority operation is needed by Ratchet.

**An existing narrow authority port already exists**: `FedosDirectRatchetSealingAuthority`
(`sealDirectRatchetSecret`/`restoreDirectRatchetSecret`), created at Alpha
5401–5480, already implemented by `FedosWasmMasterSeedAuthority` — but
NOT by `FedosProductionMasterSeedAuthority` (the real production
authority), which has never needed it until now. The port's own header
comment explains why it was NOT added to the shared `FedosMasterSeedAuthority`
interface (unrelated implementers should not be forced to grow methods
for a concern they don't own) — this Arc does not change that decision;
it only adds a SECOND implementer.

**Why B was originally development-gated**: `assembleFedosConversationProductionCryptoGraph()`'s
own header states it composes a FULL Direct-mode conversation crypto
graph (creator identity, encryption/decryption authorities, account index
authority, Nostr author binding) for the ENTIRE Direct-mode message path,
not Ratchet specifically — and per its own header, the Dev-only Gate it
routes through is "an already-reviewed... PERMANENT 'Development only —
never Production, never Worker' restriction," with closing it to
Production named as explicitly out of that Arc's own scope. This Arc does
not revisit that decision for the FULL graph — only Direct Ratchet's own
narrow slice of it is redirected to the already-activated authority.

## Phase C — frozen security invariants

1. One production profile unlock authority — **preserved**: `activateFedosProductionProfileMasterSeed()` remains the ONLY production activation call site; this Arc adds zero new call sites to it.
2. One live Master Seed owner per Runtime generation — **preserved**: authority A remains the sole production authority; B (dev-gated) is never constructed in any real packaged run.
3. One `SecretHandleStore` generation per authority — **preserved**, same reasoning.
4. No raw Master Seed crosses the Rust/WASM boundary — **preserved**: `sealDirectRatchetSecret`/`restoreDirectRatchetSecret` (to be added to `FedosProductionMasterSeedAuthority`) call the SAME WASM handle methods `FedosWasmMasterSeedAuthority` already calls; the return/parameter shapes (opaque sealed blob strings, `Uint8Array` for genuinely already-encrypted-at-rest secret material the caller itself supplies) are byte-for-byte unchanged.
5. No raw Ratchet secret crosses to TypeScript — **preserved**: unchanged wire/method contract.
6. No development-only authority in production — **preserved**: this Arc's whole purpose is eliminating B's reachability need; A is never dev-gated.
7. No test authority in packaged Beta — **preserved**: `fedos_electron_beta_main.cts` is untouched by this Arc.
8. Lock destroys/inactivates all dependent capabilities — **preserved, verified by direct read**: `Coordinator#lock()` (line 550) already calls `this.#deps.masterSeedAuthority.clear()` on authority A; since Ratchet will hold a reference to the SAME object, one `clear()` call invalidates both Archive (existing) and Ratchet (new) simultaneously — no new lock-handling code is needed.
9. Old handles and facades reject after lock/restart — **preserved, verified by direct read**: `conversationRuntime()` (the ONLY path to reach `directRatchet()`) already throws once the Runtime's own `stopped` flag is set (`fedos_desktop_runtime.ts:~1291`); combined with invariant 8, a stale reference is doubly fail-closed.
10. Ratchet state remains Device-pair isolated — **preserved**: this Arc touches zero session-state code.
11. Ratchet sealed persistence remains compatible — **preserved**: zero schema change; `sealDirectRatchetSecret`/`restoreDirectRatchetSecret`'s own wire contract (binding tuple, AEAD) is unchanged, only which authority OBJECT REFERENCE calls them changes.
12. No live session secret copied through generic Device Sync — **preserved**: untouched.
13. No protocol/wire change — **preserved**: zero Ratchet message/header format change.
14. No hidden authority lifetime longer than profile unlock — **preserved**: authority A's own lifetime is already scoped to profile unlock→lock exactly as today; Ratchet borrows a reference, never extends it.
15. No circular ownership between Desktop Runtime and crypto authority — **preserved**: the Coordinator constructs authority A BEFORE the Runtime (unchanged ordering); the Runtime only ever receives a reference, never constructs or owns authority A itself.

## Phase D — option comparison

| Option | Second Master Seed owner? | Store internals exposed? | Raw secret export? | Weakens production gate? | Stale-after-lock? | Protocol migration? | Verdict |
|---|---|---|---|---|---|---|---|
| A. Ratchet factory keeps constructing its own authority | YES (unchanged status quo) | no | no | no | n/a | no | **DISQUALIFIED** — leaves the exact blocker this Arc exists to close |
| B. Inject the complete `FedosMasterSeedAuthority` object | NO | no | no | no | no (inherits invariant 8/9) | no | **candidate** |
| C. Inject `SecretHandleStore` directly | n/a (Rust-only concept, no TS binding exists) | YES — would require a brand-new WASM export surface exposing Store internals to TS, which does not exist and would be a real, unreviewed API widening | risk | no | — | possibly (new export) | **DISQUALIFIED** — no existing TS-facing Store handle exists; inventing one is a real WASM API change, out of "no redesign" scope |
| D. Inject a narrow capability-limited Ratchet authority port | NO | no | no | no | no | no | **candidate** — but the port (`FedosDirectRatchetSealingAuthority`) ALREADY EXISTS and already gates `sealingAuthority`; the remaining gap is `masterSeedAuthority` (needed for `resolveConversationKey`), which the narrow port alone does not cover |
| E. Move Ratchet construction fully inside the existing Rust authority | NO | no | no | no | no | **YES — real Rust API redesign** | **DISQUALIFIED** — "no redesign," and Ratchet session state is already correctly Rust-owned per-session, not per-authority; folding session lifecycle into the authority object would be a genuine architecture change |
| F. Reuse the canonical production WASM facade through named operations | NO | no | no | no | no | no | effectively equivalent to B — the facade already IS `FedosProductionMasterSeedAuthority`; this collapses into B |
| G. One shared process-global crypto singleton | NO (single instance) but introduces **new, unreviewed global mutable state** | no | no | no | **risk** — a process-global would need its OWN generation-invalidation logic duplicating what the Coordinator/Runtime already do correctly via object-reference lifetime | no | **DISQUALIFIED** — invariant 15 (no circular/hidden ownership) and "no development fallback"-style unreviewed new architecture; strictly worse than B/D with zero benefit, since the Coordinator already has a perfectly scoped single instance to inject |
| H. **B+D combined, source-grounded**: `FedosProductionMasterSeedAuthority` (already the sole production `FedosMasterSeedAuthority` implementer) ALSO implements the already-existing `FedosDirectRatchetSealingAuthority` port; the ONE resulting dual-interface object is what gets injected — satisfying BOTH `conversationDirectRatchetDeps.masterSeedAuthority` (needs the full interface, confirmed by direct source read) AND `.sealingAuthority` (needs the narrow port) simultaneously, exactly mirroring how `FedosWasmMasterSeedAuthority` already does this dual-implementation for the dev/test path | NO | no | no | no | no (invariant 8/9) | no | **SELECTED** |

**Selected: Option H.** Not chosen because the mission's own prompt
"prefers" a narrow-capability framing in the abstract — chosen because
direct source inspection at `fedos_desktop_runtime.ts:804-824` proves
`conversationDirectRatchetDeps` genuinely needs BOTH the narrow sealing
port AND the full `FedosMasterSeedAuthority` interface (for
`resolveConversationKey`) from the SAME object, and `FedosProductionMasterSeedAuthority`
already implements the latter — adding the former (two methods, mirroring
an already-reviewed, already-shipped implementation pattern verbatim) is
the smallest change that satisfies every invariant with zero redesign.
