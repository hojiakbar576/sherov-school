import { useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ChevronLeft, History, Lock, NotebookPen, Phone, StickyNote, Trash2, TriangleAlert } from 'lucide-react'
import type { Grade, Student } from '../../types'
import { useSchool, useUser } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Panel } from '../../components/ui/Panel'
import { Button, ButtonLink, IconButton } from '../../components/ui/Button'
import { Field, Textarea } from '../../components/ui/Field'
import { Avatar, EmptyState, TableScroll, td, th } from '../../components/ui/misc'
import { Badge } from '../../components/ui/Badge'
import { StudentStatusBadge } from '../../components/StatusBadges'
import {
  ageOn,
  attendanceMarkLabel,
  formatDate,
  formatPercent,
  formatRelative,
  genderLabel,
  guardianRelationshipLabel,
  studentStatusLabel,
  telHref,
} from '../../lib/format'
import { studentAttendance } from '../../lib/metrics'
import { LABEL_THRESHOLDS, studentHomework, studentPerformance, trendText, type PerformanceSummary } from '../../lib/performance'
import { cn } from '../../lib/cn'
import { PerformanceBadge, ResultStatusBadge } from './LearningBadges'
import { rateTone } from './teacher-metrics'
import { GradeChip } from './group/GradeChip'
import { formatAverage } from './group/grade-style'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'homework', label: 'Homework & performance' },
  { id: 'notes', label: 'Notes' },
] as const
type TabId = (typeof TABS)[number]['id']

