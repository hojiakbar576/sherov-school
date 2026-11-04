import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ClipboardList, Plus } from 'lucide-react'
import { ASSESSMENT_KINDS } from '../../types'
import { useSchool } from '../../data/school-context'
import { useListParams } from '../../hooks/useListParams'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { Badge } from '../../components/ui/Badge'
import { EmptyState, TableScroll, td, th } from '../../components/ui/misc'
import { toISODate } from '../../lib/dates'
import { formatDate, formatPercent } from '../../lib/format'
import { assessmentKindLabel, summarizeAssessment } from '../../lib/assessments'
import { cn } from '../../lib/cn'
import { AssessmentFormDialog } from './AssessmentFormDialog'

const FILTERS = ['group', 'kind'] as const

/** Tests and exams for the branch's groups, newest first; upcoming ones on top. */
export function AssessmentsPage() {
  const { data, now } = useSchool()
  const navigate = useNavigate()
  const { values, set } = useListParams(FILTERS)
  const [creating, setCreating] = useState(false)
  const today = toISODate(now)
  const group = useMemo(() => new Map(data.groups.map((g) => [g.id, g])), [data.groups])

  const rows = data.assessments
    .filter((a) => (!values.group || a.groupId === values.group) && (!values.kind || a.kind === values.kind))
    .sort((a, b) => b.date.localeCompare(a.date))
  const upcoming = rows.filter((a) => a.date >= today && a.results.length === 0).reverse()
  const past = rows.filter((a) => !upcoming.includes(a))

  const table = (items: typeof rows, label: string) => (
    <TableScroll>
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">{label}</caption>
        <thead className="border-y border-line bg-canvas">
          <tr>
            <th scope="col" className={th}>Assessment</th>
            <th scope="col" className={th}>Group</th>
            <th scope="col" className={th}>Date</th>
            <th scope="col" className={cn(th, 'text-right')}>Results</th>
            <th scope="col" className={cn(th, 'text-right')}>Average</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((a) => {
            const g = group.get(a.groupId)
            const s = summarizeAssessment(a)
            const expected = data.students.filter((st) => st.groupId === a.groupId && st.status === 'active').length
            return (
              <tr key={a.id} onClick={() => navigate(`/assessments/${a.id}`)} className="cursor-pointer hover:bg-canvas/70">
                <td className={td}>
                  <Link to={`/assessments/${a.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink hover:text-brand hover:underline">
                    {a.title}
                  </Link>
                  <p className="text-xs text-ink-muted">{assessmentKindLabel[a.kind]} · out of {a.maxScore}</p>
                </td>
                <td className={td}>
                  {g?.name ?? '—'}
                  <p className="text-xs text-ink-muted">{g?.subject}</p>
                </td>
                <td className={cn(td, 'num whitespace-nowrap')}>{a.date === today ? 'Today' : formatDate(a.date)}</td>
                <td className={cn(td, 'num text-right')}>
                  {a.results.length === 0 ? <Badge tone={a.date <= today ? 'warning' : 'neutral'}>{a.date <= today ? 'Results needed' : 'Planned'}</Badge> : `${s.taken} of ${Math.max(expected, a.results.length)}`}
                </td>
                <td className={cn(td, 'num text-right font-medium', s.averagePercent !== null && s.averagePercent < 0.6 ? 'text-danger' : 'text-ink')}>
                  {s.averagePercent === null ? '—' : formatPercent(s.averagePercent)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </TableScroll>
  )

  return (
    <>
      <PageHeader
        title="Assessments"
        description="Level tests, monthly tests and exams for each group. Results show on each student’s profile."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)} disabled={data.groups.length === 0}>
            <Plus aria-hidden />
            New assessment
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:flex">
        <Select aria-label="Filter by group" value={values.group} onChange={(e) => set('group', e.target.value)} className="sm:w-60">
          <option value="">All groups</option>
          {data.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by type" value={values.kind} onChange={(e) => set('kind', e.target.value)} className="sm:w-44">
          <option value="">All types</option>
          {ASSESSMENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {assessmentKindLabel[k]}
            </option>
          ))}
        </Select>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface">
          <EmptyState icon={ClipboardList} title="No assessments yet" action={<Button onClick={() => setCreating(true)}>New assessment</Button>}>
            Add a level test, monthly test or exam to start tracking results.
          </EmptyState>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section aria-labelledby="upcoming-title" className="rounded-panel border border-line bg-surface">
              <h2 id="upcoming-title" className="px-5 pt-4 pb-3 text-[0.9375rem] font-semibold text-ink">
                Planned
              </h2>
              {table(upcoming, 'Planned assessments')}
            </section>
          )}
          <section aria-labelledby="past-title" className="rounded-panel border border-line bg-surface">
            <h2 id="past-title" className="px-5 pt-4 pb-3 text-[0.9375rem] font-semibold text-ink">
              Results
            </h2>
            {past.length ? table(past, 'Assessments with results') : <p className="px-5 pb-5 text-sm text-ink-muted">No results yet.</p>}
          </section>
        </div>
      )}

      <AssessmentFormDialog open={creating} onClose={() => setCreating(false)} defaultGroup={values.group} onSaved={(id) => navigate(`/assessments/${id}`)} />
    </>
  )
}
