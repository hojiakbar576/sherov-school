import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, CircleAlert, Lock, NotebookPen, Plus, Trophy } from 'lucide-react'
import type { AttendanceRecord, ISODate, MonthKey, Student } from '../../../types'
import { useSchool } from '../../../data/school-context'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { Avatar, EmptyState } from '../../../components/ui/misc'
import { addMonths, monthKey, parseISODate, toISODate } from '../../../lib/dates'
import { formatDate, formatDayMonth, formatMonth, formatPercent, groupDaysLabel } from '../../../lib/format'
import { meetsOn, endTime } from '../../../lib/schedule'
import { summarizeMarks } from '../../../lib/metrics'
import { homeworkProgress } from '../../../lib/performance'
import { cn } from '../../../lib/cn'
import { averageGrade, lessonDates, unmarkedLessons } from '../teacher-metrics'
import { LessonSheet } from './LessonSheet'
import { MonthGrid } from './MonthGrid'
import { formatAverage } from './grade-style'
import { tr } from '../../../i18n'
import { inGroup } from '../../../lib/membership'

const TABS = [
  { id: 'attendance', label: tr("Attendance") },
  { id: 'grades', label: tr("Grades") },
  { id: 'homework', label: tr("Homework") },
  { id: 'ranking', label: tr("Ranking") },
] as const
type Tab = (typeof TABS)[number]['id']

