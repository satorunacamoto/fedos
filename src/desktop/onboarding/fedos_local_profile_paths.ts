/**
 * Secure Runtime Alpha 4661-4740 — Phase G: the ONE durable path-planning
 * boundary for local application state.
 *
 * Today every durable concern is a hand-built absolute `*LogPath` string on
 * `FedosDesktopRuntimeConfig` (Phase A §8). This planner derives every
 * subpath DETERMINISTICALLY from a single profile root, so the coordinator
 * (`./fedos_profile_initialization_coordinator.ts`) supplies one coherent,
 * isolated set — instead of redesigning every persistence port.
 *
 * RULES (Phase G):
 *   - ONE profile root directory; deterministic subpaths beneath it.
 *   - No source-tree paths, no `cwd`-relative implicit paths — the caller
 *     supplies an explicit absolute root (mirrors `FedosDesktopRuntimeConfig`'s
 *     own "no default path" discipline, Alpha 604).
 *   - No path traversal: every derived leaf is a fixed, hardcoded relative
 *     segment joined to the root; no caller string is ever interpolated into
 *     a subpath, so `..`/absolute-escape is structurally impossible.
 *   - Independent profiles isolated: two different roots share no subpath.
 *   - Parent-directory creation is owned by the application ASSEMBLY
 *     (`ensureDirectories()`), never by a renderer and never implicitly.
 *   - No arbitrary renderer filesystem access — this module exposes only
 *     fixed, named paths, never an "open arbitrary path" method.
 *
 * PACKAGING NOTE (Windows / Japanese / OneDrive / short-path): the root is
 * whatever absolute path the caller supplies. On Windows this is typically
 * under `%APPDATA%` (an ASCII short path even when the user profile name is
 * Japanese). Callers whose only writable root is a long OneDrive-redirected
 * `%USERPROFILE%\OneDrive - <org>\...` path (as in this very worktree) are
 * supported — Node's `fs` handles long/UTF-8 paths — but a packaged build
 * SHOULD prefer `%APPDATA%\FedOS\profiles\<id>` to stay well under
 * `MAX_PATH`; this is documented, not enforced (Phase G: "short-path
 * packaging compatibility documented").
 */

// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join, isAbsolute } from "node:path";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdirSync } from "node:fs";

/** Every named durable leaf a profile owns. Non-secret path strings only. */
export interface FedosLocalProfilePaths {
  /** The one profile root directory (the caller-supplied absolute path). */
  readonly root: string;
  /** The non-secret profile descriptor file. */
  readonly profileDescriptorFile: string;
  /** The sealed (Argon2id + AEAD) Master Seed envelope file. Sealed bytes only — never plaintext. */
  readonly sealedMasterSeedFile: string;
  /** Board append-only log. */
  readonly boardLogFile: string;
  /** Outbox append-only log. */
  readonly outboxLogFile: string;
  /** Conversation append-only log. */
  readonly conversationLogFile: string;
  /** Conversation Message Envelope append-only log. */
  readonly conversationEnvelopeLogFile: string;
  /** Conversation Payload Storage append-only log. */
  readonly conversationPayloadLogFile: string;
  /** Conversation Membership append-only log. */
  readonly conversationMembershipLogFile: string;
  /** Device Registry append-only log. */
  readonly deviceRegistryLogFile: string;
  /** Device Binding challenge-replay append-only log. */
  readonly deviceBindingReplayLogFile: string;
  /** Durable Sync Journal append-only log. */
  readonly syncJournalLogFile: string;
  /** Device Sync schedule append-only log. */
  readonly syncScheduleLogFile: string;
  /** Device Sync conflict append-only log. */
  readonly syncConflictLogFile: string;
  /** Local application log directory (non-secret diagnostics only). */
  readonly logsDirectory: string;
  /** Navigation / session state directory. */
  readonly sessionStateDirectory: string;
}

/** The set of directories `ensureDirectories()` creates (recursively). Derived from the leaf paths above; no caller string is ever a directory component beyond the root itself. */
function directoriesFor(paths: FedosLocalProfilePaths): readonly string[] {
  return [paths.root, paths.logsDirectory, paths.sessionStateDirectory];
}

/**
 * Plans every durable subpath for one profile root. `root` MUST be an
 * absolute path (rejected with `null` otherwise — never a `cwd`-relative
 * path). Pure; creates no directory; never throws.
 */
export function planFedosLocalProfilePaths(root: string): FedosLocalProfilePaths | null {
  if (typeof root !== "string" || root.length === 0) return null;
  if (!isAbsolute(root)) return null;
  return Object.freeze({
    root,
    profileDescriptorFile: join(root, "profile.json"),
    sealedMasterSeedFile: join(root, "master-seed.sealed.json"),
    boardLogFile: join(root, "board.ndjson"),
    outboxLogFile: join(root, "outbox.ndjson"),
    conversationLogFile: join(root, "conversation.ndjson"),
    conversationEnvelopeLogFile: join(root, "conversation-envelope.ndjson"),
    conversationPayloadLogFile: join(root, "conversation-payload.ndjson"),
    conversationMembershipLogFile: join(root, "conversation-membership.ndjson"),
    deviceRegistryLogFile: join(root, "device-registry.ndjson"),
    deviceBindingReplayLogFile: join(root, "device-binding-replay.ndjson"),
    syncJournalLogFile: join(root, "sync-journal.ndjson"),
    syncScheduleLogFile: join(root, "sync-schedule.ndjson"),
    syncConflictLogFile: join(root, "sync-conflict.ndjson"),
    logsDirectory: join(root, "logs"),
    sessionStateDirectory: join(root, "session"),
  });
}

/**
 * Creates the profile's directories (root + logs + session). Owned by the
 * application assembly, never a renderer. Idempotent (recursive mkdir).
 * Returns `true` on success, `false` on any filesystem failure — never
 * throws.
 */
export function ensureFedosLocalProfileDirectories(paths: FedosLocalProfilePaths): boolean {
  try {
    for (const dir of directoriesFor(paths)) {
      mkdirSync(dir, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

/** True iff two path plans are fully isolated — no shared leaf file/directory. The Phase G "independent profiles isolated" guard. */
export function fedosLocalProfilePathsIsolated(a: FedosLocalProfilePaths, b: FedosLocalProfilePaths): boolean {
  if (a.root === b.root) return false;
  const aValues = new Set(Object.values(a));
  for (const value of Object.values(b)) {
    if (aValues.has(value)) return false;
  }
  return true;
}
