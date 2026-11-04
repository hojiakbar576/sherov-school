import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ClipboardX, Pencil, Trash2, Users } from 'lucide-react'
import type { Assessment, Student } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Panel } from '../../components/ui/Panel'
import { Button, ButtonLink } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Field'
import { Avatar, EmptyState } from '../../components/ui/misc'
import { formatDate, formatPercent } from '../../lib/format'
import { assessmentKindLabel, summarizeAssessment } from '../../lib/assessments'
import { cn } from '../../lib/cn'
import { AssessmentFormDialog } from './AssessmentFormDialog'

export function AssessmentDetailPage() {
  const { assessmentId } = useParams()
  const { data, actions } = useSchool()
  const toast = useToast()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const assessment = data.assessments.find((a) => a.id === assessmentId)

  if (!assessment) {
    return (
      <div className="rounded-panel border border-line bg-surface">
        <EmptyState icon={ClipboardX} title="Assessment not found" action={<ButtonLink to="/assessments">Back to assessments</ButtonLink>}>
          It may have been deleted, or it belongs to another branch.
        </EmptyState>
      </div>
    )
  }

  const group = data.groups.find((g) => g.id === assessment.groupId)
  const s = summarizeAssessment(assessment)

  return (
    <>
      <Link to="/assessments" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Assessments
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.015em] text-ink">{assessment.title}</h1>
          <p className="mt-1 text-ink-muted">
            {assessmentKindLabel[assessment.kind]} · {group?.name ?? 'Group'} · {formatDate(assessment.date)} · out of {assessment.maxScore}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setDeleting(true)} className="hover:bg-danger-soft hover:text-danger">
            <Trash2 aria-hidden />
            Delete
          </Button>
          <Button onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
            Edit
          </Button>
        </div>
      </div>

      <dl className="num mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-4">
        {(
          [
            ['Took the test', `${s.taken}${s.absent ? ` (${s.absent} absent)` : ''}`],
            ['Average', s.average === null ? '—' : `${s.average.toFixed(1)} (${formatPercent(s.averagePercent ?? 0)})`],
            ['Highest', s.highest === null ? '—' : String(s.highest)],
            ['Lowest', s.lowest === null ? '—' : String(s.lowest)],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="bg-surface px-5 py-4">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="mt-1 text-xl font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {/* key: start fresh when the results change elsewhere */}
      <ResultsTable key={`${assessment.id}-${assessment.updatedAt ?? assessment.createdAt}-${assessment.maxScore}`} assessment={assessment} />

      <AssessmentFormDialog open={editing} assessment={assessment} onClose={() => setEditing(false)} />
      <ConfirmDialog
        open={deleting}
        title="Delete this assessment?"
        confirmLabel="Delete assessment"
        onClose={() => setDeleting(false)}
        onConfirm={() => {
          if (actions.deleteAssessment(assessment.id)) {
            toast.show('Assessment deleted.')
            navigate('/assessments', { replace: true })
          }
        }}
      >
        <p>
          {assessment.title} for {group?.name} and its {s.taken} results will be removed from every student’s profile.
        </p>
      </ConfirmDialog>
    </>
  )
}

interface Row {
  score: string
  absent: boolean
  comment: string
}

/** One row per student: score, or absent, and an optional comment. Saved together. */
function ResultsTable({ assessment }: { assessment: Assessment }) {
  const { data, actions } = useSchool()
  const toast = useToast()
  // Everyone in the group on the day, plus anyone with a result who has since moved.
  const students = useMemo(() => {
    const inGroup = data.students.filter((st) => st.groupId === assessment.groupId && st.status !== 'left' && st.status !== 'graduated' && st.enrolledOn <= assessment.date)
    const extra = assessment.results.map((r) => data.students.find((st) => st.id === r.studentId)).filter((st): st is Student => Boolean(st) && !inGroup.includes(st!))
    return [...inGroup, ...extra].sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [data.students, assessment])
  const initial = (): Record<string, Row> =>
    Object.fromEntries(
      students.map((st) => {
        const r = assessment.results.find((x) => x.studentId === st.id)
        return [st.id, { score: r?.score != null ? String(r.score) : '', absent: r ? r.score === null : false, comment: r?.comment ?? '' }]
      }),
    )
  const [rows, setRows] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const setRow = (id: string, patch: Partial<Row>) => {
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }))
    setDirty(true)
  }
  const errorFor = (row: Row) => {
    if (row.absent || row.score.trim() === '') return null
    const n = Number(row.score)
    return Number.isFinite(n) && n >= 0 && n <= assessment.maxScore ? null : `Score must be from 0 to ${assessment.maxScore}.`
  }
  const invalid = students.filter((st) => errorFor(rows[st.id]))

  const save = () => {
    if (invalid.length) return setShowErrors(true)
    const results = students
      .filter((st) => rows[st.id].absent || rows[st.id].score.trim() !== '')
      .map((st) => ({ studentId: st.id, score: rows[st.id].absent ? null : Number(rows[st.id].score), comment: rows[st.id].comment }))
    if (!actions.saveAssessmentResults(assessment.id, results)) return toast.show('Results weren’t saved: this group isn’t yours.', 'error')
    setDirty(false)
    setShowErrors(false)
    toast.show(`Saved ${results.length} results.`)
  }

  if (students.length === 0) {
    return (
      <Panel title="Results">
        <EmptyState icon={Users} title="No students in this group on that date" />
      </Panel>
    )
  }

  return (
    <Panel title="Results" description={`Enter each score out of ${assessment.maxScore}, or mark the student absent. Leave a score empty if it isn’t in yet.`} flush>
      <ul className="divide-y divide-line border-t border-line" aria-label="Results">
        {students.map((st) => {
          const row = rows[st.id]
          const error = showErrors || row.score ? errorFor(row) : null
          const percent = !row.absent && row.score.trim() !== '' && !error ? Number(row.score) / assessment.maxScore : null
          return (
            <li key={st.id} className="grid grid-cols-2 items-center gap-x-3 gap-y-2 px-5 py-2.5 sm:grid-cols-[minmax(0,1.2fr)_6rem_5rem_6.5rem_minmax(0,1.5fr)]">
              <Link to={`/students/${st.id}`} className="col-span-2 flex min-w-0 items-center gap-3 text-sm font-medium text-ink hover:underline sm:col-span-1">
                <Avatar name={st.fullName} size="sm" />
                <span className="truncate">{st.fullName}</span>
              </Link>
              <Input
                aria-label={`Score for ${st.fullName}, out of ${assessment.maxScore}`}
                aria-invalid={error ? true : undefined}
                inputMode="decimal"
                disabled={row.absent}
                value={row.absent ? '' : row.score}
                placeholder={row.absent ? 'Absent' : `/${assessment.maxScore}`}
                onChange={(e) => setRow(st.id, { score: e.target.value.replace(/[^\d.]/g, '') })}
                className="num h-9 text-sm"
              />
              <span className={cn('num hidden text-sm sm:block', percent !== null && percent < 0.6 ? 'text-danger' : 'text-ink-muted')}>{percent === null ? '' : formatPercent(percent)}</span>
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                <input type="checkbox" checked={row.absent} onChange={(e) => setRow(st.id, { absent: e.target.checked })} className="size-4 accent-[var(--color-brand)]" />
                Absent
              </label>
              <Input
                aria-label={`Comment for ${st.fullName}`}
                value={row.comment}
                maxLength={300}
                placeholder="Comment (optional)"
                onChange={(e) => setRow(st.id, { comment: e.target.value })}
                className="col-span-2 h-9 text-sm sm:col-span-1"
              />
              {error && (
                <p role="alert" className="col-span-2 text-xs text-danger sm:col-span-5">
                  {st.fullName}: {error}
                </p>
              )}
            </li>
          )
        })}
      </ul>
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-panel border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <p className="text-sm text-ink-muted" role="status">
          {dirty ? 'Unsaved changes.' : 'All results saved.'}
        </p>
        <div className="flex gap-2">
          {dirty && (
            <Button
              variant="ghost"
              onClick={() => {
                setRows(initial())
                setDirty(false)
                setShowErrors(false)
              }}
            >
              Discard
            </Button>
          )}
          <Button variant="primary" onClick={save} disabled={!dirty}>
            Save results
          </Button>
        </div>
      </div>
    </Panel>
  )
}
