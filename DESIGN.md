---
name: Expense Splitter
description: A shared ledger whose every figure adds up, shown with professional restraint.
colors:
  accent: "#2a62d6"
  accent-hover: "#2156c9"
  accent-subtle: "#e7eefc"
  on-accent: "#ffffff"
  owe: "#b81f2f"
  owe-subtle: "#fce7ea"
  owed: "#08704b"
  owed-subtle: "#dcf1e9"
  success: "#0a7e55"
  warning: "#8a5a00"
  error: "#d32637"
  bg-primary: "#f6f8fb"
  bg-secondary: "#edf1f6"
  bg-tertiary: "#e3e9f1"
  surface: "#ffffff"
  border: "#dbe1ea"
  border-subtle: "#e7ecf3"
  border-input: "#7d8799"
  text-primary: "#131a26"
  text-secondary: "#566073"
  text-tertiary: "#646e7c"
  accent-dark: "#5b8def"
  accent-hover-dark: "#7fa6f5"
  accent-subtle-dark: "#15203a"
  on-accent-dark: "#0a0d13"
  owe-dark: "#fb7185"
  owe-subtle-dark: "#2a171c"
  owed-dark: "#36d29a"
  owed-subtle-dark: "#102a22"
  success-dark: "#36d29a"
  warning-dark: "#e3b341"
  error-dark: "#f2606a"
  bg-primary-dark: "#0a0d13"
  bg-secondary-dark: "#0c0f16"
  bg-tertiary-dark: "#151a24"
  surface-dark: "#10141c"
  border-dark: "#212935"
  border-subtle-dark: "#1a202b"
  border-input-dark: "#5a6478"
  text-primary-dark: "#e7ebf2"
  text-secondary-dark: "#8b94a6"
  text-tertiary-dark: "#788294"
typography:
  display:
    fontFamily: "Manrope, system-ui, -apple-system, sans-serif"
    fontSize: "2.4375rem"
    fontWeight: 800
    lineHeight: 1.2
  headline:
    fontFamily: "Manrope, system-ui, -apple-system, sans-serif"
    fontSize: "1.9375rem"
    fontWeight: 800
    lineHeight: 1.25
  title:
    fontFamily: "Manrope, system-ui, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Manrope, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Manrope, system-ui, -apple-system, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.45
  caption:
    fontFamily: "Manrope, system-ui, -apple-system, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.45
  amount:
    fontFamily: "IBM Plex Mono, ui-monospace, SF Mono, monospace"
    fontSize: "1rem"
    fontWeight: 600
    fontFeature: "tnum"
rounded:
  sm: "4px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  "16": "64px"
  "20": "80px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "44px"
  button-outline-hover:
    backgroundColor: "{colors.accent-subtle}"
  button-quiet:
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
    height: "44px"
  button-quiet-hover:
    backgroundColor: "{colors.accent-subtle}"
  button-ghost:
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.bg-tertiary}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 16px 4px 4px"
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.accent-subtle}"
  tab:
    textColor: "{colors.text-secondary}"
    typography: "{typography.body}"
    height: "44px"
  tab-selected:
    textColor: "{colors.text-primary}"
  filter-chip:
    backgroundColor: "{colors.accent-subtle}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 12px 4px 16px"
    height: "44px"
  hero-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "20px"
  hero-panel-wide:
    padding: "28px"
  ledger-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  ledger-row:
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 8px"
    height: "64px"
  ledger-row-hover:
    backgroundColor: "{colors.bg-tertiary}"
  group-row:
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    padding: "16px"
  group-row-wide:
    padding: "16px 20px"
  group-row-hover:
    backgroundColor: "{colors.bg-tertiary}"
  balance-owes:
    backgroundColor: "{colors.owe-subtle}"
    textColor: "{colors.owe}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
  balance-owed:
    backgroundColor: "{colors.owed-subtle}"
    textColor: "{colors.owed}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
  balance-settled:
    backgroundColor: "{colors.bg-tertiary}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
  dialog:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "24px"
    width: "448px"
---

# Design System: Expense Splitter

## Overview

**Creative North Star: "The Reconciled Ledger"**

Every screen reads like a ledger that has just been reconciled: quiet, cool, exact, and finished. The interface is a precision instrument for money, so its identity lives in correctness made visible rather than in decoration. A single cobalt accent marks what can be acted on; a red and green pair, always doubled by sign, icon and words, marks who owes whom; everything else is cool blue-grey paper and hairline rules.

