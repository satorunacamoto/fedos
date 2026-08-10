# Getting a FedOS Official Subscription Entitlement

Status: **user-facing walkthrough (design document)**, written for the
"FedOS Trust / Offline Monetization + OSS Release Closure" arc while the
underlying application UI/CLI flow was still under active construction
elsewhere in the same arc. The exact commands, menu items, and file names
below may not match the finished application yet — treat this as the
intended flow, and check the application's own in-app instructions or
`--help` output if anything here doesn't match what you see.

This is optional. Nothing described here is required to use FedOS. The
free features of FedOS work fully without ever doing any of this — see
`docs/architecture/OFFLINE-MONETIZATION-MODEL.md` if you want the full
explanation of what a subscription entitlement does and doesn't unlock.

## The short version

1. Generate a request on your own device (this creates a keypair; the
   private half never leaves your device).
2. Send the **public** request file to the operator.
3. Pay the operator, however they accept payment.
4. Receive a signed entitlement file back.
5. Import it into FedOS and verify it locally.
6. When it's about to expire, repeat from step 1 or step 2 (see
   "Renewing" below) — nothing renews automatically.

**Your private key never has to leave your device at any step.** The
request you send in step 2 contains only your public key and what plan
you're asking for — never anything secret.

## Step 1: Generate your request

Using whatever entry point the FedOS application provides for this (a
menu item, a settings panel, or a CLI command, depending on how this
lands in the finished product), generate a local keypair and export a
`SubscriptionSigningRequest`.

What this step actually does under the hood: it creates a public/private
keypair on your device and writes a request file containing only:

- your **public** key, and
- the plan/scopes you're requesting.

Your private key is generated and stored locally by the application (or
wherever your local key storage lives); it is never written into the
request file, and never needs to be typed, copied, or sent anywhere.

## Step 2: Send the request to the operator

Send the request file to whoever operates the FedOS Official issuer (or
to whichever issuer you're subscribing to, if you're using a
community/self-hosted issuer instead — see
`docs/architecture/TRUST-MODEL.md` for why that's a supported choice, not
a workaround). Since the file contains no secret data, you can send it
over email, a form, a chat message, or any channel the operator accepts
— there's nothing in it that needs end-to-end encryption to protect a
secret, though sending it over a channel you trust to reach the right
operator (not an impersonator) is still sensible.

## Step 3: Pay

Pay the operator using whatever payment method they accept. This part is
entirely outside FedOS's software — FedOS does not process, hold, or
route payments itself, and there is no in-app payment flow this document
is describing. Follow the operator's own instructions for how to pay.

## Step 4: Receive your entitlement

Once the operator has verified your payment and run their signing step,
they send you back one file: your signed entitlement. This file is not
secret either — it's a public proof that your public key has a valid
subscription, signed by the operator's issuer key. It's specific to your
public key, so someone else having a copy of your entitlement file
doesn't let them use it as their own (it only verifies for your key).

## Step 5: Import and verify it

Import the entitlement file into FedOS using the application's import
flow. The application verifies it **locally, on your device, without any
network access** — checking the signature against the trust policy your
app is configured with (which issuer keys it trusts — see
`docs/architecture/TRUST-MODEL.md`) and checking that it hasn't expired.

If verification succeeds, the entitlement is active. If it fails, the
application should tell you why (an unrecognized issuer, a bad signature,
an expired entitlement) rather than just saying "invalid" — if it
doesn't, that's worth reporting as a UX gap.

Nothing about this step contacts any FedOS server. Verification is a pure
local computation over the entitlement file and your local trust
configuration.

## Renewing

Subscription entitlements are time-bounded on purpose (see
`docs/architecture/OFFLINE-MONETIZATION-MODEL.md` for why FedOS uses
expiring entitlements instead of usage quotas). When yours is nearing
expiry or has expired:

- Repeat step 2 (send a fresh request — you can usually reuse the same
  keypair from before rather than generating a new one, unless you have
  reason to rotate your own key) through step 5.
- There's no automatic renewal, no stored payment method, and no
  recurring charge FedOS itself initiates — every renewal is a deliberate
  repeat of this same manual flow, because that's what "no mandatory
  server, no activation service" means in practice.
- Your old entitlement file doesn't need to be deleted; it simply stops
  verifying as valid once its own expiry passes, and importing the new
  one doesn't require removing the old one first.

## What this flow deliberately does not do

- It does not phone home to check your subscription is "still active" —
  once imported, an entitlement is checked locally against its own
  expiry, not against any live status server.
- It does not fingerprint your device or tie your entitlement to specific
  hardware — it's tied to your public key, which you can move to a new
  device along with your keypair.
- It does not ask you to send your private key, a password, or any other
  secret to the operator at any point.
- It does not enforce a usage count (like "100 uses this month") — see
  `docs/architecture/OFFLINE-MONETIZATION-MODEL.md` for why that's not
  something this design can securely do, and what it uses instead
  (time/scope-bounded entitlements).
