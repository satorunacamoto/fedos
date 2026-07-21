/**
 * Secure Runtime Alpha 4981-5060 — Phase M: the CLOSED settings-APPLICATION
 * command vocabulary. Exactly FOUR commands, no more:
 *   settings-application-plan / settings-apply / settings-effective-state /
 *   settings-reload-effective-state.
 *
 * This is a SEPARATE, additive command set from Alpha 4901-4980's own frozen
 * five-command settings vocabulary (`./fedos_desktop_settings_host_command.ts`,
 * load/save/reset/export/import) — the persistence commands stay exactly as
 * they were; these are the LIVE-application commands. It mirrors that file's
 * discipline exactly: a closed `type` union, STRUCTURAL validation only,
 * fail-closed to `null` for anything not genuinely in-vocabulary, never
 * throws. It exposes NO generic `set(key,value)`, NO arbitrary action
 * execution, NO Runtime-restart command (a restart is coordinated one layer
 * up, only with explicit confirmation), and NO filesystem path.
 */

/** Bound for the descriptor object passed with plan/apply — structural presence only; full validation is the authority's job. */
const MAX_REQUEST_ID_LENGTH = 512;

export type FedosDesktopSettingsApplicationHostCommand =
  | { readonly type: "settings-application-plan"; readonly descriptor: unknown; readonly requestId?: string }
  | { readonly type: "settings-apply"; readonly descriptor: unknown; readonly requestId?: string }
  | { readonly type: "settings-effective-state"; readonly requestId?: string }
  | { readonly type: "settings-reload-effective-state"; readonly requestId?: string };

function optionalRequestId(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_REQUEST_ID_LENGTH ? value : undefined;
}

/**
 * Fails closed to `null` for anything not a genuinely well-formed,
 * in-vocabulary application command. Never throws. The `descriptor` is passed
 * through as `unknown` — its full validation is the authority/validator's job
 * (this layer only confirms the field is PRESENT as an object).
 */
export function validateFedosDesktopSettingsApplicationHostCommand(
  candidate: unknown,
): FedosDesktopSettingsApplicationHostCommand | null {
  if (candidate === null || typeof candidate !== "object") return null;
  const c = candidate as Record<string, unknown>;
  const requestId = optionalRequestId(c.requestId);

  switch (c.type) {
    case "settings-effective-state":
    case "settings-reload-effective-state":
      return requestId === undefined ? { type: c.type } : { type: c.type, requestId };

    case "settings-application-plan":
    case "settings-apply": {
      if (c.descriptor === null || typeof c.descriptor !== "object") return null;
      const descriptor = c.descriptor;
      return requestId === undefined ? { type: c.type, descriptor } : { type: c.type, descriptor, requestId };
    }

    default:
      return null;
  }
}
