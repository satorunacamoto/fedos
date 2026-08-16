# Direct Ratchet Status Truth Model — Agent U

Repo: `C:/wt/fedos-installed-startup-root-cause`, branch `arc/fedos-installed-startup-root-cause`,
HEAD `3b78add15642fd38af601647c7ca332b1027e658` (verified via `git rev-parse HEAD`
this session — unchanged, no checkout performed). Read-only investigation; no
source files edited.

## 0. Executive summary

`getDirectRatchetStatus()` reports `"active"` straight from durable session
**metadata** (`lifecycleState`) and never consults the two cheap, already-in-scope,
side-effect-free facts that would tell it whether that claim is actually backed by
anything live or restorable in THIS process: `FedosDirectRatchetLiveSessionCache`
(a plain `Map` lookup) and `FedosDirectRatchetLiveStateSnapshotPersistence`
(a plain key lookup, no unsealing). Both are already threaded through the class
that owns `getDirectRatchetStatus()` — the fix is not "add new plumbing," it is
"read plumbing that already exists but is currently ignored by this one method."

The send path (`FedosDirectRatchetOutboundIntegration.sendMessage()`) is **not**
affected by this bug — it already performs a genuine live-session check/restore
and fails closed honestly. This is a **display-truthfulness bug**, not a
message-delivery-correctness bug. Full evidence in §6.

Recommended fix: an **additive** second field (`FedosDirectRatchetLiveVerificationState`),
never a breaking rename of `FedosDirectRatchetSafeStatus`. Full design in §3–§4,
blast radius in §7.

---

## 1. The existing closed vocabulary (confirmed exact)

`src/os/messenger/conversations/ratchet/fedos_direct_ratchet_conversation_runtime.ts:65-73`:

```ts
export type FedosDirectRatchetSafeStatus =
  | "unsupported"
  | "initialization-required"
  | "pending"
  | "active"
  | "reset-required"
  | "peer-incompatible"
  | "revoked"
  | "unavailable";
```

Exactly the 8-value union named in the task mandate — confirmed byte-for-byte
against source, not from memory.

`getDirectRatchetStatus()` itself, `fedos_direct_ratchet_conversation_runtime.ts:250-280`:

```ts
/** Phase M/N — the ONE safe status view. Never exposes counters, keys, or session-existence beyond this closed 8-value vocabulary. */
getDirectRatchetStatus(conversationId: string, remoteDeviceRef: string): FedosDirectRatchetSafeStatus {
  const counterparty = resolveCounterparty(this.#deps, conversationId as FedosConversationId);
  if (counterparty.outcome !== "resolved") return "unavailable";

  const resolution = resolveFedosDirectRatchetDevicePair(this.#deps.deviceRegistry, this.#deps.sessionPersistence, { ... });
  if (resolution.outcome === "local-device-revoked" || resolution.outcome === "remote-device-revoked") return "revoked";
  if (resolution.outcome !== "resolved") return "peer-incompatible";

  const metadata = this.#stateRuntime.getSessionMetadata(resolution.sessionId);
  if (metadata === null) return "initialization-required";
  switch (metadata.lifecycleState) {
    case "initialized": return "pending";
    case "active": return "active";                 // <-- the false-green branch
    case "reset-required":
    case "suspended": return "reset-required";
    case "revoked": return "revoked";
    default: return "unavailable";
  }
}
```

Confirmed: this method touches `this.#stateRuntime.getSessionMetadata()` only.
It never reads `this.#liveSessionCache` (constructed at `fedos_direct_ratchet_conversation_runtime.ts:147`
and held as a private field the whole class already has) and never reads
`this.#deps.snapshotPersistence` (also already held, `fedos_direct_ratchet_conversation_runtime.ts:84,165,180`).
Both are reachable with zero new dependency wiring.

`assessDirectRatchetReadiness()` (`fedos_direct_ratchet_conversation_runtime.ts:283-285`) is a byte-identical alias — same bug, same fix surface.

---

## 2. `FedosDirectRatchetCryptographicSession` / `FedosDirectRatchetLiveSessionCache` — is a cheap, side-effect-free "live in this process" check available?

**Yes — it already exists and is unused by the status method.**

`fedos_direct_ratchet_live_session_cache.ts:22-41`:

