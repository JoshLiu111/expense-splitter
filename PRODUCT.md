# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, weighted equally:

- **People sharing costs.** Friends travelling together, roommates, colleagues splitting a lunch, a group chipping in for a present or a camping trip. They record who paid for what, often in more than one currency, and come back when it is time to settle up. Their job: trust that every Balance is right, and settle with as few payments as possible.
- **Evaluators.** Frontend Mentor reviewers and hiring readers who open the live site or `/guest` and want to judge the work's quality within minutes.

The evaluator should see the quality as fast as possible, but never at the cost of the real user's experience: nothing is added for show that a person sharing costs would have to work around.

## Product Purpose

Expense Splitter records who paid for what in a Group, splits each Expense equally, by exact amounts, percentages or shares, and shows every Member a Balance they can trust. Settling up proposes the fewest Suggested Settlements and explains how they were derived. Success means a Group can go from first Expense to Settled Up without anyone doubting the numbers.

## Positioning

More meticulous and more professional than consumer expense splitters. The mechanism behind that claim: amounts are integer minor units, every Leftover Cent is assigned, Balances always sum to zero, foreign-currency Expenses keep the Locked Rate they were recorded at, each Suggested Settlement in Settle up traces back to the Expenses behind it, and "Why these payments?" shows the Group's debts turning into the Suggested Settlements.

## Operating Context

- Built as the Frontend Mentor "Expense Splitter" challenge; the README documents design decisions, process and a self-assessment for reviewers.
- Visitors can try everything at `/guest` with five sample Groups (travel, roommates, office lunch, a birthday present, a camping trip). Guest changes last for the browser session; a dismissible prompt invites Guests to sign up and says Guest data won't carry over.
- Signed-in Users have real accounts (email verification, password reset) and share Groups with other Users by email.
- Used on desktop and phone; light and dark themes follow the system preference with a remembered manual toggle.

## Capabilities and Constraints

- Domain language is fixed in `GLOSSARY.md` (Group, Member, Expense, Payer, Split, Split Type, Share, Leftover Cent, Group Currency, Expense Currency, Locked Rate, Balance, Settlement, Suggested Settlement, Debt Simplification, Guest, and others). UI copy uses these terms and avoids the listed alternatives.
- Decisions recorded in `docs/adr/`: integer minor units with per-line rounding; Next.js full-stack monolith; Settlements with their own Settlement Currency and Locked Rate; Balances derived, never stored; Better Auth in our own Postgres.
- Split Types: Equal, Exact, Percentage, Shares. Nine predefined Categories plus Custom Categories per Group.
- Multi-currency via ExchangeRate-API, called only from the server and cached daily.
- Insights: spending by Category, by Member and over time; Expense list filters.
- Performance targets (landing page, Lighthouse mobile): Performance > 85, Accessibility > 90, Best Practices > 90.
- Undecided: the README's three design write-ups (expense entry, group dashboard, settlement flow) await the prototype phase.

## Brand Commitments

- Name: "Expense Splitter", provisional; may change later.
- Voice: professional. Precise, plain statements; no jokes or hype.

## Evidence on Hand

- Live site: https://expense-splitter-fawn.vercel.app and the `/guest` sample Groups (seed data in `data/`).
- Screenshots in `docs/screenshots/`.
- Test suites: Vitest domain and repository tests (250+), Playwright end-to-end journeys on desktop and phone.
- No testimonials, user counts or press exist; do not invent them.

## Product Principles

1. **The numbers are always right, and visibly so.** Every amount shown adds up exactly; where a result could surprise, the product shows its working.
2. **Quality is evident in the first minutes, without staging.** The fastest route to judging the product is using it; nothing exists only to impress an evaluator.
3. **Professional precision over playfulness.** Detail and correctness carry the identity, in copy and in behaviour.
4. **One language everywhere.** Glossary terms are used consistently in UI, code and docs.

## Accessibility & Inclusion

- WCAG AA conformance is required.
- Balances never rely on colour alone: each has a sign, an icon, a label ("owes", "gets back") and a full sentence for screen readers.
- Chart colours meet 3:1 contrast in both themes; full keyboard operation; currency amounts announced correctly.
