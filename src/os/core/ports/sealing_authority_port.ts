/**
 * OS Capability Modularization — `SealingAuthorityPort`.
 *
 * A minimal, additive contract for sealing/restoring an opaque secret blob
 * at rest, under a key bound to a caller-supplied identity tuple. This is
 * the SAME two-method surface `FedosDirectRatchetSealingAuthority`
 * (`src/os/messenger/conversations/ratchet/fedos_direct_ratchet_sealing_authority.ts`)
 * already named — that file now defines its own type as an alias of this
 * one (`export type FedosDirectRatchetSealingAuthority = SealingAuthorityPort;`)
 * rather than duplicating the shape, so every existing Messenger-side
 * consumer of `FedosDirectRatchetSealingAuthority` (the ratchet state/
 * conversation runtimes, the desktop/production composition roots) keeps
 * working unchanged.
 *
 * Method and parameter names are kept IDENTICAL to the pre-existing
 * interface on purpose — this is a pure dependency-DIRECTION fix (Core now
 * OWNS the contract two concrete secrets authorities already implement;
 * Messenger consumes it), not a behavior or call-surface change. Renaming
 * would ripple into every consumer call site for no benefit.
 *
 * The two real implementers today are
 * `src/os/core/vault/wasm/fedos_wasm_master_seed_authority.ts`
 * (`FedosWasmMasterSeedAuthority`) and
 * `src/os/messenger/desktop/production_activation/fedos_production_master_seed_authority.ts`
 * (`FedosProductionMasterSeedAuthority`) — each implements this
 * ADDITIONALLY, alongside its own separate `FedosMasterSeedAuthority`
 * contract. Other `FedosMasterSeedAuthority` implementers (e.g.
 * `DevelopmentFedosMasterSeedAuthority`) deliberately do NOT implement
 * this port, matching this port's own narrow, opt-in, "unavailable is a
 * valid state" discipline (consumers hold `SealingAuthorityPort | null`).
 *
 * This file must never import from `src/conversation`, `src/os/messenger`,
 * `src/commerce`/`src/os/commerce`, or any other domain-specific module.
 */

export interface SealingAuthorityPort {
  /**
   * Seals `secretBytes` (opaque placeholder material only — this port
   * implements no cryptography itself) at rest, under a key that is a
   * pure function of the full session-binding tuple (`localDeviceRef`,
   * `remoteDeviceRef`, `conversationId`, `generation`). Returns an opaque
   * sealed blob string, or `null` on any failure (no secret held, CSPRNG
   * failure, internal AEAD failure). Never throws.
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
   * including a tampered or malformed `sealedBlob`. Never throws.
   */
  restoreDirectRatchetSecret(
    localDeviceRef: string,
    remoteDeviceRef: string,
    conversationId: string,
    generation: number,
    sealedBlob: string,
  ): Promise<Uint8Array | null>;
}
