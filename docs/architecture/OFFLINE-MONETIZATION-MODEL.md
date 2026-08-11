# FedOS Offline Monetization Model

Status: **design document** for the "FedOS Trust / Offline Monetization +
OSS Release Closure" arc, written while `src/os/trust/` is still under
active, concurrent construction. It describes the target monetization
design, not a completed and independently re-verified implementation. Read
alongside `docs/architecture/TRUST-MODEL.md`, which this document assumes
— in particular, the "what a FedOS Official subscription signature does
and does not mean" boundary from that document applies unchanged here.

Pure software/product architecture — no legal, tax, payment-processing
compliance, or regulatory content, and no claim that any particular
monetization approach is legally sufficient in any jurisdiction.

## The free/paid split, stated precisely

**Free tier (the OSS product, unconditionally):**

- Self-signing your own credentials, entitlements, and capability grants
  with your own locally generated key.
- Running your own issuer — for yourself, your household, your company,
  your community — using the same offline signer tooling FedOS Official
  itself uses (see `docs/operations/OFFLINE-ISSUER-RUNBOOK.md`).
- Local, offline verification of any signed envelope against any
  `TrustPolicy` you construct.
- The full FedOS protocol and local operation: messaging, identity,
  everything else this repository ships, with zero dependency on FedOS
  Official ever having issued anything to anyone.

None of the above requires payment, an account, a network connection at
verification time, or FedOS Official's involvement in any way. This is
not a crippled trial of the paid tier — it is the complete, unlimited
product.

**Paid, optional tier:** a `fedos.subscription.v1` envelope signed by the
FedOS Official issuer — a `FedosSubscriptionEntitlement` for stated scopes
and a stated validity period, produced by the offline issuer CLI after a
human operator manually confirms payment. Nothing about receiving one of
these changes what the free tier can already do; it adds an entitlement a
verifier can optionally check for and choose to treat as meaningful
(gating a convenience feature, displaying a badge, etc.) — never a
requirement to use the base product.

## The scarce asset is the signature, not the code

This is the central design fact that makes monetization coherent in an
OSS codebase: **the thing being sold is FedOS Official's signature — the
issuer relationship — not secret source code.** Every line of code that
creates, signs, canonicalizes, and verifies a
`FedosSubscriptionEntitlement` is in this public repository, under
MPL-2.0, readable and forkable by anyone. That is fine, and is not a
security hole, because none of that code is what a subscriber is paying
for. What cannot be replicated by reading the source is FedOS Official's
own private signing key and FedOS Official's willingness to sign a
particular public key's entitlement after being paid.

### `if (isPro) enableFeature()` is not a security boundary in OSS

State this plainly, because it is easy to get backwards: a client-side
check that gates a feature behind "does a valid entitlement exist" —
however that check is implemented — is **not an enforceable security
boundary** in an open-source, user-controlled application. The full
source of that check ships to the user. A user who wants to bypass it can
read the check, patch the binary, patch the source and rebuild, or run a
modified client that always returns `true`. This is true regardless of
how the check is written, how deeply nested it is, or how the entitlement
data is obfuscated — it is a structural property of shipping the checking
code itself to the party the check is meant to constrain.

**Any UI gate built on an entitlement check in this codebase must be
documented as UX (a convenience nudge, a way to say "thank you for
supporting the project," a feature that looks nicer when a subscription
is present), never as a security boundary, an anti-piracy measure, or a
guarantee that unpaid use is prevented.** Treating it as the latter is a
design bug: it invites building enforcement infrastructure (obfuscation,
tamper-detection, phone-home checks) that contradicts this project's own
no-mandatory-server, no-activation-server principle and does not actually
work against a motivated user with the source in hand anyway.

What the signature *does* enforce reliably is something narrower and
real: it is cryptographically infeasible to forge a valid FedOS
Official-signed entitlement without FedOS Official's private key. That
is a genuine, strong guarantee — but it is a guarantee about
**authenticity of the entitlement claim**, not about **preventing a
locally modified client from ignoring the entitlement check entirely**.
Those are different properties; this design provides the first, not the
second, and never claims otherwise.

## End-to-end flow

```
Subscriber                                    Operator (FedOS Official)
-----------                                    -------------------------
1. Generate local keypair
   (private key never leaves
   this device)
2. Export SubscriptionSigningRequest
   (public key + requested plan/
   scopes only — no secret data)
        ────────────────────────────►
                                       3. Verify payment externally
                                          (whatever payment rail/manual
                                          process the operator uses —
                                          out of scope for this design)
                                       4. Confirm/deny
                                       5. Run the offline signer
                                          (sign-entitlement command)
                                          → FedosSubscriptionEntitlement
        ◄────────────────────────────
6. Import + locally verify
   the entitlement
```

