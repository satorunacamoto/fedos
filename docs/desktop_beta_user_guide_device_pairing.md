# FedOS Desktop Beta — Device Pairing Guide

Device Pairing trusts a second Device (a separate install, with its own
separate local profile) under your account for future Sync and messaging.
It does **not** merge or share message history between the two Devices'
own local profiles, and it does **not** require restoring an existing
account from a seed phrase — there is no such onboarding flow in this
Beta. Added in Secure Runtime Alpha 8201-8280; see
`docs/secure_runtime_alpha_8201_8280_phase_a_reconciliation_report.md` for
the gap this closed.

## Before you start

- You need **two** already-onboarded Desktop profiles (they can be on the
  same machine, in two separate data directories, or on two different
  machines) — one **existing** Device you already trust, and one **new**
  Device you want to add.
- You need a way to move two short text blocks between the two Devices —
  email, a messaging app you already trust, a USB drive, whatever channel
  you'd use to move any other non-secret text. Neither block contains a
  secret key.
- **Keep the new Device's app open** between Step 1 and Step 3 below. Its
  own pairing key lives only in that running process's memory — quitting
  before Step 3 loses the in-progress pairing, and you'll need to start
  over from Step 1.

## Step 1 — On the NEW Device

1. Open **Devices** from the navigation bar.
2. Under **Pair a New Device**, enter a **Device ID** — a name you choose
   for this Device (e.g. "Alice's Laptop"). This cannot be changed later.
3. Enter the **existing Device's account public identity** — open the
   existing Device's own **Ready** panel and copy the value shown next to
   "Account public identity."
4. Click **Create pairing request**, then **Copy** the resulting text.
   Note its expiry — if it expires before you finish Step 3, start over.

## Step 2 — On the EXISTING, trusted Device

1. Open **Devices** → **Pair a New Device**.
2. Paste the text from Step 1 and click **Inspect**. You'll see the new
   Device's ID and whether its device proof is valid — never approve if
   it says INVALID.
3. Click **Approve & trust this Device**, then confirm. This also trusts
   the new Device locally on this Device right away.
4. **Copy** the resulting approval text and send it back to the new
   Device.

## Step 3 — Back on the NEW Device

1. Paste the approval text from Step 2.
2. Click **Complete pairing**. The Devices list now shows the new Device
   as trusted.

## Revoking a Device

Open **Devices**, find the Device, and click **Revoke**, then confirm.
Revoking removes that Device's trust for future messages and Sync — it
does **not** delete messages that Device already has, and this
application has no way to confirm or force deletion on another Device.
A revoked Device cannot become trusted again under the same Device ID.
Being offline is never treated as revoked.

## What this does not do

- It does not share or migrate the two Devices' own separate local
  message history — each Device keeps its own.
- It does not prove the other Device is a specific person — it proves
  possession of that Device's own signing key, approved by whoever holds
  your account's signing key.
- There is no cross-Device Registry synchronization — "trusted"/"revoked"
  is a fact recorded locally on whichever Device performed the action.
