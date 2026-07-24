# 08 — Old-Key and New-Key Proof

## New-key proof of possession

Uninteresting cryptographically but mandatory structurally: the NEW
identity's own account signature over the continuity claim already
proves possession of the new key, by the same mechanism every Nostr
event proves possession of its signer's key (real BIP-340 Schnorr,
`NobleSignatureVerifier`, unchanged). No new primitive needed — this is
identical to how `d825aa0`'s `authorizeFedosRatchetPeerCapabilityContent()`/
`verifyFedosRatchetPeerCapabilityAccountAuthorization()` already prove
account possession for capability advertisements. A future Implementation
Arc reuses this exact pattern for the continuity claim's own new-identity
signature, with its own distinct domain-separation string (never reusing
the capability-advertisement or session-reset preimage domains, per the
"never replayable across record types" discipline both already
establish).

## Old-key proof, and its hard limitation

An old-identity signature over the continuity claim proves "whoever held
the old account's Nostr private key at signing time produced this claim."
**It does not and cannot prove the old key was not, at that moment,
already in an attacker's hands.** This is the single most important
finding this review states plainly, in its own document (`09`), because
every rejected model in `07`/`18` fails for exactly this reason.

## What additional evidence may be used, and its honest limits

- **New-key proof of possession** — proves the new identity exists and
  the claim's author holds it. Does not, by itself, prove any
  relationship to a specific old identity (anyone can claim succession to
  anyone).
- **Device Binding proof** (Account-to-Device signature boundary,
  Alpha 3161-3240) — proves a SPECIFIC Device, already trusted under the
  OLD account, independently attests the claim. This is the strongest
  evidence V1 can produce, because the Device signing key is
  cryptographically independent of the account's Nostr key (`03`) — an
  attacker who only stole the Nostr private key does NOT thereby gain the
  Device's own signing key. But it is not sufficient alone either: if the
  Device itself is compromised (not just the account key), the same
  attacker can produce this evidence too (`07`'s Device-compromise
  column, `09`'s compromise matrix).
- **Trusted Device quorum** — strictly stronger than a single Device, but
  **no quorum-counting primitive exists in this codebase**; not built in
  V1 (`07`).
- **Master-Seed-derived authorization** — is exactly the same evidence as
  "the old key signed it," since the Nostr key IS Master-Seed-derived
  (`05`). Listing it as a separate, stronger mechanism would be
  overclaiming; this review does not.
- **Prior peer capability observations** (`d825aa0`) — a peer's own
  DURABLE record of having previously interacted with the old identity
  can be consulted locally to decide whether a continuity claim is even
  worth evaluating (e.g., "I have never heard of this old identity" is a
  strong signal to treat the claim as `"unsupported"`/`"conflicting"` —
  see `10`) — but an Observation record is evidence a LOCAL peer already
  holds, never something the transitioning account can present as proof.
- **Manual safety-number-style verification** — the only mechanism this
  review found that is resistant to EVERY compromise scenario in `09`
  (it moves trust outside any automated cryptographic channel entirely).
  Always the final fallback; never automated.
- **Recovery code** — no such mechanism exists in this codebase today
  (`15` confirms no passphrase-independent recovery secret exists beyond
  the sealed Master Seed itself); this review does not invent one.
- **Local user confirmation** — always required before a Replacement's
  continuity claim upgrades a peer's own LOCAL trust state beyond
  `"observed"`/`"verified"` (`10`) — no evidence combination in `07`
  automatically reaches an accepted, fully-trusted state without this
  step, matching `d825aa0`'s own "self-advertisement alone is not trust"
  principle, applied one layer up.

## Overclaim guard

No document in this review states that ANY single mechanism above
"solves" the compromised-old-key problem. `09` is the dedicated document
proving why none of them can, alone.
