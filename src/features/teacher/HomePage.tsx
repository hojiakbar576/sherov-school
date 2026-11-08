import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowUpRight, CircleAlert, UsersRound } from 'lucide-react'
import { useSchool, useUser } from '../../data/school-context'
import { EmptyState } from '../../components/ui/misc'
import { parseISODate, toISODate } from '../../lib/dates'
import { formatDayMonth, greeting, groupDaysLabel } from '../../lib/format'
import { endTime, meetsOn } from '../../lib/schedule'
import { cn } from '../../lib/cn'
import { RatingCard, SalaryCard } from './TeacherCards'
import { unmarkedLessons } from './teacher-metrics'
import { tr } from '../../i18n'
import { groupIdsOf } from '../../lib/membership'

type Show = 'all' | 'today'

/** LC UP-style home: rating and salary on top, then the teacher's groups. */
export function HomePage() {
  const { data, now, teacherView } = useSchool()
  const user = useUser()
  const navigate = useNavigate()
  const today = toISODate(now)
  const [show, setShow] = useState<Show>(() => (data.groups.some((g) => meetsOn(g, today)) ? 'today' : 'all'))

  const groups = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of data.students) if (s.status === 'active') for (const id of groupIdsOf(s)) counts.set(id, (counts.get(id) ?? 0) + 1)
    return data.groups
      .filter((g) => g.status === 'active')
      .map((g) => ({
        group: g,
        students: counts.get(g.id) ?? 0,
        today: meetsOn(g, today),
        saved: data.attendance.some((r) => r.groupId === g.id && r.date === today),
        pending: unmarkedLessons(g, data.attendance, now),
      }))
      .sort((a, b) => a.group.startTime.localeCompare(b.group.startTime))
  }, [data, today, now])

  const pending = groups.flatMap((g) => g.pending.map((date) => ({ group: g.group, date })))
  const shown = show === 'today' ? groups.filter((g) => g.today) : groups

  return (
    <div className="space-y-6">
      <h1 className="sr-only">{tr("Home")}</h1>
      <p className="text-ink-muted">
        {greeting(now)}, <span className="font-medium text-ink">{user.fullName.split(' ')[0]}</span>
      </p>

      {teacherView && (
        <div className="grid gap-4 lg:grid-cols-2">
          <RatingCard view={teacherView} />
          <SalaryCard view={teacherView} />
        </div>
      )}

      {pending.length > 0 && (
        <div role="status" className="rounded-2xl border border-warning-mark/40 bg-warning-soft px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <CircleAlert aria-hidden className="size-5 text-warning" />
            {pending.length === 1 ? tr("One lesson still needs attendance") : tr("{0} lessons still need attendance", pending.length)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pending.slice(0, 6).map(({ group, date }) => (
              <Link
                key={`${group.id}-${date}`}
                to={`/teacher/groups/${group.id}?lesson=${date}`}
                className="rounded-lg border border-warning-mark/50 bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas"
              >
                {group.name} · {formatDayMonth(parseISODate(date))}
              </Link>
            ))}
          </div>
        </div>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-ink">{tr("Groups")}</h2>
          <div role="tablist" aria-label={tr("Which groups")} className="inline-flex rounded-2xl border border-line bg-surface p-1">
            {(['all', 'today'] as Show[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={show === v}
                onClick={() => setShow(v)}
                className={cn('h-10 rounded-xl px-5 text-sm font-medium', show === v ? 'bg-brand text-white' : 'text-ink hover:bg-subtle')}
              >
                {v === 'all' ? tr("All") : tr("Today")}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-canvas p-2 sm:p-3">
          {shown.length === 0 ? (
            <div className="rounded-2xl bg-surface">
              <EmptyState icon={UsersRound} title={show === 'today' ? tr("No lessons today") : tr("No groups yet")}>
                {show === 'today' ? tr("None of your groups meet today.") : tr("Your branch administrator assigns groups.")}
              </EmptyState>
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[2fr_1.4fr_1fr_1fr_1.3fr] gap-4 rounded-2xl bg-surface px-6 py-4 text-sm text-ink-muted md:grid">
                <span>{tr("Group name")}</span>
                <span>{tr("Course")}</span>
                <span className="text-center">{tr("Students")}</span>
                <span className="text-center">{tr("Room")}</span>
                <span className="text-right">{show === 'today' ? tr("Today") : tr("Days and time")}</span>
              </div>
              <ul className="mt-2 space-y-2">
                {shown.map(({ group, students, saved, today: meetsToday }) => (
                  <li key={group.id}>
                    <div
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate(`/teacher/groups/${group.id}`)}
                      onKeyDown={(e) => e.key === 'Enter' && navigate(`/teacher/groups/${group.id}`)}
                      className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-2xl bg-surface px-5 py-4 transition-colors hover:bg-brand-soft/50 md:grid-cols-[2fr_1.4fr_1fr_1fr_1.3fr] md:px-6"
                    >
                      <span className="flex min-w-0 items-center gap-3 font-medium text-ink">
                        <ArrowUpRight aria-hidden className="size-5 shrink-0 text-brand" />
                        <span className="truncate">{group.name}</span>
                      </span>
                      <span className="hidden text-sm text-ink-muted uppercase md:block">{group.subject}</span>
                      <span className="num text-sm text-ink-muted md:text-center md:text-ink">
                        <span className="md:hidden">{students}{' '}{tr("students")}</span>
                        <span className="hidden md:inline">{students}</span>
                      </span>
                      <span className="hidden text-center text-sm md:block">{group.room.replace(/^Room\s*/, '')}</span>
                      <span className="col-span-2 text-sm text-ink-muted md:col-span-1 md:text-right">
                        {show === 'today' && meetsToday ? (
                          <Link
                            to={`/teacher/groups/${group.id}?lesson=${today}`}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              'num inline-flex h-9 items-center rounded-xl px-3 text-sm font-medium',
                              saved ? 'bg-success-soft text-success' : 'bg-brand text-white hover:bg-brand-hover',
                            )}
                          >
                            {saved ? tr("✓ Marked · {0}", group.startTime) : tr("Mark lesson · {0}", group.startTime)}
                          </Link>
                        ) : (
                          <span className="num">
                            {groupDaysLabel(group)}, {group.startTime}–{endTime(group)}
                          </span>
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
