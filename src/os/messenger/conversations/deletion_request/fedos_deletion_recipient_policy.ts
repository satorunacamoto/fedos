/**
 * Secure Runtime Alpha 5881-5960 (FedOS Signed Recipient Deletion Request
 * Private Transport and Local Policy Integration Arc) — Phase E: the
 * closed, LOCALLY-CONFIGURED recipient deletion policy.
 *
 * A request names a SCOPE ("what the sender is asking for"); this policy
 * names what the LOCAL recipient install is willing to grant — a request
 * is a request, never an authority of its own (mission's own explicit
 * instruction). The policy value itself is never caller-supplied by the
 * inbound wire path — `FedosDeletionRequestInboundDependencies.resolveLocalPolicy`
 * (`fedos_deletion_request_inbound_coordinator.ts`) is the ONE seam a
 * real local settings store would inject through; nothing in this file
 * or its callers ever derives a policy value from the request itself.
 *
 * The default is `"always-review"` (never unconditional automatic
 * deletion) unless a real, cited local configuration deliberately selects
 * one of the two `"allow-*"` values — this file makes NO default
 * selection itself (it has no notion of "the" default; a caller who
 * cannot resolve a real configured value should supply `"unavailable"`,
 * never silently substitute `"allow-local-history-and-index"`).
 *
 * Archive/backup/Relay scopes are structurally unsupported: this
 * vocabulary has no value that could ever grant one, and
 * `FedosDeletionRecipientPolicyDecision`'s own `grantedScope` type is
 * `FedosDeletionRequestScope` — the SAME two-value, Archive/backup/Relay-
 * free vocabulary `5641-5720` already restricted the wire request itself
 * to.
 */
import { isFedosDeletionRequestScope, type FedosDeletionRequestScope } from "./fedos_deletion_request_scope.js";

export type FedosDeletionRecipientPolicy =
  | "always-review"
  | "allow-local-history-only"
  | "allow-local-history-and-index"
  | "deny"
  | "unavailable";

export const FEDOS_DELETION_RECIPIENT_POLICIES: readonly FedosDeletionRecipientPolicy[] = [
  "always-review",
  "allow-local-history-only",
  "allow-local-history-and-index",
  "deny",
  "unavailable",
];

const FEDOS_DELETION_RECIPIENT_POLICY_SET: ReadonlySet<string> = new Set(FEDOS_DELETION_RECIPIENT_POLICIES);

export function isFedosDeletionRecipientPolicy(value: unknown): value is FedosDeletionRecipientPolicy {
  return typeof value === "string" && FEDOS_DELETION_RECIPIENT_POLICY_SET.has(value);
}

export type FedosDeletionRecipientPolicyDecision =
  | { readonly decision: "deny" }
  | { readonly decision: "await-review" }
  | { readonly decision: "grant"; readonly grantedScope: FedosDeletionRequestScope };

/**
 * Pure function of `(policy, requestedScope)` — never reads a clock, never
 * touches persistence, never calls `b3b3a6d`. `"deny"`/`"unavailable"`
 * both refuse (distinctly logged upstream, identically decided here — an
 * unavailable local policy is never treated as an implicit allow).
 * `"allow-local-history-only"` NEVER grants more than `"local-history"`,
 * even when the request itself asked for the wider
 * `"local-history-and-index"` scope — the grant is capped by LOCAL
 * policy, never expanded by what the request merely asked for.
 * `"allow-local-history-and-index"` grants exactly the requested scope
 * (itself already one of the two closed values) — it can grant
 * `"local-history"` alone if that is genuinely all the request asked for,
 * never silently widening a narrower request.
 */
export function evaluateFedosDeletionRecipientPolicy(
  policy: FedosDeletionRecipientPolicy,
  requestedScope: FedosDeletionRequestScope,
): FedosDeletionRecipientPolicyDecision {
  if (!isFedosDeletionRecipientPolicy(policy) || !isFedosDeletionRequestScope(requestedScope)) return { decision: "deny" };
  if (policy === "deny" || policy === "unavailable") return { decision: "deny" };
  if (policy === "always-review") return { decision: "await-review" };
  if (policy === "allow-local-history-only") return { decision: "grant", grantedScope: "local-history" };
  return { decision: "grant", grantedScope: requestedScope };
}