```ts
export class FedosDirectRatchetLiveSessionCache {
  readonly #sessions = new Map<string, FedosDirectRatchetCryptographicSession>();
  get(sessionId: FedosDirectRatchetSessionId): FedosDirectRatchetCryptographicSession | null {
    return this.#sessions.get(sessionId as unknown as string) ?? null;
  }
  ...
}
```

`get()` is a synchronous `Map.get()` — no I/O, no WASM call, no async, no side
effect. The class's own header (`fedos_direct_ratchet_live_session_cache.ts:1-18`)
documents it as "the in-process, in-memory-only cache of live
`FedosDirectRatchetCryptographicSession` handles ... reused across every
send/receive for a given session id."

Crucially, an entry only ever lands in this cache after a **real cryptographic
success**, never speculatively:
- On establishment: `fedos_direct_ratchet_outbound_integration.ts:192-232` —
  `FedosDirectRatchetCryptographicSession.createAsReceiver()` must return
  non-null (a real WASM object) before `liveSessionCache.set()` is ever called.
- On restore: `fedos_direct_ratchet_outbound_integration.ts:323-329` —
  `#restoreLiveSession()` must return non-null (a real WASM `restore()` call
  that successfully unsealed the chain/root/private keys via the sealing
  authority) before `liveSessionCache.set()` is ever called.

So `liveSessionCache.get(sessionId) !== null` is not just "cheap" — it is
already a **structurally earned** fact: this process has, at some point since
start, either established or successfully restored this exact session's live
crypto object and still holds it. `getDirectRatchetStatus()` currently never
looks at it.

The second cheap fact — durable-snapshot presence — is equally cheap:
`fedos_direct_ratchet_live_state_snapshot_persistence.ts:52-55`:

```ts
export interface FedosDirectRatchetLiveStateSnapshotPersistence {
  putSnapshot(sessionId: string, snapshot: FedosDirectRatchetLiveStateSnapshotV1): void;
  getSnapshot(sessionId: string): FedosDirectRatchetLiveStateSnapshotV1 | null;
}
```

`getSnapshot()` is a plain key lookup (`InMemoryFedosDirectRatchetLiveStateSnapshotPersistence`,
same file, lines 57-67) or an NDJSON-tail read (`FileFedosDirectRatchetLiveStateSnapshotPersistence`,
lines 76-121) — **neither implementation unseals anything or calls WASM**. It
answers "does a durable current-value snapshot exist for this session" without
attempting to use it. That is exactly the "restorable, not yet confirmed" fact
the mandate asks for, and it is already a constructor dependency of
`FedosDirectRatchetConversationRuntime` (`fedos_direct_ratchet_conversation_runtime.ts:84,165,180`).

Confirmed wiring detail relevant to "today's universal case": the composition
root's own doc comment states plainly that in the shipped Runtime, this port
"remain[s] in-memory-only even when this subsystem is enabled (a genuine,
disclosed, narrower boundary)" —
`src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.ts:557-566`. A
file-backed variant (`FileFedosDirectRatchetLiveStateSnapshotPersistence`)
already exists in code but is not wired into the production Runtime — this is
presumably the parallel durability workstream's target, not something this
design needs to build.

There is **no** cheap way today to distinguish "a restore was attempted and
failed" from "a restore was never attempted" — no per-session outcome is
recorded anywhere (see §3, `lastRestoreOutcome`, and §7 for what a minimal
additive tracker would look like).

---

## 3. Effective-status derivation — design

### 3.1 Facts (explicit, pre-gathered — no re-querying)

