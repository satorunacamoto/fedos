# Direct Ratchet Integration Points — Current State (Agent R, Phase A, Read-Only)

Investigated against `arc/fedos-installed-startup-root-cause` HEAD (`b514b11c`)
in worktree `C:\wt\fedos-installed-startup-root-cause`. No source file under
`src/` or `packages/` was modified. Goal: map exactly where a future
cross-account peer-Device discovery protocol's OUTPUT would plug into the
existing Direct Ratchet bootstrap/session path.

---

## 1. The exact, minimal Registry-write contract a discovery protocol needs

The ratchet resolver consumes exactly one thing: a `FedosDeviceBindingV1`
record reachable via `FedosDeviceRegistryPersistence.getBinding(deviceId)`
whose `trustState === "trusted"`
(`src/os/messenger/device/fedos_device_binding.ts:36,53-66,135-137`).

`FedosDeviceRegistryPersistence` itself
(`src/os/messenger/device/persistence/fedos_device_registry_persistence.ts:32-38`)
is an append-only **event** port:

```ts
interface FedosDeviceRegistryPersistence {
  putEvent(event: FedosPersistedDeviceBindingEventV1): FedosDeviceRegistryPersistenceWriteResult;
  getBinding(deviceId: string): FedosDeviceBindingV1 | null;
  listBindings(): readonly FedosDeviceBindingV1[];
  listBindingsForAccount(accountAuthority: string, accountPublicIdentifier: string): readonly FedosDeviceBindingV1[];
}
```

It is never written directly by feature code. The **sole production
orchestrator** over it is
`PersistedFedosDeviceTrustAuthority`
(`src/os/messenger/device/persistence/persisted_fedos_device_trust_authority.ts:79-191`),
confirmed independently by grepping every non-test `.putEvent(` call site in
`src/os/messenger/**` — the only hits against `FedosDeviceRegistryPersistence`
specifically are inside `persisted_fedos_device_trust_authority.ts:134,149,165`
(the other `putEvent` hits found belong to unrelated ports: conversation
capability, device sync schedule, device transfer session).

`PersistedFedosDeviceTrustAuthority` exposes exactly three mutating calls:

```ts
registerDevice(request: FedosDeviceRegistrationRequest, now: number): FedosDeviceRegistrationResult;
confirmTrust(deviceId: string, now: number): FedosDeviceTrustConfirmationResult;
revokeDevice(deviceId: string, now: number): FedosDeviceRevocationResult;
```

(`persisted_fedos_device_trust_authority.ts:88,141,160`)

```ts
interface FedosDeviceRegistrationRequest {
  readonly deviceId: string;
  readonly accountRef: FedosDeviceBindingAccountRef;   // {authority, publicIdentifier, identityId}
  readonly devicePublicKeyRef: string | null;           // OPAQUE reference, never raw key bytes
  readonly label: string | null;
}
```

(`src/os/messenger/device/fedos_device_registration_authority.ts:29-35`)

**This is the minimal contract.** A new cross-account discovery protocol
needs, for zero ratchet-side code changes:

1. A `FedosDeviceRegistrationAuthority` implementation
   (`fedos_device_registration_authority.ts:52-57`) whose
   `authorizeRegistration()` / `authorizeTrustConfirmation()` decide
   `{allowed, capability: "verified" | "unavailable", reason}` from the
   discovery protocol's own cryptographic evidence (e.g. a self-signed
   peer-Device announcement). This is the ONE injected policy seam this
   codebase already reserves for exactly this purpose — its own header
   states the existing production adapter,
   `unavailable_fedos_device_registration_authority.ts`, is deliberately
   "the ONLY production adapter this Arc ships" (i.e., a placeholder
   waiting for a real one).
2. Call `PersistedFedosDeviceTrustAuthority.registerDevice(request, now)`
   then `.confirmTrust(deviceId, now)` (or a single authority whose
   `authorizeRegistration` already returns `capability: "verified"`,
   letting the binding start `"pending"` before an explicit
   `confirmTrust()`) — using the REMOTE peer's own `deviceId` /
   `accountRef` / `devicePublicKeyRef`, not a local one.
