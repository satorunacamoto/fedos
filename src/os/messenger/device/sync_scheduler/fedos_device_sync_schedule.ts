/**
 * Secure Runtime Alpha 3721–3800 ("Background Device Sync Scheduling and
 * Conflict Resolution") — the Schedule state machine (Phase F).
 *
 * Pure, synchronous, side-effect-free state-transition functions — mirrors
 * `../transfer/fedos_device_transfer_session.ts`'s own "closed transition
 * table, no I/O, no key material" discipline exactly, one layer up: one
 * Schedule represents ONE durable intent to sync a Journal range
 * (`fromSequence`..`toSequence`, both INCLUSIVE) from `sourceDeviceId` to
 * `targetDeviceId`.
 *
 * No plaintext Sync record of any kind is ever carried by a Schedule
 * record — `fromSequence`/`toSequence` are opaque Journal sequence
 * numbers, `contentHash`/change content never appear here.
 *
 * Closed transition table:
 *
 *   pending      -> { in-progress, operator-required }
 *   in-progress  -> { pending (retry later), completed, failed, operator-required }
 *   completed    -> {}  (terminal)
 *   failed       -> {}  (terminal)
 *   operator-required -> {}  (terminal until an explicit, narrow operator command re-schedules a NEW Schedule -- never a mutation of this one)
 */

export type FedosDeviceSyncScheduleState = "pending" | "in-progress" | "completed" | "failed" | "operator-required";

const TRANSITION_TABLE: Readonly<Record<FedosDeviceSyncScheduleState, readonly FedosDeviceSyncScheduleState[]>> = Object.freeze({
  pending: ["in-progress", "operator-required"],
  "in-progress": ["pending", "completed", "failed", "operator-required"],
  completed: [],
  failed: [],
  "operator-required": [],
});

export function isFedosDeviceSyncScheduleTransitionAllowed(from: FedosDeviceSyncScheduleState, to: FedosDeviceSyncScheduleState): boolean {
  return TRANSITION_TABLE[from].includes(to);
}

export function isFedosDeviceSyncScheduleTerminal(schedule: FedosDeviceSyncScheduleV1): boolean {
  return TRANSITION_TABLE[schedule.state].length === 0;
}

export interface FedosDeviceSyncScheduleV1 {
  readonly schemaVersion: 1;
  readonly scheduleId: string;
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly fromSequence: number;
  readonly toSequence: number;
  readonly transferSessionId: string | null;
  readonly state: FedosDeviceSyncScheduleState;
  readonly attemptCount: number;
  readonly nextEligibleAt: number;
  readonly lastCoarseOutcome: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface FedosDeviceSyncScheduleCreateInput {
  readonly scheduleId: string;
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly fromSequence: number;
  readonly toSequence: number;
  readonly createdAt: number;
}

export function createPendingFedosDeviceSyncSchedule(input: FedosDeviceSyncScheduleCreateInput): FedosDeviceSyncScheduleV1 {
  return Object.freeze({
    schemaVersion: 1,
    scheduleId: input.scheduleId,
    sourceDeviceId: input.sourceDeviceId,
    targetDeviceId: input.targetDeviceId,
    fromSequence: input.fromSequence,
    toSequence: input.toSequence,
    transferSessionId: null,
    state: "pending",
    attemptCount: 0,
    nextEligibleAt: input.createdAt,
    lastCoarseOutcome: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

function transition(
  schedule: FedosDeviceSyncScheduleV1,
  to: FedosDeviceSyncScheduleState,
  at: number,
  patch: Partial<Pick<FedosDeviceSyncScheduleV1, "transferSessionId" | "attemptCount" | "nextEligibleAt" | "lastCoarseOutcome">> = {},
): FedosDeviceSyncScheduleV1 | null {
  if (!isFedosDeviceSyncScheduleTransitionAllowed(schedule.state, to)) return null;
  return Object.freeze({ ...schedule, state: to, updatedAt: at, ...patch });
}

export function startFedosDeviceSyncScheduleAttempt(schedule: FedosDeviceSyncScheduleV1, transferSessionId: string, at: number): FedosDeviceSyncScheduleV1 | null {
  return transition(schedule, "in-progress", at, { transferSessionId, attemptCount: schedule.attemptCount + 1 });
}

export function retryLaterFedosDeviceSyncSchedule(schedule: FedosDeviceSyncScheduleV1, nextEligibleAt: number, coarseOutcome: string, at: number): FedosDeviceSyncScheduleV1 | null {
  return transition(schedule, "pending", at, { nextEligibleAt, lastCoarseOutcome: coarseOutcome });
}

export function completeFedosDeviceSyncSchedule(schedule: FedosDeviceSyncScheduleV1, coarseOutcome: string, at: number): FedosDeviceSyncScheduleV1 | null {
  return transition(schedule, "completed", at, { lastCoarseOutcome: coarseOutcome });
}

export function failFedosDeviceSyncSchedule(schedule: FedosDeviceSyncScheduleV1, coarseOutcome: string, at: number): FedosDeviceSyncScheduleV1 | null {
  return transition(schedule, "failed", at, { lastCoarseOutcome: coarseOutcome });
}

export function requireOperatorForFedosDeviceSyncSchedule(schedule: FedosDeviceSyncScheduleV1, coarseOutcome: string, at: number): FedosDeviceSyncScheduleV1 | null {
  return transition(schedule, "operator-required", at, { lastCoarseOutcome: coarseOutcome });
}
