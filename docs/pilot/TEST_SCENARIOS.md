# Test Scenarios — FedOS Closed Pilot

Work through these in order. Record what happened using
[`RESULTS_TEMPLATE.md`](RESULTS_TEMPLATE.md).

**Use a throwaway identity and synthetic message content.** Do not put
anything real into these tests.

**A failure is a success for us.** If you cannot complete a scenario,
that is the most useful thing you can report. Please do not "fix it
yourself and move on" without telling us — the workaround you found is
exactly what we need to know about.

Scenarios marked **[2P]** need a second participant.

---

## S1 — Install and verify

1. Verify the SHA-256 checksum before running anything.
2. Install (or extract the portable ZIP).
3. Note whether SmartScreen warned, and exactly what it said.
4. Launch the app.

**Report:** did the checksum match? What did the warning say? Did it
start? How long did first launch take?

## S2 — Create a profile

1. Create a profile.
2. Set a passphrase. **Write it down first.**
3. Observe the Master Seed derivation step.

**Report:** was it clear what the passphrase protects? Was it clear that
**there is no recovery**? How long did derivation take? Would a careful
user understand what they had just committed to?

## S3 — Lock and unlock

1. Lock the app.
2. Unlock with the correct passphrase.
3. Close the app entirely, reopen it, unlock again.
4. **Deliberately enter a wrong passphrase.**

**Report:** does it always start locked? Is the wrong-passphrase error
clear without leaking anything useful to an attacker? Any way to reach
data while locked?

## S4 — Configure relays

1. Add one working relay.
2. Add a second.
3. **Add a deliberately unreachable one** (e.g. `wss://does-not-exist.invalid`).
4. Restart the app.

**Report:** is connection status honest and visible? **Does the
unreachable relay break anything else?** (A single bad relay taking down
startup was a real bug in this project's history — please check
specifically.) Do settings survive restart?

## S5 — Invitation **[2P]**

1. Create an invitation.
2. Send it to your partner out-of-band.
3. Have them accept.
4. Confirm the conversation appears for both of you.

**Report:** was it clear how to transmit the invitation safely? What
happens on a malformed or expired invitation? Can either side tell
whether it worked?

## S6 — Messaging **[2P]**

1. Send a message. Confirm it arrives.
2. Reply. Confirm round-trip.
3. Exchange ~20 messages, both directions, including rapid back-and-forth.
4. Send while your partner is **offline**; have them come online.
5. **Send simultaneously**, both at once.
6. Send a long message (several thousand characters), and one with
   emoji and non-Latin script.

**Report:** delivery reliability, ordering, delays, anything lost or
duplicated, anything rendered wrong.

## S7 — Restart persistence

1. With history in place, close the app fully.
2. Reopen and unlock.

**Report:** is all history present and correctly ordered? Anything
missing, duplicated, or re-delivered? How long did startup take with
history present?

## S8 — Search

1. Search for a word you know is present.
2. Search for one that is not.
3. Search with partial words, mixed case, non-Latin script, punctuation.

**Report:** correct results? Anything missing that should match?
Performance? **Does search ever surface content it should not?**

## S9 — Archive export and restore

1. Export an Archive.
2. Note where it went and how large it is.
3. Restore it.
4. Compare before and after.

**Report:** did export succeed for **Direct conversations
specifically**? Did restore return everything? Any content lost or
altered? **Is the archive file itself protected, or is it readable
plaintext?** — check this and say what you find.

## S10 — Devices

1. Open Device management, review registered devices.
2. If you can, pair a second device.
3. Revoke a device.

**Report:** does the list match reality? Does revocation take effect,
and is that visible? Anything confusing about what revocation actually
does?

## S11 — Identity replacement

**Do this last — it changes your identity.**

1. Read the in-app explanation first.
2. Perform an identity replacement.
3. Check what happens to existing conversations. **[2P]** Check what your
   partner sees.

**Report:** was it clear beforehand what would happen and what would be
lost? Did your partner get a verifiable signal, or did the identity just
silently change? **Could this be used to impersonate someone?**

## S12 — Signed deletion

1. Request deletion of a message.
2. Check your side, then your partner's. **[2P]**

**Report:** **is it clear that this is a request and not an erasure?**
If the UI implies content is gone from everywhere, that is a defect —
report it as one.

## S13 — Safety Center

1. Open it and read it fully.
2. Compare against [`KNOWN_RISKS.md`](KNOWN_RISKS.md) and
   [`../../SECURITY.md`](../../SECURITY.md).

**Report:** **does it claim anything stronger than what is true?** Does
it contradict the documentation? Would a reader come away with an
accurate impression of how much to trust this build? Overstatement here
is a **security defect**, not a wording nit.

## S14 — Unhappy paths

Try to break it, then tell us what happened:

- Kill the process mid-send.
- Disconnect the network mid-conversation.
- Disconnect during Archive export.
- Fill the disk, or point the profile at a read-only location.
- Change the system clock significantly.
- Run two instances at once.
- Leave it running for several days.

**Report:** did it fail safely? Any crash, corruption, hang, or silent
data loss? **Did any error message leak key material, a path, or another
user's data?**

---

## Especially valuable to report

- **Anything that overstates security.** Wording included.
- **Silent failures** — something that looks like it worked and did not.
- **Anything that makes losing the passphrase easier** to do accidentally.
- **Anything surprising about what relays can observe.**
- **Any way to reach data while the app is locked.**

If a finding has **security impact**, do not put it in a public Issue —
report it privately. See [`../../SECURITY.md`](../../SECURITY.md).