3. Nothing else. Once `getBinding(remoteDeviceId).trustState === "trusted"`
   is true in the SAME `FedosDeviceRegistryPersistence` instance the
   Runtime already wires into the ratchet resolver
   (`conversationDirectRatchetDeps.deviceRegistry`,
   `src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts:1039`), every
   ratchet consumer below picks it up with **zero code changes**.

---

## 2. Current failure/degraded states — verbatim, and gap analysis

### `resolveFedosDirectRatchetDevicePair()` outcomes
(`src/os/messenger/conversations/ratchet/fedos_direct_ratchet_device_pair_resolver.ts:63-71`)

```
"resolved" | "local-device-unknown" | "local-device-revoked" | "local-device-not-trusted"
| "remote-device-unknown" | "remote-device-revoked" | "remote-device-not-trusted" | "invalid-binding"
```

Exact rejection when the peer device isn't trusted: `"remote-device-not-trusted"`
(binding exists, `trustState` is `"pending"` or `"unavailable"`, not `"trusted"`) —
line 172. If the peer device was never registered at all:
`"remote-device-unknown"` — line 170.

**Separation of "session resolution" from "trust gate":** the function does
the trust gate FIRST (lines 164-172, unconditional revoked/unknown/untrusted
checks against `deviceRegistry`), and only AFTER both local and remote pass
does it touch session resolution (`findCurrentFedosDirectRatchetSession()`,
lines 174-186, a pure scan of already-persisted `sessionPersistence` records
for the highest generation matching the tuple — never fabricates a session).
Session id construction (lines 188-218) is pure string encoding, no I/O. This
means: trust is the gate; the Registry call gating it is
`deviceRegistry.getBinding(remoteDeviceRef)` (line 169) followed by
`isFedosDeviceBindingRevoked()` / `isFedosDeviceBindingTrusted()`
(`fedos_device_binding.ts:135-141`).

### `selectFedosDirectConversationForwardSecrecyRoute()` reasons
(`fedos_direct_conversation_forward_secrecy_route.ts:56-68`), verbatim:

```
"ratchet-not-configured"       // no Ratchet route wired into this Runtime at all
"no-session-for-conversation"  // Ratchet wired, but no session exists for THIS conversation
"remote-device-unknown"        // a session exists, but the remote Device binding is absent from the Registry
"remote-device-revoked"        // a session exists, but the remote Device binding has been revoked
"remote-device-not-trusted"    // a session exists, but the remote Device binding is not trusted
"ambiguous-remote-device"      // >1 distinct remote Device has a session for this conversation at the same generation
```

Note this function does **not** call `resolveFedosDirectRatchetDevicePair()`
at all — it scans `sessionPersistence.listSessions()` directly for records
already bound to the conversation (lines 112-120), and only re-checks the
Registry (lines 138-141) for the ALREADY-CHOSEN candidate's remote device, on
every call (so a revocation lands immediately, not just at next restart —
comment lines 134-137). If no session record exists yet — the case a new
discovery protocol would first produce — it returns `"no-session-for-conversation"`
regardless of whether the remote device is now trusted; it never distinguishes
"no session because peer unknown" from "no session because peer is trusted but
nobody has bootstrapped a session yet."

### `resolveFedosDirectRatchetRoute()` reasons — the broader vocabulary
(`fedos_direct_ratchet_route_resolution.ts:44-60`), verbatim:

```
"unknown-route" | "local-device-unknown" | "local-device-revoked" | "local-device-not-trusted"
| "remote-device-unknown" | "remote-device-revoked" | "remote-device-not-trusted" | "invalid-binding"
| "session-initialization-required" | "session-reset-required" | "session-revoked" | "session-expired"
| "session-corrupt" | "session-unavailable" | "downgrade-detected" | "legacy-route-unsupported"
```

