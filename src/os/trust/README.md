# Trust (`src/os/trust/`)

## Status: real, tested, NOT wired into the packaged app

FedOS Trust / Offline Monetization + OSS Release Closure arc. Every module
under this directory is real, newly implemented code (not carried-forward
prototype scaffolding like most of `os/commerce`) with passing tests — see
`test/trust_*.test.ts`, `test/architecture_boundary_trust.test.ts`,
`test/trust_factory_composition.test.ts` (80 tests, 0 failures at the time
this file was written). It is **not yet referenced** from any of the
packaged Electron app's entry tsconfigs (`packages/fedos-desktop-electron-spike/tsconfig.*.json`)
or from `src/desktop/runtime/` / `os/messenger/desktop/runtime/`'s
composition root — per this repo's own honesty discipline
(`docs/architecture/ADDING-A-CAPABILITY.md`'s "Packaging implications"
section), a real, tested capability nothing calls yet is still "inert
scaffolding" from the shipped app's point of view. The one real, runnable
entrypoint today is the offline issuer CLI, `scripts/fedos_trust_issuer_cli.mjs`
(`npm run trust:issuer -- <subcommand>`), which is standalone Node tooling,
not part of the Electron app.

## Design goals

- **No mandatory FedOS server.** Every primitive here — signing, issuing,
  verifying, encoding/decoding — runs entirely locally. Nothing in this
  directory makes a network call.
- **Verifier-selected trust, not a universal root.** `FedOS Official` is one
  OPTIONAL issuer among any number a verifier may choose to trust (see
  "No universal root of trust" below) — never hardcoded as the only valid
  issuer.
