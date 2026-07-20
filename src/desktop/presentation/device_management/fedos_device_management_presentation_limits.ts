/**
 * Secure Runtime Alpha 3941–4020 — Phase L: presentation limits.
 *
 * No existing domain/resource limit governs "how many items to show on
 * one screen" — `FEDOS_DEVICE_SYNC_DEFAULT_RESOURCE_LIMITS`
 * (`../../../device/sync_scheduler/fedos_device_sync_resource_limits.ts`,
 * Alpha 3721-3800) governs SCHEDULING/RETENTION concerns (target devices
 * per sync cycle, retained history), not UI list size, so this file does
 * NOT repurpose those numbers as if they were the same thing. It DOES
 * reuse the one existing, genuinely applicable constant:
 * `FEDOS_DESKTOP_HOST_MAX_ID_LENGTH`
 * (`../../host_boundary/fedos_desktop_host_command.ts`, Alpha 3561-3640)
 * for label/text truncation, since that constant already governs the
 * exact same "how long can an id/label string be" concern one layer down.
 *
 * Every list screen model this Arc produces reports `totalCount`,
 * `renderedCount`, and `truncated` honestly (Phase L's own "expose
 * truncation/pagination metadata honestly, never claim unlimited") —
 * never a bare array with no size context.
 */

import { FEDOS_DESKTOP_HOST_MAX_ID_LENGTH } from "../../host_boundary/fedos_desktop_host_command.js";

/** Reused verbatim — the existing, already-tested bound for any id/label-shaped string. */
export const FEDOS_DEVICE_MANAGEMENT_MAX_LABEL_LENGTH = FEDOS_DESKTOP_HOST_MAX_ID_LENGTH;

/** A short diagnostic/reason line (e.g. a coarse Shell `reason` string) is truncated more aggressively than a full id/label — long enough for a real, human-readable sentence, short enough that a render model can never carry an unbounded log dump. */
export const FEDOS_DEVICE_MANAGEMENT_MAX_DIAGNOSTIC_LENGTH = 240;

/** NEW presentation-only limits (Phase L) — this Arc's own, since no existing UI-list-size constant exists anywhere in this codebase yet. Deliberately generous (real accounts in this codebase's own tests never approach these counts) while still being a REAL, enforced, honestly-reported cap rather than an unlimited list. */
export const FEDOS_DEVICE_MANAGEMENT_MAX_DEVICES_RENDERED = 200;
export const FEDOS_DEVICE_MANAGEMENT_MAX_SCHEDULES_RENDERED = 200;
export const FEDOS_DEVICE_MANAGEMENT_MAX_TRANSFERS_RENDERED = 200;
export const FEDOS_DEVICE_MANAGEMENT_MAX_CONFLICTS_RENDERED = 200;

export interface FedosDeviceManagementTruncatedList<T> {
  readonly items: readonly T[];
  readonly totalCount: number;
  readonly renderedCount: number;
  readonly truncated: boolean;
}

/** The ONE place every list screen model in this Arc applies its own cap — never a bare `.slice()` repeated ad hoc across files. */
export function fedosDeviceManagementTruncateList<T>(items: readonly T[], maxItems: number): FedosDeviceManagementTruncatedList<T> {
  const totalCount = items.length;
  const truncated = totalCount > maxItems;
  const rendered = truncated ? items.slice(0, maxItems) : items;
  return Object.freeze({ items: rendered, totalCount, renderedCount: rendered.length, truncated });
}

/** Truncates a label/diagnostic string to `maxLength`, never throwing, never expanding a short string. `null` passes through as `null`. */
export function fedosDeviceManagementTruncateText(value: string | null, maxLength: number): string | null {
  if (value === null) return null;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}
