# FedOS Offline Issuer Runbook

Status: **operator runbook (design document)**, written for the "FedOS
Trust / Offline Monetization + OSS Release Closure" arc while
`scripts/fedos_trust_issuer_cli.mjs` was still under active, concurrent
construction elsewhere in the same arc. At the time this document was
written, that script did not yet exist in this worktree.

**Before publishing or following this runbook, confirm the exact CLI
subcommand names, flags, and file formats against
`scripts/fedos_trust_issuer_cli.mjs`'s own header comment.** This runbook
was written to the subcommand names specified in this arc's own brief
(`generate-key`, `inspect-key`, `sign-entitlement`, `verify-entitlement`)
and should be treated as provisional until checked against the real,
merged script. If any subcommand name, flag, or output format below
differs from the real CLI, trust the CLI's own `--help` output and header
comment over this document, and update this document to match.

This document assumes no prior knowledge of this repository's source
code. An operator following it should never need to open a `.ts` file.

**No production secret key material appears anywhere in this document.**
Every key, path, and command below is a placeholder or example value —
substitute your own real paths and never paste a real private key, seed,
or signed artifact into a shared document, ticket, or chat log.

## Who this is for

Anyone running a FedOS-compatible issuer — including FedOS Official
itself, but also any self-hosting individual, company, or community
choosing to issue their own subscription entitlements, pseudonymous
credentials, or capability grants under their own issuer identity (see
`docs/architecture/TRUST-MODEL.md` — issuing is not FedOS-exclusive).
Where this document says "FedOS Official," substitute your own issuer
label if you are running your own issuer.

## Prerequisites

- Node.js installed, matching this repository's supported version (see
  the repository root `package.json` `engines` field, or its
  `.nvmrc`/CI config if present).
- A local, offline-capable machine to run the signer on. **The signer
  should be run on a machine that is not routinely exposed to untrusted
  network input** — this is a key-custody recommendation, not a
  requirement enforced by any code in this repository.
- The issuer's own signing keypair already generated (see "One-time
  setup" below if this is the first time).

## One-time setup: generating the issuer's signing key

```
node scripts/fedos_trust_issuer_cli.mjs generate-key --out ./issuer-key.json
```

This produces a keypair file. Treat the private key portion of that file
exactly like any other high-value secret:

- Store it somewhere access-controlled and backed up (a password manager
  with file attachment support, an encrypted volume, a hardware security
  module if available) — never in this repository, never in a shared
  drive, never in plaintext chat/email.
- Do not commit it, attach it to a ticket, or paste it into any document
  — including this one, including a future edited version of this one.
- Record the resulting **public key hex** and its **`keyId`** somewhere
  that will be shared with subscribers and embedded in application trust
  policies — the public key is meant to be distributed; the private key
  is never meant to leave this step.

Confirm the key was generated correctly before using it:

```
node scripts/fedos_trust_issuer_cli.mjs inspect-key --key ./issuer-key.json
```

This should print the public key hex, the `keyId`, and no private key
material to the terminal by default — if it prints the private key,
double-check you are not redirecting that output anywhere it could be
captured (a shared terminal, a CI log, a screen share).

## Steady-state: handling one subscription request

### 1. Receive the subscriber's request

A subscriber sends a `SubscriptionSigningRequest` — their **public** key
plus their requested plan/scopes. This is non-secret data; it can arrive
by email, a form submission, a chat message, or any other channel the
operator chooses. There is no prescribed transport.

Sanity-check the request before proceeding:

- It should contain a public key (not a private key — a subscriber's
  request should never include one; if it does, do not use it, and tell
  the subscriber their tooling has a bug).
- It should name the specific plan/scopes being requested.

### 2. Verify payment externally

Confirm the subscriber actually paid, using whatever payment mechanism
you use (an invoice system, a payment processor's dashboard, a bank
transfer confirmation, cash in hand). **This step happens entirely
outside this repository's code** — there is no payment-verification
command in the CLI, and none is planned as part of this design (see
`docs/architecture/OFFLINE-MONETIZATION-MODEL.md`).

### 3. Confirm or deny

If payment is confirmed and the request is well-formed, proceed to
signing. If not, do not sign — there is no partial or provisional
entitlement in this design; either an entitlement is issued, or it is
not.

### 4. Run the sign-entitlement command

```
node scripts/fedos_trust_issuer_cli.mjs sign-entitlement \
  --key ./issuer-key.json \
  --subject-pubkey <subscriber's public key hex> \
  --scopes <comma-separated scopes> \
  --valid-from <ISO 8601 or unix seconds> \
  --valid-until <ISO 8601 or unix seconds> \
  --out ./entitlement-<subscriber-id>.json
```

(Confirm exact flag names against the real CLI's `--help` output — this
is illustrative of the required inputs, not a guaranteed-exact invocation
until checked against the merged script.)