- **Private keys never leave the device that generates them.** Every signing
  keypair (`envelope/fedos_trust_signing_keypair.ts`) is an opaque handle —
  no method returns the raw secret. The one place raw secret bytes are
  handled at all is the offline issuer's own key-loading path
  (`issuer/fedos_trust_issuer_secret_provider.ts`), and even there the
  design is "never touches git/CLI-args/logs" (see that file's header).
- **Reuse this repo's own existing crypto, never invent new primitives.**
  Every signature in this directory is Schnorr/secp256k1 via `@noble/curves`
  — the same library and curve this repo already uses in production for
  Nostr event signing/verification
  (`src/os/messenger/adapters/nostr/protocol/noble_signature.ts`,
  `src/os/messenger/device/crypto/fedos_device_signing_keypair.ts`). No new
  hash, no new key format, no new random generator.

## Non-goals

- Not a general-purpose authorization system — `capabilities/` is a small,
  narrow `CapabilityGrant` primitive, deliberately not a policy engine.
- Not a KYC/identity-verification product — `credentials/` binds a
  pseudonym to a public key; it never claims real-world identity.
- Not blockchain/smart-contract tooling — `contracts/` signs an already
  computed artifact digest; it makes no network or chain contact.
- Not a revocation infrastructure — `issuer/fedos_trust_issuer_status_list_types.ts`
  is an OPTIONAL, purely local, no-fetch data shape a verifier may check if
  it happens to have one; default verification never requires or blocks on
  its presence (see "Revocation" below).

## Threat model (brief)

Trusted: the verifier's own device, the verifier's own choice of which
issuer public key(s) to trust (`policy/`), the `@noble/curves` Schnorr
implementation. NOT trusted: any envelope's own self-declared `issuer`/
`keyId` fields (they are resolved against the verifier's OWN
`FedosTrustPolicy`, never taken at face value —
`envelope/fedos_trust_envelope_verify.ts`), QR-encoded text before
structural + cryptographic verification (`qr/` fails closed on
oversized/malformed/truncated input before any parsing), and the content
of anything a valid signature merely attests to signing (see "What a
signature does and does not mean" below — this is the single most
important thing to get right when building on top of this directory).

## Issuer / holder / verifier model

- **Issuer** — holds a `FedosTrustSigningKeypair` and issues signed
  envelopes (an entitlement, a credential, a capability grant, a contract
  proof). Anyone can be an issuer — "FedOS Official" is a documented
  profile (`policy/fedos_trust_official_issuer_profile.ts`), not a
  privileged role baked into the verification code.
- **Holder / subject** — controls the private key an envelope's `subject`
  field names (or is itself an issuer of e.g. their own pseudonymous
  credential or a self-signed `SubscriptionSigningRequest`).
- **Verifier** — constructs a `FedosTrustPolicy` naming exactly which
  issuer(s)/key(s) it trusts, then calls `verifyFedosTrustEnvelopeV1()` (or
  a domain-specific verify function layered on top of it). Two verifiers
  with different policies can legitimately reach different conclusions
  about the same envelope — that's the design, not a bug.

## No mandatory FedOS server

Every function in this directory that reads as a verb — issue, sign,
verify, encode, decode, resolve — is synchronous or `Promise`-returning
pure local computation. Nothing here calls `fetch`, opens a socket, or
depends on Electron. `issuer/` (the offline signer) is deliberately a CLI
tool an operator runs by hand, not a server process.

## Signed Envelope (`envelope/`)

`FedosTrustSignedEnvelope<TPayload>` — the one signed-artifact shape every
domain below is built from:

```
version, type, issuer, subject?, audience?, issuedAt, expiresAt?, nonce?,
payload, signatureAlgorithm, keyId, signature
```

- **Domain separation** — `type` is one of `fedos.subscription.v1` /
  `fedos.credential.v1` / `fedos.possession.v1` / `fedos.capability.v1` /
  `fedos.contract-artifact.v1` / `fedos.subscription-request.v1` /
  `fedos.status-list.v1`, and is itself a signed field — a signature
  produced for one type can never be replayed as another.
- **Canonicalization** — hand-written, fixed-field-order string building
  (`envelope/fedos_trust_canonical_bytes.ts`), matching this repo's own
  established per-record convention (see
  `src/os/messenger/conversations/deletion_request/fedos_deletion_request_canonical_bytes.ts`)
  rather than a generic JSON canonicalizer. Every domain owns its own
  payload canonicalizer, following the same style.
- **Versioning** — `version` must equal `FEDOS_TRUST_ENVELOPE_VERSION_1`;
  any other value fails closed (`unsupported-version`), never silently
  parsed as v1.
- **Clock** — expiry checks take an injectable `FedosTrustClock`
  (`() => number`, Unix seconds), never call `Date.now()` directly, so
  tests are deterministic.

## Subscription entitlement (`entitlement/`) — the core monetization primitive

`FedosSubscriptionEntitlement` — `subjectPublicKeyHex`, `planId`, `scopes`
(from the closed initial set `credential` / `signed-qr` /
`pseudonymous-credential` / `contract-proof`), `validFrom`/`validUntil`
(the actual subscription period — deliberately independent of the
envelope's own `issuedAt`/`expiresAt`), `serial`, `formatVersion`. No real
name/email/address/phone/device fingerprint is required or accepted for
cryptographic validity. Renewal always produces a NEW entitlement (new
`serial`, new validity window) — an existing signed entitlement is never
mutated; both remain independently verifiable at their own original terms.

`SubscriptionSigningRequest` — the subject's own self-signed, non-secret
request artifact (`subjectPublicKeyHex`, `requestedPlan`,
`requestedScopes`, `requestNonce`, `createdAt`) an operator can verify
possession of the subject key against before issuing.

See `docs/architecture/OFFLINE-MONETIZATION-MODEL.md` for the full
end-to-end flow and `docs/operations/OFFLINE-ISSUER-RUNBOOK.md` for the
operator's own procedure.

## Offline issuer (`issuer/` + `scripts/fedos_trust_issuer_cli.mjs`)

`npm run trust:issuer -- <subcommand>`:
`generate-key` / `inspect-key` / `sign-entitlement` / `verify-entitlement`.
The production secret key is loaded via `FedosTrustIssuerEnvFileSecretProvider`
— an env var (`FEDOS_ISSUER_KEY_FILE`) holds a FILE PATH, never the secret
itself; the secret is read once, used, and never logged or printed. No
production secret belongs in git, fixtures, docs, CLI arguments, logs, or
test snapshots — tests use freshly-generated synthetic keys only.

## Pseudonymous credentials (`credentials/`)

Binds a pseudonymous label/handle to a subject public key under an
issuer's statement. Explicitly does NOT claim real-world identity — that
would require a separate, explicitly-named issuer policy, which nothing in
this directory implements today.

## Proof of possession (`possession/`)

Local challenge-response: a verifier issues a challenge (nonce + audience +
expiry, domain-separated as `fedos.possession.v1`), the subject signs it
back. `createInMemoryFedosTrustUsedNonceTracker()` provides best-effort,
process-local replay protection — durable/shared replay protection is a
caller-supplied concern (there is no server to hold that state centrally).

## Capability grant (`capabilities/`)

A small, intentionally narrow `CapabilityGrant` (`subject`, `resource`,
`permissions`, `delegationPolicy`) — a reusable Trust primitive, not a
general authorization system.

## Signed QR (`qr/`)

QR is TRANSPORT, not a security primitive — the signature already lives in
the envelope before it ever reaches the QR layer.
`encodeFedosTrustEnvelopeToQrText()`/`decodeFedosTrustEnvelopeFromQrText()`
losslessly encode/decode an already-signed envelope to/from a compact text
string (`fedos:trust:v1:` + base64url JSON); decode fails closed on
oversized/malformed/truncated input, checked before any parsing work.
Decoding never re-derives or re-checks the signature — callers must call
`verifyFedosTrustEnvelopeV1()` themselves with the right domain
canonicalizer afterward. `qr/fedos_trust_qr_image.ts` renders that text to
a PNG data URL / terminal string via the `qrcode` package (this arc's one
new dependency, MIT-licensed — see `LICENSE_STATUS.md`).

## Contract artifact proof (`contracts/`)

Signs an immutable artifact digest (`artifactDigestHex` + `digestAlgorithm`)
— no network/blockchain contact of any kind. Verification returns
`artifactSignature` (`VALID`/`INVALID`/an envelope failure reason) and
`contentClaim` (always `"NOT_EVALUATED"`) as SEPARATE fields — a valid
signature over a digest never implies the artifact is audited, secure,
legal, safe, approved, or deployed.
`verifyFedosTrustDelegatedContractProof()` layers this arc's serverless
delegated-monetization model on top: the artifact's own signature, a
subscription entitlement's signature, and the entitlement's `scopes`
(must include `"contract-proof"`) are checked independently, never
collapsed into one boolean.

## What a FedOS Official signature does and does not mean

A FedOS Official subscription signature means exactly: **"this public key
has a valid FedOS-issued entitlement for these scopes and this validity
period."** It does NOT mean: real-world identity verified, QR/credential
contents are true, a signed contract is safe or legal, a transaction is
legitimate, or any financial guarantee
(`policy/fedos_trust_official_issuer_profile.ts`'s
`FEDOS_OFFICIAL_ENTITLEMENT_MEANING_STATEMENT` is the canonical wording —
surface it verbatim in any UI/CLI output rather than paraphrasing).

## No universal root of trust

`policy/fedos_trust_policy_types.ts`'s `FedosTrustPolicy` is always
verifier-constructed. `createFedosOfficialTrustedIssuer(keys)` requires the
caller to supply the current public key(s) explicitly — this repository
contains **no hardcoded FedOS Official public key anywhere**, and never
will; that key is operator-held, generated and used entirely outside this
OSS repository (see `docs/architecture/TRUST-MODEL.md`).

## Revocation

No mandatory always-online revocation service. The default model is
short-lived entitlements that simply expire. `issuer/fedos_trust_issuer_status_list_types.ts`
defines an OPTIONAL signed status list an issuer may additionally publish;
a verifier that has one may check it, but its absence never blocks default
verification (arc brief's own
`VALID`/`EXPIRED`/`NOT_YET_VALID`/`REVOKED_IF_STATUS_AVAILABLE`/`UNKNOWN_STATUS`
distinction — this directory's verify functions return the first three
today; status-list-aware verification is left to the caller composing
`isSerialRevoked()` on top).

## Example: self-signed round trip

```ts
import { FedosTrustSigningKeypair } from "./envelope/index.js";
import { createFedosTrustPolicy } from "./policy/index.js";
import {
  issueFedosSubscriptionEntitlement, verifyFedosSubscriptionEntitlement,
  signFedosTrustSubscriptionSigningRequest, FEDOS_TRUST_SUBSCRIPTION_SIGNING_REQUEST_FORMAT_VERSION_1,
} from "./entitlement/index.js";

const issuer = FedosTrustSigningKeypair.generate();  // "self" — no FedOS Official involvement required
const subject = FedosTrustSigningKeypair.generate();

const request = signFedosTrustSubscriptionSigningRequest(
  {
    subjectPublicKeyHex: subject.publicKeyHex, requestedPlan: "self-signed",
    requestedScopes: ["credential"], requestNonce: "…", createdAt: Math.floor(Date.now() / 1000),
    formatVersion: FEDOS_TRUST_SUBSCRIPTION_SIGNING_REQUEST_FORMAT_VERSION_1,
  },
  subject,
);

const validFrom = Math.floor(Date.now() / 1000);
const entitlement = issueFedosSubscriptionEntitlement(
  request.payload, "self-signed", ["credential"], validFrom, validFrom + 60 * 60 * 24 * 30,
  issuer, "self", issuer.publicKeyHex,
);

const policy = createFedosTrustPolicy([
  { issuerId: "self", keys: [{ keyId: issuer.publicKeyHex, publicKeyHex: issuer.publicKeyHex }] },
]);
// verifyFedosSubscriptionEntitlement(entitlement, policy) -> { status: "VALID", ... }
```

## Security considerations

- Every negative-path test in `test/trust_*.test.ts` verifies: single-byte
  payload tamper, wrong `type`/`issuer`/`subject`, wrong scope, expired,
  not-yet-valid, unknown issuer key, key rotation window violation, replay
  under the same audience, reuse under a different audience, oversized/
  malformed/truncated QR text, and contract-digest tamper.
- Parser limits (`fedos_trust_limits.ts`) bound canonical envelope length,
  field string lengths, scope-array length, delegation-chain depth, and
  issuer-key-list length — a hostile oversized/deeply-nested input fails
  before real parsing/verification work happens.
- `verbatimModuleSyntax: true` (root `tsconfig.json`) is enforced
  repo-wide; every type-only import in this directory uses `import type`.
