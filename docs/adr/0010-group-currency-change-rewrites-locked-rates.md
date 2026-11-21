# A Group Currency change rewrites every Locked Rate at one rate

Amends ADR 0008 and ADR 0009.

The Group Creator can change the Group Currency at any time, not only while nothing is recorded. One rate, units of the new Group Currency per one unit of the old (Today's Rate unless they type another), converts every Expense and Settlement: its Locked Rate becomes the old Locked Rate times that rate. An Expense or Settlement already in the new Group Currency gets exactly 1 instead, so its own amount is what counts. Nothing else about a record changes, and nothing balance-like is stored (ADR 0004): Balances follow from the new Locked Rates, with each Share still rounded on its own line (ADR 0001), so they scale by about the rate and still sum to zero. Per-line rounding can leave Small Change where there was none.

We multiply Locked Rates rather than store converted amounts, so each record keeps what was actually paid and one rule converts every foreign amount, as before. The product is exact, then rounded half up to the twelve decimals a typed rate may have, so an Expense with a manual rate can still be edited and saved; whether a rate was manual is kept, except at 1.

Settlements are still never edited, but their Locked Rate now changes with the Group Currency, which ADR 0009 said never happens. The Group Currency is no longer one of the Group's details that ADR 0008 lets the Group Creator alone change in Own Records Only: it is the Group Creator's alone in every Editing Mode, like the Editing Mode itself, because it changes every Balance at once.

The conversion is one pure function (`changeGroupCurrency`); Group settings previews the new Balances with it, and the repository applies it in one transaction that locks the Group, so a second change waits and then finds the Group Currency it was worked out from is gone, and converts nothing. The rate applied is the one previewed, never one fetched again when confirming.

Activity entries keep the records as they were recorded, so an entry from before a change holds Locked Rates into the old Group Currency. The change records its own entry (old and new Group Currency, and the rate), and those entries mark where each Group Currency began: the Activity view reads every entry in the Group Currency of its time, the old one of the next change after it, or the current one if none. No entry is rewritten. A change made before it recorded entries left no such mark, so entries before it are still read in the Group Currency that followed it.