Density is moderate and calm. Content sits in one narrow reading column (672px) so a Group reads top to bottom like a reconciled statement: the payments that close it, then the Balances, then the ledger. Type is a confident grotesque (Manrope) set heavy for headings and plain for prose, while every monetary figure switches to a tabular monospace (IBM Plex Mono) so columns of amounts align to the digit. Surfaces are flat, separated by borders and tonal steps; shadows appear only on things that float.

Light and dark themes are equal citizens: tokens swap, layouts do not. Dark is a cool graphite, not inverted grey. Motion is brief and functional, with one sanctioned moment of celebration when a Group is Settled Up and one deliberate piece of narrative motion when Simplify explains Debt Simplification.

**Key Characteristics:**
- One cool-blue accent on cool blue-grey neutrals; no secondary brand colour.
- Money in IBM Plex Mono with tabular numerals, never truncated.
- Owing and being owed are never told apart by colour alone.
- Flat surfaces with hairline borders (the hero panels are the exception: white on paper, borderless in light theme); elevation reserved for floating layers.
- Every interactive target is at least 44×44px.
- Every text pairing meets WCAG AA in both themes.

## Colors

A cool, low-chroma ledger palette with one cobalt accent and a semantic red/green pair reserved for money owed.

### Primary
- **Ledger Cobalt** (`accent`; `accent-dark` in dark theme): every button role (the primary fill, the secondary outline's text, quiet text buttons), links, focus rings, selected chips, the active accent border on the inline expense editor and the landing page eyebrow. It is the only hue that means "act here".
- **Cobalt Pressed** (`accent-hover`): hover state of primary buttons. In dark theme it lightens instead of darkening.
- **Cobalt Wash** (`accent-subtle`): background of selected chips and the landing eyebrow pill; the hover fill of outline and quiet buttons.
- **On Cobalt** (`on-accent`): text on cobalt. White in light theme; near-black in dark theme because white on the lighter dark-theme cobalt fails AA.

### Secondary
- **Debt Red** (`owe`) with **Debt Blush** (`owe-subtle`): a Member who owes. Text on its blush passes 4.5:1.
- **Credit Green** (`owed`) with **Credit Mint** (`owed-subtle`): a Member who gets back.

### Tertiary
- **Confirmation Green** (`success`): success announcements, the Settled Up Moment's check badge and the Groups list's Settled Up check.
- **Ochre Caution** (`warning`): warnings; darkened in light theme to reach 4.85:1.
- **Alarm Red** (`error`): field errors, the error summary border and destructive actions.

### Neutral
- **Statement Paper** (`bg-primary`): the page background.
- **Header Slate** (`bg-secondary`): the site header band and inset notes such as the live split preview.
- **Hover Slate** (`bg-tertiary`): hover background for ghost buttons; the neutral "settled up" Balance pill.
- **Sheet White** (`surface`): panels (including the Settle up and Balances hero panels), list containers (including the Groups list), dialogs, inputs and chips.
- **Hairline** (`border`) and **Faint Hairline** (`border-subtle`): decorative rules and list dividers. About 1.3:1; never the only boundary of a control. The hero panels' edge (`border-panel`) is transparent in light theme and Faint Hairline in dark.
- **Control Edge** (`border-input`): the boundary of inputs, chips and dashed empty states, at least 3:1 against surfaces.
- **Ink** (`text-primary`), **Graphite** (`text-secondary`), **Pewter** (`text-tertiary`): body text, supporting text, and the least important metadata.

Chart series use seven additional tokens (`--color-chart-1` to `--color-chart-7`, see the sidecar), each at least 3:1 against the surface in both themes.

### Named Rules
**The One Accent Rule.** Cobalt is the only brand hue. If something is not interactive or selected, it is not cobalt.

**The Never Colour Alone Rule.** Owe and owed always carry a sign, an arrow icon, a word ("owes", "gets back") and a screen-reader sentence. A Balance stripped of its colour must still be unambiguous.

**The Red and Green Are Money Rule.** `owe` and `owed` describe Balances and nothing else. Errors use `error`; confirmations use `success`.

## Typography

**Display Font:** Manrope (with system-ui, -apple-system, sans-serif)
**Body Font:** Manrope (with system-ui, -apple-system, sans-serif)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace, SF Mono, monospace), for money only

**Character:** A geometric-leaning grotesque set at extrabold for headings gives the product a firm, confident voice; the monospace for figures says "this number was computed, not typed". The pairing is a ledger: words in a sans, sums in columns.

The scale is a compact major third (13, 16, 20, 25, 31, 39px), with an 11px caption below it.

