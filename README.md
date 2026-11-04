# Sherov School

A management app for the Sherov School learning centre in Tashkent, which has three branches (Bashlik, Chilonzor, Quyliq). Branch administrators manage students, teachers, groups, attendance, the schedule, tuition payments and reports for their branch. Teachers get their own portal for their classes, attendance, homework and notifications.

**This is a frontend-only demo.** There is no backend, no database and no real sign-in. All data is realistic sample data generated in the browser and saved in that browser's `localStorage`. It is not shared between devices or people, and clearing browser data removes it. No real payments are processed.

## Run it (Windows PowerShell)

Requires Node.js 22 or newer.

```powershell
cd "C:\VS code with Claude\Sherov School"
npm.cmd install
npm.cmd run dev
```

Then open http://localhost:5173 and sign in with a demo account.

## Demo sign-in (temporary, not secure)

Every account uses the password `demo`. The sign-in page lists all accounts; click one to fill in the form.

| Role | Username | Sees |
| --- | --- | --- |
| Administrator, Chilonzor | `admin.chilonzor` | Chilonzor branch only |
| Administrator, Bashlik | `admin.bashlik` | Bashlik branch only |
| Administrator, Quyliq | `admin.quyliq` | Quyliq branch only |
| Teacher | first name, e.g. `kamola`, `dilshod`, `nigora` | Their own groups and students |

This only shapes what the demo shows. Passwords aren't checked by a server, only the signed-in user's id is remembered in `localStorage` (`sherov-school:session`), and anyone with browser developer tools can switch accounts. It must be replaced by real authentication and server-side permission checks before real data is used. The owner account exists in the data but can't sign in yet: the owner portal isn't built.

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

- Generated for today's date on first visit: 3 branches, 248 active students in 20 running groups, 10 teachers, six months of tuition payments, six weeks of attendance (with a few teacher notes), six weeks of homework per running group with each student's result, student profiles with parents or guardians, a few teacher notes, and notifications for teachers. For administrators: courses, rooms per branch, each student's group history and timeline (including some earlier transfers, discounts with reasons and a few graduates), about a dozen admissions enquiries per branch at every stage (with a trial lesson today), and monthly / level tests with results.
- Each teacher works at one branch; their groups and those groups' students belong to that branch too.
- Every change (add, edit, delete, attendance, payments, settings) is saved in `localStorage` under the key `sherov-school:data`.
- **Reset:** Settings → Demo data → *Reset demo data*. A confirmation explains that local changes will be lost. You can download a JSON copy first.
- Data saved by earlier versions of the app (before branches and sign-in, or before homework evaluation) is upgraded automatically and nothing is lost; a copy of the old data is kept under `sherov-school:backup:<time>`.
- If saved data can't be read (corrupted, or from a newer version), the app keeps a copy under `sherov-school:backup:<time>`, loads fresh sample data and shows a banner. It never overwrites silently.

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
                  attendance, schedule, payments, reports, settings;
                  teacher/ holds the teacher portal pages
  data/           Store context and provider, demo data (seed.ts, seed-portal.ts,
                  seed-learning.ts for profiles, homework results and notes),
                  localStorage layer and upgrades of older saved data (migrate.ts)
  hooks/          Small React hooks (current time, URL filters, attention items)
  lib/            Pure helpers: dates, formatting, metrics, schedule, CSV,
                  homework results and progress indicators (performance.ts),
                  demo sign-in (auth.ts), what each role can see (scope.ts), notifications
  types/          Domain types (Student, Group, Payment, ...)
