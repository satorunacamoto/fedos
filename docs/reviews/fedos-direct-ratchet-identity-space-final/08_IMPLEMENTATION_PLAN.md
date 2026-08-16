# Direct Ratchet Identity-Space Unification — Implementation Plan

**Status**: Coordinator-adopted plan, based verbatim on design doc `02_OPTION_A_CANONICAL_DEVICE_ID.md` §7 (the
only implementation plan in Phase A, since Option B/C were not selected). Sequenced so the self-binding writer
lands before the `localDeviceRef` source switch, so no fresh profile is ever created in a window where Direct
Ratchet is enabled but the self-binding is missing.

1. **`fedos_local_peer_device_announcement_identity.ts`** — add an optional `onFreshlyGenerated` callback
   parameter to `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity(filePath, onFreshlyGenerated?)`, invoked
   synchronously only on the "generate fresh" branch, passing the freshly generated `FedosDeviceSigningKeypair`
   and the constructed identity. No behavior change for any caller that omits the parameter.

2. **`fedos_desktop_runtime.ts`** — inside the `conversationPeerDeviceAnnouncementDeps` construction, pass a
   callback performing the self-registration sequence against the existing, unmodified
   `FedosDeviceBindingRegistrationAuthority` (via `FedosDevicePairingFacade`): `createPairingRequest()` →
   `approvePairingRequest()` → `completePairing()`, using the freshly generated keypair, the PDD `deviceId`, and
   `config.localAccountRef!`. Must land before step 3.

3. **`fedos_desktop_runtime.ts`** — change `conversationDirectRatchetDeps.localDeviceRef` from
   `config.localDeviceId!` to the PDD `deviceId` resolved in step 2. Read the PDD identity once, shared by both
   the `conversationPeerDeviceAnnouncementDeps` and `conversationDirectRatchetDeps` construction (avoids reading/
   creating the identity file twice per Runtime construction).

4. **Verification checkpoint, no edit**: `forwardSecrecySelector` closure (`localDeviceRef:
   deps.directRatchet!.localDeviceRef`) — confirm it now carries the Space B value automatically.

5. **No edits**: `fedos_direct_ratchet_outbound_integration.ts`, `fedos_direct_ratchet_inbound_integration.ts`,
   `fedos_direct_ratchet_conversation_runtime.ts`, `fedos_direct_ratchet_device_pair_resolver.ts`,
   `fedos_direct_ratchet_session_binding.ts`, `fedos_direct_ratchet_cryptographic_session.ts`, the Rust boundary,
   the NIP-17 payload codec — every one consumes `localDeviceRef` as an opaque string.

6. **Verification checkpoint, no edit**: `fedos_conversation_security_state_controller.ts` — confirm
   `getSecurityState()` reports coherent Axis 2/3 results in the new integration test.

7. **Documentation, not code**: record the no-retroactive-migration limitation for already-provisioned installs
   (already captured in `07_FINAL_ARCHITECTURE_DECISION.md`).
