import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ChevronLeft, Lock, Pencil, Trash2 } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Panel } from '../../components/ui/Panel'
import { Button, ButtonLink } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/misc'
import { formatDate } from '../../lib/format'
import { homeworkProgress } from '../../lib/performance'
import { HomeworkFormDialog } from './HomeworkFormDialog'
import { HomeworkChecker } from './HomeworkChecker'
import { formatScoreAsGrade } from './group/grade-style'

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
              ['Graded', String(progress.evaluated)],
              ['Average grade', formatScoreAsGrade(progress.averageScore)],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="bg-surface px-5 py-4">
              <dt className="text-sm text-ink-muted">{label}</dt>
              <dd className="mt-1 text-xl font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* key: start fresh when another homework is opened */}
      <HomeworkChecker key={homework.id} homework={homework} />

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
          “{homework.title}” and its {progress.evaluated} {progress.evaluated === 1 ? 'grade' : 'grades'} will be removed from {group?.name ?? 'the group'} and from each
          student’s history. This can’t be undone.
        </p>
      </ConfirmDialog>
    </div>
  )
}
