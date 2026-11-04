import { Navigate, Route, Routes, useSearchParams } from 'react-router'
import { AppLayout } from './AppLayout'
import { LoginPage } from './LoginPage'
import { RequireRole } from './RequireRole'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { StudentsPage } from '../features/students/StudentsPage'
import { StudentDetailPage } from '../features/students/StudentDetailPage'
import { TeachersPage } from '../features/teachers/TeachersPage'
import { GroupsPage } from '../features/groups/GroupsPage'
import { AttendancePage } from '../features/attendance/AttendancePage'
import { SchedulePage } from '../features/schedule/SchedulePage'
import { PaymentsPage } from '../features/payments/PaymentsPage'
import { ReportsPage } from '../features/reports/ReportsPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { TeacherDetailPage } from '../features/teachers/TeacherDetailPage'
import { LeadsPage } from '../features/leads/LeadsPage'
import { LeadDetailPage } from '../features/leads/LeadDetailPage'
import { AssessmentsPage } from '../features/assessments/AssessmentsPage'
import { AssessmentDetailPage } from '../features/assessments/AssessmentDetailPage'
import { HomePage } from '../features/teacher/HomePage'
import { GroupPage } from '../features/teacher/group/GroupPage'
import { StatisticsPage } from '../features/teacher/StatisticsPage'
import { ProfilePage } from '../features/teacher/ProfilePage'
import { MyStudentsPage } from '../features/teacher/MyStudentsPage'
import { HomeworkPage } from '../features/teacher/HomeworkPage'
import { HomeworkDetailPage } from '../features/teacher/HomeworkDetailPage'
import { StudentProfilePage } from '../features/teacher/StudentProfilePage'
import { NotificationsPage } from '../features/teacher/NotificationsPage'
import { NotFoundPage } from './NotFoundPage'
import { OwnerLoginPage } from './OwnerLoginPage'
import { OwnerOverviewPage } from '../features/owner/OwnerOverviewPage'
import { OwnerBranchesPage } from '../features/owner/OwnerBranchesPage'
import { OwnerFinancePage } from '../features/owner/OwnerFinancePage'
import { OwnerTeachersPage } from '../features/owner/OwnerTeachersPage'
import { OwnerSettingsPage } from '../features/owner/OwnerSettingsPage'
import { OwnerUsersPage } from '../features/owner/OwnerUsersPage'
import { ExpensesPage } from '../features/expenses/ExpensesPage'
import { SalariesPage } from '../features/salaries/SalariesPage'
import { StaffAttendancePage } from '../features/staff/StaffAttendancePage'
import { ActivityPage } from '../features/activity/ActivityPage'
import { ReceiptPage } from '../features/payments/ReceiptPage'

// The owner has their own pages under /owner and can also use every administrator page (for any branch).
const MANAGERS = ['admin', 'reception', 'accountant', 'owner'] as const
const OWNER = ['owner'] as const
const TEACHERS = ['teacher'] as const

export function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="owner/login" element={<OwnerLoginPage />} />

      <Route
        path="owner"
        element={
          <RequireRole roles={OWNER}>
            <AppLayout />
          </RequireRole>
        }
      >
        <Route index element={<OwnerOverviewPage />} />
        <Route path="branches" element={<OwnerBranchesPage />} />
        <Route path="finance" element={<OwnerFinancePage />} />
        <Route path="teachers" element={<OwnerTeachersPage />} />
        <Route path="users" element={<OwnerUsersPage />} />
        <Route path="settings" element={<OwnerSettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route
        element={
          <RequireRole roles={MANAGERS}>
            <AppLayout />
          </RequireRole>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/:studentId" element={<StudentDetailPage />} />
        <Route path="teachers" element={<TeachersPage />} />
        <Route path="teachers/:teacherId" element={<TeacherDetailPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="leads/:leadId" element={<LeadDetailPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="assessments" element={<AssessmentsPage />} />
        <Route path="assessments/:assessmentId" element={<AssessmentDetailPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="payments/:paymentId/receipt" element={<ReceiptPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="salaries" element={<SalariesPage />} />
        <Route path="staff-attendance" element={<StaffAttendancePage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route
        path="teacher"
        element={
          <RequireRole roles={TEACHERS}>
            <AppLayout />
          </RequireRole>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="schedule" element={<SchedulePage />} />
        {/* Groups are listed on Home; attendance and grades are taken inside a group. */}
        <Route path="groups" element={<Navigate to="/teacher" replace />} />
        <Route path="groups/:groupId" element={<GroupPage />} />
        <Route path="attendance" element={<OldAttendanceLink />} />
        <Route path="statistics" element={<StatisticsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="students" element={<MyStudentsPage />} />
        <Route path="students/:studentId" element={<StudentProfilePage />} />
        <Route path="homework" element={<HomeworkPage />} />
        <Route path="homework/:homeworkId" element={<HomeworkDetailPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

/** Older links (e.g. in notifications) to /teacher/attendance?group=…&date=… open that lesson in its group. */
function OldAttendanceLink() {
  const [params] = useSearchParams()
  const group = params.get('group')
  const date = params.get('date')
  if (!group) return <Navigate to="/teacher" replace />
  return <Navigate to={`/teacher/groups/${group}${date ? `?lesson=${date}` : ''}`} replace />
}
