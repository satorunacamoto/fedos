# Trust Authority Decision (Coordinator, mandate §8 mandatory stop condition)

**Question the mandate requires answering before any implementation begins:**
who may authoritatively bind account/persona identity → Device public
identity, for a Device belonging to an account OTHER than the verifying
node's own?

## Decision: NOT ambiguous. Proceed.

**Authority: the announcing account's own Nostr identity signing key
(self-sovereign, kind-1, BIP-340 Schnorr via the existing, unmodified
`FedosNostrSigningAuthority` / `NobleSignatureVerifier`), combined with an
independent device-level proof-of-possession signature from the announced
device's own keypair.**

This is not invented for convenience. It is the *only* structurally coherent
answer available, and it is the exact authority FedOS already uses for every
other trust fact an account makes about itself:

1. **No other candidate authority exists or is permitted.** Mandate §9
   explicitly forbids a central device directory, operator database, or
   central verification API. Agent A confirmed (01_CURRENT_DEVICE_AUTHORITY.md
   §2) no code path anywhere in this codebase lets a third party assert
   "Device D belongs to Account P" — the only entity that can ever know which
   devices are genuinely its own is the account itself. A local-first,
   no-central-authority system has exactly one root of trust for
   self-attested facts: the account's own signing key. This is not a new
   category of authority — it is the same authority that already signs
   messages, product listings, board posts, capability advertisements, and
   same-account device pairings in this codebase.

2. **This is not a downgrade from existing precedent — it is the identical
   bar same-account pairing already accepts.** Directly verified this session
   (`fedos_device_binding_registration_authority.ts:287-326`):
   `FedosDeviceBindingRegistrationAuthority.#performRegistration()` calls
   `registerDevice()` then immediately `confirmTrust()` in the **same call**,
   with **zero additional human step**, purely gated on two real signatures —
   an account-level kind-1 Schnorr signature (`accountAuthorization`) and an
   independent device-level Schnorr signature (`deviceProof`, proof of
   possession of the claimed device key). The terminal success outcome is
   literally named `"registered-trusted"`. So even for a device the account
   already controls locally, `"trusted"` in this codebase's own existing
   vocabulary already means "cryptographically verified dual-signature,"
   never "additionally human-verified." A cross-account announcement
   carrying the identical dual-signature strength (real account signature +
   real device proof-of-possession signature) can consistently reach the
   same `"trusted"` outcome without inventing a new, weaker or stronger bar
   than the one this codebase already applies to itself.

3. **This does not create a new trust boundary.** A compromised account key
   can announce arbitrary devices under its own identity — but a compromised
   account key already controls messages, product listings, and same-account
   device pairing in this codebase today. This protocol adds no new attack
   surface beyond what account-key compromise already grants; it is
   proportionate, matching the readiness doc's own prior assessment
   (`docs/reviews/fedos-direct-ratchet-readiness-current.md`, Option 1).

4. **Cryptographic trust is explicitly NOT human identity verification.**
   Per mandate §19/§27: a `"trusted"` Device Registry binding means "this key
   is cryptographically bound to this account," never "a human confirmed
   this is really the person I think it is." FedOS has no safety number and
   makes no such claim anywhere else either (`05_SECURITY_CLAIM_BOUNDARIES.md`
   standing limit, reused verbatim). This protocol does not change that
   boundary — it only extends the SAME cryptographic (not human) trust
   category same-account pairing already grants, across the account
   boundary.

## What this authority does NOT grant (explicit boundaries)

- It does not prove the announcing account is operated by a specific real
  human — no human identity verification ceremony exists or is added by this
  arc (explicitly out of scope, mandate §51).
- It does not survive identity replacement automatically — a device trusted
  under an account's OLD identity does not carry forward to the NEW identity
  without its own fresh, independently-evaluated announcement (§4.7 test
  category, `07_MULTI_DEVICE_AND_CONFLICT_MODEL.md`).
- It does not grant any device-enumeration capability — the announcement
  remains bilaterally addressed (sender/recipient), never a broadcast/public
  directory (mandate §15 privacy bound; Agent X §2.2).

**Conclusion: TRUST AUTHORITY AMBIGUITY does not apply. Proceeding to
`06_PROTOCOL_CONTRACT_FREEZE.md`.**
