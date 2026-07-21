/**
 * Secure Runtime Alpha 4741-4820 — Phase G: production profile
 * activation assembler.
 *
 * The single entry point the Electron main package uses to obtain a
 * REAL, WASM-backed `FedosMasterSeedAuthority` for the profile
 * coordinator. It runs the production Desktop crypto activation
 * authority (Phase B) and, ONLY on `permitted`, constructs the
 * production authority (Phase G). On ANY other decision it returns an
 * explicit closed blocked result — there is NO silent fallback to the
 * development seed double or a fake authority (Absolute Prohibitions).
 *
 * The coordinator itself is UNCHANGED: it already accepts an injected
 * `FedosMasterSeedAuthority`. This assembler decides WHICH authority is
 * available, honestly, and hands back either the real one or a blocked
 * decision — never a downgrade.
 */

import type { FedosMasterSeedAuthority } from "../../runtime/master_seed/fedos_master_seed_authority.js";
import {
  authorizeAndActivateFedosProductionDesktopMasterSeed,
  type FedosProductionActivationDecision,
  type FedosProductionActivationRequest,
} from "./fedos_production_desktop_crypto_activation_authority.js";
import { FedosProductionMasterSeedAuthority } from "./fedos_production_master_seed_authority.js";

export type FedosProductionProfileActivation =
  | { readonly outcome: "activated"; readonly masterSeedAuthority: FedosMasterSeedAuthority; readonly appId: string }
  | {
      readonly outcome: "blocked";
      readonly decision: Exclude<FedosProductionActivationDecision, "permitted">;
      readonly reason: string;
    };

/**
 * Attempt production activation and return a real `FedosMasterSeedAuthority`
 * on success. Never throws. Never returns a dev/fake authority on failure.
 */
export async function activateFedosProductionProfileMasterSeed(
  request: FedosProductionActivationRequest,
): Promise<FedosProductionProfileActivation> {
  const result = await authorizeAndActivateFedosProductionDesktopMasterSeed(request);
  if (result.decision !== "permitted") {
    return { outcome: "blocked", decision: result.decision, reason: result.reason };
  }
  return {
    outcome: "activated",
    masterSeedAuthority: new FedosProductionMasterSeedAuthority(result.facade),
    appId: result.appId,
  };
}
