# FedOS Trust Model

Status: **design document** for the "FedOS Trust / Offline Monetization +
OSS Release Closure" arc, written while `src/os/trust/` is still under
active, concurrent construction by other agents on this same arc. It
describes the target design this capability is being built to, not a
completed and independently re-verified implementation. Where this
document references real source files, those files existed and were read
at the time of writing (`src/os/trust/envelope/`, `src/os/trust/policy/`,
`src/os/trust/credentials/`); other subdirectories it describes
(`entitlement/`, `issuer/`, `possession/`, `capabilities/`, `contracts/`,
`qr/`) are planned and may still be in progress. A future pass should
cross-check this document's claims against the finished code before
treating it as verified, the same way `docs/architecture/CAPABILITY-MAP.md`
and `docs/architecture/COMMERCE-ARCHITECTURE.md` distinguish target shape
from measured shape.

Pure software architecture — no legal, compliance, or regulatory content,
and no claim of legal identity verification anywhere in this document.

## The one sentence that matters most

**FedOS Official is not, and cannot become, a universal root of trust.**
Every verifier decides for itself who to trust, through an explicit,
local, inspectable `TrustPolicy` object it constructs. FedOS's core
messaging and identity protocols work completely, with full functionality,
if FedOS Official (the organization) never issues a single credential to
anyone, ever. Trust in this system is opt-in and additive, never a
dependency the base protocol requires.

This is not a policy promise layered on top of the code — it falls out of
the actual shape of the types. `FedosTrustPolicy` (see
`src/os/trust/policy/fedos_trust_policy_types.ts`) is built from a plain
array of `FedosTrustedIssuer` entries the *verifier* supplies. Nothing in
the generic envelope-verification function
(`verifyFedosTrustEnvelopeV1` in `src/os/trust/envelope/fedos_trust_envelope_verify.ts`)
knows FedOS Official exists — it resolves `(issuer, keyId)` through
whatever policy it was handed, and a policy that never mentions
`"fedos-official"` verifies every bit as well as one that does.

## Who can be an issuer

Anyone. The `issuer` field on a signed envelope
(`FedosTrustSignedEnvelope.issuer`) is an opaque string label, not a
protocol-privileged identity. Concretely, all of the following are valid,
equally well-formed issuers under this design:

- **`"self"`** — a subscriber signs their own credential or entitlement
  with their own key. `createSingleIssuerFedosTrustPolicy()` exists
  specifically for this case: a policy that trusts exactly one
  issuer/key pair, so an app or user can say "I trust only myself" and
  mean it literally.
- **A community, company, or project** — any group can generate a
  keypair, publish its public key out-of-band (a website, a signed
  release, word of mouth), and start signing credentials or entitlements
  for its own members. Nothing in this design distinguishes such an
  issuer from FedOS Official except the label a verifier chooses to give
  it in their own policy.
- **`"fedos-official"`** — the one issuer identity this arc ships a named
  constant for (`FEDOS_OFFICIAL_ISSUER_ID` in
  `src/os/trust/policy/fedos_trust_official_issuer_profile.ts`), used for
  the optional paid subscription tier described in
  `docs/architecture/OFFLINE-MONETIZATION-MODEL.md`. Trusting it is never
  automatic: `createFedosOfficialTrustedIssuer()` requires the caller to
  supply the current public key(s) explicitly — there is no hardcoded key
  baked into this repository, and no default policy that trusts this
  issuer unless the consuming application or user opts in.

A verifier can also merge policies (`mergeFedosTrustPolicies()`) — for
example, an app might ship a default policy trusting FedOS Official *and*
let the user add their own community issuer's key, with no code change
required to support the second one.

## What "trust" means here, precisely

Trust in this design is **local, explicit, and per-verifier**. Two
verifiers can look at the exact same signed envelope and reach different
`ok`/`not-ok` verification results, because they constructed different
`TrustPolicy` objects — and that is intended behavior, not a bug or an
inconsistency to fix. There is no shared, canonical, network-visible
notion of "trusted" anywhere in this design; trust is a property of the
verifier's own local configuration, not a property the protocol assigns
to a key.

