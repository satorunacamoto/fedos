/**
 * Secure Runtime Alpha 4661-4740 — Phase C: the closed profile lifecycle
 * state machine.
 *
 * Uses this repository's own state-machine vocabulary convention (a closed
 * union + an explicit, exhaustive transition table + a total
 * `canTransition`/`applyTransition` pair, mirroring
 * `src/device/fedos_device_binding.ts`'s own closed transition table and
 * `src/conversation/retention/*`'s state models).
 *
 * States:
 *   - `absent`            — no profile exists (fresh install, first run).
 *   - `initializing`      — a create-profile is mid-flight; NOT ready.
 *   - `locked`            — a profile exists on disk, sealed, not yet unlocked.
 *   - `unlocking`         — an unlock attempt is in flight (running-process only).
 *   - `ready`             — Master Seed restored, Runtime started, usable.
 *   - `failed`            — an initialization step failed; NO false ready marker.
 *   - `recovery-required` — corruption/identity-mismatch detected; MUST NOT
 *                           silently become a new profile. FedOS Peer Device
 *                           Discovery Arc P0 Closure (Agent F): the first
 *                           explicit, user-confirmed exception is
 *                           `"reset-interrupted-profile"` below — never
 *                           silent, and structurally unreachable for a
 *                           profile that ever durably reached `ready` (see
 *                           `FedosProfileInitializationCoordinator#resetInterruptedProfile()`'s
 *                           own guard). FedOS Installed Startup Root-Cause
 *                           Arc adds the SIBLING exception,
 *                           `"reset-corrupt-ready-profile"` below, for the
 *                           opposite shape: a descriptor that DID durably
 *                           reach `ready` but whose sealed Master Seed
 *                           envelope is structurally missing/corrupt (see
 *                           `FedosProfileInitializationCoordinator#resetCorruptReadyProfile()`'s
 *                           own guard). Every other `ready` profile remains
 *                           structurally unreachable by either exception.
 *   - `stopped`           — Runtime deliberately stopped/locked; durable state
 *                           intact, returns to `locked` on next launch.
 *
 * INVARIANTS (asserted by real tests):
 *   - There is NO partial `ready`: `ready` is reachable ONLY from
 *     `unlocking` (existing profile) or `initializing` (first run).
 *   - Unlock failure returns `unlocking -> locked` (never `failed`, never a
 *     new profile) — retry stays possible.
 *   - Corruption enters `recovery-required`, never `absent`.
 *   - Runtime stop (`ready -> stopped`) never destroys the profile; a fresh
 *     launch reads it back as `locked`.
 *   - `applyTransition` is total and pure: an illegal transition returns the
 *     UNCHANGED state (never throws, never advances).
 */

export type FedosProfileLifecycleState =
  | "absent"
  | "initializing"
  | "locked"
  | "unlocking"
  | "ready"
  | "failed"
  | "recovery-required"
  | "stopped";

export const FEDOS_PROFILE_LIFECYCLE_STATES: readonly FedosProfileLifecycleState[] = Object.freeze([
  "absent",
  "initializing",
  "locked",
  "unlocking",
  "ready",
  "failed",
  "recovery-required",
  "stopped",
]);

/** The events that drive the machine. Closed union — no free-form string. */
export type FedosProfileLifecycleEvent =
  | "begin-create" // absent -> initializing
  | "initialization-succeeded" // initializing -> ready
  | "initialization-failed" // initializing -> failed
  | "corruption-detected" // (any durable) -> recovery-required
  | "profile-detected-locked" // absent -> locked (a launch found an existing sealed profile)
  | "begin-unlock" // locked -> unlocking
  | "unlock-succeeded" // unlocking -> ready
  | "unlock-failed" // unlocking -> locked (indistinguishable coarse failure; retry stays open)
  | "identity-mismatch" // unlocking -> recovery-required
  | "runtime-start-failed" // unlocking|initializing -> failed
  | "lock" // ready -> stopped
  | "relaunch" // stopped -> locked (durable state intact)
  // FedOS Peer Device Discovery Arc P0 Closure (Agent F) — the ONE
  // narrowly-scoped escape from `recovery-required`, emitted ONLY by
  // `FedosProfileInitializationCoordinator#resetInterruptedProfile()`
  // after that method's own guard has already confirmed `"ready"` was
  // NEVER durably reached (see that method's own header, and the frozen
  // decision doc `docs/reviews/fedos-peer-device-discovery-current/10_P0_CLOSURE_COORDINATOR_FREEZE.md`
  // §2). A `"ready"` profile can never legally be in `recovery-required`
  // to begin with (only `"locked"` — see the `TRANSITIONS` table below),
  // so this event structurally can never touch one.
  | "reset-interrupted-profile" // recovery-required -> absent
  // FedOS Installed Startup Root-Cause Arc — the SIBLING escape from
  // `recovery-required`, emitted ONLY by
  // `FedosProfileInitializationCoordinator#resetCorruptReadyProfile()`
  // after that method's own guard has confirmed the OPPOSITE shape from
  // `"reset-interrupted-profile"` above: the descriptor DID durably reach
  // `"ready"`, but its sealed Master Seed envelope is verifiably,
  // structurally missing/corrupt (see that method's own header). Kept as
  // a distinct event (rather than reusing `"reset-interrupted-profile"`)
  // so the transition log itself records which of the two structurally
  // different guards actually authorized the reset.
  | "reset-corrupt-ready-profile"; // recovery-required -> absent

