/**
 * Secure Runtime Alpha 4741-4820 — Phase C: Host Attestation Boundary.
 *
 * The narrowest LOCAL evidence that an activation request originates
 * from the accepted Electron main process / package — NOT remote
 * attestation, and explicitly NOT a claim of resistance to local
 * malware or a modified binary. This is CAPABILITY CONTAINMENT: a
 * renderer / Worker / arbitrary-browser context cannot mint a valid
 * attestation, because the only constructor is guarded by a
 * module-private `Symbol` that is never exported and never reachable
 * across the context-isolation boundary (`contextIsolation: true`,
 * `nodeIntegration: false`, `sandbox: true`). A caller-controlled
 * string can never stand in for a real attestation instance — approval
 * is identified from an unforgeable object identity, never a string.
 *
 * The attestation carries only non-secret, build-embedded facts: the
 * application identifier and version the accepted Electron main package
 * was built with. It carries NO seed, NO key, NO passphrase.
 */

/** Module-private brand — never exported. Renderer code cannot obtain it. */
const HOST_ATTESTATION_BRAND: unique symbol = Symbol("fedos.production.host-attestation");

export interface FedosProductionDesktopHostAttestation {
  readonly [HOST_ATTESTATION_BRAND]: true;
  /** Build-embedded application identifier of the accepted Electron main package. */
  readonly appId: string;
  /** Build-embedded application version. */
  readonly appVersion: string;
}

export interface FedosProductionDesktopHostIdentity {
  readonly appId: string;
  readonly appVersion: string;
}

/**
 * Construct a host attestation. This function is INTENDED to be called
 * ONLY from inside the isolated Electron main package (explicit
 * dependency injection unavailable to renderer code). It performs
 * minimal shape validation on the build-embedded identity and returns a
 * branded, frozen token. It is deliberately the ONLY way to produce a
 * value that `isFedosProductionDesktopHostAttestation()` accepts.
 */
export function createElectronMainHostAttestation(
  identity: FedosProductionDesktopHostIdentity,
): FedosProductionDesktopHostAttestation | null {
  if (typeof identity !== "object" || identity === null) return null;
  if (typeof identity.appId !== "string" || identity.appId.length === 0 || identity.appId.length > 200) return null;
  if (
    typeof identity.appVersion !== "string" ||
    identity.appVersion.length === 0 ||
    identity.appVersion.length > 64
  ) {
    return null;
  }
  return Object.freeze({
    [HOST_ATTESTATION_BRAND]: true as const,
    appId: identity.appId,
    appVersion: identity.appVersion,
  });
}

/**
 * The unforgeable check the activation authority uses. Returns `true`
 * ONLY for a value produced by `createElectronMainHostAttestation()` —
 * a plain object literal, a JSON-parsed payload, or any renderer-crafted
 * shape all fail here, because none can carry the module-private brand.
 */
export function isFedosProductionDesktopHostAttestation(
  candidate: unknown,
): candidate is FedosProductionDesktopHostAttestation {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    (candidate as Record<PropertyKey, unknown>)[HOST_ATTESTATION_BRAND] === true &&
    typeof (candidate as FedosProductionDesktopHostAttestation).appId === "string" &&
    typeof (candidate as FedosProductionDesktopHostAttestation).appVersion === "string"
  );
}