This module (separate from the forward-secrecy route file, used by
`fedos_direct_ratchet_outbound_integration.ts` and
`fedos_private_wire_route.ts`) **does** call
`resolveFedosDirectRatchetDevicePair()` first (line 112/132). Critically:
`"session-initialization-required"` (line 139) is returned precisely when
`resolveFedosDirectRatchetDevicePair()` outcome is `"resolved"` (i.e. BOTH
local and remote devices are trusted) but
`stateRuntime.readiness(sessionId).state === "session-not-found"` — i.e. no
live/persisted crypto session record exists yet for an already-trusted pair.

**This is exactly the state "authenticated peer device now known but ratchet
not yet established"** — it already exists, verbatim, in this module's own
vocabulary, reachable today. It is **not** present in
`fedos_direct_conversation_forward_secrecy_route.ts`'s narrower vocabulary,
because that module deliberately checks session-existence before device-trust
(see above) rather than device-trust before session-existence.

### `FedosDirectRatchetReadinessState`
(`fedos_direct_ratchet_readiness.ts:9-14`), verbatim:

```
"ready" | "sealing-authority-unavailable" | "session-not-found" | "session-not-active" | "runtime-stopped"
```

### Answer to Q2 — are existing states sufficient, or are 1-2 new ones needed?

**Sufficient, with a caveat.** `resolveFedosDirectRatchetRoute()` already has
the exact truthful state needed
(`"session-initialization-required"`) for "peer device now trusted, ratchet
session not yet bootstrapped." The **one genuine gap** is that
`selectFedosDirectConversationForwardSecrecyRoute()` — the module actually
named in this Arc's own charter as the forward-looking per-conversation
decision point, and the one a UI/send-path integration is most likely to
consume — collapses this same distinction into the single reason
`"no-session-for-conversation"`, which is ambiguous between "peer never
discovered" and "peer discovered/trusted, but no session bootstrapped yet."

If a future arc wants that distinction surfaced through
`FedosForwardSecrecyUnavailableReason` specifically (e.g. for a UI that
should say "establishing secure session..." rather than a flat
"not available"), **one new, narrowly-scoped reason** would be genuinely
truthful and non-frivolous:

- `"peer-device-trusted-session-not-established"` (name a candidate,
  precise, not invented for its own sake) — returned when a Registry lookup
  for a discovered/trusted remote device pair exists but
  `sessionPersistence.listSessions()` has no record for this conversation
  yet. This would require `selectFedosDirectConversationForwardSecrecyRoute()`
  to additionally consult `resolveFedosDirectRatchetDevicePair()` (or an
  equivalent trust-only probe) before falling back to the current
  `"no-session-for-conversation"` — a real, additive code change to that
  one function's branching, not a cryptography change, and not strictly
  required (the wiring can also be entirely done at the layer that calls
  `registerDevice()`/`confirmTrust()` plus a session-bootstrap trigger,
  leaving this function untouched and accepting the coarser message).

No other new states are needed. Every device-trust-scoped rejection reason
(`*-unknown`, `*-revoked`, `*-not-trusted`) already exists in both
`resolveFedosDirectRatchetDevicePair()` and (for the remote side)
`selectFedosDirectConversationForwardSecrecyRoute()`, and is exactly what a
discovery protocol would need to report through once wired to the real
Registry.

---

## 3. Does the ratchet cryptographic protocol itself need to change?

**No. This is 100% a Registry/trust-gate wiring problem**, confirmed by
reading the actual crypto boundary:

- `FedosDirectRatchetCryptographicSession.createAsReceiver()` /
  `.createAsSender()`
  (`fedos_direct_ratchet_cryptographic_session.ts:380-427`) take exactly:
  `masterSeedAuthority`, `accountIndex`, `counterpartyPublicKeyHex`,
  `sessionId`, `localDeviceRef`, `generation`, and (sender only)
  `remoteRatchetPublicKeyHex`. **No parameter here encodes HOW the
  counterparty's public key was learned or trusted** — it is handed in as an
  opaque, already-resolved hex string. The crypto layer has no concept of
  "discovery protocol," "pairing," or any provenance at all.
