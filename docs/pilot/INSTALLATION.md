# Installation — FedOS Desktop Closed Pilot

**Before you start:** read [`KNOWN_RISKS.md`](KNOWN_RISKS.md).

## Requirements

- **Windows 10 or 11, x64.** No macOS or Linux build exists.
- ~500 MB free disk space.
- Network access to whichever Nostr relays you configure.

## What you receive

Two artifacts — you need only one:

| Artifact | Use it if |
| --- | --- |
| `FedOS-Desktop-Beta-Setup-<version>.exe` (NSIS installer) | You want a normal install with a Start-menu entry |
| `FedOS Desktop Beta-<version>-win.zip` (portable) | You want no installer, or you want to run it from a folder you control |

Plus a **`SHA256SUMS.txt` file** listing the expected checksums.

**Both artifacts are unsigned.** See step 2.

## Step 1 — Verify the checksum

**Do this before running anything.** It is your only integrity check,
because the artifacts are unsigned.

PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 .\FedOS-Desktop-Beta-Setup-<version>.exe
```

Compare the result against the `SHA256SUMS.txt` file, character by
character — or let the shell compare it:

```powershell
$expected = "<paste the expected hash here>"
$actual = (Get-FileHash -Algorithm SHA256 .\FedOS-Desktop-Beta-Setup-<version>.exe).Hash
if ($actual -eq $expected) { "MATCH" } else { "MISMATCH - DO NOT RUN" }
```

**If it does not match, stop.** Do not run the file. Report it — see
[`FEEDBACK.md`](FEEDBACK.md). A mismatch means a corrupted download or a
tampered one, and you cannot tell which from your side.

> **Get the checksum from a source independent of the download.** A
> checksum published next to the file it describes proves very little
> against an attacker who could replace both.

## Step 2 — Expect the SmartScreen warning

The artifacts have **no Authenticode signature**, so Windows will
probably show:

> **Windows protected your PC**
> Microsoft Defender SmartScreen prevented an unrecognised app from
> starting.

**This warning is legitimate and expected.** It is not a false positive
being wrong — it is Windows correctly reporting that this publisher is
unverified, which is true.

To proceed anyway: **More info → Run anyway**.

Only do that if step 1 matched. If you are not comfortable clicking
through the warning, **build from source instead** (see below) — that is
a completely reasonable choice.

## Step 3 — Install

**Installer:** run the `.exe`, accept the default location unless you
have a reason not to.

**Portable ZIP:** extract to a folder you control — for example
`C:\FedOS` — and run `FedOS Desktop Beta.exe` from inside it.

> Avoid extracting to a **OneDrive-synced folder**. OneDrive's sync
> agent and a running application can conflict over file locks, and the
> long paths OneDrive produces have caused real problems in this
> project's own build environment.

## Step 4 — First run

1. Launch FedOS.
2. Choose **Create a profile**.
3. **Set a passphrase.** Strong, unique, and **written down offline
   before you continue** — there is no recovery, and no one can help you
   if you lose it.
4. The app derives your Master Seed (Argon2id). This takes a moment by
   design.
5. **Add at least one relay** in Settings. Without a relay nothing can
   send or receive.
6. Send or accept an **invitation** to start a conversation.

The app starts **locked** every time. That is intended.

## Building from source instead

If you would rather not run an unsigned binary, build it yourself.
Full instructions: [`../../BUILDING.md`](../../BUILDING.md).

```sh
git clone <repository-url>
cd <repository>
npm ci
npm run build:wasm
npm run release:electron-beta
```

Pinned toolchain: **Node 24.x**, **npm 11.12.1**, **Rust 1.95.0**,
**wasm-bindgen 0.2.126**. Mismatched versions are the usual cause of
build failures.

> Building from source produces an **unsigned** artifact too. What it
> buys you is that you know what went into it.

## Uninstalling

- **Installer:** Windows Settings → Apps → FedOS → Uninstall.
- **Portable:** delete the folder.

**Neither removes your profile data.** To remove that as well, delete
the FedOS profile directory under `%APPDATA%`. **This is irreversible —
export an Archive first if you want to keep anything.**

## If it will not start

1. Confirm the checksum matched.
2. Confirm you are on Windows x64.
3. Try the other artifact — if the installer fails, try the portable ZIP.
4. Check whether antivirus quarantined it. Unsigned binaries are
   frequently flagged.
5. Still stuck: open a public Issue with the bug report template. Include
   your Windows version and what you saw — **not** your passphrase or
   profile data.
