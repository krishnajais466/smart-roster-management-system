# Smart Roster Management System

**Datastraw — AI + Tech Intern assessment · Krishna Jaiswal**
LinkedIn: https://www.linkedin.com/in/krishna-jaiswal-it/

## What it is

A browser-based roster tool for a customer-experience company that runs
support and operations for multiple D2C brands. It generates a monthly
roster for 32 employees across 4 pods and 10 brands, checks every
required brand/process/day for coverage, flags conflicts in plain
language with a backup suggestion, and lets a manager edit a day and
see the impact immediately — without rebuilding the whole roster.

Sample data (fictional, as the brief allows): 32 employees, 4 pods
(each with a pod lead), 10 brands, 4 processes — Customer Support (CS),
Abandoned Cart Conversions (ACC), Retention, Non-Delivery Report (NDR).
8 of the 10 brands (80%) have one dedicated employee handling all
processes; the other 2 brands have 3 employees each, on different
processes, with one overlapping process (CS) in each.

## How to run it

No install, no server, no sign-in, no data leaves your computer.

1. Open `index.html` in a browser (Chrome / Edge recommended).
   Or serve the folder if you prefer: `npx serve .` / `python3 -m http.server`
2. The month defaults to **December 2026**. Click **Generate Roster**.

That's it. All data lives in `data.js`; all logic in `app.js`.

## How to generate a roster

1. Pick a month (default December 2026).
2. Click **Generate Roster**.
3. Read the top summary: coverage %, mandatory conflicts, preference notes.
4. Switch tabs to change the view: **Company-wide · Pod-wise ·
   Brand-wise · Process-wise · Employee-wise**. Use the filter dropdown
   in the Pod / Brand / Process / Employee views.
5. Green = covered, red = gap, grey “–” = not a required day for that
   process. In Employee view, click any day cell to pre-fill the editor.

## How to test the conflict / change demo (2 minutes)

1. Generate the December 2026 roster. You will see conflicts — that is
   intentional (see “Test results” below). Open one: it explains the gap
   in plain language and suggests a backup. Click **Assign this backup**
   to resolve that one gap.
2. **Simulate: sole employee on leave** — Kavya Sharma (E02), the sole
   employee for AuraSkin (B01), is put on leave on Mon 7 Dec 2026.
   Expected: 4 uncovered processes for B01 that day, each with a backup
   suggestion.
3. **Simulate: one of three on leave** — Riya Shah (E20), one of the
   two people covering UrbanNest (B09) CS, is put on leave on 7 Dec.
   Expected: *no* new mandatory conflict — Pooja Yadav still covers CS.
   The app says so explicitly; it does not invent a gap.
4. **Edit a day**: pick an employee, a date and a new status
   (Working / Weekly Off / Leave / Comp-off), click **Apply change**.
   The roster and conflicts re-validate immediately.
5. **Export CSV**: click **Export CSV** to download the current view.
6. **Holidays**: add or remove a public holiday (25 Dec 2026,
   Christmas Day, is seeded) and regenerate — 365-day processes still
   require cover on that day; other processes do not.

## Test results (run 17 Nov 2026, `node test.js` — 11 passed, 0 failed)

- 32 employees, 10 brands, 4 pods, 40 brand/process rows.
- 8 of 10 brands single-resource; B09 and B10 have 3 primaries each.
- December 2026: **1,138 required slots, 942 covered, 83% coverage**,
  **196 mandatory conflicts, 8 preference notes**. Every required
  slot is either covered or flagged — the test asserts this for all
  1,138 slots, so no roster is silently invalid. Most mandatory
  conflicts share one root cause: a single-resource brand's sole
  employee has a weekly off (or a seeded planned leave) on a day
  that brand still requires cover. Each one names a backup.
- Simulate sole-employee leave (B01, 7 Dec): gap flagged, 4 processes.
- Simulate multi-employee leave (B09 CS, 7 Dec): coverage holds.
- Manager edit (E02 Leave, 7 Dec) creates a B01 gap; assigning the
  suggested backup (Ananya Gupta, E06) resolves it.
- CSV export: header + 1,240 data rows (40 brand/processes × 31 days).
- Double-booking detection: verified on synthetic data (24 flagged days).
- Regeneration is deterministic.

Limit of the testing done here: the scheduling logic was tested
headlessly in Node (`node test.js`) and the HTML/JS wiring was checked
(all element IDs referenced by `app.js` exist in `index.html`).
The UI itself was not click-tested in a real browser in this run —
open `index.html` in Chrome and run the 2-minute demo above before
recording the demo video.

