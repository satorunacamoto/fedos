/**
 * Secure Runtime Alpha 4821-4900 — Phase H/I/J: the REAL renderer-driven
 * self-test. It executes INSIDE the actual loaded renderer page (via
 * `webContents.executeJavaScript`), populating the real passphrase input and
 * clicking the real controls, so every command it triggers crosses the
 * genuine renderer -> preload (`window.fedosProfile`) -> `ipcRenderer.invoke`
 * -> `ipcMain.handle` -> production activation -> real WASM boundary. It does
 * NOT call any main-process coordinator function directly (Phase J:
 * "Calling main-process functions directly is insufficient").
 *
 * The injected secret is a stand-in for a human's keystrokes; the assertions
 * verify the app's OWN observable surfaces (renderer DOM/storage/console,
 * main stdout, on-disk profile) never leak it.
 *
 * Results are emitted as `FEDOS_UNLOCK_TEST:{json}` marker lines the
 * acceptance suite parses; the profile root is emitted as
 * `FEDOS_UNLOCK_DATA_DIR:<path>` for its on-disk leak scan.
 */

interface SelftestOptions {
  readonly mode: "create" | "unlock";
  readonly secret: string;
  readonly dataDir: string;
  readonly log: (line: string) => void;
}

/** The narrow slice of Electron's WebContents this self-test uses. */
interface WebContentsLike {
  executeJavaScript(code: string): Promise<unknown>;
}

function marker(log: (line: string) => void, step: string, result: unknown): void {
  log(`FEDOS_UNLOCK_TEST:${JSON.stringify({ step, result })}`);
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function currentScreen(wc: WebContentsLike): Promise<string> {
  return (await wc.executeJavaScript(`document.getElementById("current-screen").textContent`)) as string;
}

/** Polls the visible screen until it is one of `names`, or times out. */
async function waitForScreen(wc: WebContentsLike, names: readonly string[], timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() < deadline) {
    last = await currentScreen(wc);
    if (names.includes(last)) return last;
    await sleep(120);
  }
  return `timeout(last=${last})`;
}

/** Serialises the secret into a JS string literal so it can be typed into the live input from the main process. */
function jsString(value: string): string {
  return JSON.stringify(value);
}

async function setInput(wc: WebContentsLike, id: string, value: string): Promise<void> {
  await wc.executeJavaScript(`(() => { const el = document.getElementById(${jsString(id)}); el.value = ${jsString(value)}; return true; })()`);
}
async function click(wc: WebContentsLike, id: string): Promise<void> {
  await wc.executeJavaScript(`(() => { document.getElementById(${jsString(id)}).click(); return true; })()`);
}

/** Reads a text field from the ready screen. */
async function readText(wc: WebContentsLike, id: string): Promise<string> {
  return (await wc.executeJavaScript(`document.getElementById(${jsString(id)}).textContent`)) as string;
}

/** True iff the secret appears anywhere in the serialised DOM or web storage. */
async function secretVisibleInRenderer(wc: WebContentsLike, secret: string): Promise<boolean> {
  return (await wc.executeJavaScript(
    `(() => {
       const s = ${jsString(secret)};
       const inHtml = document.documentElement.outerHTML.includes(s);
       let inStorage = false;
       try {
         for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if ((k && k.includes(s)) || (localStorage.getItem(k) || "").includes(s)) inStorage = true; }
         for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if ((k && k.includes(s)) || (sessionStorage.getItem(k) || "").includes(s)) inStorage = true; }
       } catch (e) { /* storage disabled */ }
       const inUrl = (location.href + location.hash).includes(s);
       return inHtml || inStorage || inUrl;
     })()`,
  )) as boolean;
}

async function runCreate(wc: WebContentsLike, opts: SelftestOptions): Promise<void> {
  const { secret, log } = opts;
  const first = await waitForScreen(wc, ["welcome", "unlock", "recovery"], 15000);
  marker(log, "first-screen", first);
  if (first === "welcome") {
    await click(wc, "welcome-create-btn");
  }
  await waitForScreen(wc, ["create"], 5000);

  // Type into the REAL inputs and click the REAL button -> renderer -> preload -> main -> real WASM.
  await setInput(wc, "create-label", "Acceptance Profile");
  await setInput(wc, "create-pass", secret);
  await setInput(wc, "create-pass-confirm", secret);
  await click(wc, "create-submit");

  const reached = await waitForScreen(wc, ["ready", "create", "recovery"], 30000);
  const account = await readText(wc, "ready-account");
  const device = await readText(wc, "ready-device");
  const trust = await readText(wc, "ready-trust");
  const secretLeak = await secretVisibleInRenderer(wc, secret);
  // After submit, the live inputs must be cleared.
  const passStillPresent = (await wc.executeJavaScript(`document.getElementById("create-pass").value.length`)) as number;
  marker(log, "create", { reached, account, device, trust, secretVisibleInRenderer: secretLeak, passFieldLength: passStillPresent });
}

async function runUnlock(wc: WebContentsLike, opts: SelftestOptions): Promise<void> {
  const { secret, log } = opts;
  const first = await waitForScreen(wc, ["unlock", "welcome", "recovery"], 15000);
  marker(log, "first-screen", first);

  // 1) WRONG secret stays locked, no Runtime.
  await setInput(wc, "unlock-pass", `wrong-${secret}`);
  await click(wc, "unlock-submit");
  const afterWrong = await waitForScreen(wc, ["unlock-failed", "ready", "recovery"], 30000);
  const statusAfterWrong = (await wc.executeJavaScript(`window.fedosProfile.status().then(s => JSON.stringify(s))`)) as string;
  marker(log, "wrong-secret", { screen: afterWrong, status: JSON.parse(statusAfterWrong) });

  // 2) Correct secret -> ready, real WASM restore.
  await click(wc, "retry-btn");
  await waitForScreen(wc, ["unlock"], 5000);
  await setInput(wc, "unlock-pass", secret);
  await click(wc, "unlock-submit");
  const afterCorrect = await waitForScreen(wc, ["ready", "unlock-failed"], 30000);
  const account = await readText(wc, "ready-account");
  const device = await readText(wc, "ready-device");
  marker(log, "correct-secret", { screen: afterCorrect, account, device });

  // 3) Lock -> Runtime stops, back to a locked screen.
  await click(wc, "lock-btn");
  const afterLock = await waitForScreen(wc, ["unlock", "welcome"], 15000);
  const statusAfterLock = (await wc.executeJavaScript(`window.fedosProfile.status().then(s => JSON.stringify(s))`)) as string;
  marker(log, "lock", { screen: afterLock, status: JSON.parse(statusAfterLock) });

  // 4) Unlock again -> ready.
  await setInput(wc, "unlock-pass", secret);
  await click(wc, "unlock-submit");
  const afterReunlock = await waitForScreen(wc, ["ready", "unlock-failed"], 30000);
  const account2 = await readText(wc, "ready-account");
  const secretLeak = await secretVisibleInRenderer(wc, secret);
  marker(log, "re-unlock", { screen: afterReunlock, account: account2, secretVisibleInRenderer: secretLeak });
}

export async function runFedosUnlockRendererSelftest(wc: WebContentsLike, opts: SelftestOptions): Promise<void> {
  opts.log(`FEDOS_UNLOCK_DATA_DIR:${opts.dataDir}`);
  if (opts.mode === "create") {
    await runCreate(wc, opts);
  } else {
    await runUnlock(wc, opts);
  }
  opts.log("FEDOS_UNLOCK_TEST:done");
}
