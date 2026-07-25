# Stop-Use Criteria — FedOS Closed Pilot

**There is no in-app panic button.** Stopping use means closing the
application and not reopening it until you have guidance.

## Stop immediately if any of these is true

### Your secrets may be exposed

- You believe your **passphrase or Master Seed** has been seen by anyone
  else, or has appeared anywhere outside the app — a log file, an error
  message, a screenshot, the clipboard, a backup.
- You **gave** them to someone. (No maintainer will ever ask. Anyone who
  did was attacking you.)
- Your machine may be **compromised** — malware, or someone else having
  had physical access while it was unlocked.

### The app is behaving in a way that implies a break

- **Messages appear in the wrong conversation**, or from the wrong
  person.
- You can see content that **should not be readable** — another user's
  messages, or your own while the app is locked.
- Key material, a private key, or an `nsec` appears **anywhere in the
  UI, a log, or an error message**.
- The app **unlocks without the correct passphrase**, or the lock screen
  can be bypassed.
- A **device you did not pair** appears in your device list.
- **Your identity changed** without you initiating a replacement.
- The app makes network connections to somewhere **other than the relays
  you configured**.

### Integrity of the build is in doubt

- The **SHA-256 checksum did not match** and you ran it anyway.
- You obtained the artifact from **anywhere other than your pilot
  coordinator**.
- Antivirus flags it **after** it had previously been clean.

### You were told to

- Your **pilot coordinator issued a stop-use notice**.
- A security advisory was published for the version you are running.

## What to do when you stop

1. **Close the application.** Do not reopen it.
2. **Do not uninstall yet** — if this is a security issue, the current
   state may be needed to diagnose it. Ask first.
3. **Report it privately** — GitHub Private Vulnerability Reporting. See
   [`../../SECURITY.md`](../../SECURITY.md).
4. **Assume anything you sent through FedOS is compromised**, and act on
   that assumption for anything that mattered. (This is why the pilot
   asks you not to use it for anything that matters.)
5. **If your passphrase may be exposed**, treat every message in that
   profile as readable by whoever has it. There is no way to re-key an
   existing profile.
6. **Wait for guidance** before reinstalling.

## Do not

- **Do not** "test it a bit more to be sure" after seeing something in
  the list above.
- **Do not** post the details in a public Issue.
- **Do not** send your profile directory, Archive, or passphrase to
  anyone as part of reporting it — including a maintainer. They will ask
  for exactly what they need, and it will not be those.

## Softer signals — do not stop, but do report

These are not emergencies. Report them normally
([`FEEDBACK.md`](FEEDBACK.md)):

- Crashes, hangs, or the app failing to start.
- Messages delayed, out of order, or duplicated.
- Search returning wrong results.
- Archive export or restore failing.
- The UI claiming something stronger than what is true.

## Ending the pilot deliberately

You can leave at any time, for any reason, without explanation.

To remove your data: uninstall, then delete the FedOS profile directory
under `%APPDATA%`. **This is irreversible.** Export an Archive first if
you want to keep anything — and remember the archive is itself
pilot-quality software, so verify it before relying on it.
