import { useEffect, useMemo, useState } from 'react'
import { Check, Clock, Eraser, UserX } from 'lucide-react'
import type { AttendanceMark, Grade, Group, ISODate, Student } from '../../../types'
import { GRADES } from '../../../types'
import { useSchool } from '../../../data/school-context'
import { Dialog } from '../../../components/ui/Dialog'
import { Button } from '../../../components/ui/Button'
import { Avatar } from '../../../components/ui/misc'
import { useToast } from '../../../components/ui/toast-context'
import { findRecord, groupRoster } from '../../../lib/metrics'
import { parseISODate } from '../../../lib/dates'
import { formatDayShort } from '../../../lib/format'
import { cn } from '../../../lib/cn'
import { GradeChip } from './GradeChip'
import { gradeTone } from './grade-style'

/** What a tap on a student does. Pick it once, then tap as many students as needed. */
type Tool = 'absent' | 'late' | Grade | 'clear'

interface Props {
  group: Group
  date: ISODate | null
  onClose: () => void
}

/**
 * One lesson's attendance and grades on one screen.
 * Everyone starts as present. The teacher picks a mark (Absent, Late, or a
 * grade 5–1) and taps the students it applies to, e.g. pick 4, tap the five
 * students who earned a 4. Keys: 1–5 for grades, A absent, L late, C clear.
 */
export function LessonSheet({ group, date, onClose }: Props) {
  return (
    <Dialog
      open={date !== null}
      onClose={onClose}
      size="lg"
      title={date ? `${group.name} · ${formatDayShort(parseISODate(date))}` : group.name}
      description="Everyone is present by default. Pick a mark, then tap the students it applies to."
    >
      {date && <Sheet key={date} group={group} date={date} onClose={onClose} />}
    </Dialog>
  )
}