## Assumptions made

- All brand and employee names are fictional sample data.
- A brand's operating calendar lives on each brand/process row, not
  on the brand as a whole: CS for one brand can be 365-day while its
  ACC is Sundays-and-holidays-off. Three rules are supported:
  365-day, daily except public holidays, Sundays & public holidays off.
- Minimum staffing is 1 person per brand/process/day, except
  GlowMart (B10) CS, which needs 2.
- Every employee has one weekly-off weekday (Mon–Sat). Sunday is
  handled by the brand/process rule: for 365-day processes Sunday is
  a working day and the weekly off is the weekday instead.
- A backup is *suggested*, never auto-assigned. Assigning a backup
  is a manager decision, made by clicking “Assign this backup”.
- Seeded planned leaves (FitFuel 8–9 Dec, StyleStreet 14 Dec,
  HomeHaven 21–22 Dec) and comp-offs (5 and 12 Dec) are part of the
  sample data, not real people.
- Data is stored in the browser session only (in-memory + the files
  themselves). There is no login, no database and no server — that is
  a deliberate choice for a client-side demo; see Q7 for what would
  change at scale.
- No fee is charged anywhere in this app, and it needs no secrets
  (see `.env.example`).

## Answers to the assessment questions

### 1) How did you model employees, brands, processes, pods, and their relationships?

Employees, brands, processes and pods are separate tables (in
`data.js`), joined by assignments — not by nesting one inside another.
An `Employee` has a pod, a role, one weekly-off weekday, a skill list,
a `primary` list and a `backupFor` list. Each entry in those lists is
`{ brandId, processes: [...] }`, so one employee can cover several
processes for one brand, or be a backup for several brands.
A `Brand` is just an id, name and category. The working rules live on
`BrandProcess` — one row per brand + process — with `{ rule, minStaff }`.
That separation is the key modelling choice: a brand's operating
calendar and an employee's working pattern are different things, and
storing them separately lets one brand have CS on a 365-day rule while
its Retention is Sundays-off, without duplicating the employee.
Pods are a grouping on the employee (`podId`) plus a lead id; a pod
lead is an employee with no primary brand, so they are free to cover
as a backup.

### 2) How does your system generate a roster and determine whether it satisfies the required constraints?

`generateRoster(month)` in `app.js` walks every day of the month and
every brand/process row. For each cell it first asks: is this day
*required* under this row's rule (365-day / daily-except-holidays /
Sundays-and-holidays-off, using the editable holiday list)? If not,
the cell is “not required” and cannot produce a conflict.
If it is required, it evaluates every assigned primary employee for
that day — manager override first, then planned leave, comp-off,
weekly off, then Sunday/holiday off under the rule — and counts how
many are Working. The cell is covered only if that count is at least
`minStaff`. Every required cell is therefore either covered or
produces a conflict object with a type, severity, explanation and
backup suggestion. A roster is never returned without its conflicts:
the test suite asserts that for all 1,138 required slots in December
2026. Coverage % is covered ÷ required slots.

### 3) How did you handle the difference between single-resource brands and brands with multiple employees?

Both are the same data shape — a list of primary assignments per
brand/process — so the generator does not need a special case. The
*difference is in the numbers*: a single-resource brand has one
primary for every process, so that one person's weekly off, leave or
comp-off makes the count 0 and creates a mandatory `no_coverage`
conflict for every process that day. A multi-employee brand has two
or three primaries, usually on different processes, with one
overlapping process (CS on B09 and B10). Losing one person there
usually leaves the count at or above the minimum, so no conflict is
raised — the system says so explicitly in the simulate-change result.
Where a process genuinely needs more than one person (GlowMart CS,
min 2), losing one of its two primaries *does* create an
`insufficient_staffing` conflict, even though one person is still
working. That distinction — count vs. minimum, not just “someone is
there” — is what makes the multi-employee case work.

### 4) What happens when an employee manages all processes for a brand but is unavailable on a required working day?

All four processes for that brand fail at once, and each failure is
flagged separately so the manager sees the full blast radius. For
example, putting Kavya Sharma (E02, sole employee for AuraSkin) on
leave on Mon 7 Dec 2026 produces four mandatory conflicts — CS, ACC,
Retention and NDR — each explaining that she is on leave and each
suggesting a different available backup with the right process skill
from the same pod where possible. The system does not auto-assign a
backup and does not silently mark the brand as covered. The manager
must either assign a backup (one click per conflict), move the leave,
or change a weekly off — and after any of those, the roster
re-validates and the conflict disappears only if coverage is really
restored.