### Hierarchy
- **Display** (800, 39px, 1.2): the landing page hero heading, and the Group name on the Group page (with tight tracking).
- **Headline** (800, 31px, 1.25): one per page; the page name. In the Settle up panel, also the Settled Up Moment's "Everyone is Settled Up" and "No Expenses yet".
- **Title** (700, 20px, 1.4): section headings such as Group settings' sections; the Settle up and Balances panel headings at 800.
- **Body** (400, 16px, 1.55): prose, Member names, Expense descriptions.
- **Label** (600, 13px, 1.45): buttons, field labels, legends, chips, metadata lines; the workhorse size.
- **Caption** (400, 11px, 1.45): secondary conversions under an amount, avatar initials.
- **Amount** (IBM Plex Mono, 600, tabular numerals, no wrapping): every monetary figure, at whatever size its context sets (16px in Balances, 25px in the amount field, 25px on phones and 39px from 640px for the signed-in User's own payment in Settle up, the page's largest figure; 25px keeps a long figure such as ¥12,345,678 inside a 390px screen beside the avatars).

### Named Rules
**The Figures in Mono Rule.** Every monetary amount uses the `amount` utility: IBM Plex Mono, tabular numerals, `white-space: nowrap`. Never truncate or ellipsize a figure.

**The Two Weights of Voice Rule.** Headings are 700 or 800; labels are 600; prose is 400. Weight 500 is reserved and almost never used.

## Layout

The page is a centred column inside an 80rem frame with 16px side padding. Reading content (a Group, the dashboard, forms) narrows further to a 42rem content column so lists read like a statement. The landing hero uses a two-column grid (1.1fr / 1fr) from 1024px; feature lists step from one to two (640px) to four columns (1024px). Insights charts sit in a two-column grid from 768px.

The Group page opens on its settle-up hero, two white panels inside the content column: **Settle up** (what closes the Group) and then **Balances** (why). The hero does not widen the column. Everything after it sits on the page background: the Expenses | Insights tabs, showing the dated ledger of Expenses and Settlements by default and Insights on the second tab.

Spacing is a 4px base scale. Inside components, 8–16px dominates (chip gaps 8px, list row padding 12px × 16px, panel padding 24px, hero panel padding 20px on phones and 28px from 640px); between sections, 32px. Forms stack fields with 20px gaps.

At 768px (`48rem`) the expense editor switches from a bottom sheet to an inline panel, and the "Add expense" action moves from a full-width bar fixed to the bottom of the screen to a floating button at the bottom-right. Below that width, pages reserve 96px of bottom padding so the fixed bar never covers content.

### Named Rules
**The 44 Pixel Floor Rule.** Every button, chip, link-button and toggle is at least 44×44px, on every breakpoint.

## Elevation & Depth

The system is flat at rest. Depth comes from tonal steps (paper background, white sheet, slate header) and hairline borders, not shadows. Shadows exist only for layers that float above the page: dialogs, the mobile sheet, the floating Add Expense button (a full-width pill inset 12px from a phone's edges, with no bar behind it; a default-size button at the bottom right from 768px) and the skip link use the large shadow; the open inline expense editor uses the medium one. Dark theme keeps the same roles with heavier black shadows.

### Shadow Vocabulary
- **Rest** (`--shadow-sm`, `0 1px 2px rgba(15, 23, 42, 0.05)`): available for a subtle lift; rarely used.
- **Raised** (`--shadow-md`, `0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`): the inline expense editor while open.
- **Floating** (`--shadow-lg`, `0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)`): dialogs, sheets, the floating action button.

### Named Rules
**The Only What Floats Rule.** A shadow means "this sits above the page". Lists, panels and cards in the flow have a border and no shadow; the Group page's hero panels drop the border in light theme (see The White Panel Rule).

## Shapes

Corners are gently rounded and consistent by role: inputs and Balance pills at 8px; every button, panels, list containers, dialogs and empty states at 10px; the hero panels and the mobile sheet's top edge at 14px. Fully round shapes are reserved for things that are tokens of identity or selection: Member avatars, selectable chips, Member pills, the landing eyebrow, progress bars and the sheet's drag handle.

Borders are 1px. Empty states use a dashed 1px `border-input` outline to read as "a place to fill", distinct from solid panels.

## Components

### Buttons
Firm, compact and unadorned. Cobalt marks every action; how much of it a button carries says how important the action is.
- **Shape:** one 10px radius for every button, minimum 44px tall; icon buttons are 44×44px.
- **Primary** (`default`): cobalt fill, on-accent text, 13px semibold label, 8px × 16px padding (20px sides in the hero panels). The one main action in a block: Add Expense, Record this payment, Add the first Expense, Save.
- **Secondary** (`outline`): sheet white with a control-edge border and cobalt text; hover fills with cobalt wash. An action beside or below the primary one: Record a payment, Clear Small Change, Cancel.
- **Quiet** (`quiet`): cobalt text, usually with a leading icon, no fill or border; hover fills with cobalt wash. Lesser actions inside a block: "Why these payments?", a suggestion's Record, Show / Hide Balances, the row actions in Group settings (a Member's Add email / Change email and Remove, a Pending Member's Resend Invitation, a Category's Rename and Delete), and the Expense editor's "View changes" (a history icon, beside the editor's heading; on phones before the Close). "View changes" shows only when editing an existing Expense, and closes the editor as it opens Activity at that Expense's entries. When it sits at a panel's edge it pulls its 12px padding back with a negative margin so the text, not the hit area, lines up.
- **Invitation status:** under a Pending Member's email in Group settings, a 13px line reads "Invitation sent" in graphite followed by a quiet Resend Invitation, or, when the latest Invitation wasn't sent, "Invitation not sent —" in semibold error red followed by a quiet Resend; both buttons are announced as "Resend Invitation to <name>" and pull back their 12px padding so the text lines up. Adding a Member or saving an email whose Invitation wasn't sent says so at once in the settings status line, in ochre caution ("Added Dev. Their Invitation wasn't sent; use Resend to try again.").
- **Ghost** (`ghost`): neutral text, hover fills with hover slate. Chrome only: the header (user menu, theme toggle) and icon-only buttons such as Close and the Group page's Activity icon (a history clock) and Group settings cog, side by side in that order (graphite, ink on hover, the pair pulled 10px into the column's right edge).
- **Hover / Focus:** colour-only transitions at 120ms. Focus shows a 3px cobalt ring offset 2px from the page background.
- **Link:** cobalt text, underline on hover.
- **Disabled:** 50% opacity, no pointer events.