```ts
/** Every fact here is already reachable from FedosDirectRatchetConversationRuntime's own private fields — no new dependency wiring required for the first three. */
export interface FedosDirectRatchetLiveVerificationFacts {
  /** The EXISTING FedosDirectRatchetSafeStatus this Runtime already computes — reused verbatim, never re-derived here. */
  readonly safeStatus: FedosDirectRatchetSafeStatus;
  /** `this.#liveSessionCache.get(sessionId) !== null` — cheap, structurally-earned (see §2). `null` when `safeStatus !== "active"` (no session to check). */
  readonly liveSessionPresentInProcess: boolean | null;
  /** `this.#deps.snapshotPersistence.getSnapshot(sessionId) !== null` — cheap, no unsealing (see §2). `null` when `safeStatus !== "active"`. */
  readonly durableSnapshotPresent: boolean | null;
  /** Whether a restore was attempted for this session THIS PROCESS, and its outcome. "never-attempted" is the honest default until the small additive tracker in §7 exists. */
  readonly lastRestoreOutcome: "never-attempted" | "succeeded" | "failed";
}
```

### 3.2 The new closed vocabulary

Naming mirrors `FedosPeerDeviceKnowledgeState`'s own established voice
(`src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_knowledge_state.ts:29-39`:
lower-kebab string union, one doc comment per member stating exactly what is
and is not being claimed) and `FedosSecurityAxisState`'s own use of
`"not-applicable"` for "this field carries no meaning right now"
(`fedos_conversation_security_state.ts:43`):

```ts
/** Mirrors FedosPeerDeviceKnowledgeState's own "close the honest-inference gap" naming discipline — never inferred by re-querying, always derived from FedosDirectRatchetLiveVerificationFacts. */
export type FedosDirectRatchetLiveVerificationState =
  /** safeStatus is not "active" — this field carries no meaning (mirrors FedosSecurityAxisState's own "not-applicable" convention). */
  | "not-applicable"
  /** The strongest honest claim: a real live FedosDirectRatchetCryptographicSession object is CURRENTLY held in this process for this session — established or successfully restored since this process started, never merely inferred from metadata. */
  | "live-confirmed-this-process"
  /** metadata says active and a durable sealed-state snapshot exists, but no live object has been confirmed in THIS process (e.g. fresh process start, before the first send/receive touches this session). Genuinely restorable, not yet proven. */
  | "restorable-not-yet-confirmed"
  /** A restore was attempted for this session in this process and failed (missing/corrupt/wrong-binding sealed material, or the sealing authority itself unavailable) — distinct from "never attempted"; this session will NOT send until re-established. */
  | "restore-attempted-and-failed"
  /** metadata says active but NO durable snapshot exists at all — today's universal case (no append-only backend for FedosDirectRatchetLiveStateSnapshotPersistence exists yet, see fedos_desktop_runtime_config.ts:557-566) and, once durability ships, the honest reading for a legacy pre-durability session. Never equivalent to "live-confirmed-this-process" or "restorable-not-yet-confirmed". */
  | "no-durable-snapshot";
```

### 3.3 Pure derivation function

Mirrors `deriveConversationSecurityState()`'s own documented discipline
verbatim (`fedos_conversation_security_state.ts:25-38`: "PURE: no I/O, no
clock read ... `facts` is an explicit, already-resolved object — this
function performs no lookups of its own"):

```ts
/**
 * PURE. No I/O, no session lookup of its own — every fact is caller-supplied.
 * Never reports live-confirmed-this-process or restorable-not-yet-confirmed
 * unless the corresponding fact is explicitly true; UNKNOWN-shaped facts
 * (both booleans null, i.e. safeStatus !== "active") always fall through to
 * "not-applicable", never silently to the strongest claim.
 */
export function deriveFedosDirectRatchetLiveVerificationState(
  facts: FedosDirectRatchetLiveVerificationFacts,
): FedosDirectRatchetLiveVerificationState {
  if (facts.safeStatus !== "active") return "not-applicable";
  if (facts.liveSessionPresentInProcess === true) return "live-confirmed-this-process";
  if (facts.lastRestoreOutcome === "failed") return "restore-attempted-and-failed";
  if (facts.durableSnapshotPresent === true) return "restorable-not-yet-confirmed";
  return "no-durable-snapshot";
}
```

### 3.4 Terminal/other states — confirmed unaffected

`"unsupported"`, `"initialization-required"`, `"pending"`, `"reset-required"`,
`"peer-incompatible"`, `"revoked"`, `"unavailable"` all short-circuit at
`facts.safeStatus !== "active"` → `"not-applicable"`. None of their existing
derivation branches in `getDirectRatchetStatus()` (`fedos_direct_ratchet_conversation_runtime.ts:253-278`)
change at all — this design touches ONLY the `"active"` branch's meaning, by
adding an orthogonal field next to it, never by altering when `"active"` is
returned.

---

## 4. Where should fact-gathering live?

**Recommendation: split, mirroring the Controller/pure-evaluator precedent —
but at the Runtime's own natural seam, not by inventing a new Controller
class.**

`FedosDirectRatchetConversationRuntime` is itself already the "has real access"
layer (it owns `#stateRuntime`, `#liveSessionCache`, and `#deps.snapshotPersistence`
directly — `fedos_direct_ratchet_conversation_runtime.ts:132-137`). The
established codebase pattern for pure-derivation-over-gathered-facts
(`fedos_conversation_security_state_controller.ts` gathering →
`fedos_conversation_security_state.ts` evaluating, per that file's own header
at `fedos_conversation_security_state.ts:25-38`) exists specifically because
the Controller sits ABOVE several unrelated Shell methods and must merge them.
Here there is exactly one class with all the facts already in scope, so the
correct-weight mirror is:

