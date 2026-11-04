import { useMemo } from 'react'
import { History } from 'lucide-react'
import type { ActivityType } from '../../types'
import { useSchool } from '../../data/school-context'
import { useListParams } from '../../hooks/useListParams'
import { PageHeader } from '../../components/ui/PageHeader'
import { Select } from '../../components/ui/Field'
import { EmptyState, SearchInput, TableScroll, td, th } from '../../components/ui/misc'
import { ExportButtons } from '../../components/ui/ExportButtons'
import { toISODate } from '../../lib/dates'
import { formatRelative } from '../../lib/format'
import { roleLabel } from '../../lib/auth'
import { cn } from '../../lib/cn'

const TYPE_LABEL: Record<ActivityType, string> = {
  student_added: 'Student added',
  student_updated: 'Student changed',
  student_removed: 'Student deleted',
  payment_recorded: 'Payment',
  attendance_saved: 'Attendance',
  group_changed: 'Group or transfer',
  teacher_changed: 'Teacher',
  settings_changed: 'Settings and lists',
  homework_changed: 'Homework',
  lead_changed: 'Admissions',
  assessment_changed: 'Assessment',
  owner_changed: 'Owner',
  expense_changed: 'Expense',
  salary_changed: 'Salary',
  user_changed: 'Accounts',
  contact_logged: 'Call or message',
  staff_attendance: 'Staff attendance',
}

const FILTERS = ['q', 'type', 'who'] as const

/**
 * The audit history: every recorded change, newest first, with who did it.
 * The demo keeps the latest 100 changes; a database would keep all of them.
 */
export function ActivityPage() {
  const { data, now, owner } = useSchool()
  const { values, set } = useListParams(FILTERS)
  const users = (owner?.data ?? data).users
  const userById = new Map(users.map((u) => [u.id, u]))
  const branchName = new Map((owner?.data ?? data).branches.map((b) => [b.id, b.name]))

  const rows = useMemo(() => {
    const q = values.q.trim().toLowerCase()
    return [...data.activity]
      .filter((a) => (!values.type || a.type === values.type) && (!values.who || a.byUserId === values.who) && (!q || `${a.title} ${a.detail}`.toLowerCase().includes(q)))
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [data.activity, values])
  const people = Array.from(new Set(data.activity.map((a) => a.byUserId).filter((x): x is string => Boolean(x))))

  return (
    <>
      <PageHeader
        title="Activity history"
        description="Every change recorded in the app, newest first, and who made it. Use it to check what happened and when."
        actions={
          <ExportButtons
            name="activity"
            date={toISODate(now)}
            disabled={rows.length === 0}
            rows={() => [
              ['When', 'What', 'Details', 'Who', 'Branch'],
              ...rows.map((a) => [a.at.replace('T', ' ').slice(0, 16), a.title, a.detail, a.byUserId ? (userById.get(a.byUserId)?.fullName ?? a.byUserId) : 'Sample data', a.branchId ? branchName.get(a.branchId) : 'Whole school']),
            ]}
          />
        }
      />
      <section aria-label="Activity" className="rounded-panel border border-line bg-surface">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput label="Search activity" value={values.q} onChange={(v) => set('q', v)} placeholder="Name, amount or word" />
          <Select aria-label="Kind of change" value={values.type} onChange={(e) => set('type', e.target.value)} className="sm:w-52">
            <option value="">Every kind of change</option>
            {(Object.keys(TYPE_LABEL) as ActivityType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
          <Select aria-label="Who" value={values.who} onChange={(e) => set('who', e.target.value)} className="sm:w-52">
            <option value="">Anyone</option>
            {people.map((id) => (
              <option key={id} value={id}>
                {userById.get(id)?.fullName ?? id}
              </option>
            ))}
          </Select>
          <p className="num text-sm text-ink-muted sm:ml-auto">{rows.length} changes</p>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={History} title="Nothing matches" />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-canvas">
                <tr className="border-b border-line">
                  <th scope="col" className={th}>When</th>
                  <th scope="col" className={th}>What happened</th>
                  <th scope="col" className={th}>Who</th>
                  {owner && <th scope="col" className={th}>Branch</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((a) => {
                  const who = a.byUserId ? userById.get(a.byUserId) : undefined
                  return (
                    <tr key={a.id}>
                      <td className={cn(td, 'whitespace-nowrap text-ink-muted')} title={a.at}>
                        {formatRelative(a.at, now)}
                      </td>
                      <td className={td}>
                        <span className="block font-medium text-ink">{a.title}</span>
                        <span className="block text-xs text-ink-muted">{a.detail}</span>
                      </td>
                      <td className={td}>
                        {who ? (
                          <>
                            <span className="block text-ink">{who.fullName}</span>
                            <span className="block text-xs text-ink-muted">{roleLabel[who.role]}</span>
                          </>
                        ) : (
                          <span className="text-ink-faint">Sample data</span>
                        )}
                      </td>
                      {owner && <td className={cn(td, 'text-ink-muted')}>{a.branchId ? branchName.get(a.branchId) : 'Whole school'}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>
    </>
  )
}
