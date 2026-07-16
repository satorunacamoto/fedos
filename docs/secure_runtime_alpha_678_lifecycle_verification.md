# Secure Runtime Alpha 678 — Lifecycle Verification

Stage 8. `boardRuntime()` behavior, verified
(`test/secure_runtime_alpha_678_lifecycle_verification.test.ts`):

- Available immediately once `startFedosDesktopRuntime()` resolves —
  never "not yet ready" (the handle only exists after a successful
  start).
- Returns the SAME instance across repeated calls while running.
- Inaccessible (throws) after `stop()`.
- Never outlives Host — a `boardRuntime()` handle obtained BEFORE
  `stop()` degrades its own OPERATIONS to `{ outcome: "unavailable" }`
  once the underlying Host is no longer `"ready"`, never throwing from
  inside a command method.
- Operations after stop fail closed — confirmed for both
  `createPublicThread()` and `replyToPublicThread()`.
- No restart of the same runtime handle — a second `stop()` call
  throws, mirroring `FedosDesktopHost.stop()`'s own established
  non-idempotent contract.
