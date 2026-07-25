# FedOS Desktop Beta — Identity Replacement Guide

## What Identity Replacement is (and isn't)

If a contact loses access to their account signing key, or otherwise
needs to move to a new identity, they can **sign proof, with their new
identity, that it claims continuity with their old one**. Your app shows
you that claim as a pending item in **Safety Center → Identity
Replacement** — it never trusts it automatically.

This is deliberately a **Replacement** model, not a **Rotation** model:
the old identity is never edited, merged, or mutated in place. A
Replacement is a new, separate identity that a piece of independently
verifiable evidence links to the old one. This was a considered design
decision (see `ARCHITECTURE.md` and this repository's own identity
review history), not an accidental limitation.

## Reviewing an item

1. Open **Safety Center**.
2. Under **Identity Replacement**, click a pending item to see its
   detail — both the old and new identity's own public identifier are
   shown explicitly, never implied from "whatever's currently selected."
3. Decide:
   - **Accept** — trust the new identity going forward for this contact.
     Past messages are not retroactively re-attributed; this only
     affects how future messages are treated.
   - **Reject** — refuse the claim. The contact remains under their old
     identity as far as this app is concerned.
   - **Defer** — make no decision yet; the item stays pending and you
     can return to it later.

All three actions require you to have the item open and require an
explicit click — nothing is auto-decided, and the three buttons are
disabled together while any one decision is being processed, so a rapid
double-click cannot submit two conflicting decisions.

## Why some items can't be opened

An item with no resolvable peer-Device evidence pair is shown in the
list but marked **non-openable**. This is not a bug or an omission — it
is what happens when this app genuinely cannot verify enough of the
claim to let you make an informed decision, and it is shown to you
honestly rather than silently hidden or (worse) auto-decided for you.

## What accepting a Replacement does not do

- It does not prove the OLD identity was compromised or abandoned for
  any reason beyond what the signed claim itself asserts.
- It does not delete, hide, or re-encrypt any of your existing
  conversation history with that contact.
- It does not propagate to any other Device you may have paired — each
  Device makes and stores its own Identity Replacement decisions
  locally (consistent with Device Pairing's own "every trust fact is
  local" design — see `docs/desktop_beta_user_guide_device_pairing.md`).

## If you're not sure

There is no time pressure built into this feature — **Defer** is always
available, and a deferred item does not expire or get auto-decided while
you wait. When in doubt, defer and verify the claim with your contact
through a separate, trusted channel before accepting.