/** The explicit, exhaustive transition table. A `(state, event)` pair absent here is an ILLEGAL transition. */
const TRANSITIONS: ReadonlyMap<string, FedosProfileLifecycleState> = new Map([
  ["absent|begin-create", "initializing"],
  ["absent|profile-detected-locked", "locked"],
  ["absent|corruption-detected", "recovery-required"],

  ["initializing|initialization-succeeded", "ready"],
  ["initializing|initialization-failed", "failed"],
  ["initializing|runtime-start-failed", "failed"],
  ["initializing|corruption-detected", "recovery-required"],

  ["locked|begin-unlock", "unlocking"],
  ["locked|corruption-detected", "recovery-required"],

  ["unlocking|unlock-succeeded", "ready"],
  ["unlocking|unlock-failed", "locked"],
  ["unlocking|identity-mismatch", "recovery-required"],
  ["unlocking|runtime-start-failed", "failed"],
  ["unlocking|corruption-detected", "recovery-required"],

  ["ready|lock", "stopped"],

  ["stopped|relaunch", "locked"],
  ["stopped|begin-unlock", "unlocking"],

  ["failed|corruption-detected", "recovery-required"],

  // FedOS Peer Device Discovery Arc P0 Closure (Agent F) -- see
  // `FedosProfileLifecycleEvent`'s own doc comment on `"reset-interrupted-profile"`
  // above for why this is a legal exit from `recovery-required`.
  ["recovery-required|reset-interrupted-profile", "absent"],
  // FedOS Installed Startup Root-Cause Arc -- see
  // `FedosProfileLifecycleEvent`'s own doc comment on
  // `"reset-corrupt-ready-profile"` above for why this is the SIBLING
  // legal exit from `recovery-required`.
  ["recovery-required|reset-corrupt-ready-profile", "absent"],
] as const);

/** Returns the next state for a legal `(state, event)` pair, or `null` if the transition is illegal. Pure; total; never throws. */
export function fedosProfileLifecycleNextState(
  state: FedosProfileLifecycleState,
  event: FedosProfileLifecycleEvent,
): FedosProfileLifecycleState | null {
  return TRANSITIONS.get(`${state}|${event}`) ?? null;
}

/** True iff `event` is legal from `state`. */
export function canFedosProfileLifecycleTransition(
  state: FedosProfileLifecycleState,
  event: FedosProfileLifecycleEvent,
): boolean {
  return TRANSITIONS.has(`${state}|${event}`);
}

/** Applies `event` to `state`, returning the next state — or the UNCHANGED `state` for an illegal transition. Total; pure; never throws. */
export function applyFedosProfileLifecycleTransition(
  state: FedosProfileLifecycleState,
  event: FedosProfileLifecycleEvent,
): FedosProfileLifecycleState {
  return fedosProfileLifecycleNextState(state, event) ?? state;
}

/** True iff the state is a terminal, non-usable, requires-human-action state. */
export function isFedosProfileLifecycleTerminalBlocked(state: FedosProfileLifecycleState): boolean {
  return state === "failed" || state === "recovery-required";
}

/** True iff the state permits a running Runtime to exist. ONLY `ready` — every other state must have NO running Runtime (Phase C: no partial ready). */
export function fedosProfileLifecyclePermitsRuntime(state: FedosProfileLifecycleState): boolean {
  return state === "ready";
}