- The ONLY caller-side gate deciding whether that call is even reached is
  the Registry trust check in `resolveFedosDirectRatchetDevicePair()`
  (§1/§2 above) — a pure TypeScript function with zero crypto, entirely
  upstream of `FedosDirectRatchetCryptographicSession`.
- `FedosDirectRatchetSealingAuthority`
  (`fedos_direct_ratchet_sealing_authority.ts:32`) is a type alias of
  `SealingAuthorityPort`, concerned only with sealing/restoring session
  secrets (root key, chain keys, local private key, skipped keys) via
  `masterSeedAuthority` + `remoteDeviceRef` (a plain string) +
  `conversationId` — again no provenance concept.
- Session identity itself (`toFedosDirectRatchetSessionId()`,
  `fedos_direct_ratchet_session_id.ts:100-129`) is built from account/device
  ref strings + conversationId + suite + generation — a discovery-sourced
  device ref is structurally indistinguishable from a pairing-sourced one.

**Conclusion:** the crypto only needs a device public key + a trust flag
(from the Registry), exactly as the task's working hypothesis stated. No
concrete incompatibility was found; none is being claimed. This is a
Registry-population problem, not a ratchet-redesign problem.

---

## 4. Restart/replay safety

**Session state persists correctly across restart today.**
`AppendOnlyFedosDirectRatchetSessionPersistence`
(`persistence/append_only_fedos_direct_ratchet_session_persistence.ts`) is an
NDJSON event-sourced log: `putSession()` enforces `revision` is exactly
`(current highest + 1)` or exactly `0` for a brand-new `sessionId`
(`conflict` otherwise), `listSessions()`/`getSession()` replay to the
highest-revision record per `sessionId` (lines 46-131). Replay THROWS on any
malformed line, revision gap, or binding disagreement across revisions of the
same `sessionId` (lines 52-88) — fail-closed, never silently repaired.

**Would a new peer-device fact source risk a replay/duplicate-session bug?**
No, provided the discovery protocol always resolves to the SAME `deviceId`
string for the same logical peer device (which is its own job to guarantee,
outside ratchet scope). Reasoning, cited:

