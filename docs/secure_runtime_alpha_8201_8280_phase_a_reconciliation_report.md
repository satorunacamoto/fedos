# Secure Runtime Alpha 8201-8280 — Phase A: Current UI and Capability Inventory

**Arc:** FedOS Desktop Closed-Beta Product Gap Closure and Final Polish
**Base commit inspected:** `739fb3e8` (local master tip, Alpha 8121-8200)
**Method:** direct source inspection of the real shipped Electron app
(`packages/fedos-desktop-electron-spike/`), not the unused parallel
`src/desktop/renderer` / `src/desktop/presentation/device_management`
presentation stack that a prior Arc built but the packaged app never loads.

This report resolves the two questions the mission brief posed before any
source edit, using file:line evidence gathered directly (see citations
below; classification buckets are: BACKEND LIVE / PRODUCTION-WIRED /
VISIBLE UI / TEST-ONLY REACHABLE / PARTIAL / ABSENT / DEFERRED BY ACCEPTED
POLICY).

---

## 1. Device Pairing

| Capability | Classification | Evidence |
|---|---|---|
| Device Registry / Device Trust | BACKEND LIVE | `src/device/fedos_device_binding.ts`, `src/device/binding_challenge/fedos_device_binding_registration_authority.ts`; wired as default persistence, `src/desktop/runtime/fedos_desktop_runtime.ts:962`; `deviceTrustEnabled: true` hardcoded at onboarding, `src/desktop/onboarding/fedos_profile_initialization_coordinator.ts:736` |
| Pairing offer/accept/complete/revoke lifecycle | PRODUCTION-WIRED | `FedosDevicePairingFacade` (`src/desktop/runtime/fedos_device_pairing_facade.ts`): `createPairingRequest()` L251, `inspectPairingRequest()` L337, `approvePairingRequest()` L367, `completePairing()` L295, `revokeDevice()` L403 — composed into `FedosDesktopApplicationShell` (`src/desktop/shell/fedos_desktop_application_shell.ts:687-752`), then into the real Electron main IPC handlers (`fedos_electron_beta_main.cts:1177-1211, 1792-1795`), then onto the real production preload bridge `window.fedosApp` (`fedos_electron_beta_preload.cts:159-164`; typed `fedos_electron_beta_window.d.ts:132-135`) — a channel set distinct from the test-only `fedosAcceptance` bridge |
| Device signing keypair | BACKEND LIVE | `src/device/crypto/fedos_device_signing_keypair.ts:52-60` — real BIP-340/Schnorr secp256k1 via `@noble/curves`, opaque handle, no raw-key getter, process-memory-only |
| Device Sync register/revoke | PARTIAL | revoke is PRODUCTION-WIRED and VISIBLE UI (see below); register happens automatically as a side effect of a successful pairing completion, not a separate user action |
| Device replacement | ABSENT (from `fedosApp`) | `src/device/fedos_device_replacement_coordinator.ts` exists but is not composed into `FedosDesktopApplicationShell` or `fedosApp` — BACKEND LIVE only |
| Visible Devices screen | VISIBLE UI, **list + revoke only** | `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts:642-698` calls only `devicesList()`/`deviceRevoke()`. No create-offer, no accept-offer, no import-token control anywhere in this file (confirmed absent by direct read and grep) |
| Packaged visible-control test | TEST-ONLY REACHABLE (not via UI) | `packages/.../test/secure_runtime_alpha_8041_8120_real_user_facing_vertical_slice.test.ts:329-349` only reads `#devices-list` text; the full two-Runtime pairing lifecycle is exercised only at the library level, `test/secure_runtime_alpha_4581_4660_device_registration_pairing_durable_journal.test.ts:405,592-624`, never through a browser click-path |

### Resolving the Alpha 8041-8120 vs. Validation V1 conflict

Both are correct, about different things. Alpha 8041-8120 truthfully added a
real "Devices UI" — a screen that lists real Devices from the real Registry
and lets you revoke a real Device with real backend effect. Validation V1 is
also correct: that screen supports **viewing and revoking already-paired
Devices**, not **pairing a new Device**. The four IPC methods needed for a
full pairing workflow (`devicePairingCreate/Inspect/Approve/Complete`) were
already exposed on the real, always-on `window.fedosApp` bridge as of this
Arc's own predecessor work (Alpha 4581-4660 wired the facade; Alpha 8041-8120
appears to have wired the IPC channels — main.cts comment at L1791 says
"Phase H (pairing) -- reuse the SAME handlers the acceptance vocabulary
already dispatches to" — but **no renderer code was ever written to call
them**. This is a missing UI connection to an already-real backend
capability, not a missing backend capability — squarely in scope for Phase B
of this Arc, and requires no Rust change and no protocol change.

**Phase A conclusion for Device Pairing: proceed to Phase B.** The gap is
real, narrow, and closeable with existing production boundaries only.

---

## 2. Group Messaging

