# Device & Identity Boundary (boundary docs — types + pure policy shipped)

**Status: this document describes FOUR shipped boundaries
(`src/identity/device_registration.ts`, `src/identity/device_trust.ts`,
`src/identity/session_boundary.ts`, `src/identity/recovery_policy.ts`,
Stage 127–130) plus a read-only preview UI
(`src/render/device_preview.ts`, Stage 130) — not a design sketch. NONE of
the four names, carries, derives, stores, or references a password,
recovery phrase, mnemonic, seed, backup, export, import, sync, or
authentication field of any kind, anywhere in any of the four files.**

---

## 1. Purpose

Name, as pure boundaries, four identity-adjacent concepts implied by
earlier stages (`./passkey_boundary.ts`'s "unlock trigger, never a key
source" framing, Stage 36; `./provider_boundary.ts`'s external auth
REFERENCE framing) but not previously built at the device/session level:
naming a device (registration), a coarse trust label for it, a
session-lifecycle request/response label, and a recovery-help request
label. All four stay strictly within this codebase's established "types +
pure review function, reject sensitive metadata" shape — and all four
apply the STRICTEST sensitive-marker family in this codebase, given the
subject matter.

---

## 2. `DeviceRegistrationDescriptor` / `reviewDeviceRegistration` (`src/identity/device_registration.ts`)

A device registration names WHICH device an actor says they use —
`deviceRef`/`actorRef` (opaque labels) and an optional `platformLabel`
(e.g. "desktop"/"mobile"). `reviewDeviceRegistration` rejects (never
throws) a sensitive `platformLabel`/`metadata`; a clean record is
`registered_placeholder`. This is NOT a pairing protocol, a key exchange,
or a sync mechanism — it is a display label a future route would attach to
an actor's device list, nothing more.

---

## 3. `DeviceTrustDescriptor` / `reviewDeviceTrust` (`src/identity/device_trust.ts`)

Mirrors `../creator/profile.ts`'s `CreatorTrustLabel` convention:
`DeviceTrustLabel` (`unknown_`/`trusted_`/`new_device_`/`revoked_`/
`test_placeholder`) is a FIXED category, never a real attestation result.
`reviewDeviceTrust` rejects sensitive metadata; a clean assessment is
`accepted_placeholder` — a label review only, exactly as
`reviewCreatorProfile` never performs real identity verification
(`docs/creator_monetization_flow.md` §14).

---

## 4. `SessionRequestDescriptor` / `reviewSessionRequest` (`src/identity/session_boundary.ts`)

Mirrors `../community/moderation.ts`'s "requested action maps 1:1 to a
reported label" model: `SessionRequestedAction`
(`start_`/`end_`/`refresh_placeholder`) maps to
`active_`/`ended_`/`refreshed_placeholder` respectively (or `rejected` for
a policy-dirty request). NO real session is created, stored, or
invalidated anywhere — `reviewSessionRequest` only REPORTS the label a
requested lifecycle event maps to, the same "report a decision, never
enforce it" posture already used for community moderation.

---

## 5. `IdentityRecoveryRequestDescriptor` / `reviewIdentityRecoveryRequest` (`src/identity/recovery_policy.ts`)

The most sensitive boundary in this suite, by subject matter — and
correspondingly the strictest: `IdentityRecoveryRequestKind`
(`unlock_trigger_`/`contact_verification_`/`test_placeholder`) names WHAT
KIND of help is requested, deliberately using `../identity/passkey_boundary.ts`'s
existing "unlock TRIGGER, never a key source" vocabulary (Stage 36) rather
than inventing new recovery-specific language. `reviewIdentityRecoveryRequest`
rejects any metadata containing a password/recovery-phrase/mnemonic/seed/
backup/export/import/sync/authentication marker; a clean request is
`accepted_placeholder` — meaning the REQUEST RECORD is policy-clean, never
that anything was recovered, reset, or restored.

---

## 6. Read-only preview UI (Stage 130, `src/render/device_preview.ts`)

One fixed sample record per boundary — `SAMPLE_DEVICE_REGISTRATIONS`,
`SAMPLE_DEVICE_TRUST`, `SAMPLE_SESSION_REQUESTS`,
`SAMPLE_RECOVERY_REQUESTS` — is run through its real (pure) review function
and rendered as a read-only page, gated behind `?devicePreview=1` in
`src/worker.ts`. Every label is HTML-escaped; there is no pair/unlock/
recover button, no form, and no credential field anywhere on the page.

---

## 7. What is explicitly NOT implemented

- No password, recovery phrase, mnemonic, seed, backup, export, import,
  sync, or authentication of any kind — the strictest prohibition list in
  this codebase, enforced by each boundary's own `SENSITIVE_MARKERS`.
- No real device pairing, fingerprinting, or attestation.
- No real session creation, storage, or invalidation — `active_placeholder`
  never means a real session exists.
- No real account recovery of any kind — this boundary reviews a REQUEST
  record only.
- No connection to `StorageBackend`, `./provider_boundary.ts`'s
  `IdentityProviderBoundary`, `./passkey_boundary.ts`'s `PasskeyBoundary`,
  or the Vault (`src/vault/`) from any of the four boundaries or the
  preview.

---

## 8. Conclusion

- Device & identity, at this stage, is four pure LABEL boundaries: given a
  registration/trust/session/recovery record, each reports a policy-clean
  decision (or `rejected` for a policy-dirty one) — nothing more.
- Passwords, recovery phrases, mnemonics, seeds, backups, exports, imports,
  sync, and authentication are not concepts any of the four has any
  vocabulary for, by design — the strictest guardrail set in this
  codebase.
- A read-only preview UI exists to show the model, not to apply it.
