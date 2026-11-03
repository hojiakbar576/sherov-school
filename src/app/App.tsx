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

// The owner portal comes later; until then the owner role would use the administrator pages.
const MANAGERS = ['admin', 'owner'] as const
const TEACHERS = ['teacher'] as const

export function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />

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
        <Route path="groups" element={<GroupsPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="payments" element={<PaymentsPage />} />
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
