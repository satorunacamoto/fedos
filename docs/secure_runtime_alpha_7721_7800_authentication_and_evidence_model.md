# Secure Runtime Alpha 7721–7800 — Authentication and Evidence Model (Phase D/G)

Two independent authentication layers exist for a propagated suppression
fact — they must never be conflated.

## Layer 1 (primary, mandatory): the outer Nostr event signature

Every suppression fact travels as the `content` of a real, signed `kind:1`
Nostr event (`fedos_archive_suppression_event.ts`). The Inbound Handler
(`fedos_archive_suppression_inbound_handler.ts`) verifies this with the
EXISTING, UNMODIFIED `NobleSignatureVerifier` — real BIP-340 Schnorr
verification over a real NIP-01 event, no new primitive. This proves:

> "An account-authorized Device (one that holds this account's own
> activated signing capability) sent this."

It does **not** prove "Device X specifically sent this" — the account
signing capability is currently shared/activated per-account, not
cryptographically bound to one physical Device (Phase A reconciliation
report §9's own finding, unchanged by this Arc).

This layer is **mandatory**: `descriptor.author !==
payload.fact.accountRef.publicIdentifier` or a failed
`NobleSignatureVerifier.verify()` both fail closed to `"invalid-signature"`
before any embedded claim — including the fact itself — is ever acted on
(Phase M, tests 8 and 10 prove this against both a directly-forged
signature and a tampered outer/inner `sourceDeviceId` mismatch).

## Layer 2 (secondary, optional): Device-level evidence

`fedos_archive_suppression_fact_signing.ts` adds a **separate, optional,
best-effort** layer that narrows the claim to a specific
`sourceDeviceId`, using the existing `FedosDeviceSigningKeypair` /
`verifyFedosDeviceSigningSignature()` primitives (no new signing
algorithm) under a fixed, domain-separated preimage prefix
(`"fedos-archive-suppression-fact-device-evidence-v1:"`, distinct from
every other Device-signature domain in this codebase — Proof of
Possession, Peer Capability, Ratchet Session Reset, Identity Transition
Device Corroboration each define their own).

This layer is optional because `devicePublicKeyRef` is `null` in the
Device Registry for the common case today (Phase A reconciliation report
§9) — requiring it would make suppression propagation non-functional for
every Device that has not separately activated Device-level signing.

### `FedosArchiveSuppressionFactEvidenceLevel`

| Level | Meaning |
|---|---|
| `"self-authored"` | This Device's own just-created fact (`recordSelfSuppression`) — always trusted by construction, never subject to Device-evidence verification. |
| `"account-only"` | No Device evidence was present. Only the mandatory Layer 1 claim holds. Callers must never describe this as "Device X sent this." |
| `"device-verified"` | Device evidence was present, well-formed, cryptographically valid, AND matched the Registry's own known `devicePublicKeyRef` for `sourceDeviceId`. |
| `"device-evidence-invalid"` | Device evidence was present but did not verify (wrong key, bad signature, or Registry mismatch) — a stronger signal than `"account-only"` that something was tampered with or misattributed, but it is **never** treated as successful attribution. |

## The one hard rule this evidence model enforces

`FedosArchiveSuppressionObservationAuthority.evaluateSuppression()`
excludes `"device-evidence-invalid"` records from ever suppressing a
restore (Phase M, test proven in
`secure_runtime_alpha_7721_7800_archive_restore_integration.test.ts` #5
and failure matrix test 13's own sibling coverage) — **a tampered or
misattributed fact must never gain restore-suppression power**, even
though it is still durably recorded (for audit/diagnostic visibility,
never silently discarded).

`"account-only"` and `"device-verified"` are, deliberately, equally
authoritative for suppression purposes once past Layer 1 — Layer 2 only
ever narrows *whose* Device made the claim, it never gates *whether* the
claim is honored. Tightening that (e.g. requiring `"device-verified"`
before suppression takes effect) is future work that would first require
Device-level signing to become the common case, not the exception it is
today.
