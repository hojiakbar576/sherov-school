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
| Receptionist | `reception.chilonzor`, `reception.bashlik`, `reception.quyliq` | Admissions, students, groups, schedule, attendance, payments, staff attendance (one branch) |
| Accountant | `accountant.chilonzor`, `accountant.bashlik`, `accountant.quyliq` | Students, payments, expenses, salaries, reports, activity log (one branch) |
| Teacher | first name, e.g. `kamola`, `dilshod`, `nigora` | Their own groups and students |

What each role can open is set in `ROLE_SECTIONS` in `src/app/permissions.ts`. The owner can add staff accounts, move them between branches and turn them off at **Owner → Users & access**; a turned-off account can't sign in.

This only shapes what the demo shows. Passwords aren't checked by a server, only the signed-in user's id is remembered in `localStorage` (`sherov-school:session`), and anyone with browser developer tools can switch accounts. It must be replaced by real authentication and server-side permission checks before real data is used. **Owner (Mr. Sherzod):** sign in at `/owner/login` (linked from the main sign-in page) with username `owner` and password `owner-demo-2026`. These are a temporary development login set in `OWNER_DEMO_CREDENTIALS` in `src/lib/auth.ts`; change them there. The owner's session is kept in `sessionStorage`, so it lasts until sign-out or until the browser tab is closed. The owner can't sign in on the shared page, and the administrator and teacher accounts can't open owner pages.

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
- Owner: `/owner/login`, `/owner` (overview), `/owner/branches`, `/owner/finance`, `/owner/teachers` (rating, bonuses, moving teachers), `/owner/settings`, plus every administrator page for branch work.

### Homework evaluation and progress

- Each homework records the students in the group on the day it was set. Each student gets one result: submission (not submitted, submitted, late), and once the teacher gives a score out of 100, an evaluation with feedback, date and who evaluated it.
- Student indicators (`lib/performance.ts`) are separate numbers: average homework score, completion rate (handed in ÷ homework past its deadline), attendance rate, number evaluated, and a trend (average of the last 3 scores against the 3 before, ±5 points). The label (Excellent 85+, Good 70–84, Needs improvement) comes from the average score only and needs at least 2 scores. **Nothing combines attendance and homework into a ranking**; that formula is still to be decided.
- The same functions can later feed a parent view (what was set, whether it was handed in, score and feedback). Teacher notes are kept separately and are for staff only.

### Lessons, grades, salary and teacher rating

- **Lesson sheet** (attendance + grades on one screen): every student starts as present. The teacher picks a mark (Absent, Late, or a grade 5–1) and taps the students it applies to; "Give 4 to the 7 not graded yet" fills the rest. Keys: 1–5, A, L, C. Grades are stored on the lesson (`AttendanceRecord.grades`).
- **Salary** (`lib/salary.ts`): tuition *paid* for a month by students in the teacher's groups × the teacher's share (`Teacher.salaryPercent`, set by the administrator in the teacher form; demo shares are 30–50%). Teachers see only the result, hidden behind ***** until they tap the eye.
- **Teacher rating** (`lib/rating.ts`): a score out of 100 per month from lessons recorded (25), student attendance (20), homework checked (20), students graded (15) and groups filled (20). Change `RATING_WEIGHTS` to rebalance. How high the grades are doesn't count. The top 3 (`BONUS_PLACES`) are marked as bonus places.
- The older teacher files `TeacherDashboardPage.tsx`, `MyGroupsPage.tsx`, `GroupDetailPage.tsx`, `StatStrip.tsx` and `ClassList.tsx` are no longer used and can be deleted.

### Owner portal

- **Overview**: organisation totals (active students, collected this month compared with the same point last month, overdue tuition, attendance over 30 days, open enquiries); the three **branches side by side** (students, seats filled, collected, overdue, attendance, joined / left, enquiries), with the weakest figure in each column marked; and **Where to look**, the biggest open issues per branch taken from each administrator's task list, each with a button into that branch.
- **Branch switcher** (top of every page): the owner can use every administrator page (students, admissions, payments, groups and so on) for one branch or for all branches. Owner pages always cover everything. Adding a teacher, room or enquiry asks for a branch first. Each branch's numbers are exactly what its administrator sees (`lib/owner.ts` reuses the administrator's view).
- **Branches**: each branch's address, phone (editable), administrator, size and this month's numbers, with a button to open it.
- **Finance**: tuition collected by branch for six months (chart and table, CSV export), what is still owed per branch, how people paid this month, and teacher pay for the month (share of tuition paid plus bonuses).
- **Teachers & rating**: the monthly rating (last month or this month so far) with each part shown; record a **bonus** for any teacher (top 3 suggested); every teacher across branches with **Move to another branch**. A move is refused while the teacher still has groups (groups stay at their branch), keeps a branch history, and notifies the teacher.
- **Owner settings**: courses for the whole school, the branch administrators, a link to the centre settings and demo-data reset, and a note on the temporary login.

### Administrator portal

The sidebar follows a working day: Dashboard; **Admissions** (Leads & trials); People (Students, Teachers); Teaching (Groups, Schedule, Attendance, Assessments); Finance (Payments, Expenses, Teacher salaries, Reports); Office (Staff attendance, Activity log); Settings. Reception and accountants see only their part of it.

