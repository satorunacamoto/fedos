/**
 * FedOS Commerce "Purchase Completion" mega-arc (Agent U) — pure, honest
 * connection/sync-state derivation for any bounded Commerce data view (My
 * Orders, Incoming Orders, ...).
 *
 * WHY THIS EXISTS: before this arc, Commerce had exactly one
 * connection/sync indicator anywhere in the app — `refreshRelayStatus()`
 * in `fedos_electron_beta_renderer.ts`, which is global (nav-bar-only,
 * describes the Relay socket, not any particular screen's data) and is
 * itself already careful never to claim a passive auto-retry that does not
 * exist ("no automatic reconnect... stays disconnected until lock/unlock").
 * No Commerce screen (My Orders, Incoming Orders) had ANY indicator that a
 * refresh actually happened, is happening, or failed — a fetch either
 * silently succeeded or silently produced stale/empty data with no visible
 * difference to the user. This closes that gap with one honest,
 * reusable, pure derivation, mirroring `activity_summary.ts`'s own
 * "pure and testable; the composition root only wires it in" discipline.
 *
 * HONESTY CONTRACT (the actual point of this module): this function must
 * NEVER report `"up-to-date"` unless a real fetch attempt genuinely
 * succeeded recently, and must NEVER silently swallow a failed attempt —
 * see this file's own tests for the exact truth table. `now` is always
 * caller-supplied (never `Date.now()` internally) so this stays pure and
 * deterministically testable.
 *
 * Deliberately transport-agnostic: this module has no idea whether the
 * underlying fetch was IPC, Nostr, or anything else — a caller supplies
 * only the four generic signals below. This is intentional: Agent P's real
 * payment transport and Agent D's real delivery/content transport (landing
 * in parallel this wave, not present in this worktree) can each report
 * into the SAME `CommerceSyncSnapshot` shape without this module changing
 * at all — see this file's own header for the integration seam.
 */

/** The five states a Commerce data view may honestly report — see this file's own header for why exactly these five (matches the mega-arc brief's own required vocabulary verbatim). */
export type CommerceSyncStatus = "offline" | "syncing" | "sync-failed" | "up-to-date" | "connected";

/**
 * The generic signals any Commerce data view can report, regardless of
 * transport. `isOffline` MUST come from a real signal (e.g. the renderer's
 * own `navigator.onLine`, or a real relay-connectivity probe) — this
 * module never fabricates one. `lastAttemptSucceeded` is `null` only when
 * no attempt has ever completed yet (e.g. the very first load, still
 * in-flight, or a session that has never triggered a refresh).
 */
export interface CommerceSyncSnapshot {
  readonly isOffline: boolean;
  readonly inFlight: boolean;
  /** ms epoch of the most recently COMPLETED attempt (success or failure); `null` iff `lastAttemptSucceeded` is `null`. */
  readonly lastAttemptAt: number | null;
  readonly lastAttemptSucceeded: boolean | null;
  /** Caller-supplied "current time" — see this file's header on why this is never `Date.now()` internally. */
  readonly now: number;
}

/**
 * A successful attempt is only allowed to claim `"up-to-date"` for this
 * long afterward — past this window an honest view degrades to
 * `"connected"` (we have real data and are not currently failing, but we
 * are no longer claiming it is FRESH). Deliberately generous but bounded:
 * this app has no push/poll for Commerce data (see `sendPrivateOrderSyncNonFatal()`'s
 * own module doc in `fedos_electron_beta_main.cts` — "no reconnect/backoff
 * policy of any kind" describes the broader Relay, and Commerce refreshes
 * today are explicit/on-navigation only, never a background poll), so a
 * claim of freshness must not outlive a plausible "the user is still
 * looking at this same screen" window.
 */
const FRESH_WINDOW_MS = 15_000;

/**
 * Pure derivation — see this file's header for the full honesty contract.
 * Priority order (each check short-circuits the ones below it):
 *   1. genuinely offline -> `"offline"`, regardless of anything else.
 *   2. a fetch is in flight right now -> `"syncing"`.
 *   3. the most recent COMPLETED attempt failed -> `"sync-failed"`.
 *   4. the most recent attempt succeeded AND is still within the fresh
 *      window -> `"up-to-date"`.
 *   5. otherwise (a stale success, or no attempt has ever completed yet,
 *      but we are online/idle/non-failing) -> `"connected"`.
 */
export function deriveCommerceSyncStatus(snapshot: CommerceSyncSnapshot): CommerceSyncStatus {
  if (snapshot.isOffline) return "offline";
  if (snapshot.inFlight) return "syncing";
  if (snapshot.lastAttemptSucceeded === false) return "sync-failed";
  if (snapshot.lastAttemptSucceeded === true && snapshot.lastAttemptAt !== null) {
    const age = snapshot.now - snapshot.lastAttemptAt;
    // A negative age (clock skew, or a caller passing a stale `now`) is
    // never trusted as "fresh" -- falls through to the honest "connected"
    // default rather than fabricating an up-to-date claim on bad input.
    if (age >= 0 && age <= FRESH_WINDOW_MS) return "up-to-date";
  }
  return "connected";
}

/** Short badge word + one non-jargon sentence for a `CommerceSyncStatus`. Never mentions "IPC", "relay", "poll", or any other implementation term — see the mega-arc brief's own requirement ("without exposing implementation jargon"). */
export interface CommerceSyncStatusText {
  readonly label: string;
  readonly detail: string;
}

const COMMERCE_SYNC_STATUS_TEXT: Readonly<Record<CommerceSyncStatus, CommerceSyncStatusText>> = {
  offline: {
    label: "Offline",
    detail: "You're offline. Showing the last known information.",
  },
  syncing: {
    label: "Checking…",
    detail: "Checking for updates…",
  },
  "sync-failed": {
    label: "Couldn't check",
    detail: "Couldn't check for updates just now. Showing the last known information — try Refresh.",
  },
  "up-to-date": {
    label: "Up to date",
    detail: "Up to date as of your last refresh.",
  },
  connected: {
    label: "Connected",
    detail: "Connected. Refresh to check for the latest.",
  },
};

export function describeCommerceSyncStatus(status: CommerceSyncStatus): CommerceSyncStatusText {
  return COMMERCE_SYNC_STATUS_TEXT[status];
}

/**
 * Mutable bookkeeping a caller can keep per data view (one per Commerce
 * screen — My Orders, Incoming Orders, ...) and update around each real
 * refresh attempt, then feed into `deriveCommerceSyncStatus()` via
 * `snapshotCommerceSyncTracker()`. Kept as a tiny, dependency-free class
 * (not a framework store) so it is usable from the plain-DOM renderer
 * without pulling in any UI framework, matching this package's own
 * "framework-agnostic" convention (see `order_view_models.ts`'s header).
 */
export class CommerceSyncTracker {
  private inFlight = false;
  private lastAttemptAt: number | null = null;
  private lastAttemptSucceeded: boolean | null = null;

  /** Call immediately before starting a real fetch. */
  begin(): void {
    this.inFlight = true;
  }

  /** Call immediately after a real fetch settles (success or failure) — `at` is the caller-supplied completion time. */
  complete(succeeded: boolean, at: number): void {
    this.inFlight = false;
    this.lastAttemptAt = at;
    this.lastAttemptSucceeded = succeeded;
  }

  snapshot(isOffline: boolean, now: number): CommerceSyncSnapshot {
    return {
      isOffline,
      inFlight: this.inFlight,
      lastAttemptAt: this.lastAttemptAt,
      lastAttemptSucceeded: this.lastAttemptSucceeded,
      now,
    };
  }
}
