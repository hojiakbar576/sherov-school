import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ChevronLeft, Lock, Pencil, Trash2, Users } from 'lucide-react'
import type { Homework, HomeworkResult, Student, SubmissionState } from '../../types'
import { useSchool, type ResultInput } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Panel } from '../../components/ui/Panel'
import { Button, ButtonLink } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { Input, Select } from '../../components/ui/Field'
import { Avatar, EmptyState } from '../../components/ui/misc'
import { toISODate } from '../../lib/dates'
import { formatDate } from '../../lib/format'
import { homeworkProgress, resultStatus } from '../../lib/performance'
import { cn } from '../../lib/cn'
import { ResultStatusBadge } from './LearningBadges'
import { HomeworkFormDialog } from './HomeworkFormDialog'

export function HomeworkDetailPage() {
  const { homeworkId } = useParams()
  const { data, actions } = useSchool()
  const toast = useToast()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Scoped data only holds the teacher's own homework.
  const homework = data.homework.find((h) => h.id === homeworkId)

  if (!homework) {
    return (
      <div className="rounded-panel border border-line bg-surface">
        <EmptyState icon={Lock} title="This homework isn’t one of yours" action={<ButtonLink to="/teacher/homework">Back to homework</ButtonLink>}>
          You can only open homework set for your own groups. It may also have been deleted.
        </EmptyState>
      </div>
    )
  }

  const group = data.groups.find((g) => g.id === homework.groupId)
  const teacher = data.teachers.find((t) => t.id === homework.teacherId)
  const progress = homeworkProgress(data, homework)
  const isUrl = homework.resource && /^https?:\/\//i.test(homework.resource)

  return (
    <div className="space-y-6">
      <div>
        <Link to="/teacher/homework" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ChevronLeft aria-hidden className="size-4" />
          Homework
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-[-0.015em] text-ink">{homework.title}</h1>
            <p className="mt-1 text-ink-muted">
              {group ? (
                <Link to={`/teacher/groups/${group.id}`} className="hover:text-ink hover:underline">
                  {group.name}
                </Link>
              ) : (
                'Group'
              )}
              {group && ` · ${group.subject}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
              Edit
            </Button>
            <Button variant="ghost" onClick={() => setDeleting(true)} className="text-danger hover:bg-danger-soft hover:text-danger">
              <Trash2 aria-hidden />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <Panel title="Assignment" className="xl:col-span-8">
          <p className="max-w-[70ch] text-sm whitespace-pre-line text-ink">{homework.description}</p>
          <dl className="num mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-ink-muted">Set on</dt>
              <dd className="text-ink">{formatDate(homework.assignedOn)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Deadline</dt>
              <dd className="text-ink">{formatDate(homework.dueDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Teacher</dt>
              <dd className="text-ink">{teacher?.fullName ?? '—'}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-ink-muted">Resource</dt>
              <dd className="truncate text-ink">
                {!homework.resource ? (
                  <span className="text-ink-faint">None</span>
                ) : isUrl ? (
                  <a href={homework.resource} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                    {homework.resource.replace(/^https?:\/\//i, '')}
                  </a>
                ) : (
                  homework.resource
                )}
              </dd>
            </div>
          </dl>
        </Panel>

        <dl className="num grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line xl:col-span-4">
          {(
            [
              ['Handed in', `${progress.handedIn} of ${progress.assigned}`],
              ['Late', String(progress.late)],
              ['Evaluated', String(progress.evaluated)],
              ['Average score', progress.averageScore === null ? '—' : String(Math.round(progress.averageScore))],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="bg-surface px-5 py-4">
              <dt className="text-sm text-ink-muted">{label}</dt>
              <dd className="mt-1 text-xl font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* key: start fresh if the assignment's results change elsewhere (another tab) */}
      <EvaluationTable key={homework.id} homework={homework} />

      <HomeworkFormDialog open={editing} onClose={() => setEditing(false)} homework={homework} />
      <ConfirmDialog
        open={deleting}
        title="Delete this homework?"
        confirmLabel="Delete homework"
        onClose={() => setDeleting(false)}
        onConfirm={() => {
          if (actions.deleteHomework(homework.id)) {
            toast.show(`Deleted “${homework.title}”.`)
            navigate('/teacher/homework', { replace: true })
          }
        }}
      >
        <p>
          “{homework.title}” and its {progress.evaluated} {progress.evaluated === 1 ? 'evaluation' : 'evaluations'} will be removed from {group?.name ?? 'the group'} and from each
          student’s history. This can’t be undone.
        </p>
      </ConfirmDialog>
    </div>
  )
}

// ---------------------------------------------------------------- evaluation

interface Row {
  submission: SubmissionState
  score: string
  feedback: string
}

const toRow = (result: HomeworkResult | undefined): Row => ({
  submission: result?.submission ?? 'not_submitted',
  score: result?.evaluation ? String(result.evaluation.score) : '',
  feedback: result?.evaluation?.feedback ?? '',
})

const sameRow = (a: Row, b: Row) => a.submission === b.submission && a.score.trim() === b.score.trim() && a.feedback.trim() === b.feedback.trim()

function scoreError(row: Row): string | null {
  const value = row.score.trim()
  if (value === '') return row.feedback.trim() ? 'Add a score to save feedback.' : null
  if (!/^\d{1,3}$/.test(value) || Number(value) > 100) return 'Score must be a whole number from 0 to 100.'
  return null
}

/**
 * One row per student: handed in or not, a score and feedback. Teachers change
 * any rows they like and save them together.
 */
function EvaluationTable({ homework }: { homework: Homework }) {
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const today = toISODate(now)
  const overdue = homework.dueDate < today

  const students = useMemo(
    () =>
      homework.studentIds
        .map((id) => data.students.find((s) => s.id === id))
        .filter((s): s is Student => Boolean(s))
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [homework.studentIds, data.students],
  )
  const hidden = homework.studentIds.length - students.length
  const saved = useMemo(
    () => new Map(data.homeworkResults.filter((r) => r.homeworkId === homework.id).map((r) => [r.studentId, r])),
    [data.homeworkResults, homework.id],
  )
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(students.map((s) => [s.id, toRow(saved.get(s.id))])))
  const [showErrors, setShowErrors] = useState(false)

  const changedIds = students.filter((s) => rows[s.id] && !sameRow(rows[s.id], toRow(saved.get(s.id)))).map((s) => s.id)
  const errors = Object.fromEntries(students.map((s) => [s.id, rows[s.id] ? scoreError(rows[s.id]) : null]))
  const invalid = changedIds.filter((id) => errors[id])

  const setRow = (id: string, patch: Partial<Row>) =>
    setRows((r) => {
      const next = { ...r[id], ...patch }
      // Entering a score means the work was handed in.
      if (patch.score !== undefined && patch.score.trim() !== '' && next.submission === 'not_submitted') next.submission = 'submitted'
      return { ...r, [id]: next }
    })

  const save = () => {
    if (invalid.length) {
      setShowErrors(true)
      return
    }
    const input: ResultInput[] = changedIds.map((id) => ({
      studentId: id,
      submission: rows[id].submission,
      score: rows[id].score.trim() === '' ? null : Number(rows[id].score),
      feedback: rows[id].feedback,
    }))
    const count = actions.saveHomeworkResults(homework.id, input)
    if (count === null) {
      toast.show('Evaluations weren’t saved: you can only evaluate homework for your own groups.', 'error')
      return
    }
    setShowErrors(false)
    toast.show(`Saved ${count} ${count === 1 ? 'result' : 'results'} for “${homework.title}”.`)
  }

  if (students.length === 0) {
    return (
      <Panel title="Evaluation">
        <EmptyState icon={Users} title="No students on this homework">
          It was set when the group had no students.
        </EmptyState>
      </Panel>
    )
  }

  return (
    <Panel
      title="Evaluation"
      description="Record who handed it in, give a score out of 100 and a short comment. The date is recorded when you save."
      flush
    >
      <div className="hidden grid-cols-[minmax(0,1.3fr)_9.5rem_5.5rem_minmax(0,2fr)_7.5rem] gap-3 border-y border-line bg-canvas px-5 py-2.5 text-xs font-medium text-ink-muted lg:grid" aria-hidden>
        <span>Student</span>
        <span>Submission</span>
        <span>Score</span>
        <span>Feedback</span>
        <span>Status</span>
      </div>
      <ul className="divide-y divide-line border-t border-line lg:border-t-0" aria-label="Evaluations">
        {students.map((s) => {
          const row = rows[s.id]
          const result = saved.get(s.id)
          const changed = changedIds.includes(s.id)
          const error = showErrors || row.score.trim() !== '' ? errors[s.id] : null
          return (
            <li
              key={s.id}
              className={cn(
                'grid grid-cols-2 items-start gap-3 px-5 py-3 lg:grid-cols-[minmax(0,1.3fr)_9.5rem_5.5rem_minmax(0,2fr)_7.5rem] lg:items-center',
                changed && 'bg-brand-soft/40',
              )}
            >
              <Link to={`/teacher/students/${s.id}?tab=homework`} className="col-span-2 flex min-w-0 items-center gap-3 text-sm font-medium text-ink hover:underline lg:col-span-1">
                <Avatar name={s.fullName} size="sm" />
                <span className="truncate">{s.fullName}</span>
              </Link>
              <Select
                aria-label={`Submission for ${s.fullName}`}
                value={row.submission}
                onChange={(e) => setRow(s.id, { submission: e.target.value as SubmissionState })}
                className="h-9 text-sm"
              >
                <option value="not_submitted">Not submitted</option>
                <option value="submitted">Submitted</option>
                <option value="late">Late</option>
              </Select>
              <Input
                aria-label={`Score for ${s.fullName}, out of 100`}
                aria-invalid={error ? true : undefined}
                inputMode="numeric"
                placeholder="0–100"
                value={row.score}
                maxLength={3}
                onChange={(e) => setRow(s.id, { score: e.target.value.replace(/[^\d]/g, '') })}
                className="num h-9 text-sm"
              />
              <Input
                aria-label={`Feedback for ${s.fullName}`}
                placeholder="What went well, what to improve"
                value={row.feedback}
                maxLength={1000}
                onChange={(e) => setRow(s.id, { feedback: e.target.value })}
                className="col-span-2 h-9 text-sm lg:col-span-1"
              />
              <div className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-1 lg:col-span-1 lg:block">
                {changed ? (
                  <span className="text-xs font-medium text-brand-ink">Unsaved</span>
                ) : (
                  <ResultStatusBadge status={resultStatus(result)} overdue={overdue} />
                )}
                {!changed && result?.evaluation && <p className="num text-xs text-ink-muted lg:mt-0.5">{formatDate(result.evaluation.evaluatedAt.slice(0, 10))}</p>}
              </div>
              {error && (
                <p role="alert" className="col-span-2 text-xs text-danger lg:col-span-5">
                  {s.fullName}: {error}
                </p>
              )}
            </li>
          )
        })}
      </ul>
      {hidden > 0 && (
        <p className="border-t border-line px-5 py-2.5 text-xs text-ink-muted">
          {hidden} {hidden === 1 ? 'student has' : 'students have'} since left your groups; their results are kept but not shown.
        </p>
      )}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-panel border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <p className="text-sm text-ink-muted" role="status">
          {changedIds.length === 0 ? 'No unsaved changes.' : `${changedIds.length} ${changedIds.length === 1 ? 'student' : 'students'} changed.`}
        </p>
        <div className="flex gap-2">
          {changedIds.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => {
                setRows(Object.fromEntries(students.map((s) => [s.id, toRow(saved.get(s.id))])))
                setShowErrors(false)
              }}
            >
              Discard
            </Button>
          )}
          <Button variant="primary" onClick={save} disabled={changedIds.length === 0}>
            Save evaluations
          </Button>
        </div>
      </div>
    </Panel>
  )
}
