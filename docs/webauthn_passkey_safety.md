# WebAuthn / Passkey Adapter — Safety Rules (binding)

**Status: this document adds no code.** It fixes, in writing, the safety
contract that `src/identity/webauthn_adapter.ts` (Stage 60) already implements —
the browser-provider ADAPTER seam that a future unlock flow would hand to the
Stage 36 `PasskeyBoundary` — so that when a real browser adapter is eventually
built (actual `navigator.credentials` calls), it cannot accidentally regress the
one rule that matters most: **WebAuthn / Passkey is an unlock TRIGGER, never a
key source, never an identity seed.**

If a future change to this area would violate a rule below, the rule wins —
change the code, not this document, or open a new Stage to renegotiate the rule
explicitly.

This is a safety contract, not a marketing claim. Nothing here should be read as
"secure", "audited", or "complete". It states what the WebAuthn adapter does and
does not do, and why. See [`docs/vault_crypto_identity.md`](vault_crypto_identity.md)
for the surrounding Vault / Crypto / Identity design, and the Stage 36 passkey
boundary (`src/identity/types.ts`, `src/identity/passkey_boundary.ts`).

---

## 1. Purpose of the WebAuthn adapter

`src/identity/webauthn_adapter.ts` exists for exactly one job: to be the
browser-provider SEAM that a future unlock flow uses to ask "did a WebAuthn
`get`/`create` succeed?" — nothing more.

- **Unlock-trigger boundary.** Its output feeds an *unlock trigger*, not a key.
  A successful WebAuthn ceremony means "the user proved presence, so we may try
  to unlock the local Vault" — it never means "here is key material."
- **Browser provider seam.** It names the states and capabilities a real browser
  WebAuthn provider WOULD expose (`WebAuthnProvider`), so a real adapter can drop
  in later behind the same interface without the rest of the app depending on any
  concrete browser API.
- **NOT a key source.** Nothing a WebAuthn ceremony produces (credential id,
  assertion, attestation, `authenticatorData`, `clientDataJSON`, signature) is
  ever turned into a private key, a symmetric key, a KDF input, or randomness.
- **NOT an identity seed.** No Apple ID, Google Account, `sub`, user handle,
  email, or profile field is ever turned into a Nostr key, a master seed, or any
  deterministic key-derivation input.

## 2. Absolute rules (never negotiable without a new Stage)

- **Apple ID / Google Account is NEVER a seed.** An account identifier, `sub`,
  OAuth subject, or any platform user id must never be hashed, KDF'd, or
  otherwise turned into key material or a master seed.
- **A WebAuthn credential ID is NEVER a seed.** The credential id (and its
  `rawId`) identifies an authenticator; it is not secret key material and must
  never seed a key derivation.
- **An assertion response is NEVER a seed.** The signature / assertion returned
  by `get` proves presence; it must never be fed into a KDF or used as key bytes.
- **A challenge is NEVER stored.** The random challenge a real relying party
  would generate is single-use and must never be persisted, logged, or retained
  past the ceremony.
- **`rawId` / `attestation` / `authenticatorData` / `clientDataJSON` are NEVER
  stored.** These ceremony artifacts must never be persisted or retained by the
  adapter or the app.
- **JWT / OAuth tokens are NEVER stored.** No bearer token, ID token, refresh
  token, or session token is retained by this boundary.

## 3. Information that MAY be handled

Only the following, all non-secret, may ever cross this boundary:

- **Opaque reference** — `WebAuthnAdapterRequest.reference` (e.g. a UI slot id).
- **Opaque relying-party / user labels** — `rpIdRef` / `userRef`: display labels
  only, never an rpId origin secret, a real user handle, or a credential id.
- **Coarse status** — one of `WebAuthnAdapterStatus`
  (`unavailable` / `idle` / `waiting` / `authenticated_placeholder` /
  `cancelled` / `error`).
- **Placeholder capability** — one of `WebAuthnAdapterCapability`
  (`webauthn_placeholder`, `platform_authenticator_placeholder`,
  `cross_platform_authenticator_placeholder`, `conditional_ui_placeholder`) —
  labels of future intent, never a launched feature.
- **Non-secret reason string** — a human-readable status note that never echoes
  any opaque label or any ceremony artifact.

## 4. Information that MUST NEVER be handled

The following must never be stored, logged, rendered, returned, or derived from
by this boundary — in any state:

- **credential** (a `PublicKeyCredential` or any credential object)
- **rawId** (raw credential id bytes)
- **challenge bytes**
- **assertion response** (the `get` signature / `AuthenticatorAssertionResponse`)
- **attestation object** (the `create` `AuthenticatorAttestationResponse`)
- **authenticator data** (`authenticatorData`)
- **private key** (of any kind)
- **seed** (master seed or any key-derivation input)
- **token** (bearer / session / refresh / any)
- **JWT** (ID token or any signed token)
- **profile / email** (or any platform account attribute)
- **platform authenticator secret** (Secure Enclave / Android Keystore material)

## 5. Relationship to the Vault

The unlock chain is a series of **separate boundaries**, each doing one job:

```
WebAuthn adapter  --(webauthnReportToPasskeyRequest)-->  PasskeyAuthenticationRequest
PasskeyBoundary   --(passkeyAuthenticationToVaultRequest)-->  VaultUnlockRequest
Vault boundary    --(future, separate)-->  unlock decision
```