- `FedosDirectRatchetSessionId` is fully **deterministic** from the tuple
  `(localAccountRef, localDeviceRef, remoteAccountRef, remoteDeviceRef,
  conversationId, suite, generation)`
  (`fedos_direct_ratchet_session_id.ts:100-129` — "Deterministic
  construction only... the identical component tuple always produces the
  identical id").
- `resolveFedosDirectRatchetDevicePair()` sorts the two (account,device)
  slots into a FIXED, side-independent order (lines 202-207 of
  `fedos_direct_ratchet_device_pair_resolver.ts`) specifically so both
  participants compute the byte-identical session id regardless of who
  initiated — this is unrelated to and unaffected by how either side's
  Device came to be trusted.
- `fedosDirectRatchetSessionBindingsEqual()`
  (`fedos_direct_ratchet_session_binding.ts:44-60`) is the substitution
  check every recovery path uses — it compares `sessionId`, both device
  refs, both account refs, `conversationId`, `suite`, `generation` — a
  discovery-sourced fact populating the SAME `remoteDeviceRef`/`accountRef`
  fields a pairing-sourced fact would have populated is indistinguishable
  to this check, by design.
- The append-only log's own conflict rule (§ above) means a second write
  attempt for an existing `sessionId` at an already-used revision with
  DIFFERENT content is a hard `"conflict"`, never silently overwritten — so
  even a buggy discovery integration that tried to re-derive/re-write a
  session record would fail closed rather than corrupt state.

**Genuine risk to flag (not a crypto bug, an integration discipline risk):**
if a future discovery protocol ever assigns a NEW/different `deviceId`
string to what a human would consider "the same physical device" (e.g. on
re-announcement after some local reset), the session-id determinism above
would silently treat it as a DIFFERENT device pair — a new session id,
`generation` scan finds nothing, a fresh `generation: 0` session starts. This
is not unsound (no key/generation reuse), but it does mean device-identity
stability is entirely the discovery protocol's own responsibility; the
ratchet layer has no independent "same person, new device string" merge
logic anywhere, and none should be expected to appear here.

---

## 5. Multi-device: peer with more than one trusted device, same account

**`resolveFedosDirectRatchetDevicePair()` alone handles this correctly** —
it is always called with one explicit `remoteDeviceRef`
(`fedos_direct_ratchet_device_pair_resolver.ts:55`), so multiple trusted
devices for the same remote account simply means multiple independent
session tuples/session ids can coexist — each `(..., remoteDeviceRef, ...)`
combination is its own row in `findCurrentFedosDirectRatchetSession()`'s scan
(lines 92-108), by design ("one independent ratchet session identity for a
(local account, local Device, remote account, remote Device, ...) tuple" —
file header, lines 6-7).

**The send-time route selector does NOT tolerate ambiguity at that layer**:
`selectFedosDirectConversationForwardSecrecyRoute()` explicitly detects when
more than one DISTINCT remote device has a session bound to the same
conversation at the same (highest) generation and fails closed rather than
guess:

```ts
const distinctDeviceRefs = new Set(current.map((record) => record.binding.remoteDeviceRef));
if (distinctDeviceRefs.size > 1) return legacy("ambiguous-remote-device");
```

(`fedos_direct_conversation_forward_secrecy_route.ts:107-129`, comment at
line 67: "Several distinct remote Devices have sessions for this
conversation and no single one can be chosen without guessing. Fail closed
rather than pick arbitrarily.")

**Implication for a discovery protocol:** discovering and trusting a SECOND
device for an already-known peer account does not itself break anything
(the Registry, the pair-resolver, and session persistence all handle
multiple devices per account natively, matching the same multi-device
pattern this codebase already established for LOCAL accounts). But it does
mean whatever layer decides to actually BOOTSTRAP a ratchet session (call
`resolveFedosDirectRatchetDevicePair()`/create the crypto session) for a
freshly-discovered peer must pick exactly one target `remoteDeviceRef` per
conversation — the existing `"ambiguous-remote-device"` fail-closed behavior
already protects the send path from an accidental multi-device fan-out, but
provides no automatic "pick the newest/best device" policy; that policy
would need to live in whatever conversation-establishment logic consumes
discovery output, not in the ratchet layer itself.

---

## 6. Verification of `docs/reviews/fedos-direct-ratchet-readiness-current.md`

Re-read in full and checked claim-by-claim against current HEAD:

- **"Ratchet session establishment requires the counterparty's Device to be
  a `trusted` binding in the local Device Registry"** — CONFIRMED
  (`resolveFedosDirectRatchetDevicePair()`, §1 above).
- **"The only production writer of that registry is same-account Device
  Pairing... explicitly same-account-only by design"** — CONFIRMED at one
  level removed: the only production writer of `FedosDeviceRegistryPersistence`
  is `PersistedFedosDeviceTrustAuthority`, and its own registration-authority
  policy plug-in point (`FedosDeviceRegistrationAuthority`) currently only
  ships `unavailable_fedos_device_registration_authority.ts` as its
  production-shipped adapter alongside pairing-challenge-based
  implementations — no drift found; this doc's framing is accurate and this
  session additionally located the EXACT plug-in seam
  (`fedos_device_registration_authority.ts:52-57`) a discovery protocol
  would implement.
- **"`FedosDesktopRuntimeConfig.directRatchetMessageDeliveryRemoteDeviceRef`
  is a single, runtime-wide, construction-time-fixed device ref"** —
  CONFIRMED, and independently traced further than the prior doc did: this
  field feeds `ratchetDelivery.remoteDeviceRef`
  (`fedos_conversation_runtime.ts:901-915`), which is what
  `FedosConversationDirectMessagingCoordinator` actually uses to decide the
  REAL send route (`fedos_conversation_direct_messaging_coordinator.ts:246-247`,
  `ratchetDelivery !== undefined` takes priority). The PER-CONVERSATION
  `forwardSecrecySelector`/`selectFedosDirectConversationForwardSecrecyRoute()`
  wired alongside it is explicitly comment-labeled "Reporting only: it never
  changes which route runs" (`fedos_conversation_runtime.ts:932-936`) — so
  today, even a fully-populated, multi-peer-capable Device Registry would
  NOT by itself make Ratchet the real send route for more than the one
  construction-time-fixed device; the send-path wiring gap this doc calls
  "separate, and independent" is confirmed still separate and independent of
  the discovery-protocol gap.
- **"A validly-signed peer-capability advertisement from a genuinely
  different account is still rejected `untrusted-device`... acceptance is
  gated on that same Registry's trust state, not on signature validity
  alone"** — not independently re-verified in this pass (out of this task's
  file list; Agent C/prior doc's own citation of
  `fedos_ratchet_peer_capability_acceptance_policy.ts` was not re-read here).
  No contradiction found in anything this pass did read.
- **"`resolveFedosDirectRatchetDevicePair()`... already correctly separates
  'session resolution' from 'trust gate'... a real discovery protocol would
  plug in as a NEW Registry writer, requiring zero change to this
  resolver's own logic"** — CONFIRMED, and this pass adds the specific
  mechanism: the "NEW Registry writer" is concretely
  `PersistedFedosDeviceTrustAuthority.registerDevice()` +
  `.confirmTrust()`, gated by a new `FedosDeviceRegistrationAuthority`
  implementation (§1).
- **"`selectFedosDirectConversationForwardSecrecyRoute()`... already fails
  closed and honestly on every one of the 'no discovery yet' cases"** —
  CONFIRMED verbatim reason list (§2), with the added nuance (not present in
  the prior doc) that a SEPARATE, broader module
  (`fedos_direct_ratchet_route_resolution.ts`) already has a MORE precise
  reason (`"session-initialization-required"`) for the "peer now trusted,
  session not yet bootstrapped" case that `fedos_direct_conversation_forward_secrecy_route.ts`
  itself does not surface.

**No drift found.** Every claim in the prior doc holds against current HEAD.
This pass's marginal additions: (a) the exact `FedosDeviceRegistrationAuthority`
plug-in seam and its two-call minimal contract, (b) the observation that
`"session-initialization-required"` already exists one module over from
where the prior doc's own conclusion implicitly expected a gap, (c)
independent confirmation that the send-path wiring gap
(`directRatchetMessageDeliveryRemoteDeviceRef`) is real, single-valued, and
architecturally separate from the discovery-protocol gap, traced one level
deeper into `FedosConversationDirectMessagingCoordinator`'s actual route
priority.

---

## File index (all paths relative to repo root)

- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_device_pair_resolver.ts`
- `src/os/messenger/conversations/ratchet/fedos_direct_conversation_forward_secrecy_route.ts`
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_route_resolution.ts`
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_lifecycle.ts`
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_readiness.ts`
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_sealing_authority.ts`
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_cryptographic_session.ts`
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_binding.ts`
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_id.ts`
- `src/os/messenger/conversations/ratchet/persistence/fedos_direct_ratchet_session_persistence.ts`
- `src/os/messenger/conversations/ratchet/persistence/append_only_fedos_direct_ratchet_session_persistence.ts`
- `src/os/messenger/conversations/runtime/fedos_conversation_runtime.ts` (lines ~894-949)
- `src/os/messenger/conversations/messaging/fedos_conversation_direct_messaging_coordinator.ts` (lines ~131-250)
- `src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.ts` (line 602)
- `src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts` (lines ~1029-1064)
- `src/os/messenger/device/fedos_device_binding.ts`
- `src/os/messenger/device/persistence/fedos_device_registry_persistence.ts`
- `src/os/messenger/device/persistence/persisted_fedos_device_trust_authority.ts`
- `src/os/messenger/device/fedos_device_registration_authority.ts`
- `docs/reviews/fedos-direct-ratchet-readiness-current.md` (re-verified, no drift)
