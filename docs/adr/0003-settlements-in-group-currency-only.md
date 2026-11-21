# Settlements are recorded only in the Group Currency

Superseded by [ADR 0009](0009-settlement-currency-with-its-own-locked-rate.md): Settlements now have their own Settlement Currency and Locked Rate.

Unlike Expenses, a Settlement can only be entered in the Group Currency; a Member who repays in another currency (e.g. yen cash on a USD trip) converts it themselves before recording. The seed data's Settlement `currency`/`exchangeRate` fields are kept for import compatibility but are always the Group Currency and 1. We chose this so the "can't settle a debt that doesn't exist" rule and Suggested Settlement amounts compare like with like, with no second exchange rate to explain.