- **Keep `getDirectRatchetStatus()` byte-for-byte unchanged** (backward compat, §7).
- **Add a new method**, e.g. `getDirectRatchetLiveVerification(conversationId, remoteDeviceRef): FedosDirectRatchetLiveVerificationState`,
  on `FedosDirectRatchetConversationRuntime` itself. Its body: resolve the
  session id (reuse the SAME `resolveCounterparty()` + `resolveFedosDirectRatchetDevicePair()`
  calls `getDirectRatchetStatus()` already makes — call `getDirectRatchetStatus()`
  internally to get `safeStatus`, or factor the shared resolution into a
  private helper both methods call, to avoid duplicating the device-pair
  resolution logic twice), then read `this.#liveSessionCache.get(sessionId)`
  and `this.#deps.snapshotPersistence.getSnapshot(sessionId)`, assemble
  `FedosDirectRatchetLiveVerificationFacts`, and call the pure
  `deriveFedosDirectRatchetLiveVerificationState()` (§3.3) placed in its own
  sibling file, e.g. `fedos_direct_ratchet_live_verification.ts` — exactly
  mirroring `fedos_conversation_security_state.ts` being a standalone pure
  module the Controller imports, never inlined into the gathering class.
- This is a genuine "adapter gathers facts it already holds, pure function
  derives" split — it satisfies the same discipline
  `fedos_conversation_security_state.ts`'s header documents, just scoped one
  layer lower (inside the Ratchet subsystem itself) than the Coordinator-level
  split, which is the correct altitude: the Coordinator
  (`fedos_conversation_security_state_controller.ts`) should consume the
  ALREADY-derived `FedosDirectRatchetLiveVerificationState` as one more
  Shell-exposed fact, not re-derive it itself from raw cache/snapshot state it
  has no business reaching into (`FedosDesktopApplicationShell` never exposes
  `#liveSessionCache`/`snapshotPersistence` directly today, and should not
  start).

---

## 5. Downstream consumers of `getDirectRatchetStatus()` / `assessDirectRatchetReadiness()`

Grepped across `src/` and `packages/fedos-desktop-electron-spike/`.

