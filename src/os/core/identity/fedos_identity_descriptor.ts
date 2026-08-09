/**
 * Secure Runtime Alpha 028 — "FedOS Identity Descriptor". Secure
 * Runtime Alpha 045 — "FedOS Identity Descriptor Expansion" (this
 * revision — two optional fields).
 *
 * The MINIMAL shape a future FedOS Identity layer might hold to name
 * one linked identity — a caller-supplied opaque id, a provider label,
 * a PUBLIC, non-sensitive identifier the caller already controls, and
 * (since Alpha 045) two OPTIONAL, public, display-only fields —
 * `displayName`/`avatar` — matching Alpha 038's own formal ADOPT
 * decision, and matching `FedosNostrPublicIdentitySnapshot`'s own
 * identical two-field expansion (Alpha 044). See
 * `docs/secure_runtime_alpha_028_fedos_identity_descriptor.md` for the
 * original three-field design rationale, the exclusion list, and the
 * layering this type fits into (Alpha 027's own recommended Option C),
 * and `docs/secure_runtime_alpha_045_fedos_identity_descriptor_expansion.md`
 * for this Stage's own rationale: why `displayName`/`avatar` are both
 * optional, why `avatar` remains a reference only, and why neither may
 * ever carry sign-in-shaped or confidential content of any kind.
 *
 * This file defines a TYPE ONLY — no function, no class, no runtime
 * behavior, and no wiring into any other module in this repository.
 * `provider` is left as a plain, unconstrained value here, deliberately
 * NOT a fixed set of named values — this file carries no
 * protocol-specific vocabulary of any kind. `displayName`/`avatar` are
 * both OPTIONAL (`?:`) — no Provider implementation in this repository
 * is modified by this Stage to populate either field, so every
 * Descriptor any Provider produces today continues to omit both,
 * exactly as before this Stage.
 */
export interface FedosIdentityDescriptor {
  readonly id: string;
  readonly provider: string;
  readonly publicIdentifier: string;
  readonly displayName?: string;
  readonly avatar?: string;
}
