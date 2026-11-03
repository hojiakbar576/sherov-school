import { useEffect, useMemo, useState } from 'react'
import { Check, CheckCheck, Clock, Eraser, Users, X } from 'lucide-react'
import type { Grade, Homework, Student, SubmissionState } from '../../types'
import { GRADES } from '../../types'
import { useSchool, type ResultInput } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Button } from '../../components/ui/Button'
import { Avatar, EmptyState } from '../../components/ui/misc'
import { toISODate } from '../../lib/dates'
import { cn } from '../../lib/cn'
import { GradeChip } from './group/GradeChip'
import { ToolButton } from './group/ToolButton'
import { gradeToScore, gradeTone, scoreToGrade } from './group/grade-style'

/** What a tap on a student does. Pick it once, then tap every student it applies to. */
type Tool = 'missing' | 'late' | 'handed' | Grade | 'clear'

interface State {
  submission: SubmissionState
  grade?: Grade
}

const same = (a: State, b: State) => a.submission === b.submission && a.grade === b.grade

/**
 * Homework checking, the same way as a lesson: pick a mark (Not done, Late,
 * Handed in, or a grade 5–1), then tap the students it applies to.
 * Keys: 1–5 grades, N not done, L late, H handed in, C clear.
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
    return { submission: r?.submission ?? 'not_submitted', grade: r?.evaluation ? scoreToGrade(r.evaluation.score) : undefined }
  }

  const [states, setStates] = useState<Record<string, State>>(() => Object.fromEntries(students.map((s) => [s.id, savedState(s.id)])))
  const [tool, setTool] = useState<Tool>(5)

  const apply = (id: string) =>
    setStates((prev) => {
      const cur = prev[id] ?? { submission: 'not_submitted' }
      let next: State
      if (tool === 'missing') next = cur.submission === 'not_submitted' ? { submission: 'submitted' } : { submission: 'not_submitted' }
      else if (tool === 'late') next = { ...cur, submission: cur.submission === 'late' ? 'submitted' : 'late' }
      else if (tool === 'handed') next = cur.submission === 'submitted' && !cur.grade ? { submission: 'not_submitted' } : { ...cur, submission: cur.submission === 'late' ? 'late' : 'submitted' }
      else if (tool === 'clear') next = { submission: 'not_submitted' }
      else {
        // Giving a grade means it was handed in. Tapping the same grade again removes it.
        next = { submission: cur.submission === 'not_submitted' ? 'submitted' : cur.submission, grade: cur.grade === tool ? undefined : tool }
      }
      return { ...prev, [id]: next }
    })

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
      // An old comment belongs to the old grade, so it's dropped when the grade changes.
      return { studentId: s.id, submission: st.submission, score, feedback: keep ? before!.feedback : '' }
    })
    const count = actions.saveHomeworkResults(homework.id, rows)
    if (count === null) {
      toast.show('Not saved: you can only check homework for your own groups.', 'error')
      return
    }
    toast.show(`Saved ${count} ${count === 1 ? 'student' : 'students'} for “${homework.title}”.`, 'success')
  }

  if (students.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface">
        <EmptyState icon={Users} title="No students on this homework">
          It was set when the group had no students.
        </EmptyState>
      </section>
    )
  }

  return (
    <section aria-labelledby="check-title" className="rounded-2xl border border-line bg-surface">
      <header className="px-5 pt-4">
        <h2 id="check-title" className="font-semibold text-ink">
          Check homework
        </h2>
        <p className="text-sm text-ink-muted">Pick a mark, then tap the students it applies to. A grade also marks the work as handed in.</p>
      </header>

      <div className="sticky top-[5.5rem] z-10 mt-3 border-y border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <p id="hw-tool-label" className="mb-2 text-xs font-medium text-ink-muted">
          1. Pick a mark
        </p>
        <div role="radiogroup" aria-labelledby="hw-tool-label" className="flex flex-wrap gap-2">
          <ToolButton active={tool === 'missing'} onClick={() => setTool('missing')} shortcut="N" className="data-[active=true]:bg-danger data-[active=true]:text-white">
            <X aria-hidden className="size-4" /> Not done
          </ToolButton>
          <ToolButton active={tool === 'late'} onClick={() => setTool('late')} shortcut="L" className="data-[active=true]:bg-warning-mark data-[active=true]:text-ink">
            <Clock aria-hidden className="size-4" /> Late
          </ToolButton>
          <ToolButton active={tool === 'handed'} onClick={() => setTool('handed')} shortcut="H" className="data-[active=true]:bg-success data-[active=true]:text-white">
            <Check aria-hidden className="size-4" /> Handed in
          </ToolButton>
          <span aria-hidden className="mx-1 hidden w-px self-stretch bg-line sm:block" />
          {GRADES.map((g) => (
            <ToolButton
              key={g}
              active={tool === g}
              onClick={() => setTool(g)}
              shortcut={String(g)}
              label={`Grade ${g}`}
              className={cn('w-12 justify-center text-base font-semibold', tool === g && gradeTone[g])}
            >
              {g}
            </ToolButton>
          ))}
          <ToolButton active={tool === 'clear'} onClick={() => setTool('clear')} shortcut="C" className="data-[active=true]:bg-ink data-[active=true]:text-white">
            <Eraser aria-hidden className="size-4" /> Clear
          </ToolButton>
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-xs font-medium text-ink-muted">2. Tap the students it applies to</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {notHanded.length > 0 && (
              <button
                type="button"
                onClick={() => setStates((prev) => ({ ...prev, ...Object.fromEntries(notHanded.map((s) => [s.id, { submission: 'submitted' as const }])) }))}
                className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
              >
                <CheckCheck aria-hidden className="size-4" /> Everyone handed it in
              </button>
            )}
            {typeof tool === 'number' && handedNoGrade.length > 0 && (
              <button
                type="button"
                onClick={() => setStates((prev) => ({ ...prev, ...Object.fromEntries(handedNoGrade.map((s) => [s.id, { ...prev[s.id], grade: tool }])) }))}
                className="text-sm font-medium text-brand hover:underline"
              >
                Give {tool} to the {handedNoGrade.length} handed in but not graded
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
                  aria-label={`${s.fullName}: ${missing ? 'not handed in' : st.submission === 'late' ? 'handed in late' : 'handed in'}${st.grade ? `, grade ${st.grade}` : ''}`}
                  className={cn(
                    'relative flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors active:scale-[0.99]',
                    missing && overdue
                      ? 'border-danger-mark/40 bg-danger-soft'
                      : st.submission === 'late'
                        ? 'border-warning-mark/50 bg-warning-soft'
                        : 'border-line bg-surface hover:border-line-strong hover:bg-canvas',
                  )}
                >
                  {isChanged && <span aria-hidden title="Not saved yet" className="absolute top-1.5 left-1.5 size-2 rounded-full bg-accent" />}
                  <Avatar name={s.fullName} size="sm" />
                  <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', missing && overdue ? 'text-danger' : 'text-ink')}>{s.fullName}</span>
                  {missing && <span className={cn('text-xs font-semibold', overdue ? 'text-danger' : 'text-ink-faint')}>{overdue ? 'Not done' : 'Not yet'}</span>}
                  {st.submission === 'late' && <span className="text-xs font-semibold text-warning">Late</span>}
                  {st.grade ? (
                    <GradeChip grade={st.grade} />
                  ) : (
                    !missing && (
                      <span title="Handed in, not graded" className="flex size-8 items-center justify-center rounded-lg bg-success-soft text-success">
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
            {hiddenCount} {hiddenCount === 1 ? 'student has' : 'students have'} since left your groups; their results are kept but not shown.
          </p>
        )}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-line bg-canvas/95 px-5 py-3 backdrop-blur">
        <p className="num text-sm text-ink-muted" aria-live="polite">
          <span className="font-semibold text-ink">{students.length - notHanded.length}</span> handed in ·{' '}
          <span className={cn('font-semibold', notHanded.length && overdue ? 'text-danger' : 'text-ink')}>{notHanded.length}</span> not ·{' '}
          <span className="font-semibold text-ink">{graded}</span> graded
          {changed.length > 0 && <span className="text-accent-ink"> · {changed.length} not saved</span>}
        </p>
        <div className="flex gap-2">
          {changed.length > 0 && (
            <Button variant="ghost" onClick={() => setStates(Object.fromEntries(students.map((s) => [s.id, savedState(s.id)])))}>
              Undo changes
            </Button>
          )}
          <Button variant="primary" onClick={save} disabled={changed.length === 0}>
            Save
          </Button>
        </div>
      </div>

    </section>
  )
}
