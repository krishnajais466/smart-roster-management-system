# Approach — Smart Roster Management System

**Krishna Jaiswal · Datastraw AI + Tech Intern assessment**
LinkedIn: https://www.linkedin.com/in/krishna-jaiswal-it/

## Approach (2–3 sentences)

I modelled the problem as three separate things that are usually tangled
together — a brand's operating calendar, an employee's working pattern,
and the assignment that joins them — then built a plain client-side app
that generates a monthly roster from those rules, checks every required
day for minimum coverage, and flags any gap in plain language with a
backup suggestion instead of silently producing an invalid roster.

## Architecture (short form)

- **Stack:** plain HTML + CSS + JavaScript, no build step, no backend,
  no database, no external API. Open `index.html` and it runs.
- **Data (`data.js`):** employees (32, in 4 pods with a lead each),
  brands (10), one `BrandProcess` row per brand + process carrying its
  working rule (`365` / `daily_no_holiday` / `sun_holiday_off`) and
  minimum staffing, plus an editable holiday list and seeded leaves /
  comp-offs.
- **Logic (`app.js`, pure functions, tested in Node):**
  `generateRoster()` walks every day × brand/process, decides if the
  day is required, evaluates each assigned employee (override → leave
  → comp-off → weekly off → Sunday/holiday off → working), and counts
  Working staff against the minimum. Uncovered required days become
  conflicts (`no_coverage`, `insufficient_staffing`, `double_booked`,
  plus `holiday_working` as a preference), each with a templated
  explanation and a backup search that excludes anyone already working
  for another brand that day.
- **Human control:** backups are suggested, never auto-assigned; a
  manager assigns one, edits a day, or adds a holiday, and the roster
  re-validates immediately. All changes are listed in an on-screen log.
- **Views:** Company / Pod / Brand / Process / Employee tabs, CSV
  export of the current view, and two one-click “Simulate change”
  demos (sole employee on leave → gap; one of three on leave →
  coverage holds).
- **Tested:** `node test.js` — 11 checks passed, 0 failed (17 Nov 2026):
  December 2026 has 1,138 required slots, 942 covered (83%), every
  required slot either covered or flagged.