- **Dashboard** answers "what do I need to do today?": five numbers (active students, classes today, attendance today, collected this month, overdue tuition), then **Today's tasks** (trial lessons today, missing attendance, trial results not recorded, overdue tuition, new enquiries to call back, groups whose teacher is on leave, repeated absences, full groups), each with an action and an expandable list, then today's classes. Charts are on Reports. The bell shows the same tasks.
- **Students** list shows the main parent and their phone (with copy), attendance %, tuition and status; click a row to open the profile. Search (here and in the header) also finds students by a parent's name or phone. **Current** shows active and paused students; **Archive** holds students who left or graduated, with all their history. Export CSV exports the list as filtered.
- **Student lifecycle**: Active, Paused (keeps the seat, not billed), Left, Graduated. **Change status** asks for a date and a reason. **Transfer** moves a student to another group from a chosen date, with an optional reason and a choice of keeping their price or taking the new group's fee. Leaving, graduating and transferring end the old group membership instead of deleting it, so group history and reports stay correct (`lib/student-lifecycle.ts`, `SchoolData.enrollments`, `SchoolData.studentEvents`). Delete is only for records added by mistake.
- **Discounts**: when a student's monthly price differs from the group's fee, the form asks for the kind (discount, scholarship, special price) and a reason, shown on the profile and in exports.
- **Student profile**: parents first (copyable phones), personal details, study details with **group history**, tuition (price and why it differs, owed, overdue, payments with who recorded them), attendance summary with full history, homework progress on the same 1–5 scale teachers use, **assessment results**, and a **History** timeline (enrolment, transfers, status and price changes, payments). There is no overall ranking yet: each number stands on its own until the formula is agreed.
- **Add / edit student** form has four sections: student, parent / guardian (up to three), group, tuition. When editing, group and status are changed with Transfer and Change status so the history is kept.
- **Admissions** (`/leads`): enquiry → contacted → trial scheduled → trial done (with level placement) → enrolled, or lost with a reason. Each enquiry page shows one obvious next step. **Enroll as student** opens the student form already filled in (name, parent, phone, recommended group) and links the new student to the enquiry. Trial lessons today and missing trial results appear on the dashboard.
- **Assessments** (`/assessments`): level tests, monthly tests, midterms and finals for a group, scored out of any maximum (e.g. 50 or 100), with absent students and comments. Planned tests are listed first; results show on each student's profile. Teachers don't enter assessments in their portal yet.
- **Teachers**: click a teacher for their profile: contact, branch (and earlier branches), groups with attendance, the next 7 days of classes, this month's pay so far, and this month's work measures (lessons recorded, homework checked and so on). Only the owner can move a teacher between branches (Owner portal → Teachers & rating).
- **Courses and rooms** are lists in Settings, not fixed in code: add a course (e.g. Arabic) or turn one off; add, rename or remove your branch's rooms. Group forms choose from them; two running groups can't share a room at the same time.
- **Payments** opens on **Who hasn't paid** (overdue first, parent to call, one-click Record payment, Export CSV); **Payment history** is the second tab and shows who recorded each payment.
- **Exports**: students, debtors, payments, expenses, activity and the new report tables offer **Excel (.xlsx)** and CSV; attendance, teachers, enquiries and the first four report tables are CSV. The .xlsx writer (`lib/xlsx.ts`) has no dependencies. PDF = the browser's print dialog ("Save as PDF") on a receipt.
- **Receipts** (`/payments/:id/receipt`, the receipt icon on each payment): numbered per branch (e.g. `CH-000123`), printable, with every correction listed. **Refund** keeps the payment on record as refunded with a reason.
- **Expenses** (`/expenses`): rent, bills, salaries of office staff, purchases; by month and category, with edit, delete and export.
- **Teacher salaries** (`/salaries`): what each teacher earned for a month under their pay rule (percentage of tuition, fixed, or fixed + percentage, set on the teacher form), what was paid out, and what is left. **Pay** records a payout.
- **Staff attendance** (`/staff-attendance`): mark office staff and teachers present, late or absent for a day, with arrival time and a note; month summary below.
- **Activity log** (`/activity`): every recorded change with who did it, filterable and exportable.
- **Reports** also include profit and loss (revenue − expenses − teacher pay), retention and leave reasons, student and group rankings (score = average of homework score, test % and attendance %; parts without data are skipped) and teacher performance.
- **Lists in Settings**: payment methods, expense categories, student tags, pause reasons, leave reasons and lead sources are edited in Settings → Lists, not in code. Turning an item off hides it from forms but keeps it on old records. Courses have levels and a usual fee; a new group picks a level and starts from that fee.
- **Students** can have tags (filter on the Students page), **extra lessons** (planned / done / cancelled, with a fee and paid flag) and a **calls and messages** log; enquiries have the same log and a **Board** view by stage.
- **Excused** is a fourth attendance mark. It doesn't count against the attendance rate.
- **Translations**: `src/i18n` holds the message catalogue and `t()`; the sidebar uses it. Uzbek and Russian can be added there and the rest of the screens moved over gradually.
- Teachers can add a short comment per student when checking homework (Comment mark, key M). The comment is saved with the grade and shows on the student profile.

## Not built yet

- Real backend, database and authentication (sign-in is a labelled demo; permissions are enforced only in the browser)
- Adding or removing branches (the three branches are fixed in the demo data; staff accounts can now be added)
- Real passwords, password resets and per-account permissions beyond the role lists
- Salary payouts are recorded, not paid: money moves outside the app
- Students and parents can't hand in or view homework yet: teachers record who handed it in. Notifications are in-app only
- Centre settings are shared by all branches
- Real payment processing (Click / Payme integration); receipts are printable records, not fiscal receipts
- Multi-device sync; data stays in one browser
- Sending SMS or Telegram messages: calls and messages are logged by staff, nothing is sent from the app. No internal chat
- Parent and student portal
- A month view and a per-room view of the schedule
- Translations (the interface is English only; the foundation is in `src/i18n`)
- Assessments in the teacher portal, and reusable exam templates
- Editing a group's room by id: groups store the room's name; renaming a room in Settings updates its groups
