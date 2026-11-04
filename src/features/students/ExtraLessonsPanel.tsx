import { useState, type FormEvent } from 'react'
import { CalendarPlus, Pencil } from 'lucide-react'
import type { ExtraLesson, Student } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Panel } from '../../components/ui/Panel'
import { Button, IconButton } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input, Select } from '../../components/ui/Field'
import { Badge } from '../../components/ui/Badge'
import { isValidISODate, toISODate } from '../../lib/dates'
import { formatDate, formatUZS } from '../../lib/format'

const statusTone = { planned: 'info', done: 'success', cancelled: 'neutral' } as const
const statusLabel = { planned: 'Planned', done: 'Done', cancelled: 'Cancelled' } as const

/** One-to-one or extra lessons outside the group's timetable, with any extra fee. */
export function ExtraLessonsPanel({ student, className }: { student: Student; className?: string }) {
  const { data } = useSchool()
  const [editing, setEditing] = useState<ExtraLesson | 'new' | null>(null)
  const lessons = data.extraLessons.filter((x) => x.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date))
  const teacherName = new Map(data.teachers.map((t) => [t.id, t.fullName]))
  const unpaid = lessons.filter((x) => x.status === 'done' && x.fee > 0 && !x.paid)

  return (
    <Panel
      title="Extra lessons"
      description={unpaid.length ? `${unpaid.length} done but not paid (${formatUZS(unpaid.reduce((s, x) => s + x.fee, 0))})` : 'Lessons outside the group’s timetable.'}
      actions={
        <Button size="sm" onClick={() => setEditing('new')}>
          <CalendarPlus aria-hidden />
          Plan extra lesson
        </Button>
      }
      className={className}
      flush
    >
      {lessons.length === 0 ? (
        <p className="border-t border-line px-5 py-4 text-sm text-ink-muted">No extra lessons.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {lessons.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
              <span className="num w-28 shrink-0 text-ink-muted">
                {formatDate(x.date)}, {x.time}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-ink">{x.topic}</span>
                <span className="block text-xs text-ink-muted">
                  {teacherName.get(x.teacherId) ?? '—'} · {x.durationMinutes} min · {x.fee ? `${formatUZS(x.fee)}${x.paid ? ', paid' : ', not paid'}` : 'no extra fee'}
                </span>
              </span>
              <Badge tone={statusTone[x.status]}>{statusLabel[x.status]}</Badge>
              <IconButton label={`Edit extra lesson on ${formatDate(x.date)}`} onClick={() => setEditing(x)}>
                <Pencil />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Plan an extra lesson' : 'Extra lesson'} description={student.fullName}>
        {editing !== null && <ExtraLessonForm student={student} lesson={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      </Dialog>
    </Panel>
  )
}

function ExtraLessonForm({ student, lesson, onClose }: { student: Student; lesson?: ExtraLesson; onClose: () => void }) {
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const groupTeacher = data.groups.find((g) => g.id === student.groupId)?.teacherId
  const teachers = data.teachers.filter((t) => t.status === 'active' || t.id === lesson?.teacherId)
  const [form, setForm] = useState({
    teacherId: lesson?.teacherId ?? groupTeacher ?? teachers[0]?.id ?? '',
    date: lesson?.date ?? toISODate(now),
    time: lesson?.time ?? '12:00',
    durationMinutes: String(lesson?.durationMinutes ?? 60),
    topic: lesson?.topic ?? '',
    fee: String(lesson?.fee ?? 0),
    status: lesson?.status ?? ('planned' as ExtraLesson['status']),
    paid: lesson?.paid ?? false,
  })
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (form.topic.trim().length < 3) return setError('Say what the lesson is for.')
    if (!isValidISODate(form.date) || !/^\d\d:\d\d$/.test(form.time)) return setError('Choose the date and time.')
    const fee = Number(form.fee)
    if (!Number.isFinite(fee) || fee < 0) return setError('Enter the fee, or 0.')
    const input = { studentId: student.id, teacherId: form.teacherId, date: form.date, time: form.time, durationMinutes: Number(form.durationMinutes), topic: form.topic.trim(), fee: Math.round(fee), status: form.status, paid: fee > 0 && form.paid }
    if (lesson) actions.updateExtraLesson(lesson.id, input)
    else actions.addExtraLesson(input)
    toast.show(lesson ? 'Extra lesson saved.' : 'Extra lesson planned.')
    onClose()
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="What for" error={error || undefined} className="sm:col-span-2">
        {(p) => <Input {...p} autoFocus value={form.topic} maxLength={100} onChange={(e) => set('topic', e.target.value)} placeholder="e.g. Catching up after an absence" />}
      </Field>
      <Field label="Teacher">
        {(p) => (
          <Select {...p} value={form.teacherId} onChange={(e) => set('teacherId', e.target.value)}>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Length">
        {(p) => (
          <Select {...p} value={form.durationMinutes} onChange={(e) => set('durationMinutes', e.target.value)}>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
            <option value="90">90 minutes</option>
          </Select>
        )}
      </Field>
      <Field label="Date">
        {(p) => <Input {...p} type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />}
      </Field>
      <Field label="Time">
        {(p) => <Input {...p} type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />}
      </Field>
      <Field label="Extra fee (UZS)" hint="0 if it’s included in tuition.">
        {(p) => <Input {...p} type="number" inputMode="numeric" min={0} step={10000} value={form.fee} onChange={(e) => set('fee', e.target.value)} />}
      </Field>
      <Field label="Status">
        {(p) => (
          <Select {...p} value={form.status} onChange={(e) => set('status', e.target.value as ExtraLesson['status'])}>
            <option value="planned">Planned</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        )}
      </Field>
      {Number(form.fee) > 0 && (
        <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
          <input type="checkbox" checked={form.paid} onChange={(e) => set('paid', e.target.checked)} className="size-4 accent-[var(--color-brand)]" />
          The fee has been paid
        </label>
      )}
      <div className="flex justify-end gap-2 border-t border-line pt-4 sm:col-span-2">
        {lesson && (
          <Button
            variant="ghost"
            className="mr-auto text-danger hover:bg-danger-soft"
            onClick={() => {
              actions.deleteExtraLesson(lesson.id)
              toast.show('Extra lesson deleted.')
              onClose()
            }}
          >
            Delete
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          Save
        </Button>
      </div>
    </form>
  )
}
