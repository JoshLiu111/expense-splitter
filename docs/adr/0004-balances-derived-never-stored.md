# Balances are derived, never stored

Balances and Suggested Settlements are always computed on read by the framework-free domain core from a Group's Expenses and Settlements; nothing balance-like is persisted. The same core runs on the server (signed-in Users, Postgres via Drizzle) and in the browser (Guests, sessionStorage), behind one repository interface. This guarantees Balances sum to zero and never drift from history, at the cost of recomputing per request, which is cheap at this scale (< 500ms target).
