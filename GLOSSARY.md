# Expense Splitter

A shared ledger where a group of people record who paid for what, how each cost is divided, and how they settle up.

## Language

### Groups and people

**Group**:
A set of Members sharing one ledger of Expenses and Settlements, with a single Group Currency.
_Avoid_: Ledger, pool, trip

**Member**:
A person taking part in a Group's Splits and Balances. A Member is either Linked to a registered User or Name-only.
_Avoid_: Participant, friend, person

**User**:
A registered account holder who can sign in. One User may be the Linked identity of Members in many Groups.
_Avoid_: Account, customer

**Linked Member**:
A Member tied to a User, so that User can see and edit the Group.

**Name-only Member**:
A Member with no User behind it; still splits costs and carries a Balance.
_Avoid_: Guest member, placeholder

**Pending Member**:
A Member added by an email that no User has yet; it becomes a Linked Member when a User verifies that email.
_Avoid_: Invitee, invited user

**Former Member**:
A Member removed from a Group at zero Balance; no longer selectable for new Expenses but still shown on past ones. If an edit to a past Expense or Settlement later gives them a non-zero Balance, they are shown in Balances, labelled as a Former Member, and that Balance can be settled like any other.
_Avoid_: Deleted member, ex-member

**Group Creator**:
The User who created the Group; the only one allowed to delete it. All other Linked Members have equal editing rights.
_Avoid_: Owner, admin

### Expenses and splits

**Expense**:
A single cost paid by exactly one Payer, recorded in an Expense Currency and divided among Members by a Split.
_Avoid_: Bill, transaction, charge

**Payer**:
The one Member who paid an Expense.
_Avoid_: Owner, creditor

**Split**:
How an Expense's amount is divided into Shares among Members, according to a Split Type.
_Avoid_: Breakdown, allocation

**Split Type**:
The rule a Split uses: Equal, Exact, Percentage, or Shares (ratio).

**Share**:
The amount one Member owes for one Expense, as determined by its Split.
_Avoid_: Portion, part (and do not confuse with the "Shares" Split Type, which is a ratio)

**Category**:
A label on an Expense: one of the nine predefined Categories shared by all Groups, or a Custom Category.

**Custom Category**:
A Category created within one Group and visible only there.
_Avoid_: Tag, label

**Leftover Cent**:
The indivisible remainder when a Split cannot divide an amount evenly; it goes to the Member with the largest fractional remainder, ties broken by Member order in the Group.
_Avoid_: Rounding error, penny

### Money and currency

**Group Currency**:
The single currency in which a Group's Balances and Settlements are measured; fixed once the Group has any Expense or Settlement.
_Avoid_: Base currency, home currency, default currency

**Expense Currency**:
The currency an Expense was actually paid in, which may differ from the Group Currency.
_Avoid_: Original currency, foreign currency

**Locked Rate**:
The exchange rate from Expense Currency to Group Currency fixed on an Expense when it is recorded (or overridden by a Member), so past Balances never change.
_Avoid_: Current rate, live rate

**Today's Rate**:
The exchange rate a new Locked Rate is taken from: ExchangeRate-API's rate, cached once a day, or the last cached rate (flagged "rates may be outdated") when the service can't be reached.
_Avoid_: Current rate, live rate, market rate

### Balances and settling

**Balance**:
A Member's net position in a Group: total paid minus total owed, in Group Currency. Positive means others owe them. A Group's Balances always sum to zero. A Balance is one net figure per Member; a Debt is one amount between two Members, and a Member's Balance is what their Debts net to.
_Avoid_: Debt, total

**Member Statement**:
The itemised account of one Member's Balance (including a Former Member's): for each Expense, what they paid and their Share, and each Settlement they made or received, all in Group Currency at each Expense's Locked Rate and totalling exactly their Balance.
_Avoid_: Balance breakdown

**Debt**:
The net amount one Member owes another from the Expenses they shared (and any Settlements between them), before Debt Simplification. A Group's Debts and its Suggested Settlements leave every Member with the same Balance.
_Avoid_: IOU, payment

**Settled Up**:
The state where every Member's Balance is exactly zero. A single Member whose own Balance is exactly zero is also Settled Up ("You're settled up"), even while the Group is not.
_Avoid_: Closed, paid off

**Settlement**:
A recorded payment, always in Group Currency, from a Member with a negative Balance to a Member with a positive Balance. "payment" in its everyday sense is fine (as in "Why these payments?"); just never use it as the name of a Settlement.
_Avoid_: Payment, repayment, transfer

**Small Change**:
A non-zero Balance under one unit of Group Currency (e.g. under $1) that is left once every Suggested Settlement is recorded. The payments under one unit that would clear it are never suggested, but can all be recorded in one action as real Settlements. A payment under one unit is still suggested when it involves a Member whose Balance is one unit or more and who has no suggestion of one unit or more, so such a Balance never ends up as Small Change.
_Avoid_: Dust, rounding leftover

**Suggested Settlement**:
A Settlement the app proposes so that, once all are recorded, every Member is Settled Up.
_Avoid_: Recommendation, IOU

**Debt Simplification**:
Reducing the Suggested Settlements to as few payments as possible, using only Balances rather than who shared which Expense.
_Avoid_: Netting, optimisation

**Activity**:
The record of each change to a Group's Expenses and Settlements (adding, editing or deleting an Expense; adding or deleting a Settlement): who made it (a Linked Member, still named if later a Former Member, or the Guest), when, and for edits the values before and after. No one can edit or remove an entry, and it holds no Balances or Suggested Settlements.
_Avoid_: History, change log, audit log, feed

### Access

**Guest**:
A visitor exploring the sample Groups without an account; their changes last only for the browser session and are never carried into a User.
_Avoid_: Demo user, anonymous user