| Caller | File:line | Needs full effective-status detail? |
|---|---|---|
| `FedosDesktopApplicationShell.directRatchetStatus()` | `src/os/messenger/desktop/shell/fedos_desktop_application_shell.ts:1107-1110` | Pass-through only — narrows to `FedosDesktopShellResult<FedosDirectRatchetSafeStatus>`. No change needed at this layer; would gain a sibling `directRatchetLiveVerification()` passthrough for the new method (§4). |
| `FedosConversationSecurityStateController.#gatherFacts()` (Axis 2 ENCRYPTION + Axis 3 FORWARD_SECRECY) | `src/os/messenger/desktop/presentation/security_state/fedos_conversation_security_state_controller.ts:100-116` | **YES — this is the consumer this whole investigation is about.** Line 101-102 sets `ratchetStatus` from `directRatchetStatus()`'s raw value; line 115 computes `forwardSecrecy = ratchetStatus === null ? null : ratchetStatus === "active" && forwardSecrecyConfigured`. **Both** Axis 2 (`evaluateEncryption()`, `fedos_conversation_security_state.ts:132-148`, `"active"` → `state: "good"`) and Axis 3 (`evaluateForwardSecrecy()`, same file, lines 175-185) currently treat raw `"active"` as ground truth. Both need the new fact. |
| `fedosIdentityTransitionBuildSessionImpactRow()` | `src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_ratchet_impact_view.ts:32-40` | **No.** It holds its own copy of the union (`FedosDirectRatchetSafeStatusLike`, same file lines 9-16) and only asks "is this session in `{"pending","active"}`" (`RESETTABLE_STATUSES`, line 32) to decide whether to recommend a reset. A false `"active"` here only makes the tool MORE likely to recommend a reset (the conservative direction), never less — no truthfulness exposure, coarse status is correct and sufficient. |
| `FedosSafetyCenterController.refreshOverview()` | `src/os/messenger/desktop/presentation/safety_center/fedos_safety_center_controller.ts:128-132` | **Borderline, not required for this task's scope.** Feeds `fedosSafetyCenterBuildSummary()` (`fedos_safety_center_summary.ts:122-129,210`), which only uses raw status for section warnings (`"reset-required"`/`"revoked"`/`"peer-incompatible"` → warning) and a coarse `activeRatchetSessionCount` (`s === "active"`, line 210). Same overclaim exists here in principle (an unconfirmed-active session counts as "active" in the Safety Center tile), but it is a secondary display, not the axis this mandate is scoped to fix. Flagged as a natural follow-on, not required now. |
| Electron main process IPC handler `fedos-acceptance:direct-ratchet-status` | `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts:5796-5800` | **No** — raw passthrough of the Shell result over IPC, coarse status is what the renderer/test harness expects. |
| Electron main process poll-until-active helper | `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts:5827-5836` (`while (... lastResult.value !== "active" ...)`) | **No** — this polls immediately after real in-process establishment during an E2E test; the session genuinely is live in that same process by the time it flips to `"active"`, so the coarse boolean-shaped answer is correct for this use. Worth noting for completeness, not a truthfulness gap. |
| `fedos_electron_beta_window.d.ts` / `fedos_electron_beta_preload.cts` | lines 787 / 138-141 | Type/IPC plumbing only, no logic — unaffected either way. |
| `fedos_electron_deletion_request_send_ipc.ts` | line 34 | Doc-comment cross-reference only ("mirrors `directRatchetStatus()`'s own ... precedent") — no actual call, unaffected. |

### Test files that assert on the current status shape (list only, not fixed here)

Grepped `test/*.test.ts` for `getDirectRatchetStatus`/`assessDirectRatchetReadiness`/`directRatchetStatus`/`FedosDirectRatchetSafeStatus`, plus `deriveConversationSecurityState`/`FedosConversationSecurityStateController` usage:

- `test/secure_runtime_alpha_7401_7480_ratchet_route_binding_isolation.test.ts` (12 `"active"` occurrences)
- `test/secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts` (6)
- `test/secure_runtime_alpha_5561_5640_failure_matrix.test.ts` (3)
- `test/fedos_ratchet_device_lifecycle_session_reset_real_vertical_slice.test.ts` (16)
- `test/fedos_conversation_security_state.test.ts` — **3 occurrences that matter**: tests 2, 8, and the "no secret material" spot-check (lines 55, 115, 254) each hand-construct `encryption: { ratchetStatus: "active", asOf: NOW }` and assert `state.encryption.state === "good"` (test 8, line 119, is literally titled "encryption active (session genuinely active) — GOOD"). **These will need updating** once `evaluateEncryption()`'s fact shape gains the new field — this is the real, unavoidable behavioral consequence of actually fixing the bug (see §7), distinct from the union-rename question.
- `test/fedos_conversation_security_state_controller.test.ts` — present in the consumer chain but 0 raw `"active"` string hits; would need a mock/stub update wherever it stubs `shell.directRatchetStatus()` to also stub the new live-verification accessor.
- `packages/fedos-desktop-electron-spike/test/direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts`, `packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_7321_7400_structural_guards.test.ts` — reference `directRatchetStatus`/`FedosDirectRatchetSafeStatus`, not individually inspected line-by-line here (out of scope: task asks to list, not audit each).

