# Secure Runtime Alpha 7721-7800 — Threat and Trust Model

FedOS Archive Multi-Device Suppression Propagation Arc — Phase B

## Trusted sender — precise definition

A suppression fact's SOURCE is trusted if and only if ALL of the following hold, checked
by the RECEIVING device against its own local state:

1. **Same account** — the fact's `accountRef` (authority + publicIdentifier) matches the
   receiving Device's own local account identity exactly. A structural, not cryptographic,
   first gate (mirrors Device Sync's own existing `accountRef`-scoping).
2. **Currently trusted Device** — `sourceDeviceId` resolves to a binding in the receiving
   Device's own local Device Registry (`FedosDeviceRegistryPersistence`) with
   `trustState === "trusted"` **at the moment of receipt**, checked live via the real,
   existing `isDeviceTrusted()` evaluator — never cached, never assumed.
3. A **previously-trusted-but-now-revoked** Device's facts are rejected outright — checked
   by the same live evaluator (revocation is terminal and immediately reflected, per §9 of
   the reconciliation report). A fact that arrives from a Device the receiver has since
   revoked is denied, not merely deprioritized.
4. A **locally-paired** Device (one this Device's own Registry actually knows about) is the
   only kind of Device that can pass check 2 at all — an unknown `sourceDeviceId` fails
   closed (`"unknown-device"`), never treated as an implicit account-level trust grant.
5. **Peer/recipient Devices (a different account's Devices) are never trusted senders for
   this fact type** — this is enforced structurally by gate 1 (`accountRef` match), not as
   a separate policy decision. A suppression fact is inherently a same-account artifact.

## Authorized receiver — precise definition

- **Same-account Device only** — for V1 (per the reconciliation report's own scope
  decision), the only authorized receiver of a suppression fact is another Device
  belonging to the SAME account. There is no "conversation peer Device" receiver type for
  this fact — that would be a materially different mechanism (see "Signed Deletion
  relationship" below), deliberately not built by this Arc.
- **V1 propagation scope, confirmed and finalized**: own-account Device Sync only,
  supported directly by the reconciliation report's source-level findings (§11 — the NIP-17
  control channel is structurally the wrong shape; §10 — Device Sync's `accountRef`/
  self-`["p", accountPublicIdentifier]` addressing is exactly the right shape). Signed
  Deletion acknowledgements remain wholly separate evidence about a DIFFERENT account's
  Device — never conflated with, and never automatically converted into, a suppression fact
  (Phase L proves this explicitly).

## Threat/edge-case handling, explicit

| Scenario | Handling |
|---|---|
| **Malicious Device** (a Device that IS in the local Registry but is actively lying) | Bounded by trust-state gating — a malicious Device that is still `"trusted"` locally can send a suppression fact the receiver will apply (this is the honest limit of any trust-based system: a currently-trusted party is, by definition, trusted). Mitigated by (a) the fact's own closed, minimal vocabulary (Phase C) — a malicious trusted Device can only ever claim "suppress this specific already-known subject," never inject arbitrary deletions of unrelated data (Phase G's own explicit requirement: "a peer-controlled fact [must never] delete unrelated local data" — this Arc's suppression fact is additive-restrictive only, it can make something MORE suppressed, never less, and never touches anything outside its own narrow subject reference), and (b) the receiver's own local, stronger decision always wins (Phase H hierarchy) — a malicious Device cannot UN-suppress something the receiver itself already tombstoned. |
| **Revoked Device** | Facts from a Device revoked before or at receipt time are rejected (`"revoked-source"`). Facts already durably imported from a Device BEFORE it was revoked remain applied — revocation never erases already-delivered history (existing, established Device Sync precedent — reconciliation report §10). |
| **Compromised Device** (a Device whose signing key has been exfiltrated but the binding itself is not yet revoked) | Indistinguishable from "malicious Device" from the receiver's own point of view until the account owner revokes it — this is a fundamental, disclosed limit, not a gap this Arc can close (no code can distinguish a compromised-but-not-yet-revoked Device from a genuinely trusted one; this is why revocation is the account owner's own responsibility, and why this Arc's suppression facts are additive-restrictive only, bounding the blast radius of a compromised Device to "can over-suppress its own already-known subjects," never "can exfiltrate or corrupt unrelated data"). |
| **Replay** | A suppression fact's own deterministic id (Phase C) makes exact-duplicate replay an idempotent no-op at the persistence layer (mirrors every other append-only log in this codebase). A replayed-but-stale (lower-revision) fact for the same subject+source is rejected by the revision/staleness check (Phase G), never re-applied, never treated as "new" evidence. |
| **Rollback** (a fact with a revision <= the max revision already seen for that subject+source) | Rejected outright, exactly mirroring Identity Transition's own rule (reconciliation report §8) — the LOCAL device's own already-applied suppression state is never weakened by a stale re-delivery. |
| **Missing Device** (a Device the sender believes exists but the receiver has no record of, or vice versa) | The sender's own outbound fanout (Phase F) only targets Devices present in the SENDER's own local Registry as `"trusted"` at enqueue time — a genuinely unknown-to-the-sender Device is never targeted at all (not a "missing" case, simply never enqueued). On the receive side, an inbound fact from a `sourceDeviceId` absent from the RECEIVER's own Registry fails closed as `"unknown-device"` (see "Trusted sender" gate 4) — this is a real, disclosed limitation: a Device pairing race (Device X pairs with the account after the suppression fact was already broadcast to the then-current Device set) means X may never receive that specific fact via original fanout. Not solved by this Arc — named as a declared limitation (Phase J/completion declaration), consistent with "do not fabricate global deletion propagation." |
| **Offline Device** | Remains in a durable, explicit `"pending"`/`"offline"` status (Phase I) — never silently promoted to "delivered" or "acknowledged." The sender's own local deletion/retention decision does NOT wait for any Device to come online (Phase F's own explicit requirement) — suppression propagation is eventually-consistent, best-effort, never blocking. |
| **Device replacement** | The existing `FedosDeviceReplacementCoordinator` flow (reconciliation report §9's Phase A research) always registers a brand-new `deviceId`/keypair and revokes the old one. A suppression fact addressed to the OLD `deviceId` before replacement is never received by the NEW one (a new Device pairing, from this mechanism's own point of view, is exactly the "missing Device" case above — the new Device was never a `"trusted"` target at original enqueue time). Not solved by this Arc; consistent with the existing Device Replacement flow's own accepted, pre-existing semantics (replacement is not silent continuity — a new Device starts with no synced history it wasn't separately given). |
| **Identity replacement** (Identity Transition) | Per the reconciliation report §12, no code path migrates Device Bindings' `accountRef` across an Identity Transition. **Explicitly out of scope and named as a declared limitation** — a suppression fact created under the OLD identity's `accountRef` will not automatically be recognized as belonging to the NEW identity's Device set. This Arc does not attempt to bridge this gap (doing so would require Identity-Transition-domain changes, prohibited by this Arc's own "no Identity Transition redesign" instruction). |
| **Foreign profile** (a genuinely different account, not merely an offline/never-informed same-account Device) | Never a trusted sender at all — rejected by gate 1 (`accountRef` mismatch) before any Device-trust check is even attempted. This is, and remains, the ALREADY-ACCEPTED, correctly-disclosed limitation from `feff676`'s own docs (§1 above) — this Arc does not touch this case, and does not claim to. |

## Summary: what V1 propagation IS and IS NOT

**Is**: a narrow, authenticated, best-effort mechanism for one account's own currently-
trusted Devices to learn "this device already decided subject X is suppressed" from each
other, so that a stale pre-deletion Archive cannot resurrect suppressed content/metadata on
an INFORMED device.

**Is not**: proof any other Device actually erased bytes; proof every Device received the
fact; a Relay-deletion mechanism; a backup-deletion mechanism; a recipient (different-
account) remote-erasure acknowledgement; account-wide physical-erasure proof; a fix for
foreign-profile restores; a fix for Devices that were never paired at broadcast time; a fix
for Devices that changed identity via Identity Transition.