## The SignedEnvelope, conceptually

Every proof this capability produces — a subscription entitlement, a
pseudonymous credential, a proof-of-possession response, a capability
grant, a contract-artifact proof — is carried inside the same envelope
shape (`FedosTrustSignedEnvelope` in
`src/os/trust/envelope/fedos_trust_envelope_types.ts`). One shape, one
canonicalizer, one verifier, five-plus domains built on top of it. Its
fields, at a conceptual level:

| Field | Meaning |
| --- | --- |
| `version` | The envelope format version. Currently always `1`. See "Versioning" below. |
| `type` | Which signing *domain* this envelope belongs to (e.g. `fedos.subscription.v1`, `fedos.credential.v1`). See "Domain separation" below. |
| `issuer` | An opaque label identifying who signed this — `"self"`, `"fedos-official"`, or any operator-chosen string. Not a raw public key. |
| `subject` | An opaque identifier for who/what this envelope is about — conventionally the subject's own public key hex, but domain-defined. Optional. |
| `audience` | An opaque identifier for who this envelope is intended for, where that distinction matters (e.g. a proof-of-possession challenge response). Optional. |
| `issuedAt` | Unix seconds. When this envelope was signed. |
| `expiresAt` | Unix seconds. Envelope-level expiry, checked with a small clock-skew tolerance. Optional — some envelope types (e.g. a durable pseudonymous credential) may not expire at the envelope level even though a domain-specific payload field might carry its own validity window. |
| `nonce` | A single-use value, required on proof-of-possession responses for replay protection, optional elsewhere. |
| `payload` | The domain-specific content (the actual entitlement, credential, grant, or proof data). Each domain defines and canonicalizes its own payload shape — see "Domain separation" below for why this is not generic. |
| `signatureAlgorithm` | Which signature scheme was used. Currently always Schnorr over secp256k1 — the same primitive this repository's Nostr protocol layer already uses in production, not a new signature scheme invented for this capability. |
| `keyId` | Which of `issuer`'s keys signed this envelope. This is the rotation seam — see "Key rotation" below. |
| `signature` | The signature itself, over the SHA-256 digest of this envelope's canonical bytes (metadata + canonical payload). |

An envelope is signed over its own canonical byte serialization — a
fixed-field-order, hand-written serializer (never a generic
`JSON.stringify` of the whole object, and never a third-party JSON
canonicalization library), so that serialization is deterministic across
JS engines and repository versions forever. The `payload` field embeds a
caller-supplied, already-canonicalized string; each domain owns its own
payload canonicalizer rather than this format guessing at how to
serialize an arbitrary payload shape correctly.

## Domain separation: why `type` matters

The `type` field is a signed field — it is included in the canonical
bytes the signature covers. This means a signature produced for one
envelope type can never be reinterpreted as a valid signature for a
different type, even if two payload shapes happen to produce
overlapping or colliding serialized bytes. Without this, a signature an
issuer produced for, say, a pseudonymous credential could in principle be
replayed by an attacker as if it were a subscription entitlement or a
capability grant, if the raw signed bytes ever happened to coincide.
Domain separation via a signed `type` field closes that class of
cross-domain reinterpretation attack structurally, not by convention.

Every verifier that checks a specific domain (an entitlement verifier, a
credential verifier, a possession-proof verifier) is expected to pass an
`expectedType` to the generic envelope verifier and reject anything that
doesn't match exactly — never trust an envelope whose domain wasn't
explicitly checked.

Adding a new envelope type in the future is additive and safe. Renaming
an existing type literal, or reusing one for a different purpose than it
originally meant, reintroduces exactly the ambiguity this field exists to
prevent, and must never be done.

## Versioning: unknown versions fail closed