/** One group: the month's journal (attendance and grades), homework and a student ranking. */
export function GroupPage() {
  const { groupId } = useParams()
  const { data, now } = useSchool()
  const [params, setParams] = useSearchParams()
  const today = toISODate(now)
  const group = data.groups.find((g) => g.id === groupId)

  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'attendance') as Tab
  const monthParam = params.get('month')
  const month: MonthKey = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : monthKey(now)
  const lesson = params.get('lesson')
  const openLesson = lesson && /^\d{4}-\d{2}-\d{2}$/.test(lesson) && lesson <= today ? lesson : null

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: key !== 'lesson' },
    )

  const records = useMemo(() => data.attendance.filter((r) => r.groupId === groupId), [data.attendance, groupId])
  const monthRecords = useMemo(() => records.filter((r) => r.date.startsWith(month)), [records, month])

  const students = useMemo<Student[]>(() => {
    const current = data.students.filter((s) => inGroup(s, groupId) && (s.status === 'active' || s.status === 'paused'))
    const ids = new Set(current.map((s) => s.id))
    const earlier = monthRecords
      .flatMap((r) => Object.keys(r.marks))
      .filter((id, i, all) => !ids.has(id) && all.indexOf(id) === i)
      .map((id) => data.students.find((s) => s.id === id))
      .filter((s): s is Student => Boolean(s))
    return [...current, ...earlier].sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [data.students, groupId, monthRecords])

  if (!group) {
    return (
      <div className="rounded-2xl border border-line bg-surface">
        <EmptyState icon={Lock} title={tr("This group isn’t one of yours")} action={<ButtonLink to="/teacher">{tr("Back to home")}</ButtonLink>}>
          {tr("You can only open groups you teach. It may also have been deleted.")}
        </EmptyState>
      </div>
    )
  }

  const dates = lessonDates(group, records, month)
  const pending = unmarkedLessons(group, records, now)
  const todayLesson = meetsOn(group, today)
  const todaySaved = records.some((r) => r.date === today)
  const activeCount = data.students.filter((s) => inGroup(s, group.id) && s.status === 'active').length
  const monthSummary = summarizeMarks(monthRecords)

  return (
    <div className="space-y-5">
      <div>
        <Link to="/teacher" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ChevronLeft aria-hidden className="size-4" />
          {tr("Home")}
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-ink">{group.name}</h1>
            <p className="num mt-1 text-ink-muted">
              {groupDaysLabel(group)}, {group.startTime}–{endTime(group)} · {group.room} · {activeCount}{' '}{tr("students")}
            </p>
          </div>
          {todayLesson && (
            <Button variant="primary" onClick={() => setParam('lesson', today)} className="h-11 rounded-xl px-5">
              {todaySaved ? tr("Open today’s lesson") : tr("Mark today’s lesson")}
            </Button>
          )}
        </div>
      </div>

      {pending.length > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-warning-mark/40 bg-warning-soft px-4 py-3 text-sm">
          <CircleAlert aria-hidden className="size-5 shrink-0 text-warning" />
          <p className="flex-1 text-ink">
            {pending.length === 1 ? tr("1 lesson has") : tr("{0} lessons have", pending.length)}{' '}{tr("no attendance yet. Unmarked lessons lower your rating.")}
          </p>
          <div className="flex flex-wrap gap-2">
            {pending.map((date) => (
              <Button key={date} size="sm" onClick={() => setParam('lesson', date)} className="rounded-lg">
                {tr("Mark")}{' '}{formatDayMonth(parseISODate(date))}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label={tr("Group sections")} className="inline-flex flex-wrap gap-1 rounded-2xl border border-line bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setParam('tab', t.id === 'attendance' ? null : t.id)}
              className={cn(
                'h-10 rounded-xl px-4 text-sm font-medium transition-colors',
                tab === t.id ? 'bg-brand text-white' : 'text-ink-muted hover:bg-subtle hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {(tab === 'attendance' || tab === 'grades' || tab === 'ranking') && (
          <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface p-1">
            <MonthButton label={tr("Previous month")} onClick={() => setParam('month', addMonths(month, -1))}>
              <ChevronLeft className="size-4" />
            </MonthButton>
            <span className="min-w-36 text-center text-sm font-medium text-ink">{formatMonth(month)}</span>
            <MonthButton label={tr("Next month")} onClick={() => setParam('month', addMonths(month, 1))} disabled={month >= monthKey(now)}>
              <ChevronRight className="size-4" />
            </MonthButton>
          </div>
        )}
      </div>

      {(tab === 'attendance' || tab === 'grades') &&
        (students.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface">
            <EmptyState icon={Lock} title={tr("No students in this group yet")}>
              {tr("Your branch administrator adds students to groups.")}
            </EmptyState>
          </div>
        ) : (
          <>
            <MonthGrid
              group={group}
              mode={tab}
              dates={dates}
              students={students}
              records={monthRecords}
              today={today}
              onOpenLesson={(date) => setParam('lesson', date)}
            />
            <p className="num text-sm text-ink-muted">
              {tab === 'attendance' ? tr("{0}: {1} lessons saved, {2}. Click a day to mark it; a red dot means not marked yet.", formatMonth(month), monthRecords.length, monthSummary.rate === null ? tr("no marks yet") : tr("{0} of students came", formatPercent(monthSummary.rate))) : tr("Click a day to give grades: pick a grade, then tap every student who earned it.")}
            </p>
          </>
        ))}

      {tab === 'homework' && <HomeworkTab groupId={group.id} />}
      {tab === 'ranking' && <RankingTab students={students} records={monthRecords} month={month} />}

      <LessonSheet group={group} date={openLesson as ISODate | null} onClose={() => setParam('lesson', null)} />
    </div>
  )
}

function MonthButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-9 items-center justify-center rounded-xl text-ink-muted hover:bg-subtle hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function HomeworkTab({ groupId }: { groupId: string }) {
  const { data, now } = useSchool()
  const today = toISODate(now)
  const items = data.homework.filter((h) => h.groupId === groupId).sort((a, b) => b.dueDate.localeCompare(a.dueDate))
  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 px-5 py-4">
        <h2 className="font-semibold text-ink">{tr("Homework")}</h2>
        <ButtonLink to={`/teacher/homework?group=${groupId}&new=1`} variant="primary" size="sm" className="rounded-lg">
          <Plus aria-hidden />{' '}{tr("New homework")}
        </ButtonLink>
      </header>
      {items.length === 0 ? (
        <EmptyState icon={NotebookPen} title={tr("No homework set yet")} />
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {items.map((h) => {
            const p = homeworkProgress(data, h)
            return (
              <li key={h.id}>
                <Link to={`/teacher/homework/${h.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5 hover:bg-canvas">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{h.title}</span>
                    <span className="num text-xs text-ink-muted">
                      {h.dueDate < today ? tr("Was due") : tr("Due")} {formatDate(h.dueDate)}
                    </span>
                  </span>
                  <span className="num text-sm text-ink-muted">
                    {p.handedIn}/{p.assigned}{' '}{tr("handed in")}
                  </span>
                  <span className={cn('num text-sm font-medium', p.toEvaluate ? 'text-warning' : 'text-ink-muted')}>
                    {p.toEvaluate ? tr("{0} to check", p.toEvaluate) : tr("{0} checked", p.evaluated)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Students this month, best average grade first; attendance breaks ties. */
function RankingTab({ students, records, month }: { students: Student[]; records: AttendanceRecord[]; month: MonthKey }) {
  const rows = students
    .map((s) => {
      const own = records.filter((r) => r.marks[s.id])
      const marks = summarizeMarks(own.map((r) => ({ ...r, marks: { [s.id]: r.marks[s.id] } })))
      const grades = own.filter((r) => r.grades?.[s.id]).length
      return { student: s, avg: averageGrade(own, s.id), rate: marks.rate, grades }
    })
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0) || (b.rate ?? 0) - (a.rate ?? 0) || a.student.fullName.localeCompare(b.student.fullName))

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="px-5 py-4">
        <h2 className="font-semibold text-ink">{tr("Student ranking,")}{' '}{formatMonth(month)}</h2>
        <p className="text-sm text-ink-muted">{tr("By average lesson grade; attendance decides ties.")}</p>
      </header>
      <ol className="divide-y divide-line border-t border-line">
        {rows.map((row, i) => (
          <li key={row.student.id} className="flex items-center gap-4 px-5 py-3">
            <span
              className={cn(
                'num flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                i === 0 ? 'bg-accent text-white' : i < 3 ? 'bg-accent-soft text-accent-ink' : 'bg-subtle text-ink-muted',
              )}
            >
              {i < 3 ? <Trophy aria-label={tr("Place {0}", i + 1)} className="size-4" /> : i + 1}
            </span>
            <Link to={`/teacher/students/${row.student.id}`} className="flex min-w-0 flex-1 items-center gap-3 font-medium text-ink hover:underline">
              <Avatar name={row.student.fullName} size="sm" />
              <span className="truncate">{row.student.fullName}</span>
            </Link>
            <span className="num w-20 text-right text-sm text-ink-muted">{row.grades}{' '}{tr("grades")}</span>
            <span className="num w-16 text-right text-sm text-ink-muted">{row.rate === null ? '—' : formatPercent(row.rate)}</span>
            <span className="num w-12 text-right text-lg font-semibold text-ink">{formatAverage(row.avg)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
