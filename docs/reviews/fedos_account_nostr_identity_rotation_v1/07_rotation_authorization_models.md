# 07 — Rotation/Replacement Authorization Models

Compared against: key compromise, Device compromise, loss of all
Devices, offline recovery, split brain, rollback, usability,
implementation cost. Because `06` establishes V1's model as
**Replacement** (not Rotation), "authorization" here means: what
evidence makes a NEW identity's continuity claim (linking it to an OLD
identity) worth a peer's trust, never what makes the new identity itself
valid (a Replacement's own new identity is self-authorizing — it's just a
normal new Master Seed/account, valid the moment it exists).

| Model | Key compromise | Device compromise | Loss of all Devices | Offline recovery | Split brain | Rollback | Usability | Impl. cost |
|---|---|---|---|---|---|---|---|---|
| A. Old account key only | Attacker can forge the SAME claim (`09`) | N/A | Claim impossible (old key gone with the seed) | Yes, if old seed still held | Two different new identities can each claim succession | Not addressed by the model itself | Simple: one signature | Low |
| B. Old + new keys (dual-signature) | Same as A — an attacker holding the old key can produce both halves | N/A | Same as A | Yes | Same as A | Not addressed | Simple | Low |
| C. Old key + Device evidence (hybrid) | Weakened: attacker needs old key AND a currently-trusted Device's cooperation | A single compromised Device can still forge if it also holds/derives old-key signing | Claim impossible without old key OR a trusted Device with independent authority | Yes, if either evidence source is available | Reduced: requires the SAME evidence bundle be reproduced twice | Not addressed by itself; needs `17`'s revision discipline | Medium | Medium |
| D. Master-Seed-derived authorization only | Same weakness as A (Master Seed IS the old key's root) | N/A | Same as A | Yes | Same as A | Not addressed by itself | Simple | Low |
| E. Single trusted-Device authorization (no old key needed) | **Resistant** — a Device's own signing key is independent of the account's Nostr key (Alpha 3161-3240) | A single compromised Device can forge a claim with NO account evidence at all | Claim impossible (no trusted Device left) | No — requires an already-trusted, currently-reachable Device | Two different Devices could each authorize a different new identity if both are "trusted" | Not addressed by itself | Requires an existing paired Device | Low (reuses live primitive) |
| F. Multi-Device quorum | Resistant to single-key/single-Device compromise | Resistant to a single compromised Device | Claim impossible if quorum can't be met | No | Reduced, but requires more Devices | Not addressed by itself | Requires ≥2 already-trusted Devices, unbuilt today | High (no existing quorum primitive) |
| G. Peer/manual verification only | Resistant to any automated evidence forgery | Resistant | Always available (out-of-band) | Yes, always | Resolved by human judgment | Not addressed by itself | High friction (safety-number-style) | Low (no new crypto) |
| H. Hybrid (best-available evidence, explicit evidence level) | **Not falsely claimed resistant** — the evidence level itself communicates the compromise risk | Same | Degrades gracefully to "no linkage evidence" (still a valid, if unlinked, Replacement) | Yes, always (unlinked Replacement never requires anything) | `17`'s revision/conflict machinery still required, but evidence level lets a peer WEIGH competing claims | `17` | Medium — never blocks creating a working new identity, only affects how strongly linked it appears | Medium |

## Chosen: **Model H — hybrid, evidence-leveled, best-available**

V1 does not pick a single authorization mechanism and pretend it's
sufficient. It defines a **closed set of evidence levels** (mirroring the
exact `FedosRatchetPeerCapabilityEvidenceLevel` 3-state pattern `d825aa0`
already established) rather than a boolean `rotationValid`:

- `"unlinked-replacement"` — no continuity evidence at all (old identity
  unavailable/known-compromised); the new identity is valid on its own
  terms, contact re-establishment is manual.
- `"old-identity-signed"` — the OLD account's Nostr key signed a
  continuity claim naming the new identity. Weakest linkage evidence —
  proves only "whoever held the old key at claim time" (`08`, `09`).
- `"old-identity-and-device-evidence"` — the above, PLUS at least one
  currently-trusted Device (per the live Account-to-Device signature
  boundary, Alpha 3161-3240) independently attests the same claim. The
  strongest V1 evidence level; still not a quorum (F is explicitly
  deferred — no multi-Device quorum primitive exists to build on).

No single model from A-G is adopted alone; H is the adopted direction,
built entirely from live primitives (old-key signing already exists;
Device-evidence signing already exists via the SAME per-Device signing
keypair the peer-capability layer already reuses). Multi-Device quorum
(F) remains a named, explicitly deferred upgrade path for a LATER Arc,
not V1 — no quorum-counting/threshold primitive exists anywhere today
and inventing one is out of this review's scope.
