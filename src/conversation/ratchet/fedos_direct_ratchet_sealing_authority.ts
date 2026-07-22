/**
 * Secure Runtime Alpha 5401-5480 (FedOS Direct Ratchet State and Sealed
 * Persistence Foundation Arc) — the narrow, additive sealing-authority
 * port this Arc's own persistence layer depends on. Deliberately NOT
 * added to the shared `FedosMasterSeedAuthority` interface
 * (`../../runtime/master_seed/fedos_master_seed_authority.ts`) — that
 * interface is implemented by several unrelated authorities
 * (`DevelopmentFedosMasterSeedAuthority`, `FedosProductionMasterSeedAuthority`)
 * that have no reason to know about ratchet sealing, and widening it
 * would force every implementer and every existing test fixture to grow
 * two new methods for a concern they don't own. `FedosWasmMasterSeedAuthority`
 * (`../../runtime/master_seed/fedos_wasm_master_seed_authority.ts`)
 * implements this port ADDITIONALLY, alongside its unchanged
 * `FedosMasterSeedAuthority` implementation.
 *
 * Consumers (this Arc's own Runtime facade and sealed-secret port) take
 * `FedosDirectRatchetSealingAuthority | null` — `null` when no real
 * sealing authority is wired up (e.g. `DevelopmentFedosMasterSeedAuthority`),
 * matching this Arc's own "unavailable" lifecycle state rather than a
 * thrown error.
 */

export interface FedosDirectRatchetSealingAuthority {
  /**
   * Seals `secretBytes` (opaque placeholder material only — this Arc
   * implements no real ratchet cryptography) at rest, under a key that
   * is a pure function of the full Direct Ratchet session-binding tuple
   * (`localDeviceRef`, `remoteDeviceRef`, `conversationId`,
   * `generation`). Returns an opaque sealed blob string, or `null` on
   * any failure (no Master Seed held, CSPRNG failure, internal AEAD
   * failure).
   */
  sealDirectRatchetSecret(
    localDeviceRef: string,
    remoteDeviceRef: string,
    conversationId: string,
    generation: number,
    secretBytes: Uint8Array,
  ): Promise<string | null>;

  /**
   * The restoring counterpart. Requires the EXACT SAME binding tuple the
   * secret was sealed with; any difference (wrong local/remote device,
   * wrong conversation, wrong generation) fails closed by AEAD
   * authentication, not by a string comparison. `null` on ANY failure,
   * including a tampered or malformed `sealedBlob`.
   */
  restoreDirectRatchetSecret(
    localDeviceRef: string,
    remoteDeviceRef: string,
    conversationId: string,
    generation: number,
    sealedBlob: string,
  ): Promise<Uint8Array | null>;
}