None of these need to change under a purely-additive union (the string values
themselves never change) — only the two `fedos_conversation_security_state*.test.ts`
files exercise the CHANGED behavior (Axis 2/3 no longer auto-"good" on raw
`"active"`), and only if the fix is actually wired into the Coordinator per §5's
recommendation.

---

## 6. Send-time gate: does `sendMessage()` already verify, or does it also just trust metadata?

**It already verifies — this is a display-only truthfulness bug, not a send-correctness bug.**

Evidence, `fedos_direct_ratchet_outbound_integration.ts:318-332`:

```ts
const sessionMetadata = this.#deps.stateRuntime.getSessionMetadata(sessionId);
if (sessionMetadata === null) return { outcome: "route-unavailable", reason: "session-initialization-required" };

let session = this.#deps.liveSessionCache.get(sessionId);
if (session === null) {
  const restored = await this.#restoreLiveSession(sessionId, remoteDeviceRef, conversationId, sessionMetadata);
  if (restored === null) return { outcome: "crypto-unavailable" };   // <-- genuine fail-closed
  session = restored;
  this.#deps.liveSessionCache.set(sessionId, session);
}

const ready = await session.isReadyToSend();
if (!ready) return { outcome: "route-unavailable", reason: "session-initialization-required" };  // <-- genuine fail-closed
```

Walking this precisely: `sendMessage()` reads metadata (same as the status
method), but then — unlike the status method — it (1) checks the live cache,
(2) if absent, actually calls `#restoreLiveSession()`
(`fedos_direct_ratchet_outbound_integration.ts:401-428`), which reads the
durable sealed-state snapshot, calls `restoreFedosDirectRatchetSealedStateV1()`
(`fedos_direct_ratchet_secret_checkpoint.ts:118-141` — returns `null` if no
snapshot was ever checkpointed for this session, per that function's own doc
comment), and calls the real WASM `FedosDirectRatchetCryptographicSession.restore()`
(`fedos_direct_ratchet_cryptographic_session.ts:430-468`), and (3) if restore
fails for ANY reason (no snapshot, unseal failure, WASM restore failure), it
returns `{ outcome: "crypto-unavailable" }` — a real, honest, fail-closed
outcome — rather than proceeding. It then additionally calls
`session.isReadyToSend()` (`fedos_direct_ratchet_cryptographic_session.ts:478-480`)
as a second live check before ever calling `encrypt()`.

