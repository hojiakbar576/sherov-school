import { useEffect, useMemo, useState } from 'react'
import { Check, CheckCheck, Clock, Eraser, MessageSquare, Users, X } from 'lucide-react'
import type { Grade, Homework, Student, SubmissionState } from '../../types'
import { GRADES } from '../../types'
import { useSchool, type ResultInput } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Textarea } from '../../components/ui/Field'
import { Avatar, EmptyState } from '../../components/ui/misc'
import { toISODate } from '../../lib/dates'
import { cn } from '../../lib/cn'
import { GradeChip } from './group/GradeChip'
import { ToolButton } from './group/ToolButton'
import { gradeToScore, gradeTone, scoreToGrade } from './group/grade-style'
import { plural, tr } from '../../i18n'

/** What a tap on a student does. Pick it once, then tap every student it applies to. */
type Tool = 'missing' | 'late' | 'handed' | Grade | 'comment' | 'clear'

interface State {
  submission: SubmissionState
  grade?: Grade
  /** Short comment for the student (and later their parents). Kept with the grade. */
  comment?: string
}

const same = (a: State, b: State) => a.submission === b.submission && a.grade === b.grade && (a.comment ?? '') === (b.comment ?? '')

/**
 * Homework checking, the same way as a lesson: pick a mark (Not done, Late,
 * Handed in, or a grade 5–1), then tap the students it applies to.
 * Keys: 1–5 grades, N not done, L late, H handed in, M comment, C clear.
 */