**The Three Cobalt Roles Rule.** Every button shares the 10px radius and is cobalt in one of three roles: filled for the one primary action in a block, outlined for a secondary one, quiet text for the rest. Neutral ghost buttons are chrome only. Rows that open what they show are not buttons in this sense: a Dated Ledger row, a Balances row and a name in Balances' "Settled up" line stay ink, with a hover tint or underline and the focus ring (see Dated Ledger and Hero Panels). Tabs are not actions but places: the Expenses | Insights tabs stay ink and graphite with an ink underline and no radius (see Expenses | Insights Tabs).

### Chips
Selectable pills for Payer, participants and Split Type.
- **Style:** fully round, white sheet, control-edge border, 13px semibold label, at least 44px tall. Member chips lead with a 32px avatar (4px left inset); Split Type chips have 16px padding on both sides.
- **State:** checked chips take a cobalt border and cobalt wash. Each chip wraps a visually hidden native radio or checkbox; keyboard focus draws the 3px ring on the chip.

### Hero Panels
The Group page's Settle up and Balances panels: the page's focal point, so they sit on sheet white rather than the paper background.
- **Above them**, the Group header stays short: the back link, the Group name (39px extrabold) with the Activity icon and the Group settings cog, then one row of the Members' overlapping 32px avatars and "4 members, $1,234.56 across 12 expenses" (13px graphite, the total in the mono figure style). The description is not shown on the Group page, and the per-currency subtotals live in Insights (see Expenses | Insights Tabs). The header sits 32px above Settle up, the column's section gap.
- **Shape:** 14px radius, no shadow. No border in light theme (white on paper is edge enough); dark theme keeps a faint hairline (`border-panel`, which is `border-subtle` in dark). The 1px border is always there, transparent in light, so nothing shifts between themes.
- **Padding:** 20px on phones, 28px from 640px. Heading 20px extrabold.
- **Settle up** has four states. *Open Debts*: the header line counts the payments and their total; the signed-in User's own payment leads as the largest figure (avatars 48px, "You pay Taylor Kim" or "Taylor Kim pays you" in owe red or owed green over the amount, and a primary Record this payment), then everyone else's Suggested Settlements as single rows (payer → payee avatars, "Sam Rivera pays Taylor Kim", figure; on phones the names drop to their own line so a long name never pushes the figure out), with no per-row action, then a secondary Record a payment and a quiet "Why these payments?" that loads the graph on demand (always there in Open Debts). Below its graph, the panel's After list carries what the main view leaves out: under each Suggested Settlement, a one-line reason in secondary text when its two Members never shared an Expense ("Sam and Taylor never shared an Expense; settling directly saves the Group a Settlement."), and a cobalt disclosure, "From “Kyoto ryokan (2 nights)” and 6 other expenses", that opens to every source (its title, then who paid and when in secondary text) with its amount in a right-aligned column of its own, so the narrow After column wraps titles, never figures, and ends on the total the suggestion adds up to. Record a payment shows only when the viewer has no Suggested Settlement of their own (Guests, or a signed-in User with none); a User with one records through Record this payment, whose form can be changed to any Settlement. A User with no suggestion of their own reads "You're settled up" (text only, no icon) or how much Small Change they hold, in extrabold first. *Small Change*: the User's own line when signed in ("You're settled up", text only, at a zero Balance), then "$0.32 of Small Change left; nothing worth a payment." with a secondary Clear Small Change on the right; no suggestion list and no graph. *Settled Up*: the Settled Up Moment. *No Expenses*: the Members' avatars, "No Expenses yet" (31px extrabold) and a primary Add the first Expense, the page's only call to action: the floating Add Expense is hidden. Empty means nothing recorded at all: Settlements left after every Expense is deleted still show as Open Debts.
- **Balances** is a T-account: an Owe column (up-right arrow, debt red) and a Get back column (down-left arrow, credit green), largest first, each closing on its total; Members at zero share one line, "Settled up: Marcus Webb, Olivia Hayes", rather than $0.00 rows; a check line confirms the two sides reconcile to zero. The columns stack on phones. A long name wraps at whole words and pushes its figure onto its own line rather than breaking a word or squeezing the figure. Hidden once Settled Up, with a quiet Show / Hide. Every Member listed opens their Member Statement: a Balance row is one button (hover tints it hover slate at 60%, bleeding 8px past its column; focus rings the whole row), and each name in the "Settled up" line is an inline button, underlined in control edge (cobalt on hover), whose 44px hit area extends past the text without moving the line. A 13px graphite line closes the panel: "Select a Member to see their Member Statement."

