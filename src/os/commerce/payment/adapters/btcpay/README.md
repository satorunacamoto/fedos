# BTCPay payment adapter (reserved)

Reserved location for a **future** BTCPay Server adapter implementing the
existing `PaymentProvider` contract (`src/os/commerce/payment/types.ts`). No
BTCPay adapter, SDK dependency, or server integration exists in this
repository today — this directory is empty except for this file.

The two implementations that exist today, `NoopPaymentProvider` and
`PlaceholderPaymentProvider` (`src/os/commerce/payment/noop_payment.ts`),
charge nothing and contact no rail; a BTCPay adapter built here would be the
first `PaymentProvider` implementation to actually reach an external payment
system.

## Rule

When a real adapter is built here, BTCPay-specific types/packages/wire
formats must stay contained to this directory. `src/os/commerce/payment/`
domain code must never import a BTCPay-specific type or package directly —
it may only depend on the rail-neutral `PaymentProvider` contract this
adapter will implement.

## Status

Inert scaffolding / reserved location only. No BTCPay code exists anywhere
in this repository.
