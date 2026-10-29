# Sherov School

A management app for the Sherov School learning centre in Tashkent: students, teachers, groups, attendance, the weekly schedule, tuition payments and reports.

**This is a frontend-only demo.** There is no backend, no database and no sign-in yet. All data is realistic sample data generated in the browser and saved in that browser's `localStorage`. It is not shared between devices or people, and clearing browser data removes it. No real payments are processed.

## Run it (Windows PowerShell)

Requires Node.js 22 or newer.

```powershell
cd "C:\VS code with Claude\Sherov School"
npm.cmd install
npm.cmd run dev
```

Then open http://localhost:5173.

(`npm.cmd` avoids PowerShell's script execution policy blocking `npm.ps1`. If `npm` works for you, use it.)

Other commands:

| Command | What it does |
| --- | --- |
| `npm.cmd run build` | Type-checks and builds the production site into `dist/` |
| `npm.cmd run preview` | Serves the production build at http://localhost:4173 |
| `npm.cmd run typecheck` | TypeScript check only |
| `npm.cmd run lint` | Lints with oxlint |
| `npm.cmd test` | Runs the data-layer unit tests (Vitest) |

## Demo data

- Generated for today's date on first visit: 248 active students in 20 running groups, 10 teachers, six months of tuition payments and six weeks of attendance.
- Every change (add, edit, delete, attendance, payments, settings) is saved in `localStorage` under the key `sherov-school:data`.
- **Reset:** Settings → Demo data → *Reset demo data*. A confirmation explains that local changes will be lost. You can download a JSON copy first.
- If saved data can't be read (corrupted, or from an older version), the app keeps a copy under `sherov-school:backup:<time>`, loads fresh sample data and shows a banner. It never overwrites silently.

### Rules used for the numbers

- **Revenue** = payments with status *Paid*, by payment date. *Pending* and *Refunded* don't count.
- **Outstanding tuition** = for each *active* student, monthly tuition for every month since enrolment (within the six-month demo history) minus paid payments for those months. It becomes **overdue** after the due day (10th by default, changeable in Settings), and earlier unpaid months are always overdue.
- **Attendance rate** = (present + late) ÷ all marks.
- **Needs attention** lists overdue tuition, three or more absences in 14 days, groups with one seat or fewer left, and classes in the last week that ended without attendance.

## Project structure

```
src/
  app/            App routes, layout shell, navigation config
  components/     Shared UI: buttons, dialogs, fields, badges, layout (sidebar, header)
  features/       One folder per page: dashboard, students, teachers, groups,
                  attendance, schedule, payments, reports, settings
  data/           Types for the store, demo-data generator (seed.ts), localStorage layer
  hooks/          Small React hooks (current time, URL filters, attention items)
  lib/            Pure helpers: dates, formatting, metrics, schedule, CSV
  types/          Domain types (Student, Group, Payment, ...)
```

Start with `src/types/index.ts` (the data model), then `src/data/seed.ts` (how sample data is made) and `src/lib/metrics.ts` (how every number is calculated). Pages read data through `useSchool()` and change it only through its `actions`.

## Not built yet

- Real backend, database, authentication and user roles
- Real payment processing or receipts
- Multi-device sync; data stays in one browser
- SMS or Telegram reminders to parents
- Translations (the interface is English only)
