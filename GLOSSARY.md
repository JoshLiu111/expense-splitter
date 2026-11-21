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
A Member tied to a User, so that User can see and edit the Group. Shown under their User's current name, whatever name they were added by, and with their User's avatar image if they have one, so a change to either shows in every Group at once (Former Members who were Linked included). Name-only and Pending Members have no avatar image and show coloured initials.

**Name-only Member**:
A Member with no User behind it; still splits costs and carries a Balance.
_Avoid_: Guest member, placeholder

**Pending Member**:
A Member added by an email that no User has yet (or a Name-only Member given one); a signed-in User adding them sends them an Invitation. It becomes a Linked Member when a User verifies that email, by following the Invitation or the sign-up verification email. A Guest's Pending Members are sent nothing.
_Avoid_: Invitee, invited user

**Invitation**:
A one-time link emailed to a Pending Member that lets its holder sign up (or sign in) as that email, which counts as verifying it, and claim every Pending Member with that email (ADR 0007). It names the Group and who sent it, and works for 7 days; only a Pending Member's latest Invitation works, and it stops working once used or once the Pending Member is removed or claimed. A Member can resend it (in Own Records Only, only the Group Creator), which sends a new Invitation and stops the older link working; Group settings show whether a Pending Member's latest Invitation was sent, and adding a Member or giving one an email says at once if their Invitation wasn't. A link that no longer works explains why, except that a used one takes the User who used it back into the Group.
_Avoid_: Invite code, share link

**Former Member**:
A Member removed from a Group at zero Balance; no longer selectable for new Expenses but still shown on past ones. If an edit to a past Expense or Settlement later gives them a non-zero Balance, they are shown in Balances, labelled as a Former Member, and that Balance can be settled like any other; while it is non-zero, a Former Member who was a Linked Member can see the Group again, read-only (ADR 0006).
_Avoid_: Deleted member, ex-member

**Group Creator**:
The User who created the Group; the only one allowed to delete it or change its Group Currency or Editing Mode. In Own Records Only, also the only one who may edit or delete every Expense and Settlement, and who manages the Group: adds, removes, invites or resends to Members, gives a Member an email, renames or describes the Group, and adds, renames or deletes Custom Categories. A Guest is the Group Creator of every session Group. Otherwise all Linked Members have equal editing rights.
_Avoid_: Owner, admin

**Editing Mode**:
Who may edit or delete a Group's Expenses and Settlements, and manage the Group: Open (any Member, the default) or Own Records Only (a record only by its Recorder or the Group Creator; one with no Recorder, and the Group's details, Members and Custom Categories, only by the Group Creator). Adding Expenses and Settlements is never restricted. Every Member can see it; only the Group Creator can change it (ADR 0008).
_Avoid_: Permissions, lock, edit policy

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

**Recorder**:
The Member who recorded an Expense or Settlement. It never changes: whoever edits an Expense later, its Recorder stays the same. Some records have no Recorder: the Guest's, and older ones whose adding left no Activity entry to say who recorded them.
_Avoid_: Author, creator, owner (and do not confuse with the Payer, who paid)

**Category**:
A label on an Expense: one of the nine predefined Categories shared by all Groups, or a Custom Category.

**Custom Category**:
A Category created within one Group and visible only there. Any Member adds, renames or deletes one, except in Own Records Only, where only the Group Creator does.
_Avoid_: Tag, label

**Leftover Cent**:
The indivisible remainder when a Split cannot divide an amount evenly; it goes to the Member with the largest fractional remainder, ties broken by Member order in the Group.
_Avoid_: Rounding error, penny

### Money and currency

**Group Currency**:
The single currency in which a Group's Balances and Settlements are measured. Only the Group Creator can change it, at any time, after seeing the new Balances: one rate (Today's Rate unless they type another) converts every Expense and Settlement by multiplying its Locked Rate, so every Balance scales by that rate, except that one in the new Group Currency gets a Locked Rate of exactly 1 (ADR 0010).
_Avoid_: Base currency, home currency, default currency

**Expense Currency**:
The currency an Expense was actually paid in, which may differ from the Group Currency.
_Avoid_: Original currency, foreign currency

**Settlement Currency**:
The currency a Settlement was actually paid in: the Group Currency unless the Member recording it chose another. A Settlement in another Settlement Currency counts at its Locked Rate wherever it is counted, and shows both amounts (e.g. "¥4,478 ≈ $30.00").
_Avoid_: Payment currency, original currency