```

Start with `src/types/index.ts` (the data model), then `src/data/seed.ts` (how sample data is made) and `src/lib/metrics.ts` (how every number is calculated). Pages read data through `useSchool()` and change it only through its `actions`. `data` is already narrowed to what the signed-in person may see (`lib/scope.ts`), and the actions refuse changes outside that person's branch or groups.

### Portals and routes

- `/login`: demo sign-in.
- Administrator: `/`, `/students`, `/teachers`, `/groups`, `/attendance`, `/schedule`, `/payments`, `/reports`, `/settings`.
- Teacher (laid out like LC UP's teacher side, without chat): `/teacher` (Home: rating, salary, groups with All/Today), `/teacher/groups/:id` (the group's month journal: Attendance, Grades, Homework, Ranking; `?lesson=YYYY-MM-DD` opens the lesson sheet), `/teacher/students` and `/teacher/students/:id`, `/teacher/statistics` (rating breakdown, all teachers, salary breakdown), `/teacher/homework` and `/teacher/homework/:id`, `/teacher/profile` (details and salary history), `/teacher/notifications` (from the bell). Old links to `/teacher/groups` and `/teacher/attendance` redirect.
- Adding the owner portal: add routes under `/owner`, a navigation entry in `app/navigation.ts`, and `'owner'` to `SIGN_IN_ROLES` in `lib/auth.ts`. The owner already sees every branch in `scopeData`.

### Homework evaluation and progress

- Each homework records the students in the group on the day it was set. Each student gets one result: submission (not submitted, submitted, late), and once the teacher gives a score out of 100, an evaluation with feedback, date and who evaluated it.
- Student indicators (`lib/performance.ts`) are separate numbers: average homework score, completion rate (handed in ÷ homework past its deadline), attendance rate, number evaluated, and a trend (average of the last 3 scores against the 3 before, ±5 points). The label (Excellent 85+, Good 70–84, Needs improvement) comes from the average score only and needs at least 2 scores. **Nothing combines attendance and homework into a ranking**; that formula is still to be decided.
- The same functions can later feed a parent view (what was set, whether it was handed in, score and feedback). Teacher notes are kept separately and are for staff only.

### Lessons, grades, salary and teacher rating

- **Lesson sheet** (attendance + grades on one screen): every student starts as present. The teacher picks a mark (Absent, Late, or a grade 5–1) and taps the students it applies to; "Give 4 to the 7 not graded yet" fills the rest. Keys: 1–5, A, L, C. Grades are stored on the lesson (`AttendanceRecord.grades`).
- **Salary** (`lib/salary.ts`): tuition *paid* for a month by students in the teacher's groups × the teacher's share (`Teacher.salaryPercent`, set by the administrator in the teacher form; demo shares are 30–50%). Teachers see only the result, hidden behind ***** until they tap the eye.
- **Teacher rating** (`lib/rating.ts`): a score out of 100 per month from lessons recorded (25), student attendance (20), homework checked (20), students graded (15) and groups filled (20). Change `RATING_WEIGHTS` to rebalance. How high the grades are doesn't count. The top 3 (`BONUS_PLACES`) are marked as bonus places.
- The older teacher files `TeacherDashboardPage.tsx`, `MyGroupsPage.tsx`, `GroupDetailPage.tsx`, `StatStrip.tsx` and `ClassList.tsx` are no longer used and can be deleted.

### Administrator portal

The sidebar follows a working day: Dashboard; **Admissions** (Leads & trials); People (Students, Teachers); Teaching (Groups, Schedule, Attendance, Assessments); Finance (Payments, Reports); Settings.

- **Dashboard** answers "what do I need to do today?": five numbers (active students, classes today, attendance today, collected this month, overdue tuition), then **Today's tasks** (trial lessons today, missing attendance, trial results not recorded, overdue tuition, new enquiries to call back, groups whose teacher is on leave, repeated absences, full groups), each with an action and an expandable list, then today's classes. Charts are on Reports. The bell shows the same tasks.
- **Students** list shows the main parent and their phone (with copy), attendance %, tuition and status; click a row to open the profile. Search (here and in the header) also finds students by a parent's name or phone. **Current** shows active and paused students; **Archive** holds students who left or graduated, with all their history. Export CSV exports the list as filtered.
- **Student lifecycle**: Active, Paused (keeps the seat, not billed), Left, Graduated. **Change status** asks for a date and a reason. **Transfer** moves a student to another group from a chosen date, with an optional reason and a choice of keeping their price or taking the new group's fee. Leaving, graduating and transferring end the old group membership instead of deleting it, so group history and reports stay correct (`lib/student-lifecycle.ts`, `SchoolData.enrollments`, `SchoolData.studentEvents`). Delete is only for records added by mistake.
- **Discounts**: when a student's monthly price differs from the group's fee, the form asks for the kind (discount, scholarship, special price) and a reason, shown on the profile and in exports.
- **Student profile**: parents first (copyable phones), personal details, study details with **group history**, tuition (price and why it differs, owed, overdue, payments with who recorded them), attendance summary with full history, homework progress on the same 1–5 scale teachers use, **assessment results**, and a **History** timeline (enrolment, transfers, status and price changes, payments). There is no overall ranking yet: each number stands on its own until the formula is agreed.
- **Add / edit student** form has four sections: student, parent / guardian (up to three), group, tuition. When editing, group and status are changed with Transfer and Change status so the history is kept.
- **Admissions** (`/leads`): enquiry → contacted → trial scheduled → trial done (with level placement) → enrolled, or lost with a reason. Each enquiry page shows one obvious next step. **Enroll as student** opens the student form already filled in (name, parent, phone, recommended group) and links the new student to the enquiry. Trial lessons today and missing trial results appear on the dashboard.
- **Assessments** (`/assessments`): level tests, monthly tests, midterms and finals for a group, scored out of any maximum (e.g. 50 or 100), with absent students and comments. Planned tests are listed first; results show on each student's profile. Teachers don't enter assessments in their portal yet.
- **Teachers**: click a teacher for their profile: contact, branch (and earlier branches), groups with attendance, the next 7 days of classes, this month's pay so far, and this month's work measures (lessons recorded, homework checked and so on). Only the owner will be able to move a teacher between branches.
- **Courses and rooms** are lists in Settings, not fixed in code: add a course (e.g. Arabic) or turn one off; add, rename or remove your branch's rooms. Group forms choose from them; two running groups can't share a room at the same time.
- **Payments** opens on **Who hasn't paid** (overdue first, parent to call, one-click Record payment, Export CSV); **Payment history** is the second tab and shows who recorded each payment.
- **Exports (CSV)**: students, debtors, payments, attendance (the month being viewed), teachers, enquiries and report tables. Files are CSV with a UTF-8 marker so Excel opens them; there is no XLSX or PDF export yet.
- **Translations**: `src/i18n` holds the message catalogue and `t()`; the sidebar uses it. Uzbek and Russian can be added there and the rest of the screens moved over gradually.
- Teachers can add a short comment per student when checking homework (Comment mark, key M). The comment is saved with the grade and shows on the student profile.

## Not built yet

- Real backend, database and authentication (sign-in is a labelled demo; permissions are enforced only in the browser)
- Owner portal (where the owner would review the teacher rating and award bonuses), and moving teachers between branches (owner only)
- Recording actual salary payouts (salary is calculated, not paid out, in the app)
- Students and parents can't hand in or view homework yet: teachers record who handed it in. Notifications are in-app only
- Centre settings are shared by all branches
- Real payment processing or receipts
- Multi-device sync; data stays in one browser
- SMS or Telegram reminders to parents
- Translations (the interface is English only; the foundation is in `src/i18n`)
- Staff attendance (administrators, reception): not needed day to day yet. A `staffAttendance` list with person, date and status can be added later without changing anything else.
- An "Excused" attendance mark (only present, late and absent today)
- Configurable payment methods (the five methods are still fixed in `PAYMENT_METHODS`)
- Assessments in the teacher portal, and reusable exam templates
- Editing a group's room by id: groups store the room's name; renaming a room in Settings updates its groups
