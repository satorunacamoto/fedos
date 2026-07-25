# Pilot Results Template

Copy this, fill it in, and post it in GitHub Discussions.

**Before you post:** no passphrases, Master Seeds, private keys, profile
data, Archive exports, real message content, or relay credentials.
Redact screenshots and logs.

**Anything with security impact does not go here** — report it privately
first. See [`../../SECURITY.md`](../../SECURITY.md).

---

## Participant

- **Handle** (or "anonymous"):
- **Want credit in release notes?** yes / no *(default: no)*
- **Date range tested:**

## Environment

- **Windows version:**
- **Artifact:** NSIS installer / portable ZIP / built from source
- **FedOS version or commit:**
- **Checksum matched:** yes / no / did not check
- **SmartScreen warned:** yes / no — what it said:
- **Relays used:** *(public relay names are fine; never personal credentials)*

## Scenario results

Mark each: **PASS** / **FAIL** / **PARTIAL** / **SKIPPED**.
For anything not PASS, say what happened.

| # | Scenario | Result | Notes |
| --- | --- | --- | --- |
| S1 | Install and verify | | |
| S2 | Create a profile | | |
| S3 | Lock and unlock | | |
| S4 | Configure relays | | |
| S5 | Invitation **[2P]** | | |
| S6 | Messaging **[2P]** | | |
| S7 | Restart persistence | | |
| S8 | Search | | |
| S9 | Archive export/restore | | |
| S10 | Devices | | |
| S11 | Identity replacement | | |
| S12 | Signed deletion | | |
| S13 | Safety Center | | |
| S14 | Unhappy paths | | |

## Issues found

Repeat per issue. File anything reproducible as its own Issue too, and
link it.

### Issue 1

- **What happened:**
- **Expected:**
- **Steps to reproduce:**
  1.
  2.
  3.
- **How often:** every time / sometimes / once
- **Severity, your judgement:** blocker / major / minor / cosmetic
- **Security impact?** **If yes — stop, and report privately instead.**
- **Issue link:**

## Honesty check

The most valuable section. Please answer even if the answer is "no".

- **Did anything claim to be more secure than it is?** *(Wording counts.
  This is treated as a defect.)*
- **Did the Safety Center match what the documentation says?**
- **Was it clear that there is no passphrase recovery, before you set
  one?**
- **Was it clear that signed deletion is a request, not an erasure?**
- **Was it clear what relays can observe about you?**
- **Anything that made you trust the build more than you should have?**

## Experience

- **Did you get stuck anywhere?** Where, and what did you do?
- **What was confusing?**
- **What worked better than you expected?**
- **Did you lose any data?** Even if you are not certain.
- **Would you keep using it for non-critical messaging?** Why or why
  not?

## Anything else

Free text — including "I stopped because X", which is genuinely useful.