**The White Panel Rule.** On the Group page, Settle up and Balances sit on white hero panels (14px radius, no shadow, borderless in light theme and a faint hairline in dark); everything after them stays on the page background, so the hero reads as the page's focal point.

### Expenses | Insights Tabs
Below the hero panels, Expenses and Insights are two views of one filtered set of Expenses, switched by underline tabs on the page background. There is no separate Insights heading and no always-open filter form.
- **Tab row:** "Expenses" and "Insights" in 16px semibold, 24px apart, each at least 44px tall and square-cornered, with the standard focus ring; the selected tab in ink with a 2px ink underline sitting on the row's hairline (`border`), the other in graphite (ink on hover). Expenses is selected by default. The tabs follow the ARIA tabs pattern: arrow keys, Home and End move between them and select them; only the selected tab is in the tab order.
- **Filter button:** a quiet cobalt button with a sliders icon at the right end of the tab row, pulled back 12px so its text lines up with the column's edge. It reads "Filter", or "Filter (2)" with two filters active (read out as "2 active"). It opens and closes the filter panel (Category, Member paid or included, month, and a From / To date range on a white sheet, the ledger panel's style), which is collapsed by default. It shows only once the Group has an Expense.
- **Filter chips:** each active filter, in the panel's order, is a fully round chip below the tab row (cobalt border and cobalt wash, 13px semibold ink label, a graphite ×, at least 44px tall; hover tints it hover slate) that removes that filter on click; a whole calendar month reads as one chip ("March 2024"), any other range as "From …" and "To …" chips, and the Filter button counts chips. A quiet Clear all follows the chips and removes every filter at once. Keyboard focus never drops to the page: a removed chip hands it to the chip now in its place, and the last chip or Clear all hands it to the Filter button.
- **Count line:** while filtering, 13px graphite text under the chips reads "Showing 4 matching Expenses of 13", adding "; Settlements are hidden while filtering" in the Expenses view. It is a polite live region, so the count is read out as filters change.
- **Insights' totals:** "Spending by Category", then "$4,512.30 across 18 expenses" (13px graphite, the total in the mono figure style). When any filtered Expense is in a currency other than the Group Currency, a wrapping row beneath lists each Expense Currency, the Group Currency first: "Spent in USD: $2,421.90", "Spent in JPY: ¥312,000 ≈ $2,090.40", 16px apart, the figures in the mono figure style. Like every Insights figure, the subtotals follow the filters.
- **Switching views keeps the filters.** Only the selected view renders, so Insights' charts (with their text alternatives) load the first time the Insights tab opens.
- **Spacing:** with nothing between them, the ledger's top rule tucks under the tab row's hairline (and under the selected tab's underline), so one rule shows; the panel, chips and count line each sit 12px apart, and Insights starts 20px below the tab row.
- **Empty:** with nothing recorded, neither the tabs nor the ledger show; the Settle up hero leads to the first Expense. A Group whose only entries are Settlements shows the tabs without the Filter button, and its Insights view reads "Insights appear once there are Expenses." in a dashed empty-state outline.

### Dated Ledger
The Group's Expenses and Settlements, newest first: the Expenses view of the Expenses | Insights tabs, on the page background with no card and no visible heading (a visually hidden "Expenses and Settlements" names the region for screen readers).
- **Rules:** a hairline (`border`) above each date and below the last; faint hairlines (`border-subtle`) between rows on the same date.
- **Date column:** 52px wide, one date per day, aligned with that day's first row: the day of the month in 31px extrabold ink, the month beneath it in 11px semibold uppercase graphite, and the year beneath that (11px regular) on the first date and wherever the year changes. The full date is read out with every row.
- **Expense row:** the Payer's 36px avatar; the description (16px semibold) with "Sam Rivera paid in Groceries" (13px graphite) beneath it, ending " · recorded by Casey Brooks" when the Recorder is known ("recorded by you" for the visitor); on the right the amount in Group Currency (mono, 16px semibold) and, when the Expense Currency differs, the Expense Currency amount beneath it (mono, 11px graphite), e.g. `$55.88` over `¥8,340`. Split Type, member count and the Locked Rate are not in the row; they live in the editor.
- **Settlement row:** payer → payee in 24px avatars; "Sam Rivera paid Taylor Kim" (names semibold ink, "paid" graphite) with "Settlement" (13px graphite) beneath it, ending " · recorded by …" as on an Expense row; the amount in graphite, so it reads as money moving rather than money spent. No panel or dashed border sets it apart.
- **Row:** at least 64px tall, 10px × 8px padding, 12px gaps, the avatar and amount vertically centred. The row bleeds 8px past the column on each side so its hover tint clears the avatar and figure. Long names and descriptions wrap at whole words (breaking a word only when it cannot fit); the amount never shrinks, so at 390px it stays inside the screen.
- **Rows carry no buttons.** An Expense or Settlement row is one control: a click, tap or Enter anywhere on it opens it (the Expense editor, or a dialog stating the Settlement), hover tints it hover slate at 60%, and focus rings the whole row. Delete lives inside what the row opens: the Expense editor's quiet Delete Expense, the Settlement dialog's Delete Settlement, each confirmed first.
- **Recorded by:** the Expense editor (beneath its heading, when editing an existing Expense) and the Settlement dialog (beneath the sentence stating it) carry a line "Recorded by Casey Brooks" in 13px graphite, the name semibold ink, or "Recorded by you" for the visitor. With no known Recorder (the Guest's records, and records older than Recorders with no Activity to tell) the line and the rows' " · recorded by …" are left out.
- **Read-only** (a Former Member with a reopened Balance, ADR 0006): an Expense row is plain text with no hover tint or pointer, and the Settlement dialog states the Settlement with no Delete Settlement.
- **Saving** (signed in): a row the User just added counts in Balances at once but waits for the server to give it its id. Until then its second line ends " · Saving…" in graphite, and it behaves as Read-only: an Expense row is plain text, and the Settlement dialog has no Delete Settlement.
- **Filtering** hides Settlements; the tabs' count line says how many Expenses match, and no match reads "No Expenses match these filters." in a dashed empty-state outline.

### Groups List
The Groups page (Guest and signed in) lists each Group as a row of one ledger panel (white sheet, 10px radius, 1px hairline, faint hairlines between rows, no shadow). Each row leads with where the Group stands on settling up, in the Settle up hero's words.
- **Row:** the whole row is one link to the Group: 16px × 16px padding (20px sides from 640px), hover tints it hover slate at 60%, and focus draws the 3px cobalt ring inset inside the panel; a graphite chevron on the right.
- **Name:** 20px bold ink; a long name wraps at whole words.
- **Settle status** (16px semibold, beneath the name), from the same Suggested Settlements as Settle up: "3 payments to settle up" (ink) with open Debts; "Settled Up" (ink) after a 16px Confirmation Green check; "$0.32 of Small Change left" (graphite, the figure in ink mono) when only Small Change remains; "No Expenses yet" (graphite) when nothing is recorded. Settlements left after every Expense is deleted still count as payments to settle up.
- **Secondary line:** "13 expenses  $2,751.25 spent" in 13px graphite, the total in the mono figure style, also graphite.
- **Signed in**, the row adds the User's own Balance: "Your Balance" (13px graphite) and a Balance Status pill, stacked and right-aligned beside the text from 640px, on one line beneath it on phones. Its screen-reader sentence reads "You get back $160.00", "You owe $630.00" or "You're settled up". Guests see only the settle status.
- **Read-only** (signed in): a Group the User sees only as a Former Member with a reopened Balance (ADR 0006) carries a "Read-only" marker after its name: a 16px graphite eye and a 13px semibold graphite label in an 8px-radius hairline outline.
- Figures never truncate: the text column wraps first, then the Balance drops beneath it.

### Cards / Containers
The ledger panel: a list or block on a white sheet, such as the filter panel and Insights' charts. The Group page's Expenses and Settlements are not in one; see Dated Ledger.
- **Corner Style:** 10px.
- **Background:** sheet white.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px hairline; rows inside are separated by faint hairline dividers.
- **Internal Padding:** 12px × 16px per row; 24px for standalone panels and dialogs.

### Inputs / Fields
- **Style:** white sheet, 1px control-edge border, 8px radius, 8px × 12px padding, 16px text (prevents zoom on iOS). The amount field uses the mono figure style at 25px.
- **Focus:** 3px cobalt ring; no border-colour shift.
- **Error:** the border turns alarm red, a 13px semibold red message sits under the field, and after a failed submit an error summary panel takes focus and links to each field.
- **Labels:** 13px semibold above the control; optional hint in graphite between label and control.

### Navigation
A single header band in header slate with a faint hairline beneath it: the product name (16px bold) on the left; the user menu and theme toggle as ghost buttons on the right. It wraps on narrow screens. A skip link appears on keyboard focus. In-page "back" links are cobalt 13px semibold with a leading arrow.

### Balance Status
The signature component: a Balance as a pill.
- **Shape:** 8px radius, 4px × 8px padding, 8px gap.
- **Content:** arrow icon (down-left for gets back, up-right for owes, check for settled up), a 13px semibold word, then the signed amount in the mono figure style.
- **Colour:** owes is debt red on debt blush; gets back is credit green on credit mint; settled up is graphite on hover slate.
- **Accessibility:** a full screen-reader sentence ("Jordan owes $219.49") replaces the visual parts for assistive technology.
- **On the Groups list** the pill shows the signed-in User's own Balance under a 13px graphite "Your Balance" label (see Groups List).
- **On the Group page** Balances use the hero panel's T-account instead of pills: there the column heading carries the word and arrow, the figure its sign and colour, and each row the same screen-reader sentence.

### Dialogs and Sheets
- **Dialog:** centred, white sheet, 10px radius, hairline border, 24px padding, floating shadow, at most 448px wide and 92% of the viewport tall.
- **Sheet (below 768px):** full-width from the bottom edge, 14px top corners, a 40px × 4px rounded drag handle, floating shadow.

### Member Statement
The itemised account of one Member's Balance, opened from Balances: a dialog on wide screens, the bottom sheet below 768px (see Dialogs and Sheets). It reads top to bottom like a bank statement and ends on the Balance it explains.
- **Header:** the Member's 36px avatar and name (18px bold; "(Former Member)" or "(you)" in regular graphite), the ghost Close, then "Member Statement: every Expense and Settlement behind this Balance, in USD." in 13px graphite.
- **Lines:** oldest first, between a hairline above and faint hairlines between. An Expense line: the description (16px semibold), then "Mar 23, 2024 · Paid $32.50 · Share $8.13" (13px graphite, figures in ink mono); when the Expense Currency is not the Group Currency, "Paid ¥4,850 · Share ¥1,213 · 1 JPY = 0.0067 USD" beneath it in 11px graphite (Paid only when they were the Payer); and "Includes the Split's Leftover Cent" (11px graphite) when their Share received it. A Settlement line: "Paid Alex Chen" or "Received from Jordan Park", over "Mar 24, 2024 · Settlement". On the right, the line's signed effect on the Balance in ink mono 16px semibold: no owe/owed colour on lines, only on the Balance.
- **Totals:** under a hairline, a 13px list of Paid, Share of Expenses, and (when there are any) Settlements made and Settlements received, signed, graphite labels, mono figures.
- **Balance:** pinned to the bottom of the dialog or sheet on sheet white under a hairline, so it stays in view while the lines scroll: "Balance" (bold) on the left; the arrow, the word ("owes", "gets back", "settled up") and the signed figure (mono 18px) on the right in debt red, credit green or graphite, with the Balances row's screen-reader sentence.
- **Empty:** a Member with no lines reads "No Expenses or Settlements involve Marcus Webb yet."

### Activity
A Group's Activity page, opened from the Group page's Activity icon or an Expense editor's "View changes": every change to the Group's Expenses and Settlements, newest first, unfiltered and read-only (no buttons on entries; nothing can be edited, deleted or restored).
- **Header:** the cobalt back link ("Back to Japan Trip 2024"), "Activity" (31px extrabold, the Headline), then "Every addition, edit and deletion of this Group's Expenses and Settlements, newest first." in 13px graphite.
- **Entries:** a ledger-style list on the page background with no card: a hairline above each entry and below the last, 16px vertical padding. Each entry opens with one sentence: the actor (a Linked Member, labelled "(Former Member)" once removed, or "You" for the Guest) and the title in semibold ink, the action between them in regular ink ("Casey Brooks edited the Expense January electricity", "Sam Rivera recorded a Settlement: Sam Rivera paid Taylor Kim"), then the moment in 13px graphite, in the visitor's own time zone (UTC, labelled, until the page hydrates).
- **Before → after lines:** an edit lists only what changed, in the Expense form's order, then each Member whose Share changed (in Group Currency, so a new Locked Rate shows as the Shares it moved), with the percentage or ratio typed for it. Each line is a 13px semibold graphite label (a 12rem column from 640px; stacked above the values on phones) and the values: the old struck through in graphite, a tertiary "→", the new in semibold ink. Monetary values use the Amount style. Screen readers hear "changed from … to …".
- **Added and deleted entries** list what the item was instead, label and value in a two-column 13px list: an Expense's Amount (in its own currency), Payer and Date; a Settlement's Amount (in Group Currency) and Date.
- **Highlight:** arriving from "View changes", that Expense's entries are marked with a 4px cobalt left border on a cobalt wash at 50% (bleeding 12px past the column, 8px radius), and the newest is scrolled to the top and focused. Screen readers hear "(the Expense you opened)". When none are listed, an inset note in header slate says so ("“Hotel in Shinjuku” has no changes listed.") above the list, with the launch note's reason.
- **Launch note:** for a Group older than Activity, the list closes on a 13px graphite line: "Activity starts on Mar 23, 2024. Earlier Expenses and Settlements aren't listed here." A Group with no entries and no launch date reads "No changes yet."

### Settled Up Moment
When every Balance reaches zero, the Settle up hero panel stays white: the Members' avatars with a success check badge, "Everyone is Settled Up" in 31px extrabold ink, and "$1,234.56 shared, nothing outstanding." The panel pops in once (scale 0.92 → 1.03 → 1 over 360ms), the system's only celebratory motion, stilled under reduced motion. Balances fold away beneath it.

### Simplify Animation
In "Why these payments?", Simplify plays the Group's debts turning into the Suggested Settlements: once the graph has scrolled into view, Before's arrows draw in one at a time from payer to recipient, each amount appearing as its arrow lands; Before holds, fades out, and After's arrows draw in the same way. For Japan's six debts and three Suggested Settlements this runs about six seconds.

It deliberately runs past the motion tokens. It is narrative, not feedback: the point is the comparison, and when Before only flashed for 0.6s (fading while After drew, about a second in all) people could not read it or see the contrast. Its durations and easings are defined in one place, `SIMPLIFY_TIMING` in `src/components/simplify-timing.ts`, rather than in `tokens.css`. Under reduced motion it switches straight to After with no transition; the global reduced-motion rule collapses durations but not delays, so the panel drops its transitions itself. The Before/After toggle stays a plain crossfade. The button carries a Play icon and reads "Replay" once the animation has played through, when a status line also reads out the result.

## Do's and Don'ts

### Do:
- **Do** use the `amount` utility (IBM Plex Mono, tabular numerals, no wrapping) for every monetary figure.
- **Do** pair every owe/owed colour with a sign, an arrow icon, a word and a screen-reader sentence.
- **Do** keep every interactive target at least 44×44px.
- **Do** use `border-input` (≥ 3:1) for any control boundary; keep `border` and `border-subtle` for decoration.
- **Do** style through the CSS variables in `tokens.css` so both themes follow automatically.
- **Do** keep transitions on the motion tokens (120 / 200 / 360ms, `cubic-bezier(0.2, 0, 0, 1)`), which collapse to 0ms under reduced motion. The one exception is the Simplify Animation.
- **Do** keep reading content within the 42rem content column.
- **Do** put the Group page's Settle up and Balances on white hero panels; the ledger below stays on the page background.
- **Do** give each block at most one primary (filled) button; make the rest outline or quiet.

### Don't:
- **Don't** use `dark:` classes; theme switching swaps variables only.
- **Don't** introduce a second brand hue or use cobalt for non-interactive decoration.
- **Don't** use the `owe`/`owed` tokens for errors or success; charts use their own `chart-*` series tokens.
- **Don't** put shadows on in-flow panels, lists or cards.
- **Don't** truncate or ellipsize amounts.
- **Don't** give a button its own radius or a neutral outline; every button is 10px and cobalt (ghost is for chrome only).
- **Don't** map shadcn's `accent` to a hover background; `accent` is the brand cobalt and hover uses `bg-tertiary`.
