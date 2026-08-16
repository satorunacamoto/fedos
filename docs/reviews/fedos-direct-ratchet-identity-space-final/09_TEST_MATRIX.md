# Direct Ratchet Identity-Space Unification — Test Matrix

**Status**: Coordinator-adopted, from design doc `02` §8 (new/updated tests) plus the Option-A-relevant rows of
threat model `05`'s negative-test matrix (§4, INV-1/2/9/12).

## New tests

1. Self-binding registration unit test: `onFreshlyGenerated` fires exactly once, only on first PDD identity
   creation, never on a subsequent read; resulting `FedosDeviceBindingV1` has the exact fields design doc 02 §3.3
   step 3 specifies.
2. `resolveFedosDirectRatchetDevicePair()` regression test: `"local-device-unknown"` before the self-binding
   write, `"resolved"` after.
3. **Primary proof**: rewrite `packages/fedos-desktop-electron-spike/test/direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts`
   scenario c so it now asserts BOTH sides reach `"active"`, not Bob durably stuck at `"initialization-required"`.
4. Security State Controller coherence test: Axis 2 (`ratchetStatus`) reports `"active"` for a genuinely
   established cross-account session using the real `peerDeviceAnnouncementListObserved()`-sourced device.
5. Forward-secrecy route selector test: `selectFedosDirectConversationForwardSecrecyRoute()` selects `"ratchet"`
   for a session whose `binding.localDeviceRef` is a Space B value.
6. INV-1 (Registry conflict, must still hold for the new self-binding write path).
7. INV-9 (profile isolation, must still hold for the new self-binding write path).
8. INV-12 (self-binding registration migration/write is idempotent across a simulated restart).

## Existing tests to audit for Space-A-shaped assumptions (from design doc 02 §8.2 — must be opened, not
assumed clean)

- `test/secure_runtime_alpha_5561_5640_route_and_device_pair.test.ts`
- `test/secure_runtime_alpha_5961_6040_real_vertical_slice.test.ts`
- `test/secure_runtime_alpha_5961_6040_ratchet_reset_integration.test.ts`
- `test/secure_runtime_alpha_6921_7000_production_session_vertical_slice.test.ts`
- `test/secure_runtime_alpha_7001_7080_structural_guards.test.ts`
- `test/secure_runtime_alpha_7401_7480_ratchet_route_binding_isolation.test.ts`
- `test/fedos_ratchet_device_lifecycle_session_reset_foundation_unit.test.ts`
- `test/fedos_ratchet_device_lifecycle_session_reset_real_vertical_slice.test.ts`
- `test/support/fake_direct_ratchet_sealing_authority.ts`

## Live installed proof (mandate §16-25)

Real NSIS-installed Alice + Bob, two independent processes/profiles/dataDirs:
mutual Device discovery → Alice establishes → Bob receives → Bob responds → Alice receives → ACTIVE both sides →
Alice→Bob message → Bob→Alice message → repeat → Alice restart → Bob restart → both restart → offline/delayed
handshake → replay → wrong-device negative → route-evidence proof → Security UI truthfulness proof.
