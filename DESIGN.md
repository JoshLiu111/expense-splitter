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
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-outline-hover:
    backgroundColor: "{colors.bg-tertiary}"
  button-ghost:
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
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
  ledger-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
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

Density is moderate and calm. Content sits in one narrow reading column (672px) so a Group's Balances, Expenses and Settlements scan top to bottom like a statement. Type is a confident grotesque (Manrope) set heavy for headings and plain for prose, while every monetary figure switches to a tabular monospace (IBM Plex Mono) so columns of amounts align to the digit. Surfaces are flat, separated by borders and tonal steps; shadows appear only on things that float.

Light and dark themes are equal citizens: tokens swap, layouts do not. Dark is a cool graphite, not inverted grey. Motion is brief and functional, with one sanctioned moment of celebration when a Group is Settled Up and one deliberate piece of narrative motion when Simplify explains Debt Simplification.

**Key Characteristics:**
- One cool-blue accent on cool blue-grey neutrals; no secondary brand colour.
- Money in IBM Plex Mono with tabular numerals, never truncated.
- Owing and being owed are never told apart by colour alone.
- Flat surfaces with hairline borders; elevation reserved for floating layers.
- Every interactive target is at least 44×44px.
- Every text pairing meets WCAG AA in both themes.

## Colors

A cool, low-chroma ledger palette with one cobalt accent and a semantic red/green pair reserved for money owed.

### Primary
- **Ledger Cobalt** (`accent`; `accent-dark` in dark theme): primary buttons, links, focus rings, selected chips, the active accent border on the inline expense editor and the landing page eyebrow. It is the only hue that means "act here".
- **Cobalt Pressed** (`accent-hover`): hover state of primary buttons. In dark theme it lightens instead of darkening.
- **Cobalt Wash** (`accent-subtle`): background of selected chips and the landing eyebrow pill.
- **On Cobalt** (`on-accent`): text on cobalt. White in light theme; near-black in dark theme because white on the lighter dark-theme cobalt fails AA.

### Secondary
- **Debt Red** (`owe`) with **Debt Blush** (`owe-subtle`): a Member who owes. Text on its blush passes 4.5:1.
- **Credit Green** (`owed`) with **Credit Mint** (`owed-subtle`): a Member who gets back. Also the background of the "All settled up!" panel.

### Tertiary
- **Confirmation Green** (`success`): success announcements and the Settled Up border.
- **Ochre Caution** (`warning`): warnings; darkened in light theme to reach 4.85:1.
- **Alarm Red** (`error`): field errors, the error summary border and destructive actions.

### Neutral
- **Statement Paper** (`bg-primary`): the page background.
- **Header Slate** (`bg-secondary`): the site header band and inset notes such as the live split preview.
- **Hover Slate** (`bg-tertiary`): hover backgrounds for outline and ghost buttons; the neutral "settled up" Balance pill.
- **Sheet White** (`surface`): panels, list containers, dialogs, inputs and chips.
- **Hairline** (`border`) and **Faint Hairline** (`border-subtle`): decorative rules and list dividers. About 1.3:1; never the only boundary of a control.
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
- **Display** (800, 39px, 1.2): the landing page hero heading only.
- **Headline** (800, 31px, 1.25): one per page; the page or Group name.
- **Title** (700, 20px, 1.4): section headings such as Balances, Insights and Expenses; also the "All settled up!" line (800).
- **Body** (400, 16px, 1.55): prose, Member names, Expense descriptions.
- **Label** (600, 13px, 1.45): buttons, field labels, legends, chips, metadata lines; the workhorse size.
- **Caption** (400, 11px, 1.45): secondary conversions under an amount, avatar initials.
- **Amount** (IBM Plex Mono, 600, tabular numerals, no wrapping): every monetary figure, at whatever size its context sets (16px in Balances, 25px in the amount field).

### Named Rules
**The Figures in Mono Rule.** Every monetary amount uses the `amount` utility: IBM Plex Mono, tabular numerals, `white-space: nowrap`. Never truncate or ellipsize a figure.

**The Two Weights of Voice Rule.** Headings are 700 or 800; labels are 600; prose is 400. Weight 500 is reserved and almost never used.

## Layout

The page is a centred column inside an 80rem frame with 16px side padding. Reading content (a Group, the dashboard, forms) narrows further to a 42rem content column so lists read like a statement. The landing hero uses a two-column grid (1.1fr / 1fr) from 1024px; feature lists step from one to two (640px) to four columns (1024px). Insights charts sit in a two-column grid from 768px.

Spacing is a 4px base scale. Inside components, 8–16px dominates (chip gaps 8px, list row padding 12px × 16px, panel padding 24px); between sections, 32px. Forms stack fields with 20px gaps.

At 768px (`48rem`) the expense editor switches from a bottom sheet to an inline panel, and the "Add expense" action moves from a full-width bar fixed to the bottom of the screen to a floating button at the bottom-right. Below that width, pages reserve 96px of bottom padding so the fixed bar never covers content.

### Named Rules
**The 44 Pixel Floor Rule.** Every button, chip, link-button and toggle is at least 44×44px, on every breakpoint.

## Elevation & Depth