`version` is currently always `1` (`FEDOS_TRUST_ENVELOPE_VERSION_1`). The
generic verifier rejects any envelope whose `version` is not the one
version it understands, with a distinct `unsupported-version` failure
reason — it does not attempt to "best-effort" parse an unrecognized
version as if it were `v1`. If this envelope format's metadata shape ever
needs to change, the design calls for a new version constant and a
version-specific canonicalizer/verifier, never a silent redefinition of
what an existing version number means. This is a hard fail-closed rule:
an older or newer verifier encountering a version it doesn't recognize
must reject the envelope, not guess at its shape.

## What a FedOS Official subscription signature means — and does not mean

This is the single most important semantic boundary in this design, and
it is deliberately narrow. A verified `fedos.subscription.v1` envelope
signed by FedOS Official means exactly this, and nothing more:

> **This public key has a valid FedOS-issued entitlement for the stated
> scopes and validity period.**

It explicitly does **not** mean any of the following. Any code, UI copy,
or product decision that collapses this signature into a broader claim
than the list above is a design bug, not a stricter interpretation:

- It is **not** legal identity verification. FedOS Official does not
  check government ID, does not confirm a real name, and the subscriber
  behind a key may be pseudonymous or anonymous.
- It is **not** a claim that any content the subject later signs, posts,
  or sends is true.
- It is **not** a claim that a contract, listing, or transaction the
  subject participates in is safe, legal, or approved.
- It is **not** a financial guarantee of any kind — not a payment
  guarantee, not a refund guarantee, not an assurance the subject will
  deliver on any commitment.

This exact boundary is also stated as a load-bearing code comment and a
machine-surfaceable constant
(`FEDOS_OFFICIAL_ENTITLEMENT_MEANING_STATEMENT` in
`src/os/trust/policy/fedos_trust_official_issuer_profile.ts`), so UI and
CLI output can surface the same wording verbatim rather than each call
site inventing its own paraphrase that might drift from this meaning over
time.

The same narrowness applies to every other domain built on this envelope
format. A verified `fedos.credential.v1` envelope means only "the issuer
asserts this public key may use this pseudonymous label" — it is not a
real-world identity claim either, regardless of who the issuer is.

## Issuer key rotation

An issuer is not one eternal key. `FedosTrustedIssuer` holds an array of
`FedosTrustedIssuerKey` entries, each with its own `keyId`, its own
`publicKeyHex`, and optional `notBefore`/`notAfter` bounds (Unix
seconds). `resolveIssuerKey(issuer, keyId, atTimeUnixSeconds)` looks up
the specific key that was valid *at the time the envelope claims to have
been signed* — so:

- An issuer can retire an old key and start signing with a new one
  without invalidating envelopes the old key already signed within its
  own validity window.
- A verifier's `TrustPolicy` can hold multiple keys for the same issuer
  simultaneously — the current key and any number of historical keys —
  bounded by `FEDOS_TRUST_MAX_ISSUER_KEYS` (16) to keep policy resolution
  cost and object size bounded.
- There is no hardcoded, single, eternal public key anywhere in this
  repository for FedOS Official or any other issuer. The trusted-issuer
  key list is always supplied by the consuming application's or user's
  own configuration, never compiled into source as a constant.

This is what makes rotation possible without breaking already-issued,
still-valid entitlements, and without requiring any online lookup —
`resolveIssuerKey` never performs I/O; it is a pure function over
whatever key list the verifier's policy was constructed with.

## Issuer-compromise response

Because there is no centralized, always-online verification service,
issuer-key compromise is handled without one:

1. **Stop issuing.** The compromised key's holder stops signing anything
   new with it immediately.
2. **Ship an updated trusted-issuer set.** Applications and users that
   trust the compromised issuer update the key list in their own
   `TrustPolicy` configuration — removing the compromised key (or setting
   its `notAfter` to the compromise time) and, if the issuer is
   continuing, adding a freshly generated replacement key with a new
   `keyId`.
3. **Rotate.** The issuer generates a new keypair and begins signing new
   entitlements/credentials with the new `keyId`, following the same
   rotation seam described above.