- **WebAuthn → `PasskeyAuthenticationRequest`.** The pure
  `webauthnReportToPasskeyRequest(request)` bridge maps a `get`/`create` to
  `kind: "webauthn"` (never `apple_passkey`/`android_passkey` — the adapter
  cannot know the platform) and passes ONLY the opaque `reference` through;
  `rpIdRef`/`userRef` are not forwarded. It derives no key and holds no
  credential.
- **Passkey → `VaultUnlockRequest`.** The Stage 36
  `passkeyAuthenticationToVaultRequest` maps the passkey factor to a vault unlock
  factor, still carrying only the opaque reference.
- **Vault unlock is a different boundary.** Deciding whether an unlock succeeds
  belongs to the Vault seam, not to this adapter.
- **No real unlock happens yet.** `authenticated_placeholder` is a LABEL; the
  Vault is NOT unlocked by any current code path.
- **WebAuthn unlocks a LOCAL vault; it does not generate the vault's seed.** The
  master seed (if any) is created and held by the Vault/Crypto layer on its own
  terms. WebAuthn only gates access to it — it is never its origin.

## 6. Relationship to Crypto / FedOS Core

- **FedOS Core is the future crypto swap point.** `packages/fedos-core-rust`
  (Stage 59) is where a real RustCrypto-backed WASM/FFI core would live — it is
  the ONLY place real KDF / AEAD / randomness would ever be implemented.
- **The WebAuthn adapter never calls a `CryptoProvider`.** It does not import,
  construct, or invoke `CryptoProvider` / `FedosCoreCrypto`, and takes no
  dependency on `src/crypto/`.
- **No KDF / AEAD / random here.** This adapter derives no key, encrypts nothing,
  and generates no randomness. Those concerns belong to the crypto core, behind
  its own boundary and its own future explicit stage.

## 7. Conditions for a future real `navigator.credentials` adapter

A real browser adapter (one that actually calls the browser credential API) is
OUT OF SCOPE for Stage 60 and requires its own explicit, reviewed Stage. When it
is built, it must satisfy ALL of the following:

- **Disabled by default.** No `navigator.credentials` call happens without an
  explicit opt-in gate (env + user action), the way earlier stages gated real
  provider invocation.
- **Explicit user action.** A ceremony starts ONLY in response to a direct user
  gesture (e.g. a tapped "Unlock with passkey" button) — never on page load,
  never speculatively.
- **No automatic prompt.** No conditional-UI / autofill / silent mediation that
  surfaces an authenticator prompt without the user asking for it.
- **No credential persistence.** No credential, `rawId`, or credential id is
  stored after the ceremony.
- **No challenge persistence.** The challenge is single-use and discarded.
- **Sanitized errors.** A failed ceremony surfaces a FIXED, safe status/reason —
  never the raw browser error.
- **No stack trace.** No exception object, message, or trace is rendered or
  logged to the user-visible surface.
- **No raw provider response.** No `PublicKeyCredential`,
  `AuthenticatorAssertionResponse`, `AuthenticatorAttestationResponse`,
  `authenticatorData`, or `clientDataJSON` is stored or rendered.

## 8. UI / UX wording

Wording must frame WebAuthn/Passkey as *unlock*, never as *key generation* or
*identity origin*.

- **Allowed:** "Unlock with passkey", "Unlock with Face ID", "Use your passkey
  to unlock this device's vault".
- **Forbidden:** "Generate key from Apple ID".
- **Forbidden:** "Face ID creates your Nostr key".
- **Forbidden:** "Your Apple/Google account is your seed" (and any variant that
  equates an account, biometric, or credential with a key/seed origin).

Rule of thumb: if a phrase implies the credential, biometric, or account
*produces* or *is* a key/seed, it is forbidden. If it implies the credential
merely *unlocks* something that already exists locally, it is allowed.

## 9. Test policy for this area

Any change that touches `src/identity/webauthn_adapter.ts` (and any future real
adapter) must be covered by tests that:

- **Assert `navigator.credentials` is never called** — the source names no
  browser credential API, and running `begin`/`cancel` in the node test env
  (where `navigator` is absent) never throws, proving no API touch.
- **Assert no credential / challenge retention** — a `begin` report carries only
  `{ status, reason }`, with no `credential`/`rawId`/`challenge`/`assertion`/
  `attestation`/`response`/`token` property, and the reason echoes no opaque
  label.
- **Assert Runtime / Worker are not wired** — `src/runtime/create_runtime.ts` and
  `src/worker.ts` contain no `webauthn` reference; the adapter is constructed
  nowhere in the core.
- **Assert the Passkey-types import stays type-only** — the bridge's dependency
  on `./types.js` is `import type` only.
- **Assert no crypto import** — the adapter imports no `../crypto/`, `@noble`,
  `node:crypto`, or any AEAD/KDF/WebAuthn/credential library.

These are enforced today in `test/webauthn_adapter.test.ts` (Stage 60).

## 10. Conclusion (current state)

- **Docs only.** This stage adds no code and changes nothing under `src/`.
- **No real WebAuthn.** No `navigator.credentials`, no Face ID / Touch ID, no
  Secure Enclave, no Android Keystore is invoked anywhere.
- **No key derivation.** Nothing here derives, generates, or stores a key, seed,
  or credential.
- **A future explicit stage is required.** A real browser adapter must be its own
  reviewed, disabled-by-default Stage satisfying §7 — never grown silently out of
  the Stage 60 skeleton.
