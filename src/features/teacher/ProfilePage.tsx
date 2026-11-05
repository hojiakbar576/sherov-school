import { useSearchParams } from 'react-router'
import { History, UserRound } from 'lucide-react'
import { useSchool, useUser } from '../../data/school-context'
import { formatDate, formatMonth, initials } from '../../lib/format'
import { cn } from '../../lib/cn'
import { EyeToggle, Money } from './TeacherCards'
import { useSalaryHidden } from './teacher-view'
import { tr } from '../../i18n'

const SECTIONS = [
  { id: 'personal', label: tr("Personal details"), icon: UserRound },
  { id: 'salary', label: tr("Salary history"), icon: History },
] as const

/** LC UP-style profile: personal details, and salary month by month. */
export function ProfilePage() {
  const { teacherView: view, branch } = useSchool()
  const user = useUser()
  const [params, setParams] = useSearchParams()
  const section = params.get('section') === 'salary' ? 'salary' : 'personal'
  const [hidden, toggle] = useSalaryHidden()
  if (!view) return null
  const t = view.teacher

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[16rem_1fr]">
      <nav aria-label={tr("Profile sections")} className="rounded-3xl border border-line bg-surface p-3">
        <ul className="space-y-1">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                aria-current={section === id ? 'page' : undefined}
                onClick={() => setParams(id === 'personal' ? {} : { section: id }, { replace: true })}
                className={cn(
                  'flex h-12 w-full items-center gap-3 rounded-xl px-4 text-left text-sm font-medium',
                  section === id ? 'bg-brand text-white' : 'text-ink-muted hover:bg-subtle hover:text-ink',
                )}
              >
                <Icon aria-hidden className="size-5" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {section === 'personal' ? (
        <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <h1 className="text-2xl font-semibold text-ink">{tr("Personal details")}</h1>
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <span aria-hidden className="flex size-24 items-center justify-center rounded-3xl bg-brand-soft text-2xl font-semibold text-brand-ink">
              {initials(user.fullName)}
            </span>
            <div>
              <p className="text-xl font-semibold text-ink">{t.fullName}</p>
              <p className="text-ink-muted">
                {t.subject}{' '}{tr("teacher")}{branch && tr(", {0} branch", branch.name)}
              </p>
            </div>
          </div>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              [tr("Phone number"), t.phone],
              [tr("Email"), t.email],
              [tr("Username"), user.username],
              [tr("Teaching here since"), formatDate(t.joinedOn)],
              [tr("Salary share"), tr("{0}% of paid tuition", t.salaryPercent)],
              [tr("Status"), t.status === 'active' ? tr("Active") : tr("On leave")],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-canvas px-5 py-4">
                <dt className="text-sm text-ink-muted">{label}</dt>
                <dd className="mt-1 font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm text-ink-muted">{tr("To change any of these, ask your branch administrator.")}</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-line bg-surface">
          <header className="flex items-center justify-between gap-3 px-6 py-5">
            <h1 className="text-2xl font-semibold text-ink">{tr("Salary history")}</h1>
            <EyeToggle hidden={hidden} onToggle={toggle} />
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-y border-line bg-canvas text-left text-ink-muted">
                <tr>
                  <th scope="col" className="px-6 py-3 font-medium">{tr("Month")}</th>
                  <th scope="col" className="px-6 py-3 text-right font-medium">{tr("Students paid")}</th>
                  <th scope="col" className="px-6 py-3 text-right font-medium">{tr("Tuition paid")}</th>
                  <th scope="col" className="px-6 py-3 text-right font-medium">{tr("Share")}</th>
                  <th scope="col" className="px-6 py-3 text-right font-medium">{tr("Salary")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {view.salary.map((s, i) => (
                  <tr key={s.month}>
                    <td className="px-6 py-4 font-medium text-ink">
                      {formatMonth(s.month)}
                      {i === 0 && (
                        <span className="ml-2 rounded-full bg-info-soft px-2 py-0.5 text-2xs font-semibold text-info">{tr("So far")}</span>
                      )}
                    </td>
                    <td className="num px-6 py-4 text-right">{s.lines.length}</td>
                    <td className="px-6 py-4 text-right text-ink-muted">
                      <Money amount={s.collected} hidden={hidden} />
                    </td>
                    <td className="num px-6 py-4 text-right">{s.percent}%</td>
                    <td className="px-6 py-4 text-right font-semibold text-ink">
                      <Money amount={s.amount} hidden={hidden} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-6 py-4 text-xs text-ink-muted">
            {tr("Worked out from the tuition your current students paid for each month. Payouts themselves aren’t recorded here yet.")}
          </p>
        </section>
      )}
    </div>
  )
}
