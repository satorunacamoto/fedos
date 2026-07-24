/**
 * Secure Runtime Alpha 4901-4980 — Phase F: the CLOSED settings command
 * vocabulary. Exactly FIVE commands, no more:
 *   settings-load / settings-save / settings-reset / settings-export /
 *   settings-import.
 *
 * Mirrors `validateFedosDesktopHostCommand`
 * (`../host_boundary/fedos_desktop_host_command.ts`) exactly in discipline —
 * a closed `type` union, STRUCTURAL validation only (right type, present,
 * within bound), fail-closed to `null` for anything not genuinely
 * in-vocabulary, never throws. It never re-derives the settings DOMAIN
 * decision (the `FedosSettingsAuthority`/validator already own that); it
 * only ensures a malformed/oversized/wrong-shaped object can never reach
 * that layer at all.
 *
 * This is a SEPARATE, additive command set — it does NOT modify the
 * conversation Host Bridge's own frozen command union (Alpha 3561-3640 /
 * 4581-4660). Settings are independent of the running conversation Runtime,
 * so they get their own narrow bridge (`./fedos_desktop_settings_host_bridge.ts`).
 */

/** Bound for the serialized settings JSON passed to `settings-import` — generous for a full descriptor, a hard ceiling against an unbounded string reaching `JSON.parse`. */
export const FEDOS_DESKTOP_SETTINGS_MAX_IMPORT_LENGTH = 64 * 1024;

export type FedosDesktopSettingsHostCommand =
  | { readonly type: "settings-load"; readonly requestId?: string }
  | { readonly type: "settings-save"; readonly descriptor: unknown; readonly requestId?: string }
  | { readonly type: "settings-reset"; readonly requestId?: string }
  | { readonly type: "settings-export"; readonly requestId?: string }
  | { readonly type: "settings-import"; readonly serialized: string; readonly requestId?: string };

const MAX_REQUEST_ID_LENGTH = 512;

function optionalRequestId(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_REQUEST_ID_LENGTH ? value : undefined;
}

/**
 * Fails closed to `null` for anything not a genuinely well-formed,
 * in-vocabulary settings command. Never throws. The `descriptor` on
 * `settings-save` is passed through as `unknown` — its full validation is
 * the authority/validator's job, not this structural layer's (this layer
 * only confirms the field is PRESENT as an object).
 */
export function validateFedosDesktopSettingsHostCommand(candidate: unknown): FedosDesktopSettingsHostCommand | null {
  if (candidate === null || typeof candidate !== "object") return null;
  const c = candidate as Record<string, unknown>;
  const requestId = optionalRequestId(c.requestId);

  switch (c.type) {
    case "settings-load":
    case "settings-reset":
    case "settings-export":
      return requestId === undefined ? { type: c.type } : { type: c.type, requestId };

    case "settings-save": {
      if (c.descriptor === null || typeof c.descriptor !== "object") return null;
      const descriptor = c.descriptor;
      return requestId === undefined ? { type: "settings-save", descriptor } : { type: "settings-save", descriptor, requestId };
    }

    case "settings-import": {
      if (typeof c.serialized !== "string" || c.serialized.length === 0 || c.serialized.length > FEDOS_DESKTOP_SETTINGS_MAX_IMPORT_LENGTH) {
        return null;
      }
      const serialized = c.serialized;
      return requestId === undefined ? { type: "settings-import", serialized } : { type: "settings-import", serialized, requestId };
    }

    default:
      return null;
  }
}