export function HomeworkChecker({ homework }: { homework: Homework }) {
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const overdue = homework.dueDate < toISODate(now)

  const students = useMemo(
    () =>
      homework.studentIds
        .map((id) => data.students.find((s) => s.id === id))
        .filter((s): s is Student => Boolean(s))
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [homework.studentIds, data.students],
  )
  const hiddenCount = homework.studentIds.length - students.length
  const saved = useMemo(
    () => new Map(data.homeworkResults.filter((r) => r.homeworkId === homework.id).map((r) => [r.studentId, r])),
    [data.homeworkResults, homework.id],
  )
  const savedState = (id: string): State => {
    const r = saved.get(id)
    return {
      submission: r?.submission ?? 'not_submitted',
      grade: r?.evaluation ? scoreToGrade(r.evaluation.score) : undefined,
      comment: r?.evaluation?.feedback || undefined,
    }
  }

  const [states, setStates] = useState<Record<string, State>>(() => Object.fromEntries(students.map((s) => [s.id, savedState(s.id)])))
  const [tool, setTool] = useState<Tool>(5)
  const [commenting, setCommenting] = useState<Student | null>(null)

  const apply = (id: string) => {
    if (tool === 'comment') {
      setCommenting(students.find((s) => s.id === id) ?? null)
      return
    }
    setStates((prev) => {
      const cur = prev[id] ?? { submission: 'not_submitted' }
      let next: State
      if (tool === 'missing') next = cur.submission === 'not_submitted' ? { submission: 'submitted' } : { submission: 'not_submitted' }
      else if (tool === 'late') next = { ...cur, submission: cur.submission === 'late' ? 'submitted' : 'late' }
      else if (tool === 'handed') next = cur.submission === 'submitted' && !cur.grade ? { submission: 'not_submitted' } : { ...cur, submission: cur.submission === 'late' ? 'late' : 'submitted' }
      else if (tool === 'clear') next = { submission: 'not_submitted' }
      else {
        // Giving a grade means it was handed in. Tapping the same grade again removes it.
        // A comment written for the old grade goes with it, unless it was just typed.
        const grade = cur.grade === tool ? undefined : tool
        const staleComment = cur.comment && cur.comment === savedState(id).comment
        next = { submission: cur.submission === 'not_submitted' ? 'submitted' : cur.submission, grade, comment: grade && !staleComment ? cur.comment : undefined }
      }
      return { ...prev, [id]: next }
    })
  }

  const handedNoGrade = students.filter((s) => states[s.id].submission !== 'not_submitted' && !states[s.id].grade)
  const notHanded = students.filter((s) => states[s.id].submission === 'not_submitted')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return
      const key = event.key.toLowerCase()
      if (['1', '2', '3', '4', '5'].includes(key)) setTool(Number(key) as Grade)
      else if (key === 'n') setTool('missing')
      else if (key === 'l') setTool('late')
      else if (key === 'h') setTool('handed')
      else if (key === 'c') setTool('clear')
      else if (key === 'm') setTool('comment')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const changed = students.filter((s) => !same(states[s.id], savedState(s.id)))
  const graded = students.filter((s) => states[s.id].grade).length

  const save = () => {
    const rows: ResultInput[] = changed.map((s) => {
      const st = states[s.id]
      const before = saved.get(s.id)?.evaluation
      // Keep an older exact score (e.g. 87) if its grade wasn't changed.
      const keep = Boolean(st.grade && before && scoreToGrade(before.score) === st.grade)
      const score = !st.grade ? null : keep ? before!.score : gradeToScore(st.grade)
      return { studentId: s.id, submission: st.submission, score, feedback: st.grade ? (st.comment ?? '') : '' }
    })
    const count = actions.saveHomeworkResults(homework.id, rows)
    if (count === null) {
      toast.show(tr("Not saved: you can only check homework for your own groups."), 'error')
      return
    }
    toast.show(tr("Saved {0} {1} for “{2}”.", count, plural(count, 'student', 'students'), homework.title), 'success')
  }

  if (students.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface">
        <EmptyState icon={Users} title={tr("No students on this homework")}>
          {tr("It was set when the group had no students.")}
        </EmptyState>
      </section>
    )
  }

  return (
    <section aria-labelledby="check-title" className="rounded-2xl border border-line bg-surface">
      <header className="px-5 pt-4">
        <h2 id="check-title" className="font-semibold text-ink">
          {tr("Check homework")}
        </h2>
        <p className="text-sm text-ink-muted">{tr("Pick a mark, then tap the students it applies to. A grade also marks the work as handed in.")}</p>
      </header>

      <div className="sticky top-[5.5rem] z-10 mt-3 border-y border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <p id="hw-tool-label" className="mb-2 text-xs font-medium text-ink-muted">
          {tr("1. Pick a mark")}
        </p>
        <div role="radiogroup" aria-labelledby="hw-tool-label" className="flex flex-wrap gap-2">
          <ToolButton active={tool === 'missing'} onClick={() => setTool('missing')} shortcut="N" className="data-[active=true]:bg-danger data-[active=true]:text-white">
            <X aria-hidden className="size-4" />{' '}{tr("Not done")}
          </ToolButton>
          <ToolButton active={tool === 'late'} onClick={() => setTool('late')} shortcut="L" className="data-[active=true]:bg-warning-mark data-[active=true]:text-ink">
            <Clock aria-hidden className="size-4" />{' '}{tr("Late")}
          </ToolButton>
          <ToolButton active={tool === 'handed'} onClick={() => setTool('handed')} shortcut="H" className="data-[active=true]:bg-success data-[active=true]:text-white">
            <Check aria-hidden className="size-4" />{' '}{tr("Handed in")}
          </ToolButton>
          <span aria-hidden className="mx-1 hidden w-px self-stretch bg-line sm:block" />
          {GRADES.map((g) => (
            <ToolButton
              key={g}
              active={tool === g}
              onClick={() => setTool(g)}
              shortcut={String(g)}
              label={tr("Grade {0}", g)}
              className={cn('w-12 justify-center text-base font-semibold', tool === g && gradeTone[g])}
            >
              {g}
            </ToolButton>
          ))}
          <ToolButton active={tool === 'comment'} onClick={() => setTool('comment')} shortcut="M" className="data-[active=true]:bg-info data-[active=true]:text-white">
            <MessageSquare aria-hidden className="size-4" />{' '}{tr("Comment")}
          </ToolButton>
          <ToolButton active={tool === 'clear'} onClick={() => setTool('clear')} shortcut="C" className="data-[active=true]:bg-ink data-[active=true]:text-white">
            <Eraser aria-hidden className="size-4" />{' '}{tr("Clear")}
          </ToolButton>
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-xs font-medium text-ink-muted">{tr("2. Tap the students it applies to")}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {notHanded.length > 0 && (
              <button
                type="button"
                onClick={() => setStates((prev) => ({ ...prev, ...Object.fromEntries(notHanded.map((s) => [s.id, { submission: 'submitted' as const }])) }))}
                className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
              >
                <CheckCheck aria-hidden className="size-4" />{' '}{tr("Everyone handed it in")}
              </button>
            )}
            {typeof tool === 'number' && handedNoGrade.length > 0 && (
              <button
                type="button"
                onClick={() => setStates((prev) => ({ ...prev, ...Object.fromEntries(handedNoGrade.map((s) => [s.id, { ...prev[s.id], grade: tool }])) }))}
                className="text-sm font-medium text-brand hover:underline"
              >
                {tr("Give")}{' '}{tool}{' '}{tr("to the")}{' '}{handedNoGrade.length}{' '}{tr("handed in but not graded")}
              </button>
            )}
          </div>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {students.map((s) => {
            const st = states[s.id]
            const missing = st.submission === 'not_submitted'
            const isChanged = !same(st, savedState(s.id))
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => apply(s.id)}
                  aria-label={`${s.fullName}: ${missing ? tr('Not handed in') : st.submission === 'late' ? tr('Handed in late') : tr('Handed in')}${st.grade ? `, ${tr('Grade {0}', st.grade)}` : ''}`}
                  className={cn(
                    'relative flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors active:scale-[0.99]',
                    missing && overdue
                      ? 'border-danger-mark/40 bg-danger-soft'
                      : st.submission === 'late'
                        ? 'border-warning-mark/50 bg-warning-soft'
                        : 'border-line bg-surface hover:border-line-strong hover:bg-canvas',
                  )}
                >
                  {isChanged && <span aria-hidden title={tr("Not saved yet")} className="absolute top-1.5 left-1.5 size-2 rounded-full bg-accent" />}
                  <Avatar name={s.fullName} size="sm" />
                  <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', missing && overdue ? 'text-danger' : 'text-ink')}>{s.fullName}</span>
                  {missing && <span className={cn('text-xs font-semibold', overdue ? 'text-danger' : 'text-ink-faint')}>{overdue ? tr("Not done") : tr("Not yet")}</span>}
                  {st.submission === 'late' && <span className="text-xs font-semibold text-warning">{tr("Late")}</span>}
                  {st.comment && <MessageSquare aria-label={tr("Has a comment")} className="size-4 shrink-0 text-info" />}
                  {st.grade ? (
                    <GradeChip grade={st.grade} />
                  ) : (
                    !missing && (
                      <span title={tr("Handed in, not graded")} className="flex size-8 items-center justify-center rounded-lg bg-success-soft text-success">
                        <Check aria-hidden className="size-4" />
                      </span>
                    )
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        {hiddenCount > 0 && (
          <p className="text-xs text-ink-muted">
            {hiddenCount} {hiddenCount === 1 ? tr("student has") : tr("students have")}{' '}{tr("since left your groups; their results are kept but not shown.")}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-line bg-canvas/95 px-5 py-3 backdrop-blur">
        <p className="num text-sm text-ink-muted" aria-live="polite">
          <span className="font-semibold text-ink">{students.length - notHanded.length}</span>{' '}{tr("handed in ·")}{' '}
          <span className={cn('font-semibold', notHanded.length && overdue ? 'text-danger' : 'text-ink')}>{notHanded.length}</span>{' '}{tr("not ·")}{' '}
          <span className="font-semibold text-ink">{graded}</span>{' '}{tr("graded")}
          {changed.length > 0 && <span className="text-accent-ink"> · {changed.length}{' '}{tr("not saved")}</span>}
        </p>
        <div className="flex gap-2">
          {changed.length > 0 && (
            <Button variant="ghost" onClick={() => setStates(Object.fromEntries(students.map((s) => [s.id, savedState(s.id)])))}>
              {tr("Undo changes")}
            </Button>
          )}
          <Button variant="primary" onClick={save} disabled={changed.length === 0}>
            {tr("Save")}
          </Button>
        </div>
      </div>

      <CommentDialog
        student={commenting}
        state={commenting ? states[commenting.id] : undefined}
        onClose={() => setCommenting(null)}
        onSave={(comment) => {
          if (commenting) setStates((prev) => ({ ...prev, [commenting.id]: { ...prev[commenting.id], comment: comment || undefined } }))
          setCommenting(null)
        }}
      />
    </section>
  )
}

/** A short comment for one student. Saved with the grade, so a grade is needed first. */
function CommentDialog({ student, state, onClose, onSave }: { student: Student | null; state?: State; onClose: () => void; onSave: (comment: string) => void }) {
  return (
    <Dialog open={student !== null} onClose={onClose} title={student ? tr("Comment for {0}", student.fullName) : tr("Comment")} size="sm">
      {student && state && <CommentForm key={student.id} state={state} onClose={onClose} onSave={onSave} />}
    </Dialog>
  )
}

function CommentForm({ state, onClose, onSave }: { state: State; onClose: () => void; onSave: (comment: string) => void }) {
  const [text, setText] = useState(state.comment ?? '')
  if (!state.grade) {
    return (
      <div className="space-y-4 text-sm">
        <p className="text-ink-muted">{tr("Give this student a grade first. The comment is saved together with the grade.")}</p>
        <div className="flex justify-end">
          <Button onClick={onClose}>{tr("OK")}</Button>
        </div>
      </div>
    )
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(text.trim().slice(0, 300))
      }}
    >
      <Textarea aria-label={tr("Comment")} autoFocus value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder={tr("What went well, what to improve")} />
      <div className="flex justify-between gap-2">
        {state.comment ? (
          <Button variant="ghost" onClick={() => onSave('')} className="text-danger hover:bg-danger-soft hover:text-danger">
            {tr("Remove")}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button onClick={onClose}>{tr("Cancel")}</Button>
          <Button type="submit" variant="primary">
            {tr("Done")}
          </Button>
        </div>
      </div>
    </form>
  )
}
