# 14. Code Signing and Distribution

Four DIFFERENT concerns this review keeps deliberately distinct — a
frequent, real source of confusion.

## (a) Application code signing

An Authenticode certificate signs the built `.exe` itself, proving
publisher identity to Windows/SmartScreen. Requires a PURCHASED
certificate from a public CA (or an internal enterprise CA, if
applicable) — an external dependency this review cannot obtain or
provision.

## (b) Installer signing

The SAME certificate signs the installer package (NSIS/MSI) specifically
— a distinct artifact from (a), but the same external certificate
requirement.

## (c) Nostr identity signing

Already fully implemented and unrelated: `FedosNostrSigningAuthority`
(`src/nostr/sign/`) signs Nostr protocol events with a user's own Nostr
identity key. This has NOTHING to do with (a)/(b) — it authenticates a
protocol MESSAGE, not the application binary.

## (d) Cryptographic message/envelope signing

Already fully implemented and unrelated: the Conversation Envelope
encryption/authentication this entire stack is built around (AEAD via
the Rust/WASM crate) authenticates MESSAGE CONTENT between conversation
participants — again, nothing to do with (a)/(b).

**This review's own finding: (a)/(b) and (c)/(d) must never be conflated.**
A future implementer must not assume that because this codebase already
does real, strong cryptographic signing for messages/identities, it has
any bearing on whether the application BINARY is signed for OS trust
purposes — they are unrelated certificates, unrelated keys, unrelated
threat models.

## What can be tested locally vs. what requires external resources

- **Testable locally, no cost:** unsigned development builds; a
  self-signed test certificate (will trigger a SmartScreen warning on
  first run — acceptable for internal testing, never for distribution to
  end users who would reasonably expect a trusted publisher).
- **Requires external resources, outside this review's own scope to
  obtain:** a real Authenticode certificate (recurring cost, identity
  verification with a CA), and CI secret-management infrastructure to
  hold and use it safely during an automated build (this repository has
  no CI at all today, `04`).

## Conclusion

Code/installer signing is a real, external, recurring-cost decision this
review does not make and cannot provision. It should be deferred until a
real distribution decision (`15`) is made, and should never be confused
with this codebase's own, already-solved, unrelated cryptographic
signing capabilities.
