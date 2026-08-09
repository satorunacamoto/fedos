/**
 * Secure Runtime Alpha 5401-5480 — Phase D: the closed Direct Ratchet
 * session lifecycle vocabulary and its validated transition table,
 * mirroring `FedosDeviceTrustState`'s own closed-enum + `ALLOWED_TRANSITIONS`
 * Map + terminal-state discipline (`../../device/fedos_device_binding.ts`,
 * Alpha 2921-3000) exactly.
 *
 * This is a SUPERSET of the normative review's own two adjacent
 * vocabularies (`review/fedos-forward-secrecy-double-ratchet-v1` @
 * `b34d608`) — neither alone fits a pre-crypto foundation object that
 * can exist before any secret is ever sealed:
 *   - `10_double_ratchet_state_model.md` §2's own session `expiration
 *     state`: `"active" | "stale" | "superseded" | "revoked"` (reused
 *     here as `active`/`expired`/`reset-required`/`revoked` — renamed
 *     `stale`->`expired` and `superseded`->`reset-required` to match
 *     this Arc's own vocabulary, `18_failure_and_recovery_matrix.md`'s
 *     own "session marked requiring reset" phrasing for the latter).
 *   - `17_...migration_outcome.md` §1's `FedosMessagingMigrationOutcome`
 *     contributes `corrupt` (a sealed session state that failed to
 *     restore/validate).
 *   - `initialized` and `unavailable` are foundation-specific additions
 *     this Arc needs and the review never had to name: `initialized`
 *     covers a record created before any secret is ever sealed (the
 *     review always assumes a live ratchet session already exists);
 *     `unavailable` mirrors `FedosDeviceTrustState`'s own state of the
 *     same name (the sealing authority/WASM boundary itself is
 *     unreachable, not a fact about the session's own data).
 *   - `suspended` is an explicit, operator-triggered pause this Arc's
 *     own Runtime facade (Phase H) exposes — never entered
 *     automatically by anything in this Arc.
 *
 * See `docs/secure_runtime_alpha_5401_5480_reconciliation_report.md` §4
 * for the full citation trail.
 */

export type FedosDirectRatchetSessionLifecycleState =
  | "initialized"
  | "active"
  | "suspended"
  | "reset-required"
  | "expired"
  | "revoked"
  | "corrupt"
  | "unavailable";

export const FEDOS_DIRECT_RATCHET_SESSION_LIFECYCLE_STATES: readonly FedosDirectRatchetSessionLifecycleState[] = [
  "initialized",
  "active",
  "suspended",
  "reset-required",
  "expired",
  "revoked",
  "corrupt",
  "unavailable",
];

/** Terminal states: `revoked`/`corrupt` never transition anywhere (fail-closed, matching `FedosDeviceTrustState`'s own `"revoked"` terminal guarantee). `reset-required`/`expired` are also terminal for THIS session object -- recovery from either always creates a NEW session (a new generation), never a mutation of this one. */
const ALLOWED_TRANSITIONS: ReadonlyMap<
  FedosDirectRatchetSessionLifecycleState,
  ReadonlySet<FedosDirectRatchetSessionLifecycleState>
> = new Map([
  ["initialized", new Set<FedosDirectRatchetSessionLifecycleState>(["active", "corrupt", "unavailable", "revoked"])],
  [
    "active",
    new Set<FedosDirectRatchetSessionLifecycleState>([
      "suspended",
      "reset-required",
      "expired",
      "revoked",
      "corrupt",
      "unavailable",
    ]),
  ],
  [
    "suspended",
    new Set<FedosDirectRatchetSessionLifecycleState>(["active", "revoked", "expired", "corrupt", "unavailable"]),
  ],
  ["reset-required", new Set<FedosDirectRatchetSessionLifecycleState>(["revoked"])],
  ["expired", new Set<FedosDirectRatchetSessionLifecycleState>(["revoked"])],
  // Terminal, per this Arc's own requirement ("Revoked/corrupt terminal
  // behavior must fail closed") -- zero outgoing edges, matching
  // `FedosDeviceTrustState`'s own `"revoked"` terminal guarantee exactly.
  ["revoked", new Set<FedosDirectRatchetSessionLifecycleState>()],
  ["corrupt", new Set<FedosDirectRatchetSessionLifecycleState>()],
  ["unavailable", new Set<FedosDirectRatchetSessionLifecycleState>(["active", "corrupt", "revoked"])],
]);

export function isFedosDirectRatchetSessionLifecycleTransitionAllowed(
  from: FedosDirectRatchetSessionLifecycleState,
  to: FedosDirectRatchetSessionLifecycleState,
): boolean {
  return ALLOWED_TRANSITIONS.get(from)?.has(to) ?? false;
}

export function isFedosDirectRatchetSessionLifecycleTerminal(state: FedosDirectRatchetSessionLifecycleState): boolean {
  return (ALLOWED_TRANSITIONS.get(state)?.size ?? 0) === 0;
}
