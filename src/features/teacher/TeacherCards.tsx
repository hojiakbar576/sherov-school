import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Eye, EyeOff, Medal, Trophy, Wallet } from 'lucide-react'
import type { TeacherView } from '../../data/school-context'
import { BONUS_PLACES, RATING_PART_LABEL, RATING_PARTS, RATING_WEIGHTS, type TeacherRating } from '../../lib/rating'
import { formatMonth, formatPercent } from '../../lib/format'
import { cn } from '../../lib/cn'
import { formatSum, myRating, useSalaryHidden } from './teacher-view'
import { tr } from '../../i18n'

export function Money({ amount, hidden, className }: { amount: number; hidden: boolean; className?: string }) {
  return hidden ? (
    <span className={cn('tracking-[0.2em]', className)} aria-label={tr("Hidden")}>
      *****
    </span>
  ) : (
    <span className={cn('num', className)}>
      {formatSum(amount)} <span className="text-[0.6em] font-medium text-ink-muted">{tr("so‘m")}</span>
    </span>
  )
}

export function EyeToggle({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={hidden ? tr("Show amounts") : tr("Hide amounts")}
      title={hidden ? tr("Show amounts") : tr("Hide amounts")}
      className="inline-flex size-9 items-center justify-center rounded-xl text-ink-muted hover:bg-subtle hover:text-ink"
    >
      {hidden ? <Eye className="size-[18px]" /> : <EyeOff className="size-[18px]" />}
    </button>
  )
}

function BigCard({ children, icon, tint }: { children: ReactNode; icon: ReactNode; tint: string }) {
  return (
    <section className="relative flex min-h-40 items-center overflow-hidden rounded-3xl border border-line bg-surface px-6 py-5 sm:px-8">
      <div className="relative z-10 min-w-0 flex-1">{children}</div>
      <div aria-hidden className={cn('ml-4 hidden size-24 shrink-0 items-center justify-center rounded-[1.75rem] sm:flex', tint)}>
        {icon}
      </div>
    </section>
  )
}

export function RatingCard({ view }: { view: TeacherView }) {
  const { mine, total, month } = myRating(view)
  const bonus = mine && mine.rank <= BONUS_PLACES
  return (
    <BigCard tint="bg-accent-soft text-accent" icon={<Trophy className="size-12" strokeWidth={1.6} />}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-ink-muted">{tr("Rating")}</h2>
        <span className="rounded-full bg-info-soft px-2 py-0.5 text-2xs font-semibold tracking-wide text-info uppercase">{formatMonth(month)}</span>
      </div>
      {mine ? (
        <>
          <p className="num mt-2 text-[2rem] leading-none font-semibold text-ink">
            #{mine.rank} <span className="text-base font-medium text-ink-muted">{tr("of")}{' '}{total}{' '}{tr("teachers")}</span>
          </p>
          <p className="num mt-2 text-sm text-ink-muted">
            {tr("Score")}{' '}{mine.score}/100
            {bonus ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-ink">
                <Medal aria-hidden className="size-3.5" />{' '}{tr("Top")}{' '}{BONUS_PLACES}{tr(": bonus place")}
              </span>
            ) : null}
          </p>
        </>
      ) : (
        <p className="mt-2 text-ink-muted">{tr("No rating yet this month.")}</p>
      )}
      <Link to="/teacher/statistics#rating" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
        {tr("How it’s counted")}
      </Link>
    </BigCard>
  )
}

export function SalaryCard({ view }: { view: TeacherView }) {
  const [hidden, toggle] = useSalaryHidden()
  const current = view.salary[0]
  return (
    <BigCard tint="bg-brand-soft text-brand" icon={<Wallet className="size-12" strokeWidth={1.6} />}>
      <div className="flex items-center gap-1">
        <h2 className="text-ink-muted">{tr("Salary ·")}{' '}{formatMonth(current.month)}</h2>
        <EyeToggle hidden={hidden} onToggle={toggle} />
      </div>
      <p className="mt-1 text-[2rem] leading-none font-semibold text-ink">
        <Money amount={current.amount} hidden={hidden} />
      </p>
      <p className="num mt-2 text-sm text-ink-muted">
        {current.percent}{tr("% of tuition paid so far ·")}{' '}{current.lines.length}{' '}{tr("students paid")}
      </p>
      <Link to="/teacher/statistics#salary" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
        {tr("See the breakdown")}
      </Link>
    </BigCard>
  )
}

/** Bars for each part of the score, with its weight. */
export function ScoreBreakdown({ rating }: { rating: TeacherRating }) {
  return (
    <ul className="space-y-4">
      {RATING_PARTS.map((part) => {
        const value = rating.parts[part]
        return (
          <li key={part}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-ink">
                {RATING_PART_LABEL[part].title} <span className="font-normal text-ink-faint">· {RATING_WEIGHTS[part]}{' '}{tr("pts")}</span>
              </p>
              <p className="num text-sm font-semibold text-ink">{value === null ? tr("Not counted") : formatPercent(value)}</p>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-subtle" role="presentation">
              <div className={cn('h-full rounded-full', value !== null && value < 0.7 ? 'bg-warning-mark' : 'bg-brand')} style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-muted">{RATING_PART_LABEL[part].detail}</p>
          </li>
        )
      })}
    </ul>
  )
}

/** Every teacher's place and score. Only the score is shown for colleagues. */
export function Leaderboard({ rows, meId }: { rows: TeacherRating[]; meId: string }) {
  return (
    <ol className="divide-y divide-line">
      {rows.map((r) => {
        const me = r.teacherId === meId
        const top = r.rank <= BONUS_PLACES
        return (
          <li key={r.teacherId} className={cn('flex items-center gap-3 px-5 py-3', me && 'bg-brand-soft')}>
            <span
              className={cn(
                'num flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                r.rank === 1 ? 'bg-accent text-white' : top ? 'bg-accent-soft text-accent-ink' : 'bg-subtle text-ink-muted',
              )}
            >
              {r.rank}
            </span>
            <span className={cn('min-w-0 flex-1 truncate text-sm', me ? 'font-semibold text-brand-ink' : 'text-ink')}>
              {r.teacherName}
              {me && tr(" (you)")}
            </span>
            {top && <Medal aria-label={tr("Bonus place")} className="size-4 text-accent" />}
            <span className="num w-10 text-right font-semibold text-ink">{r.score}</span>
          </li>
        )
      })}
    </ol>
  )
}