| Capability | Classification | Evidence |
|---|---|---|
| Group identity / conversation model | BACKEND LIVE | `src/conversation/group/` — `createPrivateGroupDraft()` (`fedos_conversation_runtime.ts:1257`); membership snapshots are "Generations" (`fedos_group_generation.ts:20-28`, ≥2 active members required, L73) |
| Membership add/remove | BACKEND LIVE | `FedosGroupAdmission.addMember()`/`removeMember()` (`fedos_group_admission.ts:50-79`); removal creates a new Generation snapshot (`fedos_conversation_group_runtime.ts:112,121`) — a **membership-list** change, never a cryptographic rekey (there is no group key to rotate) |
| Message transport model | PRODUCTION-WIRED, **independent pairwise fanout, not Sender-Key** | `FedosGroupSendCoordinator.sendGroupMessage()` (`fedos_group_send_coordinator.ts:94-240`) loops recipients and calls the unmodified 1:1 `sendDirectMessage()` once per recipient (L185-189); own doc comment L6-12: "fans a single logical plaintext out into N independent, pairwise-encrypted Envelopes... invokes no crypto directly" |
| Sender-Key group crypto | ABSENT from master | `git merge-base --is-ancestor` is false for all 5 candidate Sender-Key branches against `HEAD`; grep for `SenderKey`/`sender_key` across `src/` returns zero real hits |
| Group inbound routing / recipient-side reconstruction | **ABSENT — receive-blind** | Outbound embeds `groupLinkage.senderGroupMessageId` purely as a dedup hint (`fedos_private_nostr_wire_payload.ts:33,48-51`); the real inbound path, `FedosNip17InboundImportCoordinator.receiveRumor()` (`fedos_nip17_inbound_import_coordinator.ts:142-269`), decodes via a payload shape with **no `groupLinkage` field** (zero grep matches); `fedos_group_read_facade.ts:6-9` states outright the sender's own local log is the only display source and "never reaches into a recipient's own Direct Conversation to reconstruct a group view." Recipients other than the sender cannot see a group thread through the Group API at all — only ordinary 1:1 messages land on their device |
| Archive | PRODUCTION-WIRED | `fedos_conversation_archive_group_section.ts`, wired `fedos_desktop_runtime.ts:823-838,1637-1642` |
| Search | DEFERRED BY ACCEPTED POLICY | group messages are deliberately excluded from the Search index (`fedos_desktop_conversation_content_accessor.ts:41-45` — a fanned-out envelope's own conversation id is the per-recipient Direct path id, not the group id) |
| Visible UI | ABSENT | zero occurrences of "group" anywhere in `packages/fedos-desktop-electron-spike/src/*` (preload, main, page.html, renderer) — no `window.fedosApp` or `fedosAcceptance` method for group creation/membership/send exists at all |
| Packaged visible-control test | ABSENT | zero "group" references under `packages/fedos-desktop-electron-spike/test/`; all group vertical-slice coverage is library-level only |

### Group Messaging product truth (Phase C answer, stated here since it gates Phase D)

Master implements **independent pairwise Double-Ratchet fanout dressed with
a group bookkeeping layer**, not a group ratchet and not Sender-Key. Worse
than a mere "weaker than Signal-style groups" limitation: the **receive
side was never built**. A message Alice sends to a 3-person group is
delivered as three ordinary 1:1 envelopes; Bob's and Carol's devices import
them as ordinary Direct messages and have no code path that reconstructs
"this was a group message, part of group G, alongside these other members'
copies." Only Alice's own device — the sender — can render the group view,
because only Alice's device ever writes to her own local
`FedosGroupMessageRecord` log at send time.

This is not a security-labeling question (forward secrecy, PCS, etc. are all
moot) — it is a basic functional gap. **Exposing a Group UI right now would
not merely overclaim security, it would ship a feature that does not work
for anyone except the group's creator.** That is disqualifying under this
Arc's own Phase D instruction: "If the backend is only library-level or
insecure for user release: do not expose a fake group UI... declare Group
Messaging intentionally unavailable in this pilot."

**Phase A conclusion for Group Messaging: do NOT proceed to Phase D.**
Document honestly (Phase C/J), disclose the receive-side gap as the named
blocker for a future Arc, and do not build a Group Conversation UI in this
Arc. Per this Arc's own mission text, Closed Beta readiness does not require
Group Messaging when its absence is clearly disclosed, and Full Completion
is still available on that basis.

---

## 3. Scope for the rest of this Arc

- **Phase B (Device Pairing UI): proceed.** Real, narrow, backend-complete
  gap; existing production boundaries (`window.fedosApp`) already carry
  everything needed. No Rust, no protocol change.
- **Phase C (Group Messaging truth): write-up only,** completed above and
  expanded into user-facing docs in Phase J. No code change to the group
  transport/routing layer — reconstructing the receive side is real,
  necessary work but is scoped as a NEXT Arc, not this one (it touches the
  NIP-17 inbound decode path, a protocol-frozen boundary this Arc's mission
  explicitly forbids redesigning).
- **Phase D (Group Conversation UI): skip**, per the above. Update visible
  limitations copy to state group messaging is intentionally unavailable in
  this pilot, and why.
- **Phases E-K:** proceed as scoped (recovery/error polish, final polish,
  security copy, acceptance tests, docs, verification, release rebuild).

Recovery screen note (also found during this inventory, in scope for Phase
E): `screen-recovery` (`fedos_electron_beta_page.html:107-116`) copy claims
"You can retry, restore from an Archive, or quit" but only three actions are
actually wired — retry, copy diagnostic code, and quit
(`fedos_electron_beta_renderer.ts` recovery handlers). There is no
"restore from Archive" button on this screen at all. The copy overpromises
versus the real action set; Phase E will correct the copy to match the real
actions (recovery is not the place to newly wire Archive restore — that
would broaden scope beyond polish).

Settings screen note: contrary to a prior (7241-7320) review, a real
Settings screen now exists (`app-screen-settings`,
`fedos_electron_beta_renderer.ts:1088-1138`), added across Alpha 8041-8120
and 8121-8200. It exposes theme, language, notifications, background-sync,
and Relay list management, but not `archiveDirectory`, `autoStart`,
`autoLockTimeoutMinutes`, or `windowLayout`, even though `SettingsDescriptor`
already carries those fields. Left as-is in this Arc (not a Closed-Beta
blocker; noted for a future polish pass, not implemented here to avoid
scope creep beyond the two named priority gaps).
