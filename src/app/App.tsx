import { Route, Routes } from 'react-router'
import { AppLayout } from './AppLayout'
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
import { NotFoundPage } from './NotFoundPage'

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
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
    </Routes>
  )
}
