# Download and Checksum Guide — FedOS Desktop Beta 0.1.0-beta.1

## 1. Find the release

Download only from the canonical location named on the official release announcement for this
build. **As of this review, that canonical location is not yet decided or published** — see
`07_RELEASE_DISTRIBUTION_PLAN.md`. Do not trust a copy of this installer offered anywhere else,
including by direct message, unofficial mirrors, or search-engine results.

## 2. What to download

| File | Type | Recommended |
|---|---|---|
| `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe` | NSIS installer | Yes — this is the primary artifact |
| `FedOS Desktop Beta-0.1.0-beta.1-win.zip` | Portable ZIP | Secondary, for users who prefer not to install |

Both are published alongside `SHA256SUMS.txt` and a release manifest.

## 3. Verify the checksum before you run anything

Open PowerShell in the folder you downloaded to, and run:

```powershell
Get-FileHash .\FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe -Algorithm SHA256
```

Compare the printed hash, character for character, against the matching line in `SHA256SUMS.txt`.
For this exact build, the installer's hash is:

```
a1c32889173a0ae9105724d8b708abaa9456f15a054085a20c29ccde3de6dee0
```

If you downloaded the portable ZIP instead:

```powershell
Get-FileHash ".\FedOS Desktop Beta-0.1.0-beta.1-win.zip" -Algorithm SHA256
```

```
9aa0f584fee09aa7341ec76624cdbaa1a85df05c10662526c2194391075df8a5
```

**If the hash does not match exactly, stop. Do not run the file.** Delete it and download again
from the canonical location. A mismatch means the file was corrupted in transit, was tampered with,
or you have the wrong build — it does not tell you which.

## 4. What a checksum match proves, and what it does not

A matching SHA-256 proves the bytes you have match the bytes published under that filename at the
location you downloaded from. **It does not prove who published them, and it does not prove the
publishing location itself was not compromised.** This release has no separate signature channel
(no PGP signature, no code-signing certificate) beyond the plain checksum file — that file is
published alongside the binaries, from the same source. This is stated plainly here rather than
implying stronger assurance than actually exists.

## 5. The installer is unsigned — what to expect

FedOS Desktop Beta is **not code-signed**. When you run the installer or the application for the
first time, Windows SmartScreen may show a warning that the app is from an "unrecognized publisher."

This is expected for unsigned Beta software and does not, by itself, mean the file is malicious.
It means Windows has no publisher-identity signal for this file — which is exactly what an
unsigned build looks like, whether it's legitimate or not. **This is why the checksum step above
comes first**: verify the checksum matches before you decide whether to proceed past the warning.

If you choose to proceed, do so only for this specific, checksum-verified file — this guidance is
not an instruction to disable SmartScreen, Windows Defender, antivirus, or User Account Control
generally. Those protections should stay on.

**How to tell an expected unsigned-Beta warning from a sign of a corrupted or tampered download:**
- Expected: an "unrecognized publisher" / "Windows protected your PC" style warning, appearing
  *before* you choose to run the file, on a file whose checksum you have already verified matches.
- Not expected, and a reason to stop: the checksum does not match: `SHA256SUMS.txt` reports an
  error, the file size looks obviously wrong, or your antivirus flags something more specific than
  a generic "unknown publisher" notice (e.g., a named malware family).

## 6. After verifying

Continue to `INSTALL_WINDOWS.md`-equivalent guidance in the release-staging bundle for the actual
install steps, or see `05_RECOVERY_AND_BACKUP_GUIDE.md` first if you are replacing an existing
install and want to back up beforehand.
