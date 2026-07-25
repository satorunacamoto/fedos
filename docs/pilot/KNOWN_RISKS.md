# Known Risks — read before installing

This is the honest version. Nothing here is softened.

## The three that matter most

### 1. No independent security audit — ever

**The cryptography in FedOS has been reviewed only by the people who
wrote it.** No external firm, no academic review, no bug bounty.

The implementation is tested against official NIP-44 and RFC test
vectors, which shows it computes the *right answers for the cases those
vectors cover*. That is genuinely useful and it is **not** the same as
an audit. Real-world breaks usually come from the parts vectors do not
cover: state machines, key lifecycle, error handling, side channels.

**Assume there are exploitable bugs that nobody has found yet.**

### 2. Unsigned Windows artifacts

There is **no Authenticode code signature**. Consequences:

- **SmartScreen will likely warn you**, and you will have to click
  through a warning that exists for good reasons.
- **You cannot verify the publisher through Windows.** The only
  integrity check available to you is the SHA-256 checksum — verify it
  ([`INSTALLATION.md`](INSTALLATION.md)).
- **If someone tampered with your download, Windows will not tell you.**
  The checksum is your only defence, and only if you get it from a
  source independent of the download.

### 3. Losing your passphrase means losing everything

There is **no recovery**. No reset, no escrow, no backdoor, no
maintainer who can help. This is a deliberate design property, and its
cost falls entirely on you.

**Write your passphrase down and store it somewhere safe before you put
anything into FedOS.**

## What relays can see

FedOS encrypts message *content*. It does not hide the fact that you are
communicating.

**A relay you connect to can see:**

- Your **IP address**.
- **Which npubs are exchanging events, and when** — beyond what NIP-17's
  gift-wrapping obscures.
- **Message sizes and timing patterns.**
- That you are online, and roughly how active you are.

**FedOS provides no anonymity and no onion routing.** If you need your
network identity hidden, FedOS does not do that, and routing it through
a VPN or Tor yourself is outside anything this project has tested.

## What "deletion" actually means

**Signed deletion is a request, not an erasure.**

- It **cannot** remove a message from someone else's device.
- It **cannot** force a relay you do not control to forget anything.
- Anyone who received a message already has it.

Treat every message as permanent once sent.

## Memory and disk

- **No guaranteed RAM erasure.** Secrets are zeroized on a best-effort
  basis. There is no `mlock`, so the OS may page memory containing key
  material to disk, and a hibernation file or crash dump may capture it.
- **Your profile is only as safe as your machine.** Malware with read
  access to your profile directory, or physical access to an unlocked
  machine, defeats FedOS entirely. That is outside the threat model.

## Data loss

This is pilot software. **Assume data loss is possible**, from a bug, a
failed migration, or a mistake of your own.

- Back up anything you care about, outside FedOS.
- Do not make FedOS the only place any information exists.
- Archive export exists and works, but it is itself pilot-quality code.

## Metadata that survives archive and deletion

Archive export and restore are gated by retention rules. Historically,
**message metadata has been more durable than message content** in this
system. Assume that the existence of a conversation, and its timing, may
survive operations that remove the content.

## Not a Signal replacement

- FedOS's ratchet is **its own integration** over NIP-17. It is **not**
  the Signal Protocol, has not received anything like the same
  scrutiny, and **does not interoperate with Signal**.
- **No group messaging**, therefore no group forward secrecy.
- No disappearing messages, no sealed sender, no safety-number
  verification flow comparable to Signal's.

## Practical advice

**Do:**

- Use a throwaway identity for the pilot.
- Use a strong, unique passphrase, written down offline.
- Verify the checksum before installing.
- Report anything that looks wrong, including wording that oversells.

**Do not:**

- Use this for anything whose disclosure would seriously harm you or
  anyone else.
- Use it as your only copy of anything.
- Assume a feature is secure because it exists and appears to work.
- Give your passphrase or Master Seed to anyone, ever, for any reason —
  **including someone claiming to be a maintainer debugging your issue.**
  No legitimate maintainer will ask.

---

The full maintained list is [`../../KNOWN_LIMITATIONS.md`](../../KNOWN_LIMITATIONS.md).
The security status and threat model are in
[`../../SECURITY.md`](../../SECURITY.md).
When to stop entirely: [`STOP_USE_CRITERIA.md`](STOP_USE_CRITERIA.md).