The system is flat at rest. Depth comes from tonal steps (paper background, white sheet, slate header) and hairline borders, not shadows. Shadows exist only for layers that float above the page: dialogs, the mobile sheet, the floating "Add expense" button and the skip link use the large shadow; the open inline expense editor uses the medium one. Dark theme keeps the same roles with heavier black shadows.

### Shadow Vocabulary
- **Rest** (`--shadow-sm`, `0 1px 2px rgba(15, 23, 42, 0.05)`): available for a subtle lift; rarely used.
- **Raised** (`--shadow-md`, `0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`): the inline expense editor while open.
- **Floating** (`--shadow-lg`, `0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)`): dialogs, sheets, the floating action button.

### Named Rules
**The Only What Floats Rule.** A shadow means "this sits above the page". Lists, panels and cards in the flow have a border and no shadow.

## Shapes

Corners are gently rounded and consistent by role: controls (buttons, inputs, Balance pills) at 8px; panels, list containers, dialogs and empty states at 10px; the mobile sheet's top edge at 14px. Fully round shapes are reserved for things that are tokens of identity or selection: Member avatars, selectable chips, Member pills, the landing eyebrow, progress bars and the sheet's drag handle.

Borders are 1px. Empty states use a dashed 1px `border-input` outline to read as "a place to fill", distinct from solid panels.

## Components

### Buttons
Firm, compact and unadorned.
- **Shape:** gently rounded (8px), minimum 44px tall; icon buttons are 44×44px.
- **Primary:** cobalt fill, on-accent text, 13px semibold label, 8px × 16px padding.
- **Hover / Focus:** colour-only transitions at 120ms. Focus shows a 3px cobalt ring offset 2px from the page background.
- **Outline:** white sheet with a control-edge border; hover fills with hover slate.
- **Ghost:** no fill or border; hover fills with hover slate. Used in the header (user menu, theme toggle).
- **Link:** cobalt text, underline on hover.
- **Disabled:** 50% opacity, no pointer events.

### Chips
Selectable pills for Payer, participants and Split Type.
- **Style:** fully round, white sheet, control-edge border, 13px semibold label, at least 44px tall. Member chips lead with a 32px avatar (4px left inset); Split Type chips have 16px padding on both sides.
- **State:** checked chips take a cobalt border and cobalt wash. Each chip wraps a visually hidden native radio or checkbox; keyboard focus draws the 3px ring on the chip.

### Cards / Containers
The ledger panel: a list or block on a white sheet.
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

### Dialogs and Sheets
- **Dialog:** centred, white sheet, 10px radius, hairline border, 24px padding, floating shadow, at most 448px wide and 92% of the viewport tall.
- **Sheet (below 768px):** full-width from the bottom edge, 14px top corners, a 40px × 4px rounded drag handle, floating shadow.

### Settled Up Moment
When every Balance reaches zero, a credit-mint panel with a success border announces "All settled up!" in 20px extrabold success green and pops in once (scale 0.92 → 1.03 → 1 over 360ms). It is the system's only celebratory motion and is stilled under reduced motion.

### Simplify Animation
In "Why these payments?", Simplify plays the Group's debts turning into the Suggested Settlements: once the graph has scrolled into view, Before's arrows draw in one at a time from payer to recipient, each amount appearing as its arrow lands; Before holds, fades out, and After's arrows draw in the same way. For Japan's six debts and three Suggested Settlements this runs about six seconds.

It deliberately runs past the motion tokens. It is narrative, not feedback: the point is the comparison, and when Before only flashed for 0.6s (fading while After drew, about a second in all) people could not read it or see the contrast. Its durations and easings are defined in one place, `SIMPLIFY_TIMING` in `src/components/simplify-timing.ts`, rather than in `tokens.css`. Under reduced motion it switches straight to After with no transition; the global reduced-motion rule collapses durations but not delays, so the panel drops its transitions itself. The Before/After toggle stays a plain crossfade.

## Do's and Don'ts

### Do:
- **Do** use the `amount` utility (IBM Plex Mono, tabular numerals, no wrapping) for every monetary figure.
- **Do** pair every owe/owed colour with a sign, an arrow icon, a word and a screen-reader sentence.
- **Do** keep every interactive target at least 44×44px.
- **Do** use `border-input` (≥ 3:1) for any control boundary; keep `border` and `border-subtle` for decoration.
- **Do** style through the CSS variables in `tokens.css` so both themes follow automatically.
- **Do** keep transitions on the motion tokens (120 / 200 / 360ms, `cubic-bezier(0.2, 0, 0, 1)`), which collapse to 0ms under reduced motion. The one exception is the Simplify Animation.
- **Do** keep reading content within the 42rem content column.

### Don't:
- **Don't** use `dark:` classes; theme switching swaps variables only.
- **Don't** introduce a second brand hue or use cobalt for non-interactive decoration.
- **Don't** use the `owe`/`owed` tokens for errors or success; charts use their own `chart-*` series tokens.
- **Don't** put shadows on in-flow panels, lists or cards.
- **Don't** truncate or ellipsize amounts.
- **Don't** map shadcn's `accent` to a hover background; `accent` is the brand cobalt and hover uses `bg-tertiary`.
