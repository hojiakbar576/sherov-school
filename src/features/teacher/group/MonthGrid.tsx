import type { AttendanceRecord, Group, ISODate, Student } from '../../../types'
import { parseISODate } from '../../../lib/dates'
import { formatPercent, shortWeekday } from '../../../lib/format'
import { summarizeMarks } from '../../../lib/metrics'
import { cn } from '../../../lib/cn'
import { Avatar } from '../../../components/ui/misc'
import { averageGrade } from '../teacher-metrics'
import { GradeChip, MarkChip } from './GradeChip'
import { formatAverage } from './grade-style'
import { tr } from '../../../i18n'


interface Props {
  group: Group
  mode: 'attendance' | 'grades'
  dates: ISODate[]
  students: Student[]
  records: AttendanceRecord[]
  today: ISODate
  onOpenLesson: (date: ISODate) => void
}

/**
 * The month at a glance, like LC UP's journal: students down the side, lesson
 * days across. Click a day to mark or change that lesson.
 */
export function MonthGrid({ mode, dates, students, records, today, onOpenLesson }: Props) {
  const byDate = new Map(records.map((r) => [r.date, r]))

  return (
    <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 min-w-52 border-b border-line bg-surface px-4 py-3 text-left text-xs font-medium text-ink-muted">
              {tr("Students")}
            </th>
            {dates.map((date) => {
              const d = parseISODate(date)
              const record = byDate.get(date)
              const future = date > today
              const missing = !future && !record
              return (
                <th key={date} scope="col" className="border-b border-line px-1 py-2 text-center font-normal">
                  <button
                    type="button"
                    disabled={future}
                    onClick={() => onOpenLesson(date)}
                    title={future ? tr("Not yet") : record ? tr("Open this lesson") : tr("Mark this lesson")}
                    className={cn(
                      'mx-auto flex w-11 flex-col items-center rounded-lg py-1 leading-tight transition-colors',
                      date === today && 'bg-brand text-white',
                      date !== today && !future && 'hover:bg-subtle',
                      future && 'cursor-default text-ink-faint',
                    )}
                  >
                    <span className="num text-sm font-semibold">{String(d.getDate()).padStart(2, '0')}</span>
                    <span className={cn('text-2xs', date === today ? 'text-white/80' : 'text-ink-muted')}>{shortWeekday(d.getDay())}</span>
                    <span aria-hidden className={cn('mt-0.5 size-1.5 rounded-full', missing ? 'bg-danger-mark' : 'bg-transparent')} />
                  </button>
                </th>
              )
            })}
            <th scope="col" className="border-b border-l border-line px-3 py-3 text-center text-xs font-medium whitespace-nowrap text-ink-muted">
              {mode === 'attendance' ? tr("Came") : tr("Average")}
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => {
            const own = records.filter((r) => r.marks[s.id])
            const summary = summarizeMarks(own.map((r) => ({ ...r, marks: { [s.id]: r.marks[s.id] } })))
            const avg = averageGrade(own, s.id)
            const last = i === students.length - 1
            return (
              <tr key={s.id} className="group">
                <th scope="row" className={cn('sticky left-0 z-10 bg-surface px-4 py-2 text-left font-medium group-hover:bg-canvas', !last && 'border-b border-divider')}>
                  <span className="flex items-center gap-2.5">
                    <Avatar name={s.fullName} size="sm" />
                    <span className="truncate">{s.fullName}</span>
                  </span>
                </th>
                {dates.map((date) => {
                  const record = byDate.get(date)
                  const mark = record?.marks[s.id]
                  const grade = record?.grades?.[s.id]
                  return (
                    <td key={date} className={cn('px-1 py-2 text-center group-hover:bg-canvas', !last && 'border-b border-divider')}>
                      {mode === 'attendance' ? (
                        mark ? <MarkChip mark={mark} /> : <Empty future={date > today} />
                      ) : grade ? (
                        <GradeChip grade={grade} size="sm" />
                      ) : mark === 'absent' ? (
                        <span title={tr("Absent")} className="text-xs font-medium text-danger">
                          {tr("abs")}
                        </span>
                      ) : (
                        <Empty future={date > today} />
                      )}
                    </td>
                  )
                })}
                <td className={cn('num border-l border-line px-3 py-2 text-center font-semibold group-hover:bg-canvas', !last && 'border-b border-b-divider')}>
                  {mode === 'attendance' ? (summary.rate === null ? '—' : formatPercent(summary.rate)) : formatAverage(avg)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Empty({ future }: { future: boolean }) {
  return <span aria-hidden className={cn('mx-auto block size-7 rounded-lg', future ? 'bg-canvas' : 'border border-dashed border-line-strong')} />
}