### 5) How does your system handle conflicting requirements or insufficient staffing?

Conflicts are first-class output, not an afterthought. Types:
`no_coverage` (0 working, minimum unmet), `insufficient_staffing`
(some working, fewer than the minimum), `double_booked` (one person
Working for two different brands the same day), and `holiday_working`
(a preference, not a blocker). Each conflict is labelled
**mandatory** (a required day is uncovered/short, or a person is
double-booked — coverage takes priority over a preferred weekly off)
or **preference** (coverage is fine, e.g. someone working a public
holiday on a 365-day process, where a comp-off is the right response).
For every mandatory conflict the system searches for a backup: same
process skill, available (Working) for that brand/process that day,
and *not* already working as a primary for another brand that day
(assigning them would only move the gap). Same-pod backups are
preferred. If no backup exists, the explanation says so plainly and
tells the manager the two real options: reassign someone, or change
the weekly off / leave. Nothing is auto-resolved.

### 6) Which parts did you automate, and which did you leave under human control? Why?

Automated: generating the month's cells from the rules, counting
coverage against the minimum, detecting every conflict, writing the
plain-language explanation for each conflict, and finding and ranking
backup candidates. Those are mechanical, repeatable, and error-prone
by hand — exactly what software should do.
Left to the human: assigning a backup, approving a leave or a
weekly-off change, adding/removing a public holiday, and deciding
what to do when no backup exists. Those need judgement about the
client, the person, and the pod — and a wrong automatic assignment
(e.g. pulling someone off another brand) would create a new gap
somewhere else. The app therefore *suggests* and the manager
*decides*; every decision is recorded in the on-screen change log
and the roster is re-validated after it.

### 7) If the company doubled its team and brand count, what would you change?

Three things, in this order. First, move the data out of a JS file
into a real store (the brief's own stack suggests Supabase /
PostgreSQL): 64 employees and 20 brands in a flat file is still
workable, but concurrent edits by two pod leads would overwrite each
other, and there is no audit trail. Second, split the generator so
the conflict check runs incrementally — today it re-walks the whole
month on every edit, which is fine at 1,138 slots and would get slow
and wasteful at 10× that size; only the affected brand/process/day
needs re-checking, with a full check on Generate. Third, add roles
and an approval step: today anyone opening the file is the manager.
At double the size, pod leads should propose changes for their own
pod and an operations manager should approve them, and the backup
suggestion should become a proper request (“ask Ananya to cover”)
rather than a one-click assignment. The data model itself would not
need to change — employees, assignments and brand/process rules
already scale by adding rows, not by rewriting code.

### 8) If you had one additional week, what would you improve first?

Fairness of weekly offs and leave — the thing the current version
surfaces but does not fix. Today, a single-resource brand's sole
employee simply has a gap on their weekly-off day, every week, and
the manager has to assign a backup by hand each time. With one more
week I would add a rotating backup rota: for each single-resource
brand, pre-assign a named backup for each weekday, so the weekly-off
gap is covered by design instead of flagged after the fact, and add a
fairness report (who worked the most Sundays / holidays, who has had
the fewest weekly offs) so the rota does not quietly overload the
same backup every week. That is the highest-value improvement because
it removes the largest single class of conflicts in the December data
instead of just reporting them.

## AI assistance disclosure

This app was built with Muse (Meta AI) as an AI coding assistant,
from the assessment PDF and job description Krishna supplied. Krishna
checked the result himself: he runs the app, generates the roster,
and records the demo video. The scheduling logic, the conflict
explanations and the test results in this README are deterministic
(no external AI API is called at runtime — the “AI-assisted”
explanations are templated text built from the facts of each
conflict), and the tests in `test.js` were run for real on 17 Nov 2026.

## Files

- `index.html` — the app page (views, editor, simulate buttons, export)
- `styles.css` — styling
- `app.js` — roster generation, conflict detection, backup search, UI
- `data.js` — all sample data (employees, brands, pods, rules, holidays, leaves)
- `test.js` — headless checks: `node test.js` (11 passed, 0 failed, 17 Nov 2026)
- `README.md` — this file
- `APPROACH.md` — 2–3 sentence approach note + short architecture
- `.env.example` — placeholder: no secrets are needed
