# Secure Runtime Alpha 676 — Restart Verification

Stage 6. Verified against real append-only paths
(`test/secure_runtime_alpha_676_restart_verification.test.ts`): start
runtime, obtain `boardRuntime()`, create a local public thread, reply,
query, stop, start a genuinely fresh runtime over the SAME paths,
obtain a NEW `boardRuntime()`, verify hydration/query returns the SAME
posts, and confirm no shared singleton state — the two `FedosBoardRuntime`
instances are structurally distinct objects (`not.toBe`), exactly
mirroring Alpha 618/639's own established restart-verification shape,
now exercised through the Application Runtime layer.