4. **Let short-lived entitlements expire.** Because entitlements carry
   their own `expiresAt` and are meant to be time-bounded (see
   `docs/architecture/OFFLINE-MONETIZATION-MODEL.md` for the intended
   validity-period discipline), envelopes signed by a compromised key
   before the compromise stop being accepted as they naturally expire,
   without requiring any revocation-list lookup.

There is deliberately **no mandatory always-online revocation service** in
this design — no centralized endpoint a verifier must reach to check
"has this key been revoked?" A verifier who wants faster-than-expiry
protection can set `notAfter` on the compromised key in their own policy
the moment they learn of the compromise; that is a local configuration
change, not a network dependency. This preserves the offline-verifiable
property described in the sections above: verification never requires
contacting anything, before or after a compromise event.

## Official issuer key boundary: what is public, what is private

Stated plainly and as two labeled lists, because "FedOS Official" is the
one issuer this arc ships a named constant for, and precision here
prevents an operational mistake no amount of code review can undo once a
private key has touched the wrong disk.

**PUBLIC** — safe to commit to this repository, publish on a website,
print in documentation, or hand to any verifier:

- The FedOS Official issuer identifier (`FEDOS_OFFICIAL_ISSUER_ID`,
  `"fedos-official"`, in `src/os/trust/policy/fedos_trust_official_issuer_profile.ts`).
- FedOS Official's public key(s) (`publicKeyHex`), once generated.
- FedOS Official's `keyId`(s) for each of those keys.
- The verification policy an application ships or a user configures
  (`FedosTrustPolicy`, built via `createFedosOfficialTrustedIssuer()`) —
  this is local configuration data naming which public keys to trust, not
  a secret.

**PRIVATE** — must never appear in this repository, in any commit, in any
issue or pull request, in any log, or in any synced/versioned storage:

- The FedOS Official signing private key.

This repository contains **no hardcoded FedOS Official public key and no
FedOS Official private key material anywhere, and never will** — this is
the same fact stated from the rotation angle in "Issuer key rotation"
above. Operationally, that means the **production private key must be
generated outside this repository, and outside OneDrive, Dropbox, Google
Drive, or any other cloud-synced or version-controlled path.** Generating
or storing it inside any such location risks the secret being silently
replicated into a cloud provider's storage, a sync history, or a git
history the moment it touches disk there — regardless of whether it is
ever explicitly committed or shared. Generate it, and keep it, only on a
machine and a path outside all such sync/versioning surfaces. See
`docs/operations/OFFLINE-ISSUER-RUNBOOK.md`'s "One-time setup" section for
the exact operational procedure this maps to.

## What does not exist yet

- No revocation-list *protocol* — the design above relies on time-bounded
  entitlements plus local policy updates, not a defined revocation-list
  wire format. If a use case emerges that needs faster-than-expiry
  revocation at scale, that is unbuilt future work, not a gap in this
  document's honesty.
- No hosted, always-on FedOS Official issuance service exists in this
  repository. Issuance in this design is an offline CLI operation run by
  a human operator (see `docs/operations/OFFLINE-ISSUER-RUNBOOK.md`), not
  a running server.
- The `entitlement/`, `issuer/`, `possession/`, `capabilities/`,
  `contracts/`, and `qr/` subdirectories under `src/os/trust/` were still
  under active construction elsewhere in this same arc at the time this
  document was written; this document describes their intended design,
  not verified, finished code. Re-check against the merged implementation
  before relying on this document as a description of shipped behavior.
- No independent security audit of this capability has been performed —
  the same caveat `SECURITY.md` and `docs/pilot/KNOWN_RISKS.md` already
  state for the rest of this repository applies here too.

## Relationship to this repository's existing crypto

This design deliberately reuses this repository's own already-shipped
production signature primitive (`@noble/curves` Schnorr over secp256k1 —
the same library used by
`src/os/messenger/adapters/nostr/protocol/noble_signature.ts` and
`src/os/messenger/device/crypto/fedos_device_signing_keypair.ts`) rather
than introducing a second signature scheme into the codebase. This is a
deliberate minimization of cryptographic surface area, not an
accidental reuse.