This produces one signed `FedosSubscriptionEntitlement` file (a
`fedos.subscription.v1` envelope). Before sending it to the subscriber,
verify it signs and reads back correctly:

```
node scripts/fedos_trust_issuer_cli.mjs verify-entitlement \
  --entitlement ./entitlement-<subscriber-id>.json \
  --trusted-key ./issuer-key.json
```

### 5. Return the signed entitlement file to the subscriber

Send `entitlement-<subscriber-id>.json` back to the subscriber through
the same or an equivalent channel used to receive their request. This
file contains no secret material — it is safe to send over an
unencrypted channel from a confidentiality standpoint (though using a
channel the subscriber trusts to actually be from the operator is still
good practice against impersonation). The subscriber imports and verifies
it locally — see `docs/user/SUBSCRIPTION-ENTITLEMENT.md`.

Delete or archive the request/entitlement working files per your own data
retention practice; nothing in this design requires the operator to keep
them once the entitlement is delivered, though keeping a record for
support/renewal purposes is reasonable operational practice.

## Renewal

Renewal is steps 1–5 above, repeated, with a new validity period.

**Never edit or re-sign an existing entitlement file in place.** Issue a
brand-new signed entitlement with a new `issuedAt`/`valid-until` (and
send it to the subscriber as a new file). The old entitlement is left
exactly as originally signed and simply expires on its own original
schedule. This matters because the signature covers the original
`issuedAt`/`expiresAt` — there is no supported "extend this entitlement's
expiry" operation; extending validity is always a new signature over a
new envelope.

## Issuer key rotation (planned, non-emergency)

Rotate periodically as a matter of routine key hygiene, or when moving to
new hardware/custody, even without any suspicion of compromise:

1. Generate a new keypair with a new `keyId`:
   ```
   node scripts/fedos_trust_issuer_cli.mjs generate-key --out ./issuer-key-<new-keyid>.json
   ```
2. Publish the new public key + `keyId` through your normal distribution
   channel (a website, a signed release announcement, an updated
   trusted-issuer config shipped with the application), **while keeping
   the old key valid for verification** (do not remove it from any
   `TrustPolicy` configuration) until every entitlement signed with the
   old key has naturally expired.
3. Start signing all new entitlements with the new key.
4. Once the old key's last-signed entitlement's `expiresAt` has passed,
   the old key can be retired from distributed trust-policy configs — it
   is no longer needed for verification of anything still valid.

This is the same rotation seam described in
`docs/architecture/TRUST-MODEL.md` ("Issuer key rotation") — nothing
about it requires an online revocation service.

## Emergency: issuer key compromise

If the issuer's private key is suspected or confirmed compromised (theft,
accidental exposure, a compromised machine it was generated or stored
on):

1. **Stop issuing immediately.** Do not sign anything else with the
   compromised key, even a request that was already in progress.
2. **Generate a new key** following the "One-time setup" steps above,
   using a machine you have separately verified is not compromised.
3. **Ship the new public key via an updated trusted-issuer config** to
   every application/verifier that trusts this issuer, as fast as your
   distribution channel allows (this is the same publication step as
   routine rotation, but urgent). If your distribution channel supports
   it, also communicate that the old key should be treated as no longer
   trusted as of the compromise date — a verifier can set that key's
   `notAfter` in their own local `TrustPolicy` to stop accepting envelopes
   signed with it, even ones that claim an `issuedAt` before their stated
   `expiresAt`.
4. **Let old, short-lived entitlements simply expire.** Because
   entitlements are issued with bounded validity periods (see
   `docs/architecture/OFFLINE-MONETIZATION-MODEL.md`), any entitlement the
   compromised key signed stops being usable no later than its own
   `expiresAt`, without requiring an online revocation lookup. If your
   entitlements are long-lived, this is the moment that decision costs
   you response speed — consider shorter validity periods going forward
   if compromise response time matters to you.
5. **No online revocation infrastructure is required** to complete this
   procedure — every step above is a local key operation plus updating a
   config file that gets distributed through whatever channel you already
   use to ship application updates or configuration.
6. After the immediate response, investigate how the key was compromised
   before resuming normal issuance with the new key, using better
   custody practices than led to the compromise.

## Open items for whoever finalizes this runbook against the real CLI

- Confirm the four subcommand names (`generate-key`, `inspect-key`,
  `sign-entitlement`, `verify-entitlement`) and every flag shown above
  against `scripts/fedos_trust_issuer_cli.mjs` once it exists and is
  merged.
- Confirm the exact file format the CLI writes for a keypair and for a
  signed entitlement (this document assumes JSON files but does not
  assert a specific schema).
- Confirm whether the CLI has any built-in safeguard against re-signing
  an already-signed entitlement in place, or whether that discipline is
  operator-enforced only (as assumed above).