So: today, in the in-memory-only world, a stale `"active"` metadata record
with no real durable snapshot (the universal case per
`fedos_desktop_runtime_config.ts:557-566`) will correctly fail closed at
SEND TIME with `"crypto-unavailable"` or `"route-unavailable"` — the send path
never silently succeeds on a lie. Only `getDirectRatchetStatus()` (and by
extension `deriveConversationSecurityState()`'s Axis 2/3, which consume it) is
the liar. This narrows the bug's blast radius exactly as the mandate
anticipated: it is a genuine truthfulness/UI bug, not a message-loss/silent-failure
bug — but it remains a real bug, because a user reading "Forward Secrecy: GOOD"
in the Security UI and then having their next send actually fail closed (or
silently fall back to the legacy non-forward-secret route via
`selectFedosDirectConversationForwardSecrecyRoute()`, which has its own
separate, disclosed "cannot see live state" boundary — see
`fedos_direct_conversation_forward_secrecy_route.ts:97-128`) is precisely the
false-green scenario the mandate describes.

---

## 7. Backward compatibility — additive vs. breaking

**Recommendation: additive. Do not rename or narrow `FedosDirectRatchetSafeStatus`.**

Reasons:

1. **Blast radius of a rename would be large and mostly gratuitous.** At least
   9 test files reference the 8-value union or the raw string `"active"` in a
   ratchet-status context (§5's table), several with double-digit occurrence
   counts (16 in `fedos_ratchet_device_lifecycle_session_reset_real_vertical_slice.test.ts`,
   12 in `secure_runtime_alpha_7401_7480_ratchet_route_binding_isolation.test.ts`).
   None of that behavior is wrong — a session genuinely IS in lifecycle state
   `"active"` per its durable metadata; that fact is still true and still
   useful (e.g. for the Identity Transition reset-impact consumer in §5, which
   correctly wants exactly this coarse fact, not the new detail). Renaming the
   union would force updates across all of them for no behavioral gain.
2. **The two facts answer genuinely different questions.** `FedosDirectRatchetSafeStatus`
   answers "what does durable session metadata say the lifecycle state is."
   `FedosDirectRatchetLiveVerificationState` answers "how much of that claim
   has THIS PROCESS actually verified." Collapsing them into one wider union
   would force every existing `"active"` check (the Identity Transition
   consumer, the Safety Center counts, the electron poll-until-active loop,
   §5) to be rewritten to enumerate a cross-product of states it does not
   care about, for no benefit — those consumers are correctly served by the
   EXISTING coarse value today and should stay that way.
3. **Only the two truthfulness-sensitive consumers need the new field**, per
   §5: `FedosConversationSecurityStateController`'s Axis 2/Axis 3 gathering.
   Everyone else keeps working, unmodified, against the unchanged union.

Concrete shape: keep `getDirectRatchetStatus()` returning
`FedosDirectRatchetSafeStatus` exactly as today; add
`getDirectRatchetLiveVerification()` returning the new
`FedosDirectRatchetLiveVerificationState` as a SEPARATE method (§4) rather than
widening the return type of the existing one to a tuple/object — this avoids
touching the signature every existing caller in §5's table already depends on.
`FedosConversationSecurityStateEncryptionFacts`/`FedosConversationSecurityStateForwardSecrecyFacts`
(`fedos_conversation_security_state.ts:127-130,169-173`) gain one new optional-then-required
field (e.g. `liveVerification: FedosDirectRatchetLiveVerificationState | null`)
each — this DOES require updating the 3 flagged test call sites in
`test/fedos_conversation_security_state.test.ts` (§5), because that is where
the actual truthfulness fix lives: `evaluateEncryption()` should report
`"good"` only when `liveVerification === "live-confirmed-this-process"` (or,
arguably, also `"restorable-not-yet-confirmed"` with a distinct reasonCode
such as `"ratchet-session-active-unconfirmed"` mapped to `"unknown"` rather
than `"good"` — a product/copy decision this doc does not make, only flags as
the fork point), and `evaluateForwardSecrecy()`'s `forwardSecrecy` boolean
should require the same. That is an intentional, necessary behavior change,
not a cost to avoid — updating those 3 assertions IS the fix landing.

### Minimal additive follow-up needed for `lastRestoreOutcome` (§3.1)

No per-session restore-attempt outcome is tracked anywhere today — a genuine
gap, separate from the two already-free facts. A minimal addition (not built
here, per this task's read-only scope): a small in-memory,
non-durable `Map<sessionId, "succeeded" | "failed">` — either folded into
`FedosDirectRatchetLiveSessionCache` itself (e.g. a `recordRestoreOutcome()`/`lastRestoreOutcome()`
pair alongside `get()`/`set()`/`drop()`) or a new narrow sibling class — updated
by `FedosDirectRatchetOutboundIntegration.#restoreLiveSession()`
(`fedos_direct_ratchet_outbound_integration.ts:401-428`) and its inbound
counterpart on every restore attempt, success or failure. Until that exists,
`deriveFedosDirectRatchetLiveVerificationState()` (§3.3) can ship with
`lastRestoreOutcome` always `"never-attempted"` and will correctly collapse
`"restore-attempted-and-failed"` into `"no-durable-snapshot"`/`"restorable-not-yet-confirmed"`
— a smaller but still strictly-more-honest v1 than today, since it still never
claims `"live-confirmed-this-process"` without the cache fact backing it.

---

## 8. Summary of the mandate's own five status buckets — mapping check

| Mandate's bucket | This design's value |
|---|---|
| Live, in-memory, verified-usable in THIS process | `"live-confirmed-this-process"` |
| Metadata active, durable snapshot exists, not yet verified in this process | `"restorable-not-yet-confirmed"` |
| Metadata active, NO durable snapshot at all (today's universal case + post-durability legacy-session case) | `"no-durable-snapshot"` |
| Restore attempted and failed | `"restore-attempted-and-failed"` |
| Existing terminal/other states unaffected | confirmed §3.4 — all collapse to `"not-applicable"`, `FedosDirectRatchetSafeStatus`'s own branches for them are untouched |
