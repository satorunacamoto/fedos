/**
 * Secure Runtime Alpha 028 — "FedOS Identity Descriptor".
 *
 * The MINIMAL shape a future FedOS Identity layer might hold to name
 * one linked identity — a caller-supplied opaque id, a provider label,
 * and a PUBLIC, non-sensitive identifier the caller already controls.
 * See `docs/secure_runtime_alpha_028_fedos_identity_descriptor.md` for
 * the full design rationale, the exclusion list, and the layering this
 * type fits into (Alpha 027's own recommended Option C).
 *
 * This file defines a TYPE ONLY — no function, no class, no runtime
 * behavior, and no wiring into any other module in this repository.
 * `provider` is left as a plain, unconstrained value here, deliberately
 * NOT a fixed set of named values — this file carries no
 * protocol-specific vocabulary of any kind.
 */
export interface FedosIdentityDescriptor {
  readonly id: string;
  readonly provider: string;
  readonly publicIdentifier: string;
}