function Sheet({ group, date, onClose }: { group: Group; date: ISODate; onClose: () => void }) {
  const { data, actions } = useSchool()
  const toast = useToast()
  const existing = findRecord(data, group.id, date)

  const students = useMemo<Student[]>(() => {
    const roster = groupRoster(data, group.id, date)
    const ids = new Set(roster.map((s) => s.id))
    // Keep students who were marked that day even if they have since left the group.
    const extra = Object.keys(existing?.marks ?? {})
      .filter((id) => !ids.has(id))
      .map((id) => data.students.find((s) => s.id === id))
      .filter((s): s is Student => Boolean(s))
    return [...roster, ...extra].sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [data, group.id, date, existing])

  const [marks, setMarks] = useState<Record<string, AttendanceMark>>(() =>
    Object.fromEntries(students.map((s) => [s.id, existing?.marks[s.id] ?? 'present'])),
  )
  const [grades, setGrades] = useState<Record<string, Grade>>(() => ({ ...(existing?.grades ?? {}) }))
  const [tool, setTool] = useState<Tool>('absent')

  const apply = (studentId: string) => {
    const mark = marks[studentId] ?? 'present'
    const setMark = (m: AttendanceMark) => setMarks((prev) => ({ ...prev, [studentId]: m }))
    const setGrade = (g: Grade | null) =>
      setGrades((prev) => {
        const next = { ...prev }
        if (g === null) delete next[studentId]
        else next[studentId] = g
        return next
      })

    if (tool === 'absent') {
      // Tapping an absent student again brings them back.
      if (mark === 'absent') return setMark('present')
      setMark('absent')
      setGrade(null)
    } else if (tool === 'late') {
      setMark(mark === 'late' ? 'present' : 'late')
    } else if (tool === 'clear') {
      setMark('present')
      setGrade(null)
    } else {
      // Grading someone means they were there.
      if (mark === 'absent') setMark('present')
      setGrade(grades[studentId] === tool ? null : tool)
    }
  }

  const ungraded = students.filter((s) => marks[s.id] !== 'absent' && grades[s.id] === undefined)
  const giveRest = (g: Grade) =>
    setGrades((prev) => ({ ...prev, ...Object.fromEntries(ungraded.map((s) => [s.id, g])) }))

  // Keyboard shortcuts for fast marking on a laptop.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      const key = event.key.toLowerCase()
      if (['1', '2', '3', '4', '5'].includes(key)) setTool(Number(key) as Grade)
      else if (key === 'a') setTool('absent')
      else if (key === 'l') setTool('late')
      else if (key === 'c') setTool('clear')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const absent = students.filter((s) => marks[s.id] === 'absent').length
  const late = students.filter((s) => marks[s.id] === 'late').length
  const graded = students.filter((s) => grades[s.id] !== undefined && marks[s.id] !== 'absent').length

  const save = () => {
    const ok = actions.saveAttendance(group.id, date, marks, existing?.comments, grades)
    if (!ok) {
      toast.show('This lesson could not be saved.', 'error')
      return
    }
    toast.show(`Saved: ${students.length - absent} present, ${absent} absent, ${graded} graded.`, 'success')
    onClose()
  }

  if (students.length === 0) {
    return <p className="text-sm text-ink-muted">There are no students in this group on this day.</p>
  }

  return (
    <div className="space-y-4">
      {/* The palette: pick a mark first. */}
      <div className="sticky -top-5 z-10 -mx-5 -mt-5 border-b border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <p id="tool-label" className="mb-2 text-xs font-medium text-ink-muted">
          1. Pick a mark
        </p>
        <div role="radiogroup" aria-labelledby="tool-label" className="flex flex-wrap gap-2">
          <ToolButton active={tool === 'absent'} onClick={() => setTool('absent')} shortcut="A" className="data-[active=true]:bg-danger data-[active=true]:text-white">
            <UserX aria-hidden className="size-4" /> Absent
          </ToolButton>
          <ToolButton active={tool === 'late'} onClick={() => setTool('late')} shortcut="L" className="data-[active=true]:bg-warning-mark data-[active=true]:text-ink">
            <Clock aria-hidden className="size-4" /> Late
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-muted">2. Tap the students it applies to</p>
        {typeof tool === 'number' && ungraded.length > 0 && (
          <button type="button" onClick={() => giveRest(tool)} className="text-sm font-medium text-brand hover:underline">
            Give {tool} to the {ungraded.length} not graded yet
          </button>
        )}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {students.map((s) => {
          const mark = marks[s.id] ?? 'present'
          const grade = mark === 'absent' ? undefined : grades[s.id]
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => apply(s.id)}
                aria-label={`${s.fullName}: ${mark}${grade ? `, grade ${grade}` : ''}`}
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors active:scale-[0.99]',
                  mark === 'absent' ? 'border-danger-mark/40 bg-danger-soft' : mark === 'late' ? 'border-warning-mark/50 bg-warning-soft' : 'border-line bg-surface hover:border-line-strong hover:bg-canvas',
                )}
              >
                <Avatar name={s.fullName} size="sm" />
                <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', mark === 'absent' ? 'text-danger' : 'text-ink')}>{s.fullName}</span>
                {mark === 'absent' && <span className="text-xs font-semibold text-danger">Absent</span>}
                {mark === 'late' && <span className="text-xs font-semibold text-warning">Late</span>}
                {grade ? (
                  <GradeChip grade={grade} />
                ) : (
                  mark !== 'absent' && (
                    <span className="flex size-8 items-center justify-center rounded-lg bg-success-soft text-success">
                      <Check aria-hidden className="size-4" />
                    </span>
                  )
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="sticky -bottom-5 -mx-5 -mb-5 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-canvas px-5 py-3">
        <p className="num text-sm text-ink-muted" aria-live="polite">
          <span className="font-semibold text-ink">{students.length - absent}</span> present
          {late > 0 && ` (${late} late)`} · <span className={cn('font-semibold', absent ? 'text-danger' : 'text-ink')}>{absent}</span> absent ·{' '}
          <span className="font-semibold text-ink">{graded}</span> graded
        </p>
        <div className="flex gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            {existing ? 'Save changes' : 'Save lesson'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ToolButton({
  active,
  onClick,
  children,
  shortcut,
  label,
  className,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  shortcut: string
  label?: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      data-active={active}
      title={`${label ?? ''} (key ${shortcut})`.trim()}
      onClick={onClick}
      className={cn(
        'inline-flex h-11 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium transition-colors',
        active ? 'border-transparent shadow-sm ring-2 ring-ink/80 ring-offset-2' : 'border-line-strong bg-surface text-ink hover:bg-subtle',
        className,
      )}
    >
      {children}
    </button>
  )
}
