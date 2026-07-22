# 10 — Peer Acceptance and Trust Model

Directly reuses `d825aa0`'s own established discipline: "self-advertisement
alone is not trust," applied to identity-transition claims instead of
capability advertisements. A verified signature on a continuity claim
proves authorship, never acceptance.

## Closed evidence/acceptance states (never a boolean)

Mirroring `FedosRatchetPeerCapabilityAcceptanceOutcome`'s own 13-value,
non-boolean pattern:

- `"transition-advertised"` — a well-formed claim was received; nothing
  verified yet.
- `"signature-valid"` — the claim's own signature(s) verify against the
  claimed keys, per `07`'s evidence level (`old-identity-signed` /
  `old-identity-and-device-evidence` / `unlinked-replacement`).
- `"new-identity-possession-verified"` — the new identity's own
  self-signature is confirmed (trivial, always checked first).
- `"device-evidence-verified"` — for the `old-identity-and-device-evidence`
  level only: the named trusted Device's own signature independently
  verifies.
- `"locally-accepted"` — the RECEIVING peer's own local policy has
  chosen to treat the new identity as the accepted successor. Never
  automatic from signature validity alone.
- `"manually-verified"` — a human confirmed the transition out-of-band
  (safety-number-style). The strongest possible state; never required,
  always available.
- `"rejected"` — local policy declined the claim (e.g., insufficient
  evidence level for a peer's own risk posture).
- `"conflicting"` — two different claimed successors name the same
  predecessor identity at the same or overlapping revision (`17`).
- `"stale"` — a lower-revision or already-superseded claim (`17`).
- `"rollback-detected"` — a previously-accepted transition's predecessor
  identity reappears as if the transition never happened (`17`).
- `"superseded"` — this transition itself has since been succeeded by a
  later, accepted one.
- `"unsupported"` — the claim's schema/version/evidence-level combination
  is not one this peer's own implementation understands. Fails closed.

## The central rule

**Self-declared rotation/replacement is not automatic trust, at any
evidence level — including `old-identity-and-device-evidence`.** A peer
MAY continue treating the new identity as `"transition-advertised"`/
`"signature-valid"` only, deliberately short of `"locally-accepted"`,
even when the transition is cryptographically well-formed end to end.
This is a DELIBERATE, safe default this review requires, not an
oversight — it exists precisely because `09` proves no cryptographic
evidence level is immune to old-key/Device compromise; only the
receiving peer's own local policy (optionally informed by manual
verification) can decide how much residual risk it accepts.

## Safe user-visible states

Mirrors `d825aa0`'s own 10-value `FedosRatchetPeerCapabilitySafeStatus`
discipline — a future Arc's own DTO (not built here) should distinguish
at minimum: `unknown` (no claim seen), `observed` (claim seen, not yet
evaluated as accepted), `evidence-weak` (old-key-only), `evidence-strong`
(old-key + Device), `manually-confirmed`, `conflicting`, `stale`,
`superseded`, `rejected`, `unsupported`. **Never** a `"trusted"` value
derived from the claim's own signature alone — matching `d825aa0`'s own
Phase O rule verbatim, applied one layer up.
