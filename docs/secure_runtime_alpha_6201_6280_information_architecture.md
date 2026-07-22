# Secure Runtime Alpha 6201–6280 — Safety Center Information Architecture

**FedOS Desktop Beta Privacy Controls and Safety Center Arc.**

## The 13 sections

| Section | Aggregates | Live fact source |
|---|---|---|
| `overview` | worst-of-every-other-section state, standing warnings | `fedosSafetyCenterBuildSummary()` |
| `profile-and-unlock` | lock state, presence | `FedosProfileInitializationCoordinator.status()` (optional) |
| `devices` | trusted/revoked counts | `shell.devicesList()` |
| `device-sync` | running/pending-conflict counts | `shell.deviceSyncStatus()` |
| `secure-messaging` | Ratchet session status for caller-named pairs | `shell.directRatchetStatus()` (new accessor) |
| `peer-capabilities` | every observed peer Device's capability status | `shell.peerCapabilityListObserved()` (new accessor) |
| `identity-replacement` | pending review count | `shell.identityTransitionList()` |
| `deletion-requests` | pending consent count | `shell.deletionRequestListReceived()` |
| `retention-and-search` | standing disclosure only | none (always `"attention"`, see warnings doc) |
| `archive-and-backups` | standing disclosure only | none (always `"attention"`, see warnings doc) |
| `notifications-and-background` | current toggle values | `FedosDesktopSettingsController.load()` (optional) |
| `security-events` | bounded chronological feed | composed from Device/Identity-Transition/Deletion-Request facts |
| `limitations` | pointer to the completion declaration | static |

## Why two sections are "standing disclosure only"

`retention-and-search` and `archive-and-backups` have no live per-item fact
worth aggregating — the Retention/Archive/Search domains do not currently
expose a "does an old copy still exist somewhere" query that differs
per-user or per-item (see the reconciliation report's own Phase A finding:
"no existing facade packages these into a warning view"). Rather than
fabricate a live indicator, these two sections always honestly show
`"attention"` plus their standing warning text — never a green "clear."

## Why "secure-messaging" and "peer-capabilities" behave differently

`secure-messaging` needs the CALLER to name which `(conversationId,
remoteDeviceRef)` pairs to assess — no account-wide Ratchet-session-listing
query exists anywhere in this codebase (the SAME limitation
`identityTransitionAssessContinuity()` already disclosed at Alpha
6121-6200). `peer-capabilities` DOES have a real, complete
`listObservedPeerDevices()` query, so that section is always fully
populated without the caller supplying anything.

## Restart-safety

Every section reads LIVE from its own already-durable backing store on
every `refreshOverview()` call — there is no separate Safety-Center-owned
cache to go stale or need its own restart-replay logic. The one place this
Arc adds NEW durable state is the pending-review durability closure (Phase
D), documented separately.

## Recommended next Arc

**FedOS Desktop Beta Security Acceptance, Threat-Scenario Testing, and
Release Freeze Arc.**
