import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-react'
import type { Group, MonthKey, Student } from '../../types'
import { useSchool } from '../../data/school-context'
import { ButtonLink, IconButton } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/misc'
import { addMonths, monthKey, toISODate } from '../../lib/dates'
import { formatMonth, formatPercent } from '../../lib/format'
import { summarizeMarks } from '../../lib/metrics'
import { cn } from '../../lib/cn'
import { lessonDates } from '../teacher/teacher-metrics'
import { MonthGrid } from '../teacher/group/MonthGrid'
import { tr } from '../../i18n'
import { inGroup } from '../../lib/membership'

/**
 * A group's month, LC UP style: students down the side, lesson days across.
 * The month and attendance/grades view live in the address (?month=&view=).
 * `canMark` adds "Take attendance" and makes the days clickable.
 */
export function AttendanceJournal({ group, canMark = true }: { group: Group; canMark?: boolean }) {
  const { data, now } = useSchool()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const today = toISODate(now)
  const monthParam = params.get('month')
  const month: MonthKey = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : monthKey(now)
  const mode = params.get('view') === 'grades' ? 'grades' : 'attendance'
  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )

  const records = useMemo(() => data.attendance.filter((r) => r.groupId === group.id), [data.attendance, group.id])
  const monthRecords = useMemo(() => records.filter((r) => r.date.startsWith(month)), [records, month])
  // Today's students, then anyone marked in this group during the month (moved or left since).
  const students = useMemo<Student[]>(() => {
    const current = data.students.filter((s) => inGroup(s, group.id) && (s.status === 'active' || s.status === 'paused')).sort((a, b) => a.fullName.localeCompare(b.fullName))
    const ids = new Set(current.map((s) => s.id))
    const earlier = [...new Set(monthRecords.flatMap((r) => Object.keys(r.marks)))]
      .filter((id) => !ids.has(id))
      .map((id) => data.students.find((s) => s.id === id))
      .filter((s): s is Student => Boolean(s))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
    return [...current, ...earlier]
  }, [data.students, group.id, monthRecords])

  const summary = summarizeMarks(monthRecords)
  const open = (date: string) => navigate(`/attendance?date=${date}&group=${group.id}`)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <IconButton label={tr("Previous month")} onClick={() => setParam('month', addMonths(month, -1))}>
            <ChevronLeft />
          </IconButton>
          <span className="min-w-36 text-center text-sm font-medium text-ink">{formatMonth(month)}</span>
          <IconButton label={tr("Next month")} onClick={() => setParam('month', addMonths(month, 1))} disabled={month >= monthKey(now)}>
            <ChevronRight />
          </IconButton>
        </div>
        <div role="group" aria-label={tr("Show")} className="flex rounded-control border border-line p-0.5 text-sm">
          {(['attendance', 'grades'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setParam('view', m === 'grades' ? 'grades' : null)}
              className={cn('rounded-[calc(var(--radius-control)-2px)] px-3 py-1', mode === m ? 'bg-brand-soft font-medium text-brand-ink' : 'text-ink-muted hover:text-ink')}
            >
              {m === 'attendance' ? tr("Attendance") : tr("Grades")}
            </button>
          ))}
        </div>
        {canMark && (
          <ButtonLink to={`/attendance?date=${today}&group=${group.id}`} size="sm" className="ml-auto">
            <ClipboardCheck aria-hidden />
            {tr("Take attendance")}
          </ButtonLink>
        )}
      </div>
      {students.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={tr("No students this month")} />
      ) : (
        <MonthGrid group={group} mode={mode} dates={lessonDates(group, records, month)} students={students} records={monthRecords} today={today} onOpenLesson={canMark ? open : () => undefined} />
      )}
      <p className="mt-3 text-xs text-ink-muted">
        {canMark
          ? tr("{0}: {1} lessons saved, {2}. Click a day to open or mark that lesson; a red dot means it isn’t marked yet.", formatMonth(month), monthRecords.length, summary.rate === null ? tr("no marks yet") : tr("{0} of students came", formatPercent(summary.rate)))
          : tr("{0}: {1} lessons saved, {2}. A red dot means the lesson isn’t marked yet.", formatMonth(month), monthRecords.length, summary.rate === null ? tr("no marks yet") : tr("{0} of students came", formatPercent(summary.rate)))}
      </p>
    </div>
  )
}