Properties this flow deliberately holds:

- **No activation server.** Step 5 is a local command an operator runs on
  their own machine, not an API call to a FedOS-operated service that
  must be online for the flow to work.
- **No recurring network check.** Once a subscriber has imported and
  locally verified an entitlement, using it (checking `verifyFedosTrust
  EnvelopeV1` against a local `TrustPolicy`) requires no network access,
  ever, at any point after import — not at app startup, not periodically,
  not on feature use.
- **No hardware fingerprint.** The entitlement binds to a public key the
  subscriber generated, not to a device identifier, MAC address, disk
  serial, or any other machine-specific fingerprint. Moving a keypair to
  a new device carries the entitlement with it, by design.
- **No customer secret sent to the operator.** A
  `SubscriptionSigningRequest` contains only non-secret data — a public
  key and the requested plan/scopes. The subscriber's private key never
  leaves their device, at any step of this flow, including the initial
  request. The operator never sees, needs, or could reconstruct it.

## The operator's job, reduced to its essentials

Running the paid tier as an "operator" (which may literally be one person
running a CLI on their own laptop, not a hosted service) is deliberately
small:

1. Receive a subscriber's `SubscriptionSigningRequest` (public key +
   requested plan/scopes) through whatever out-of-band channel the
   operator uses — email, a form, a chat message. This design does not
   prescribe the transport for the request itself.
2. Verify payment happened, through whatever external payment mechanism
   the operator uses. Payment verification is explicitly outside this
   design's scope — it happens externally/manually, not through code in
   this repository.
3. Run one signing command (see
   `docs/operations/OFFLINE-ISSUER-RUNBOOK.md` for the exact procedure).
4. Return the resulting signed entitlement file to the subscriber.

**Renewal is the same four steps repeated with a new validity period —
never a mutation of the previously issued, already-signed entitlement.**
A signed envelope's `signature` covers its own `issuedAt`/`expiresAt`;
there is no operation anywhere in this design that edits a signed
entitlement in place. A renewed subscription is a brand-new envelope with
a new `issuedAt`, a new `expiresAt`, and (if the issuer has rotated since
the original entitlement) potentially a new `keyId` — the old entitlement
is left exactly as it was signed, and simply expires on its own original
schedule if not superseded.

## Usage quotas cannot be securely enforced in this model — use bounded entitlements instead

A common monetization instinct is a usage quota: "100 QR exports per
month," "50 signed credentials per subscription period." **This design
states plainly that hard usage quotas of that kind cannot be securely
enforced without trusted mutable state that both survives across sessions
and cannot be tampered with by the party being metered — and a
serverless, offline-verifiable model has no such state.** A local counter
the client itself maintains and checks is exactly the same
`if (isPro) enableFeature()` problem described above, at a different
granularity: the user holds the code and the storage, and can reset,
edit, or ignore a local counter as easily as a local boolean.

What this design uses instead: **time-bounded and scope-bounded
entitlements.** A `FedosSubscriptionEntitlement`'s `expiresAt` and its
`scopes` list are the actual enforceable unit — "valid until this date,"
"valid for these named capabilities" — because those are properties the
signature itself attests to and a verifier checks cryptographically, not
properties a mutable local counter tracks. This is a real behavioral
constraint (an expired or out-of-scope entitlement genuinely fails
verification) even though it cannot express "N uses" the way a quota can.

**A hard usage quota remains a possible offering in the future, but only
as an optional, explicitly centralized, hosted-service policy** — for
example, a FedOS-operated service that itself holds server-side mutable
state per account and is not claimed to be offline-verifiable or
serverless. Building such a service, if it is ever built, is a
fundamentally different trust model than the one this document describes
and would need its own design document; it is not a guarantee this
protocol or this repository's offline signer makes today, and nothing in
`src/os/trust/` should be read as promising quota enforcement.

## What does not exist yet

- No payment-processing integration of any kind lives in this repository.
  "Operator verifies payment externally/manually" is the entire scope of
  payment handling this design specifies; how an operator actually takes
  payment (an invoice, a payment link, cash, a favor) is out of scope.
- No hosted hard-usage-quota service exists, as stated above — this is
  explicitly future, optional work if it happens at all, not a current
  capability.
- No UI wiring that gates a specific FedOS feature behind an entitlement
  check has been confirmed built and merged as of this document; when it
  is built, it must be documented per the "UX, not security boundary"
  rule above, and this document should be revisited to name the specific
  gated features.
- No independent security audit of this capability has been performed —
  same caveat as `docs/architecture/TRUST-MODEL.md`.
