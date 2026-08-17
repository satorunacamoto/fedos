# Current Own-Device Model — source-verified truth

## Three layers that must not be confused (mandate §4)

1. **Peer Device Discovery** — learning devices belonging to ANOTHER account. Fully
   implemented, proven all session (`fedos_peer_device_announcement_*`).
2. **Own-Device Pairing/Admission** — adding a second device to MY OWN account.
   `FedosDevicePairingFacade` / `fedos_device_pairing_facade.ts` exists and reuses the
   existing account signing authority (a device pairing request is authenticated by the
   requesting device's own signature plus explicit approval from an already-trusted device
   — no central server, matches mandate §5's own requirement). Not re-audited line-by-line
   this pass (pre-existing, not touched by any arc this session); treated as CURRENT_AND_WIRED
   based on its own real Shell/renderer wiring (`fedos_device_management_*`,
   `fedos_desktop_device_list_renderer.ts`).
3. **State Sync** (own-device data replication) — **the central finding of this arc, see
   `02_SECOND_DEVICE_GAP.md`.**

## Own-Device Sync — exact per-domain answer (not "substantially real")

Traced `FedosDeviceSyncSessionV1` (`src/os/messenger/device/sync_session/fedos_device_sync_session.ts`)
and `FedosDeviceSyncPackageManifestV1` directly: the ENTIRE payload this sync mechanism ever
carries is the account's own trusted-device list (`deviceId`, `devicePublicKeyRef`,
`trustState`) — nothing else. Definitive classification:

| Domain | Classification |
|---|---|
| Own-device registry (which devices exist, their trust state) | **DESIGNED TO SYNC** (payload shape proves it — see gap below) |
| Conversations (existence, participants) | NOT_IMPLEMENTED — no field carries this |
| Message history | NOT_IMPLEMENTED |
| Receipts | NOT_IMPLEMENTED |
| Purchased content / grants | NOT_IMPLEMENTED |
| Commerce products/orders | NOT_IMPLEMENTED |
| Settings | NOT_IMPLEMENTED |
| Direct Ratchet session state | NOT_IMPLEMENTED (correctly — see `03_DEVICE_AUTHORITY.md`, this is a deliberate non-goal) |

This alone answers mandate §12/§45's own classification requirement: cross-device
conversation/message/receipt/content sync is uniformly `NOT_IMPLEMENTED`, not partially
implemented. "Own-Device Sync" in this codebase's own naming means "device-registry
replication," nothing broader.
