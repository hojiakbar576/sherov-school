import { useState } from 'react'
import { useSchool } from '../../data/school-context'
import { BONUS_PLACES } from '../../lib/rating'
import { formatMonth, formatMonthShort } from '../../lib/format'
import { cn } from '../../lib/cn'
import { EyeToggle, Leaderboard, Money, ScoreBreakdown } from './TeacherCards'
import { myRating, useSalaryHidden } from './teacher-view'
import { tr } from '../../i18n'

/** The teacher's rating (how it's counted, where they stand) and how their salary adds up. */
export function StatisticsPage() {
  const { teacherView: view } = useSchool()
  const [ratingMonth, setRatingMonth] = useState(0)
  const [salaryIndex, setSalaryIndex] = useState(0)
  const [hidden, toggle] = useSalaryHidden()
  if (!view) return null

  const { mine, total, month } = myRating(view, ratingMonth)
  const rows = view.ratings[ratingMonth].rows
  const salary = view.salary[salaryIndex]
  const maxSalary = Math.max(1, ...view.salary.map((s) => s.amount))

  return (
    <div className="space-y-8">
      <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-ink">{tr("Statistics")}</h1>

      {/* ---------------- Rating */}
      <section id="rating" aria-labelledby="rating-title" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="rating-title" className="text-lg font-semibold text-ink">
            {tr("Teacher rating")}
          </h2>
          <Toggle options={view.ratings.map((r, i) => ({ value: i, label: i === 0 ? tr("This month") : formatMonth(r.month) }))} value={ratingMonth} onChange={setRatingMonth} />
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl border border-line bg-surface p-6">
            {mine ? (
              <>
                <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                  <div>
                    <p className="text-sm text-ink-muted">{tr("Your score,")}{' '}{formatMonth(month)}</p>
                    <p className="num text-5xl font-semibold tracking-tight text-ink">
                      {mine.score}
                      <span className="text-xl text-ink-faint">/100</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-ink-muted">{tr("Place")}</p>
                    <p className="num text-3xl font-semibold text-ink">
                      #{mine.rank} <span className="text-base font-normal text-ink-muted">{tr("of")}{' '}{total}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-ink-muted">{tr("Average grade you gave")}</p>
                    <p className="num text-3xl font-semibold text-ink">{mine.averageGrade?.toFixed(1) ?? '—'}</p>
                  </div>
                </div>
                <div className="mt-6 border-t border-line pt-5">
                  <ScoreBreakdown rating={mine} />
                </div>
                <p className="mt-5 rounded-xl bg-canvas px-4 py-3 text-sm text-ink-muted">
                  {tr("The score counts effort you control: saving every lesson, checking homework, grading students, and keeping students coming. How high your grades are doesn’t change it. The top")}{' '}{BONUS_PLACES}{' '}{tr("teachers each month can get a bonus from the owner.")}
                </p>
              </>
            ) : (
              <p className="text-ink-muted">{tr("No rating for this month yet.")}</p>
            )}
          </div>

          <div className="overflow-hidden rounded-3xl border border-line bg-surface">
            <header className="px-5 py-4">
              <h3 className="font-semibold text-ink">{tr("All teachers")}</h3>
              <p className="text-sm text-ink-muted">{tr("Medals mark the top")}{' '}{BONUS_PLACES}{' '}{tr("(bonus places).")}</p>
            </header>
            <div className="border-t border-line">
              <Leaderboard rows={rows} meId={view.teacher.id} />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Salary */}
      <section id="salary" aria-labelledby="salary-title" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <h2 id="salary-title" className="text-lg font-semibold text-ink">
              {tr("Salary")}
            </h2>
            <EyeToggle hidden={hidden} onToggle={toggle} />
          </div>
          <p className="text-sm text-ink-muted">
            {tr("You earn")}{' '}<span className="font-semibold text-ink">{view.teacher.salaryPercent}%</span>{' '}{tr("of the tuition your students pay. Your administrator sets this share.")}
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-surface p-5">
          <p className="mb-3 text-sm text-ink-muted">{tr("Last six months · pick one to see the breakdown")}</p>
          <div className="grid grid-cols-6 items-end gap-2 sm:gap-4" style={{ height: 150 }}>
            {[...view.salary].reverse().map((s) => {
              const index = view.salary.indexOf(s)
              const selected = index === salaryIndex
              return (
                <button
                  key={s.month}
                  type="button"
                  onClick={() => setSalaryIndex(index)}
                  aria-pressed={selected}
                  aria-label={`${formatMonth(s.month)}${hidden ? '' : `: ${s.amount} so‘m`}`}
                  className="group flex h-full flex-col items-center justify-end gap-1.5"
                >
                  <span
                    className={cn('w-full max-w-14 rounded-t-lg transition-colors', selected ? 'bg-brand' : 'bg-brand-muted group-hover:bg-brand/60')}
                    style={{ height: `${Math.max(4, (s.amount / maxSalary) * 110)}px` }}
                  />
                  <span className={cn('text-xs', selected ? 'font-semibold text-ink' : 'text-ink-muted')}>{formatMonthShort(s.month)}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-line bg-surface">
          <header className="grid gap-4 px-6 py-5 sm:grid-cols-3">
            <div>
              <p className="text-sm text-ink-muted">{tr("Salary,")}{' '}{formatMonth(salary.month)}</p>
              <p className="text-2xl font-semibold text-ink">
                <Money amount={salary.amount} hidden={hidden} />
              </p>
              {salaryIndex === 0 && <p className="text-xs text-ink-muted">{tr("So far: grows as more students pay.")}</p>}
            </div>
            <div>
              <p className="text-sm text-ink-muted">{tr("Tuition paid")}</p>
              <p className="text-2xl font-semibold text-ink">
                <Money amount={salary.collected} hidden={hidden} />
              </p>
            </div>
            <div>
              <p className="text-sm text-ink-muted">{tr("Students who paid")}</p>
              <p className="num text-2xl font-semibold text-ink">{salary.lines.length}</p>
            </div>
          </header>
          {salary.groups.length === 0 ? (
            <p className="border-t border-line px-6 py-8 text-center text-sm text-ink-muted">{tr("No tuition paid for this month yet.")}</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {salary.groups.map((g) => (
                <li key={g.groupId}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-4 px-6 py-4 hover:bg-canvas [&::-webkit-details-marker]:hidden">
                      <span aria-hidden className="text-ink-faint transition-transform group-open:rotate-90">
                        ›
                      </span>
                      <span className="min-w-0 flex-1 font-medium text-ink">{g.groupName}</span>
                      <span className="num hidden text-sm text-ink-muted sm:block">{g.students}{' '}{tr("paid")}</span>
                      <span className="hidden w-36 text-right text-sm text-ink-muted sm:block">
                        <Money amount={g.paid} hidden={hidden} />
                      </span>
                      <span className="w-36 text-right font-semibold text-ink">
                        <Money amount={g.share} hidden={hidden} />
                      </span>
                    </summary>
                    <ul className="bg-canvas px-6 pb-3">
                      {salary.lines
                        .filter((l) => l.groupId === g.groupId)
                        .map((l) => (
                          <li key={l.studentId} className="flex items-center gap-4 border-b border-line py-2 pl-6 text-sm last:border-0">
                            <span className="min-w-0 flex-1 truncate text-ink">{l.studentName}</span>
                            <span className="w-36 text-right text-ink-muted">
                              <Money amount={l.paid} hidden={hidden} />
                            </span>
                            <span className="w-36 text-right font-medium text-ink">
                              <Money amount={l.share} hidden={hidden} />
                            </span>
                          </li>
                        ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

function Toggle<T extends number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-2xl border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('h-9 rounded-xl px-4 text-sm font-medium', value === o.value ? 'bg-brand text-white' : 'text-ink hover:bg-subtle')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