**Locked Rate**:
The exchange rate from an Expense Currency or Settlement Currency to the Group Currency, fixed on an Expense or Settlement when it is recorded (or overridden by a Member), so past Balances never change; 1 in the Group Currency. Only a change of Group Currency changes it, converting it with every other at one rate (ADR 0010).
_Avoid_: Current rate, live rate

**Today's Rate**:
The exchange rate a new Locked Rate is taken from: ExchangeRate-API's rate, cached once a day, or the last cached rate (flagged "rates may be outdated") when the service can't be reached.
_Avoid_: Current rate, live rate, market rate

### Balances and settling

**Balance**:
A Member's net position in a Group: total paid minus total owed, in Group Currency. Positive means others owe them. A Group's Balances always sum to zero. A Balance is one net figure per Member; a Debt is one amount between two Members, and a Member's Balance is what their Debts net to.
_Avoid_: Debt, total

**Member Statement**:
The itemised account of one Member's Balance (including a Former Member's): for each Expense, what they paid and their Share, and each Settlement they made or received, all in Group Currency at each Expense's and Settlement's Locked Rate and totalling exactly their Balance.
_Avoid_: Balance breakdown

**My Calendar**:
One month of what moved for one Member (including a Former Member), by day: the Expenses they paid for as Payer (the full amount, not their Share), the Settlements they received and the Settlements they made, with the month's three totals. Taken from their Member Statement, so in Group Currency at each Expense's and Settlement's Locked Rate. It never shows their Shares or other Members.
_Avoid_: Activity calendar, spending calendar

**Debt**:
The net amount one Member owes another from the Expenses they shared (and any Settlements between them), before Debt Simplification. A Group's Debts and its Suggested Settlements leave every Member with the same Balance.
_Avoid_: IOU, payment

**Settled Up**:
The state where every Member's Balance is exactly zero. A single Member whose own Balance is exactly zero is also Settled Up ("You're settled up"), even while the Group is not.
_Avoid_: Closed, paid off

**Settlement**:
A recorded payment from a Member with a negative Balance to a Member with a positive Balance, in a Settlement Currency at its own Locked Rate (ADR 0009). It counts as its amount in Group Currency, which must be at least one minor unit and no more than the one owes or the other is owed. "payment" in its everyday sense is fine (as in "Why these payments?"); just never use it as the name of a Settlement.
_Avoid_: Payment, repayment, transfer

**Small Change**:
A non-zero Balance under one unit of Group Currency (e.g. under $1) that is left once every Suggested Settlement is recorded. The payments under one unit that would clear it are never suggested, but can all be recorded in one action as real Settlements in the Group Currency. Converting a Settlement in another Settlement Currency to whole minor units can leave some. A payment under one unit is still suggested when it involves a Member whose Balance is one unit or more and who has no suggestion of one unit or more, so such a Balance never ends up as Small Change.
_Avoid_: Dust, rounding leftover

**Suggested Settlement**:
A Settlement the app proposes, in Group Currency, so that, once all are recorded, every Member is Settled Up. Recording one in another Settlement Currency starts from the amount nearest it at Today's Rate that converts to no more than can be settled.
_Avoid_: Recommendation, IOU

**Debt Simplification**:
Reducing the Suggested Settlements to as few payments as possible, using only Balances rather than who shared which Expense.
_Avoid_: Netting, optimisation

**Activity**:
The record of each change to a Group's Expenses, Settlements and Members (adding, editing or deleting an Expense; adding or deleting a Settlement; adding a Member, sending one an Invitation or a new one, giving one an email, or removing one; a Pending Member joining when claimed): who made it (a Linked Member, still named if later a Former Member, or the Guest; a joining is the joiner's own), when, and for edits the values before and after. An entry about a Member names them as they were named then. A change that is refused or changes nothing, or an Invitation whose email wasn't sent, records nothing; nor, yet, does a change of Group Currency, though it changes every Locked Rate. No one can edit or remove an entry, and it holds no Balances or Suggested Settlements.
_Avoid_: History, change log, audit log, feed

### Access

**Guest**:
A visitor exploring the sample Groups without an account; their changes last only for the browser session and are never carried into a User.
_Avoid_: Demo user, anonymous user

**Account Settings**:
The page where a signed-in User changes what belongs to them as a User, such as their display name, avatar image or password. These changes belong to the User, not to any Group, so they are never recorded in any Group's Activity. A Guest has no Account Settings.
_Avoid_: Profile, preferences, user settings
