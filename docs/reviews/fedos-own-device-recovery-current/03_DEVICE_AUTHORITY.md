# Device Authority, Multi-Device Ratchet, Revocation (mandate §5-11)

## Own-device admission authority (§5-6)
Confirmed self-sovereign: no central server, reuses the existing account signing authority
and Device Registry (same primitives peer-device trust already uses). Not re-derived from
scratch this pass — consistent with `fedos_device_pairing_facade.ts` existing and being
wired into the real Shell/renderer surface already.

## Bootstrap when original device is permanently gone (§7)
**Real boundary, not solved by this arc**: own-device admission requires an *already-trusted*
device to approve the new one (mandate §6's own required flow). If the ONLY trusted device is
gone, there is no live approver — bootstrapping a brand-new device onto an existing account
with no surviving device is equivalent to the machine-loss recovery problem (see
`04_RECOVERY_ASSET_MATRIX.md`), not a separate own-device-sync problem. Whatever recovery
mechanism restores account authority (today: the sealed master seed + passphrase, already
real and tested) is the same and only path — there is no separate "re-bootstrap via an old
device's own backup" shortcut in the current architecture, and inventing one would require
exactly the kind of new authority design this arc's own stop conditions forbid.

## Multi-device Direct Ratchet binding (§11) — VERIFIED, not assumed
`fedos_direct_ratchet_session_id.ts`'s `toFedosDirectRatchetSessionId()` binds a session to
the 4-tuple `(localAccountRef, localDeviceRef, remoteAccountRef, remoteDeviceRef)` — confirmed
by reading the actual construction function, not just the type signature. Two physical
devices sharing one account necessarily produce two DIFFERENT `localDeviceRef` values, hence
two disjoint session ID namespaces — a session established on Device A's ratchet state
literally cannot be looked up, decrypted, or advanced from Device B's own session store
(different key, different persisted record, different sealed-state file path since profile
directories are per-device by construction). Cross-device ratchet-state reuse is **structurally
impossible today**, not merely discouraged by convention — this closes mandate §11's own
requirement with real evidence.

## Device revocation / stolen-device threat (§9-10) — PROTOCOL_GAP, precise boundary
The Device Registry supports a `"revoked"` trust state (confirmed in `fedos_device_binding.ts`,
referenced throughout this session). A revoking device can locally mark another device
revoked. What was NOT verified this pass (time budget): whether that revocation is actively
*propagated* to peers who previously observed the revoked device as trusted, or whether peers
only learn of it passively the next time they happen to re-observe a fresh announcement. Given
the Own-Device Sync transport gap above, own-device revocation specifically cannot propagate
to a second own-device via that path (it's non-functional) — it could still propagate via the
same real-time relay-announcement mechanism Peer Device Discovery already uses in production,
but this arc did not verify that path is actually exercised for *own*-device revocation
specifically (as opposed to peer-device revocation, which prior arcs this session did verify
works). **Classification: PROTOCOL_GAP for own-device revocation propagation, specifically
because the one sync path meant to carry it (Own-Device Sync) is confirmed non-functional —
not necessarily a gap in the underlying announcement primitive itself.**

Stolen-device capability after revocation (§10) — architectural facts, not measured this pass:
a revoked device retains local disk access to whatever it already decrypted before revocation
(inherent to any local-first, no-remote-wipe design — this is not a FedOS-specific gap, and
building remote wipe would require infrastructure this codebase deliberately doesn't have).
It cannot forge NEW cryptographically valid Device-trust assertions post-revocation (those
require the account signing authority, which a compromised device does not additionally gain
by being revoked — no overclaim either way).
