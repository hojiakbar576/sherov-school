import { Banknote, ClipboardCheck, GraduationCap, Settings, UserMinus, UserPen, UserPlus, UsersRound, type LucideIcon } from 'lucide-react'
import { Panel } from '../../components/ui/Panel'
import { EmptyState } from '../../components/ui/misc'
import type { Activity, ActivityType } from '../../types'
import { formatRelative } from '../../lib/format'

const icons: Record<ActivityType, LucideIcon> = {
  student_added: UserPlus,
  student_updated: UserPen,
  student_removed: UserMinus,
  payment_recorded: Banknote,
  attendance_saved: ClipboardCheck,
  group_changed: UsersRound,
  teacher_changed: GraduationCap,
  settings_changed: Settings,
}

export function RecentActivity({ activity, now }: { activity: Activity[]; now: Date }) {
  const items = activity.slice(0, 8)
  return (
    <Panel id="recent-activity" title="Recent activity" description="Changes made in this browser, newest first">
      {items.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No activity yet">
          Adding students, recording payments and taking attendance will appear here.
        </EmptyState>
      ) : (
        <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-line">
          {items.map((item) => {
            const Icon = icons[item.type] ?? ClipboardCheck
            return (
              <li key={item.id} className="relative flex gap-3">
                <span aria-hidden className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-muted">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <time dateTime={item.at} className="text-xs whitespace-nowrap text-ink-muted">
                      {formatRelative(item.at, now)}
                    </time>
                  </div>
                  <p className="text-sm text-ink-muted">{item.detail}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}
