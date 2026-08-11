/**
 * Secure Runtime Alpha 030 — "FedOS Identity Capability".
 *
 * The MINIMAL shape naming whether one provider is currently available
 * at all — nothing more. See
 * `docs/secure_runtime_alpha_030_fedos_identity_capability.md` for the
 * full design rationale, the differences from `FedosIdentityDescriptor`
 * (Alpha 028) and `FedosIdentityProvider` (Alpha 029), the
 * responsibility separations from Secure Runtime and from any
 * sign-in/attempt/lifecycle concern, and the future Resolver
 * relationship.
 *
 * This file defines a TYPE ONLY — no function, no class, no runtime
 * behavior, and no wiring into any other module in this repository.
 * `FedosIdentityCapability` names EXACTLY one question — "is this
 * provider available" — and nothing beyond it: no status, no
 * lifecycle, no linked-identity data, no descriptive metadata of any
 * kind.
 */
export interface FedosIdentityCapability {
  readonly provider: string;
  readonly available: boolean;
}
