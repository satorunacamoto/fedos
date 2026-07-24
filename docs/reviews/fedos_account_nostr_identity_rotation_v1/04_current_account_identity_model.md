# 04 — Current Account Identity Model

## What source proves

- **Directly derived from the Master Seed**: yes. `FedosProfileInitializationCoordinator.createProfile()`
  (`fedos_profile_initialization_coordinator.ts:268-394`) always calls
  `masterSeedAuthority.generate()` (line 312) — a fresh CSPRNG seed —
  before deriving any account identity. There is no code path that
  derives an account identity independent of a Master Seed.
- **accountIndex-bound**: yes. Every derivation call
  (`publicIdentityForAccount(accountIndex)`, `signEvent({accountIndex,...})`)
  takes `accountIndex` as an explicit parameter; the Rust primitives
  (`derive_nostr_secret_key_internal`, `lib.rs:3761-3800`) prove distinct
  `accountIndex` values genuinely derive distinct, deterministic keys —
  but no production caller varies it; `FixedFedosConversationLocalAccountIndexAuthority`
  hardcodes `0` and this was an explicit Alpha 689 decision, not an
  oversight, made specifically "to prevent a caller from silently
  selecting which cryptographic identity a call binds against."
- **Equal to the Nostr identity**: yes, exactly. `fedos_profile_initialization_coordinator.ts:373-377`/`:463-467`
  constructs the account identity as `{authority: "nostr", publicIdentifier: identity.publicKeyHex, identityId: null}`
  — there is no separate account-identity value anywhere in this
  codebase; it is the Nostr public key, wrapped in a generic reference
  shape whose `authority` field happens to be fixed to the literal
  string `"nostr"`.
- **Separable from the Nostr key**: no. There is no code, type, or
  persisted field representing "the account" independent of "the current
  Nostr key." `identityId` (the one field that COULD carry an
  independent, stable identifier) is hardcoded `null` at every real
  construction site found.
- **Persistently referenced by Conversations, Devices, and Archives**:
  yes, as a static string snapshot (`FedosDeviceBindingV1.accountRef`,
  `FedosConversationMembership.participant`, Archive bundle facts,
  `FedosRatchetPeerCapabilityObservationV1.peerAccountRef`) — none of
  these re-resolve the value live; each copies it at write time.
- **Reconstructible after unlock**: yes, deterministically. Rust's own
  unit tests (`lib.rs:6488`, `12446`, `12613`) directly assert bit-identical
  re-derivation across restore calls, and the Coordinator's own
  `unlockProfile()` (`fedos_profile_initialization_coordinator.ts:400-485`)
  hard-fails `"identity-mismatch"` if the re-derived pubkey ever differs
  from what the profile descriptor recorded — unlock is verification,
  never re-keying.
- **Replaceable without changing public identity**: no. There is no
  mechanism anywhere in this codebase that changes the Master Seed (or
  the `accountIndex`) while keeping the same `publicIdentifier`. The Rust
  `Empty → Available → Cleared` state machine (`lib.rs:11157-11163`)
  structurally forbids re-generating/re-restoring an already-`Available`
  authority; a new identity always requires a new authority instance
  (i.e., a new profile).

## What this review does not invent

No stable, cryptography-independent "account id" exists in this codebase
today, and this review does not invent one as a precondition for its own
recommendation. `identityId` remains a real, reserved, currently-`null`
field on every account/participant reference type — a future
Implementation Arc (`19`) MAY choose to populate it as the stable anchor
a rotation's continuity claim points at, but this review does not
pre-decide its exact value scheme; it only confirms the field already
exists structurally and is safe to use for that purpose without a schema
change.