/** A student's profile for their teacher: details, parents, attendance, homework and notes. */
export function StudentProfilePage() {
  const { studentId } = useParams()
  const { data, now } = useSchool()
  const [params, setParams] = useSearchParams()
  // Scoped data only holds the teacher's own students.
  const student = data.students.find((s) => s.id === studentId)
  const performance = useMemo(() => (student ? studentPerformance(data, student.id, now) : null), [data, student, now])

  if (!student || !performance) {
    return (
      <div className="rounded-panel border border-line bg-surface">
        <EmptyState icon={Lock} title="This student isn’t in your groups" action={<ButtonLink to="/teacher/students">Back to my students</ButtonLink>}>
          You can only open profiles of students in groups you teach.
        </EmptyState>
      </div>
    )
  }

  const tab: TabId = TABS.some((t) => t.id === params.get('tab')) ? (params.get('tab') as TabId) : 'overview'
  const group = data.groups.find((g) => g.id === student.groupId)
  const important = data.studentNotes.filter((n) => n.studentId === student.id && n.important)

  return (
    <div className="space-y-6">
      <div>
        <Link to="/teacher/students" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ChevronLeft aria-hidden className="size-4" />
          My students
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Avatar name={student.fullName} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-[-0.015em] text-ink">{student.fullName}</h1>
              <StudentStatusBadge status={student.status} />
            </div>
            <p className="mt-0.5 text-ink-muted">
              {group ? (
                <Link to={`/teacher/groups/${group.id}`} className="hover:text-ink hover:underline">
                  {group.name}
                </Link>
              ) : (
                'No group'
              )}
              {student.dateOfBirth && ` · ${ageOn(student.dateOfBirth, now)} years old`}
            </p>
          </div>
        </div>
      </div>

      {important.length > 0 && (
        <div role="note" className="flex gap-3 rounded-panel border border-warning-mark/40 bg-warning-soft px-4 py-3 text-sm text-ink">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          <ul className="space-y-1">
            {important.map((n) => (
              <li key={n.id}>{n.text}</li>
            ))}
          </ul>
        </div>
      )}

      <SummaryStrip performance={performance} />

      <Tabs
        value={tab}
        onChange={(next) => {
          const p = new URLSearchParams(params)
          if (next === 'overview') p.delete('tab')
          else p.set('tab', next)
          setParams(p, { replace: true })
        }}
      >
        {tab === 'overview' && <OverviewTab student={student} performance={performance} />}
        {tab === 'attendance' && <AttendanceTab student={student} />}
        {tab === 'homework' && <HomeworkTab student={student} performance={performance} />}
        {tab === 'notes' && <NotesTab student={student} />}
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------- shared pieces

function Tabs({ value, onChange, children }: { value: TabId; onChange: (tab: TabId) => void; children: ReactNode }) {
  const id = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + TABS.length) % TABS.length
    onChange(TABS[next].id)
    refs.current[next]?.focus()
  }
  return (
    <div>
      <div role="tablist" aria-label="Student profile" className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 lg:mx-0 lg:px-0">
        {TABS.map((t, index) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="tab"
            id={`${id}-${t.id}`}
            aria-selected={value === t.id}
            aria-controls={`${id}-panel`}
            tabIndex={value === t.id ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap',
              value === t.id ? 'border-brand text-brand-ink' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${value}`} className="pt-6">
        {children}
      </div>
    </div>
  )
}

/** Label / value rows. Empty values show a dash so the layout never jumps. */
function Details({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-divider">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3 py-2.5 text-sm">
          <dt className="text-ink-muted">{label}</dt>
          <dd className="min-w-0 text-ink">{value ?? <span className="text-ink-faint">—</span>}</dd>
        </div>
      ))}
    </dl>
  )
}

const score = (n: number | null) => (n === null ? '—' : String(Math.round(n)))

function SummaryStrip({ performance: p }: { performance: PerformanceSummary }) {
  const items: [string, ReactNode, string][] = [
    ['Attendance', p.attendanceRate === null ? '—' : formatPercent(p.attendanceRate), 'Of all marked classes'],
    ['Homework average', score(p.averageScore), p.evaluated ? `Out of 100, from ${p.evaluated} evaluated` : 'Nothing evaluated yet'],
    ['Homework completed', p.completionRate === null ? '—' : formatPercent(p.completionRate), p.pastDeadline ? `${p.pastDeadline - p.missing} of ${p.pastDeadline} past their deadline` : 'No deadlines passed yet'],
    ['Recent trend', p.trend ? trendText[p.trend] : '—', p.trend ? 'Last 3 scores against the 3 before' : 'Needs at least 4 scores'],
  ]
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line lg:grid-cols-4">
      {items.map(([label, value, detail]) => (
        <div key={label} className="min-w-0 bg-surface px-5 py-4">
          <dt className="text-sm text-ink-muted">{label}</dt>
          <dd className="num mt-1 text-xl font-semibold text-ink">{value}</dd>
          <dd className="mt-0.5 text-xs text-ink-muted">{detail}</dd>
        </div>
      ))}
    </dl>
  )
}

// ---------------------------------------------------------------- overview

function OverviewTab({ student, performance }: { student: Student; performance: PerformanceSummary }) {
  const { data, now } = useSchool()
  const user = useUser()
  const group = data.groups.find((g) => g.id === student.groupId)
  const teacher = data.teachers.find((t) => t.id === group?.teacherId)
  const branch = data.branches.find((b) => b.id === student.branchId)

  return (
    <div className="grid items-start gap-6 xl:grid-cols-3">
      <Panel title="Personal information">
        <Details
          rows={[
            ['Full name', student.fullName],
            ['Date of birth', student.dateOfBirth && `${formatDate(student.dateOfBirth)} (age ${ageOn(student.dateOfBirth, now)})`],
            ['Gender', student.gender && genderLabel[student.gender]],
            [
              'Student phone',
              student.phone && (
                <a key="phone" href={telHref(student.phone)} className="num hover:underline">
                  {student.phone}
                </a>
              ),
            ],
            ['Address', student.address],
            ['Enrolled', formatDate(student.enrolledOn)],
            ['Status', studentStatusLabel[student.status]],
          ]}
        />
      </Panel>

      <Panel title="Parents and guardians" description={student.guardians.length > 1 ? 'Main contact first.' : undefined}>
        {student.guardians.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No parent or guardian on record.{' '}
            {student.dateOfBirth && ageOn(student.dateOfBirth, now) >= 18
              ? 'As an adult student, they are their own contact (see personal information).'
              : 'Ask the branch administrator to add one.'}
          </p>
        ) : (
          <ul className="divide-y divide-divider">
            {student.guardians.map((g, index) => (
              <li key={g.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-ink">{g.fullName}</p>
                  <Badge tone="neutral">{guardianRelationshipLabel[g.relationship]}</Badge>
                  {index === 0 && student.guardians.length > 1 && <span className="text-xs text-ink-muted">Main contact</span>}
                </div>
                <a href={telHref(g.phone)} className="num mt-1 flex items-center gap-1.5 text-sm text-ink hover:underline">
                  <Phone aria-hidden className="size-3.5 text-ink-faint" />
                  {g.phone}
                </a>
                {g.altPhone && (
                  <a href={telHref(g.altPhone)} className="num mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted hover:underline">
                    <Phone aria-hidden className="size-3.5 text-ink-faint" />
                    {g.altPhone} <span className="text-xs">(additional)</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Academic information">
        <Details
          rows={[
            ['Group', group?.name],
            ['Course', group?.subject],
            ['Teacher', teacher?.fullName ?? user.fullName],
            ['Branch', branch?.name],
            ['Enrolled', formatDate(student.enrolledOn)],
            [
              'Progress',
              <span key="progress" className="flex flex-wrap items-center gap-2">
                <PerformanceBadge label={performance.label} />
                {performance.trend && <span className="text-xs text-ink-muted">{trendText[performance.trend]}</span>}
              </span>,
            ],
          ]}
        />
        <p className="mt-3 text-xs text-ink-muted">Progress is an indicative label from homework scores only, not a ranking.</p>
      </Panel>
    </div>
  )
}

// ---------------------------------------------------------------- attendance

function AttendanceTab({ student }: { student: Student }) {
  const { data } = useSchool()
  const [showAll, setShowAll] = useState(false)
  const { history, rate } = useMemo(() => studentAttendance(data, student.id), [data, student.id])
  const groupName = new Map(data.groups.map((g) => [g.id, g.name]))
  const noteFor = (groupId: string, date: string) => data.attendance.find((r) => r.groupId === groupId && r.date === date)?.comments?.[student.id]
  const attended = history.filter((h) => h.mark !== 'absent').length
  const late = history.filter((h) => h.mark === 'late').length
  const absences = history.filter((h) => h.mark === 'absent')
  const shown = showAll ? history : history.slice(0, 15)
  const markTone = { present: 'text-success', late: 'text-warning', absent: 'text-danger' } as const
  const gradeFor = (groupId: string, date: string) => data.attendance.find((r) => r.groupId === groupId && r.date === date)?.grades?.[student.id]
  const lessonGrades = history.map((h) => gradeFor(h.groupId, h.date)).filter((g): g is Grade => g !== undefined)
  const avgGrade = lessonGrades.length ? lessonGrades.reduce((a, b) => a + b, 0) / lessonGrades.length : null

  return (
    <div className="grid items-start gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-4">
        <Panel title="Summary">
          <Details
            rows={[
              ['Attendance', <span key="rate" className={cn('num font-semibold', rateTone(rate))}>{rate === null ? '—' : formatPercent(rate)}</span>],
              ['Classes attended', <span key="att" className="num">{attended} of {history.length}{late ? `, ${late} late` : ''}</span>],
              ['Classes missed', <span key="miss" className="num">{absences.length}</span>],
              ['Average lesson grade', <span key="grade" className="num font-semibold">{formatAverage(avgGrade)}{lessonGrades.length ? ` (${lessonGrades.length} grades)` : ''}</span>],
            ]}
          />
        </Panel>
        <Panel title="Recent absences" flush>
          {absences.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-ink-muted">No absences recorded.</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {absences.slice(0, 5).map((a) => (
                <li key={`${a.groupId}-${a.date}`} className="px-5 py-2.5 text-sm">
                  <p className="num font-medium text-ink">{formatDate(a.date)}</p>
                  <p className="text-ink-muted">{noteFor(a.groupId, a.date) ?? 'No reason noted'}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Attendance history" description="Newest first." className="xl:col-span-8" flush>
        {history.length === 0 ? (
          <EmptyState icon={History} title="No attendance recorded yet" />
        ) : (
          <>
            <TableScroll>
              <table className="w-full min-w-[480px] text-sm">
                <thead className="border-y border-line bg-canvas">
                  <tr>
                    <th scope="col" className={th}>Date</th>
                    <th scope="col" className={th}>Group</th>
                    <th scope="col" className={th}>Mark</th>
                    <th scope="col" className={th}>Grade</th>
                    <th scope="col" className={th}>Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.map((h) => (
                    <tr key={`${h.groupId}-${h.date}`}>
                      <td className={cn(td, 'num whitespace-nowrap')}>{formatDate(h.date)}</td>
                      <td className={cn(td, 'text-ink-muted')}>{groupName.get(h.groupId) ?? '—'}</td>
                      <td className={cn(td, 'font-medium', markTone[h.mark])}>{attendanceMarkLabel[h.mark]}</td>
                      <td className={cn(td, 'py-2')}>{(() => { const g = gradeFor(h.groupId, h.date); return g ? <GradeChip grade={g} size="sm" /> : <span className="text-ink-faint">—</span> })()}</td>
                      <td className={cn(td, 'text-ink-muted')}>{noteFor(h.groupId, h.date) ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            {history.length > 15 && (
              <div className="border-t border-line px-5 py-3">
                <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Show fewer' : `Show all ${history.length} classes`}
                </Button>
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  )
}

// ---------------------------------------------------------------- homework

function HomeworkTab({ student, performance: p }: { student: Student; performance: PerformanceSummary }) {
  const { data, now } = useSchool()
  const lines = useMemo(() => studentHomework(data, student.id, now), [data, student.id, now])
  const recentScores = p.scores.slice(-8)

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 xl:grid-cols-12">
        <Panel
          title="Performance overview"
          description="Indicative only. Each number stands on its own; nothing here is a final ranking."
          className="xl:col-span-7"
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {(
              [
                ['Average score', score(p.averageScore)],
                ['Completion', p.completionRate === null ? '—' : formatPercent(p.completionRate)],
                ['Attendance', p.attendanceRate === null ? '—' : formatPercent(p.attendanceRate)],
                ['Assigned', String(p.assigned)],
                ['Submitted', `${p.submitted}${p.late ? ` (${p.late} late)` : ''}`],
                ['Evaluated', String(p.evaluated)],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-ink-muted">{label}</dt>
                <dd className="num text-lg font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <span className="text-sm text-ink-muted">Homework level</span>
            <PerformanceBadge label={p.label} />
            {p.trend && <span className="text-sm text-ink-muted">· {trendText[p.trend]}</span>}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Level comes from the average homework score only: {LABEL_THRESHOLDS.excellent}+ excellent, {LABEL_THRESHOLDS.good}–{LABEL_THRESHOLDS.excellent - 1} good, below{' '}
            {LABEL_THRESHOLDS.good} needs improvement.
          </p>
        </Panel>

        <Panel title="Recent scores" description={recentScores.length ? 'Oldest to newest, out of 100.' : undefined} className="xl:col-span-5">
          {recentScores.length === 0 ? (
            <p className="text-sm text-ink-muted">No evaluated homework yet.</p>
          ) : (
            <ol className="flex h-36 items-end gap-2" aria-label="Recent homework scores">
              {recentScores.map((s) => (
                <li key={s.homework.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${s.homework.title}: ${s.score}`}>
                  <span className="num text-xs font-medium text-ink">{s.score}</span>
                  <span
                    aria-hidden
                    className={cn('w-full max-w-8 rounded-t-[3px]', s.score >= LABEL_THRESHOLDS.good ? 'bg-brand' : 'bg-warning-mark')}
                    style={{ height: `${Math.max(4, s.score)}%` }}
                  />
                  <span className="sr-only">
                    {s.homework.title}, due {formatDate(s.homework.dueDate)}: {s.score}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      {p.recentFeedback.length > 0 && (
        <Panel title="Recent teacher feedback">
          <ul className="space-y-3">
            {p.recentFeedback.map(({ homework, evaluation }) => (
              <li key={homework.id} className="border-l-2 border-brand-muted pl-3">
                <p className="text-sm text-ink">“{evaluation.feedback}”</p>
                <p className="num mt-0.5 text-xs text-ink-muted">
                  {homework.title} · {evaluation.score}/100 · {formatDate(evaluation.evaluatedAt.slice(0, 10))}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Homework history" description={`${p.assigned} assignments, newest first.`} flush>
        {lines.length === 0 ? (
          <EmptyState icon={NotebookPen} title="No homework set yet" />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[680px] text-sm">
              <thead className="border-y border-line bg-canvas">
                <tr>
                  <th scope="col" className={th}>Homework</th>
                  <th scope="col" className={th}>Due</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={cn(th, 'text-right')}>Score</th>
                  <th scope="col" className={th}>Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lines.map((l) => (
                  <tr key={l.homework.id}>
                    <td className={td}>
                      <Link to={`/teacher/homework/${l.homework.id}`} className="font-medium text-ink hover:text-brand-ink hover:underline">
                        {l.homework.title}
                      </Link>
                    </td>
                    <td className={cn(td, 'num whitespace-nowrap text-ink-muted')}>{formatDate(l.homework.dueDate)}</td>
                    <td className={td}>
                      <ResultStatusBadge status={l.status} overdue={l.due} />
                    </td>
                    <td className={cn(td, 'num text-right font-medium')}>{l.result?.evaluation?.score ?? '—'}</td>
                    <td className={cn(td, 'max-w-72 text-ink-muted')}>{l.result?.evaluation?.feedback ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>
    </div>
  )
}

// ---------------------------------------------------------------- notes

function NotesTab({ student }: { student: Student }) {
  const { data, now, actions } = useSchool()
  const user = useUser()
  const toast = useToast()
  const [text, setText] = useState('')
  const [important, setImportant] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const notes = data.studentNotes.filter((n) => n.studentId === student.id).sort((a, b) => Number(b.important) - Number(a.important) || b.createdAt.localeCompare(a.createdAt))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (text.trim().length < 3) {
      setError('Write a short note first.')
      return
    }
    if (!actions.addStudentNote(student.id, text, important)) {
      toast.show('The note wasn’t saved: you can only add notes for your own students.', 'error')
      return
    }
    setText('')
    setImportant(false)
    toast.show('Note added.')
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-12">
      <Panel title="Add a note" description="Visible to staff only, never to parents." className="xl:col-span-5">
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="Note" error={error ?? undefined}>
            {(control) => (
              <Textarea
                {...control}
                rows={4}
                maxLength={1000}
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  setError(null)
                }}
                placeholder="e.g. Needs more speaking practice; parents asked for a call after the mid-term."
              />
            )}
          </Field>
          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-brand)]" />
            <span>
              Important remark
              <span className="block text-xs text-ink-muted">Shown at the top of the profile, e.g. health or safety information.</span>
            </span>
          </label>
          <div className="flex justify-end">
            <Button type="submit" variant="primary">
              Add note
            </Button>
          </div>
        </form>
      </Panel>

      <Panel title="Notes" description={notes.length ? `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}` : undefined} className="xl:col-span-7" flush>
        {notes.length === 0 ? (
          <EmptyState icon={StickyNote} title="No notes yet">
            Notes help you and the administrator remember what matters about this student.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {notes.map((n) => (
              <li key={n.id} className="flex gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  {n.important && (
                    <Badge tone="warning" className="mb-1">
                      Important
                    </Badge>
                  )}
                  <p className="text-sm whitespace-pre-line text-ink">{n.text}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {n.authorName} · {formatRelative(n.createdAt, now)}
                  </p>
                </div>
                {n.authorId === user.id && (
                  <IconButton
                    label="Delete note"
                    onClick={() => {
                      if (actions.deleteStudentNote(n.id)) toast.show('Note deleted.')
                    }}
                    className="hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
