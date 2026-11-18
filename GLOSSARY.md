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
A Member removed from a Group at zero Balance; no longer selectable for new Expenses but still shown on past ones.
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
A Member's net position in a Group: total paid minus total owed, in Group Currency. Positive means others owe them. A Group's Balances always sum to zero.
_Avoid_: Debt, total

**Settled Up**:
The state where every Member's Balance is exactly zero.
_Avoid_: Closed, paid off

**Settlement**:
A recorded payment, always in Group Currency, from a Member with a negative Balance to a Member with a positive Balance.
_Avoid_: Payment, repayment, transfer

**Small Change**:
A non-zero Balance under one unit of Group Currency (e.g. under $1); never suggested, but can be cleared in one action that records a real Settlement.
_Avoid_: Dust, rounding leftover

**Suggested Settlement**:
A Settlement the app proposes so that, once all are recorded, every Member is Settled Up.
_Avoid_: Recommendation, IOU

**Debt Simplification**:
Reducing the Suggested Settlements to as few payments as possible, using only Balances rather than who shared which Expense.
_Avoid_: Netting, optimisation

### Access

**Guest**:
A visitor exploring the sample Groups without an account; their changes last only for the browser session and are never carried into a User.
_Avoid_: Demo user, anonymous user
