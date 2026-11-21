# Settlements have their own Settlement Currency and Locked Rate

Amended by [ADR 0010](0010-group-currency-change-rewrites-locked-rates.md): a change of Group Currency converts every Settlement's Locked Rate too.

Supersedes ADR 0003.

A Settlement is recorded in any supported currency, its Settlement Currency (the Group Currency unless the Member picks another), with its own Locked Rate fixed exactly as an Expense's is: Today's Rate when it is recorded, or a rate the Member types (marked manual), and 1 in the Group Currency. Its amount is stored in the Settlement Currency's minor unit, beside the currency, the Locked Rate and whether it was manual. Everything that counts a Settlement (Balances, Debts, Suggested Settlements, Member Statement, My Calendar, the CSV export) converts it to the Group Currency once, with the same round-half-up integer conversion as an Expense's Shares (ADR 0001), and nothing stores the converted amount (ADR 0004). Settlements are never edited, so a Settlement's Locked Rate never changes. Validate Settlement compares the converted amount, so "you can't settle a debt that doesn't exist" still compares like with like; an amount that converts to nothing is refused.

We reversed ADR 0003 because a Member repaying in another currency (yen cash on a USD trip) had to convert it themselves and the record lost what was actually handed over. Giving a Settlement the same Locked Rate as an Expense means there is one rule for every foreign amount, rather than a second exchange rate to explain.

A conversion to whole minor units rarely lands exactly on a Suggested Settlement. Recording one in another Settlement Currency prefills the amount whose conversion is nearest the suggestion without going over what can be settled, computed with exact integer arithmetic; whatever under one unit of Group Currency it leaves is Small Change, which is always cleared in the Group Currency.

Existing Settlements were all in the Group Currency, so they were backfilled to it at a Locked Rate of 1. Activity entries recorded before keep the Settlement as they stored it and are read as the Group Currency at 1; Guest sessions stored before start over from the sample Groups. The seed data's Settlement `currency` and `exchangeRate` fields are now imported as they are. ADR 0003 said they were always the Group Currency and 1, but one is not: Trip to Japan's ¥8,500 at 0.0067 was converted to $56.95 on import. It is now a JPY Settlement with that Locked Rate, and the Group's Balances are unchanged.
