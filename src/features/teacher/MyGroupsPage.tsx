import { useMemo } from 'react'
import { Link } from 'react-router'
import { ChevronRight, UsersRound } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/misc'
import { GroupStatusBadge } from '../../components/StatusBadges'
import { endTime } from '../../lib/schedule'
import { dayPatternLabel, formatPercent } from '../../lib/format'
import { enrolmentByGroup, summarizeMarks } from '../../lib/metrics'
import { rateTone } from './teacher-metrics'
import { cn } from '../../lib/cn'
import { tr } from '../../i18n'

const statusOrder = { active: 0, paused: 1, completed: 2 } as const

export function MyGroupsPage() {
  const { data } = useSchool()
  const enrolment = useMemo(() => enrolmentByGroup(data), [data])
  const branchName = new Map(data.branches.map((b) => [b.id, b.name]))
  const groups = [...data.groups].sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name))

  return (
    <>
      <PageHeader title={tr("My groups")} description={tr("Groups you teach. Open one to see its students, attendance and homework.")} />
      {groups.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface">
          <EmptyState icon={UsersRound} title={tr("No groups yet")}>
            {tr("Your branch administrator assigns groups to teachers.")}
          </EmptyState>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={tr("Your groups")}>
          {groups.map((g) => {
            const students = enrolment.get(g.id) ?? 0
            const rate = summarizeMarks(data.attendance.filter((r) => r.groupId === g.id)).rate
            return (
              <li key={g.id}>
                <Link
                  to={`/teacher/groups/${g.id}`}
                  className="group flex h-full flex-col rounded-panel border border-line bg-surface p-5 hover:border-line-strong"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-ink group-hover:text-brand-ink">{g.name}</h2>
                      <p className="text-sm text-ink-muted">{g.subject}</p>
                    </div>
                    <GroupStatusBadge status={g.status} />
                  </div>
                  <dl className="num mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-ink-muted">{tr("Schedule")}</dt>
                      <dd className="text-ink">{dayPatternLabel[g.days]}</dd>
                      <dd className="text-ink">
                        {g.startTime}–{endTime(g)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-muted">{tr("Room and branch")}</dt>
                      <dd className="text-ink">{g.room}</dd>
                      <dd className="text-ink">{branchName.get(g.branchId) ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-muted">{tr("Students")}</dt>
                      <dd className="text-ink">
                        {students}{' '}{tr("of")}{' '}{g.capacity}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-muted">{tr("Attendance")}</dt>
                      <dd className={cn('font-medium', rateTone(rate))}>{rate === null ? tr("No records") : formatPercent(rate)}</dd>
                    </div>
                  </dl>
                  <span className="mt-4 flex items-center gap-1 border-t border-line pt-3 text-sm font-medium text-brand">
                    {tr("Open group")}
                    <ChevronRight aria-hidden className="size-4" />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
