# 11 — Device Migration

## Options compared

- **A. Preserve Device identities under the new account** — REJECTED.
  Would require rewriting every `FedosDeviceBindingV1.accountRef` in
  place, contradicting the append-only Device Registry's own
  insert-only discipline, and would silently grant the new account every
  Device's existing trust with zero new evidence — exactly the
  "automatic trust from a label match" this review's own brief
  prohibits.
- **B. Replace every Device identity** — REJECTED as the ONLY option
  (too disruptive; a user's own already-paired laptop/phone are still the
  same physical, locally-trusted hardware) but its underlying mechanism
  (register-then-revoke, `f80889d`'s `FedosDeviceReplacementCoordinator`)
  is exactly what Option C reuses.
- **C. Rebind Devices through explicit authorization** — **CHOSEN.**
  Every Device the user still controls locally must be explicitly
  RE-PAIRED under the new account identity: a brand-new
  `FedosDeviceBindingV1` is registered (new `deviceId`, or at minimum a
  binding whose `accountRef` names the NEW account, verified via the
  SAME live two-part Account-to-Device authorization boundary,
  Alpha 3161-3240, run again under the new account's own signing
  authority), and the OLD binding is independently revoked/marked
  superseded. This is `f80889d`'s own register-then-revoke Device
  Replacement pattern, applied at account scope instead of Device scope
  — a reused structural template, not a new mechanism.
- **D. Preserve local Devices but require peer re-verification** — this
  is a NARROWER special case of C from the PEER's point of view (the
  peer must re-verify regardless), and is folded into C rather than kept
  separate, since C already requires the account-scope rebind
  irrespective of what any peer does.
- **E. Another evidence-backed model** — no other model surfaced during
  this review beyond C's own evidence levels (`07`).

## The chosen model, precisely

1. **Local Devices are never automatically carried over.** Each Device
   the user still physically controls must independently complete a real
   Account-to-Device authorization challenge under the NEW account's own
   Nostr signing authority — the exact same registration flow every
   Device already goes through today, just re-run under the new
   identity.
2. **A Device label or `deviceId` match is never trust.** If a "new"
   Device Binding happens to reuse a `deviceId` string from before (it
   should not, but nothing prevents an operator from choosing to), that
   is purely cosmetic; the ONLY thing that establishes trust is a fresh,
   real two-part signature (account authorization + Device
   proof-of-possession) verified under the account currently claiming
   ownership.
3. **The old Devices' bindings are not deleted** — matching the
   append-only Registry's own discipline — they are independently
   revoked (or, if a future Arc adds it, marked with a new terminal
   `"superseded"` state rather than plain `"revoked"`, to distinguish
   "this Device did something wrong" from "this Device's account moved
   on" — a NAMED, additive, NOT-YET-BUILT refinement this review flags
   for the Implementation Arc, not a requirement of V1's own minimum
   scope).
4. **Peers must independently re-verify each rebound Device.** A peer who
   already held a `FedosRatchetPeerCapabilityObservationV1` about a
   Device under the OLD account gets NO automatic continuity — the
   rebound Device, under the new account, is a new `peerAccountRef` +
   (possibly new) `peerDeviceRef` combination and is evaluated fresh by
   the SAME acceptance policy `d825aa0` already implements, unmodified.

## Why this is right for V1

This is the only option that (a) reuses a live, already-reviewed,
already-tested mechanism (Device Replacement) rather than inventing a new
one, (b) never grants automatic trust from a cosmetic match, and (c)
keeps peer-side evidence honest (a rebound Device really is new evidence
to a peer, and is treated as such) — directly consistent with `10`'s
"self-declared rotation is not automatic trust" rule and `f80889d`'s own
established Device-lifecycle precedent.
