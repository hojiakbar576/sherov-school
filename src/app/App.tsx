import { Route, Routes } from 'react-router'
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
import { TeacherDashboardPage } from '../features/teacher/TeacherDashboardPage'
import { MyGroupsPage } from '../features/teacher/MyGroupsPage'
import { GroupDetailPage } from '../features/teacher/GroupDetailPage'
import { MyStudentsPage } from '../features/teacher/MyStudentsPage'
import { HomeworkPage } from '../features/teacher/HomeworkPage'
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
        <Route index element={<TeacherDashboardPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="groups" element={<MyGroupsPage />} />
        <Route path="groups/:groupId" element={<GroupDetailPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="students" element={<MyStudentsPage />} />
        <Route path="homework" element={<HomeworkPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
