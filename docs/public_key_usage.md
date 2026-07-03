# FedOS Core — Public Key Usage Design (Stage 106)

`docs/public_key_provisioning.md` (Stage 104) and its Stage 105 update
fixed `FedosKeyFormatLabel` — what shape a key is. This document fixes
`FedosKeyUsageLabel` — what a key is allowed to be used FOR. The two are
kept deliberately separate: a single key format (say, a raw AEAD key)
could in principle be attached to more than one usage, and a real
authorization system built later needs to be able to ask "is this key
allowed to encrypt?" independently of "is this key shaped like an AEAD
key?" As of Stage 106, `packages/fedos-core-rust/src/lib.rs` gains a
label-only PUBLIC `FedosKeyUsageLabel` type (plus
`FedosKeyUsageState`/`FedosKeyUsageStatus`/`FedosKeyUsageDescriptor` and
one fixed accessor) that mirrors the shape described below. This remains
a design record, not an implementation.

## 1. Why format and usage are separate dimensions

Conflating "what shape is this key" with "what can this key do" is a
common source of real-world key-management bugs: a signing key
accidentally used for encryption, or a transport key silently reused for
long-term storage. Keeping `FedosKeyFormatLabel` (Stage 105) and
`FedosKeyUsageLabel` (this stage) as two independent enumerations means a
future authorization design can check both dimensions explicitly,
instead of inferring usage from format (which does not generalize — the
same raw-key format can serve more than one usage) or inferring format
from usage (which does not generalize either — a Nostr secret key and an
external opaque key reference could both, in principle, serve a signing
usage).

## 2. The eight usage labels

- `EncryptionPlaceholder` / `DecryptionPlaceholder` — the two AEAD
  directions, kept separate so a future authorization rule could permit
  one without the other (e.g. a write-only key that can encrypt outgoing
  data but never decrypt incoming data).
- `SigningPlaceholder` / `VerificationPlaceholder` — the two signature
  directions, kept separate for the same reason (a verification-only
  public key never needs signing authorization).
- `KeyDerivationPlaceholder` — using this key as KDF input material,
  distinct from using it directly for AEAD.
- `StoragePlaceholder` — this key is meant to persist across sessions,
  as opposed to a transient, single-operation key.
- `TransportPlaceholder` — this key (or a value derived from it) is
  meant to cross a network or process boundary, as opposed to staying
  entirely local.
- `TestOnlyPlaceholder` — the fixed sentinel this stage's own placeholder
  function returns; never a real usage.

None of these labels is a statement that this crate performs the
associated operation — every one is intent only, and `encrypt`/`decrypt`/
`deriveKey`/signing/verification remain entirely unimplemented.

## 3. What a future authorization design would check

A future, separately-reviewed authorization stage is expected to check a
`(FedosKeyFormatLabel, FedosKeyUsageLabel)` pair before permitting any
real operation — for example, refusing to use an
`ExternalOpaqueKeyRefPlaceholder`-formatted key for a `SigningPlaceholder`
usage if the external key store does not expose a signing operation.
This document does not fix that check's exact rule set; it only fixes
that usage is a first-class, independently-labeled dimension a future
rule set can reference.

## 4. What this stage implements

Nothing beyond one label-only type group:

- **`FedosKeyUsageLabel`** — the eight labels above.
- **`FedosKeyUsageState`** (`Unavailable` / `Placeholder`) and
  **`FedosKeyUsageStatus`** (carries only the state).
- **`FedosKeyUsageDescriptor`** (carries only `label`/`status`), returned
  by **`fedos_key_usage_descriptor_placeholder()`** — permanently labels
  `TestOnlyPlaceholder` with an `Unavailable` status, takes no input.

No function anywhere enforces a real authorization rule, binds a usage
label to an actual key, or restricts what a real operation may do — there
is no real operation to restrict yet. No raw key byte, owned string, or
growable byte collection exists anywhere in this group.

## 5. Roadmap

1. Design the `(FedosKeyFormatLabel, FedosKeyUsageLabel)` authorization
   rule set referenced in section 3, as its own explicitly-reviewed
   stage — still no implementation.
2. Once real key generation/import exists (behind
   `FedosKeyGenerationBoundary`/`FedosKeyImportBoundary`), attach a real
   `FedosKeyUsageLabel` value to the resulting opaque handle.
3. Enforce the rule set from step 1 at the point each real operation
   (`encrypt`/`decrypt`/signing/verification/`deriveKey`) is implemented,
   never before those operations themselves exist.
