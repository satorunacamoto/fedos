# Secure Runtime Alpha 778 — Bearer Secret Boundary

`FedosConversationCapabilityBearerSecret` (`src/conversation/capability/fedos_conversation_capability_bearer_secret.ts`) — a structurally separate opaque branded type, never a field on `FedosConversationCapabilityDescriptor`, never stored in a Conversation/Board record.

Per this Arc's own instruction ("if a secure secret handle cannot be introduced without crypto/Rust scope, use an injected verifier boundary and keep real generation out of scope. Do not invent cryptography"): `FedosConversationCapabilitySecretGenerator` is an INJECTED interface — this Arc mints no real cryptographically-random secret material itself, mirroring `FedosBoardRuntimeIdGenerator`'s own injected-generator convention (Alpha 626). No new dependency, no Rust/Cargo change.

`fedosConversationCapabilityBearerSecretsMatch()` — a constant-time-SHAPED string comparison (always scans the full length of the longer operand, no early-exit on the first mismatched character). Explicitly NOT a cryptographic primitive — plain JS, no import — satisfying "equality only through safe verifier where possible" without inventing or importing cryptography.

No `console.log`/`JSON.stringify` of a bearer secret anywhere in this Arc's own source or tests — verified by `test/secure_runtime_alpha_786_in_memory_capability_authority.test.ts` #12 (`inspectDescriptor()` never leaks it) and `test/secure_runtime_alpha_788_security_structural_guards.test.ts` #3 (the descriptor interface's own field set never names `secret`/`bearer`).
