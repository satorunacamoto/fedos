/**
 * Secure Runtime Alpha 5061-5160 — the Beta renderer page script. Runs
 * inside the loaded page's isolated Chromium context (NOT the preload/Node
 * context) — no `import` of any kind, reads ONLY `window.fedosProfile` /
 * `window.fedosBeta` (the frozen bridges the preload placed there), writes
 * DOM. Mirrors `fedos_electron_unlock_renderer.ts`'s own onboarding flow
 * exactly, extended with the Phase H/I Beta status + limitations render
 * once the profile reaches `ready`.
 *
 * SECRET DISCIPLINE: identical to `fedos_electron_unlock_renderer.ts` — see
 * that file's own header. Never duplicated here beyond restating the rule.
 */

(() => {
type ScreenName =
  | "loading"
  | "welcome"
  | "create"
  | "unlock"
  | "initializing"
  | "unlock-failed"
  | "recovery"
  | "ready";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`fedos-beta renderer: missing element #${id}`);
  return el as T;
}

function showScreen(name: ScreenName): void {
  for (const section of Array.from(document.querySelectorAll("section"))) {
    section.classList.remove("active");
  }
  byId(`screen-${name}`).classList.add("active");
  byId("current-screen").textContent = name;
}

function clearField(id: string): void {
  byId<HTMLInputElement>(id).value = "";
}

function setBusy(busy: boolean, ...buttonIds: string[]): void {
  for (const id of buttonIds) {
    byId<HTMLButtonElement>(id).disabled = busy;
  }
}

async function renderBetaStatus(): Promise<void> {
  const status = await window.fedosBeta.status();

  const capabilitiesList = byId("capabilities-list");
  capabilitiesList.textContent = "";
  const capabilities = (status.capabilities as { capabilities?: readonly { capabilityId: string; status: string; userVisibleLabel: string }[] } | null)?.capabilities ?? [];
  for (const c of capabilities) {
    const li = document.createElement("li");
    const badge = document.createElement("span");
    badge.className = `status-badge status-${c.status}`;
    badge.textContent = c.status;
    li.appendChild(document.createTextNode(`${c.userVisibleLabel} `));
    li.appendChild(badge);
    capabilitiesList.appendChild(li);
  }

  const limitationsList = byId("limitations-list");
  limitationsList.textContent = "";
  const limitations = (status.limitations as { limitations?: readonly { statement: string; surfaces: readonly string[] }[] } | null)?.limitations ?? [];
  for (const l of limitations) {
    if (!l.surfaces.includes("beta-status")) continue;
    const li = document.createElement("li");
    li.textContent = l.statement;
    limitationsList.appendChild(li);
  }

  const release = status.release as { productName?: string; version?: string; stability?: string } | null;
  byId("release-info").textContent = release !== null
    ? `${release.productName ?? "FedOS Desktop"} ${release.version ?? ""} (${release.stability ?? "beta"})`
    : "";
}

function renderReady(ready: FedosProfileCommandResult["ready"]): void {
  if (ready === undefined) return;
  byId("ready-label").textContent = ready.displayLabel;
  byId("ready-account").textContent = ready.accountPublicIdentifier;
  byId("ready-device").textContent = ready.localDeviceId;
  byId("ready-trust").textContent = ready.deviceTrustState;
  showScreen("ready");
  void renderBetaStatus();
}

function routeByStatus(status: FedosProfileStatusResult): void {
  if (status.presence === "ready") {
    byId("ready-label").textContent = status.displayLabel ?? "";
    byId("ready-account").textContent = status.accountPublicIdentifier ?? "";
    byId("ready-device").textContent = status.localDeviceId ?? "";
    showScreen("ready");
    void renderBetaStatus();
    return;
  }
  if (status.presence === "absent") {
    showScreen("welcome");
    return;
  }
  if (status.presence === "recovery-required") {
    showScreen("recovery");
    return;
  }
  byId("unlock-label").textContent = status.displayLabel ?? "(existing profile)";
  showScreen("unlock");
}

async function refreshFromStatus(): Promise<void> {
  const status = await window.fedosProfile.status();
  routeByStatus(status);
}

async function onCreateSubmit(): Promise<void> {
  const label = byId<HTMLInputElement>("create-label").value.trim();
  const pass = byId<HTMLInputElement>("create-pass").value;
  const confirm = byId<HTMLInputElement>("create-pass-confirm").value;
  byId("create-error").textContent = "";

  if (label.length === 0) {
    byId("create-error").textContent = "Enter a profile label.";
    return;
  }
  if (pass.length === 0) {
    byId("create-error").textContent = "Enter a passphrase.";
    return;
  }
  if (pass !== confirm) {
    byId("create-error").textContent = "Passphrases do not match.";
    clearField("create-pass");
    clearField("create-pass-confirm");
    return;
  }

  setBusy(true, "create-submit");
  showScreen("initializing");
  let result: FedosProfileCommandResult;
  try {
    result = await window.fedosProfile.create(label, pass);
  } finally {
    clearField("create-pass");
    clearField("create-pass-confirm");
    setBusy(false, "create-submit");
  }

  if (result.outcome === "ok") {
    byId<HTMLInputElement>("create-label").value = "";
    renderReady(result.ready);
  } else {
    showScreen("create");
    byId("create-error").textContent = coarseError(result);
  }
}

async function onUnlockSubmit(): Promise<void> {
  const pass = byId<HTMLInputElement>("unlock-pass").value;
  byId("unlock-error").textContent = "";
  if (pass.length === 0) {
    byId("unlock-error").textContent = "Enter your passphrase.";
    return;
  }

  setBusy(true, "unlock-submit");
  showScreen("initializing");
  let result: FedosProfileCommandResult;
  try {
    result = await window.fedosProfile.unlock(pass);
  } finally {
    clearField("unlock-pass");
    setBusy(false, "unlock-submit");
  }

  if (result.outcome === "ok") {
    renderReady(result.ready);
  } else if (result.outcome === "recovery-required") {
    byId("recovery-reason").textContent = coarseError(result);
    showScreen("recovery");
  } else {
    byId("unlock-failed-reason").textContent = "The profile remains locked.";
    showScreen("unlock-failed");
  }
}

function coarseError(result: FedosProfileCommandResult): string {
  switch (result.outcome) {
    case "already-exists":
      return "A profile already exists on this device.";
    case "weak-secret":
      return "Passphrase is too short. Use at least 8 characters.";
    case "invalid-input":
      return "Please check the label and passphrase.";
    case "recovery-required":
      return "This profile requires recovery.";
    default:
      return "Could not complete. Please try again.";
  }
}

async function onLock(): Promise<void> {
  setBusy(true, "lock-btn");
  try {
    await window.fedosProfile.lock();
  } finally {
    setBusy(false, "lock-btn");
  }
  await refreshFromStatus();
}

byId<HTMLButtonElement>("welcome-create-btn").addEventListener("click", () => {
  showScreen("create");
});
byId<HTMLButtonElement>("create-submit").addEventListener("click", () => {
  void onCreateSubmit();
});
byId<HTMLButtonElement>("unlock-submit").addEventListener("click", () => {
  void onUnlockSubmit();
});
byId<HTMLButtonElement>("retry-btn").addEventListener("click", () => {
  clearField("unlock-pass");
  showScreen("unlock");
});
byId<HTMLButtonElement>("lock-btn").addEventListener("click", () => {
  void onLock();
});
byId<HTMLButtonElement>("quit-btn").addEventListener("click", () => {
  void window.fedosProfile.quit();
});
byId<HTMLButtonElement>("quit-btn-recovery").addEventListener("click", () => {
  void window.fedosProfile.quit();
});

void refreshFromStatus();
})();
