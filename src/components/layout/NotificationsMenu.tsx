import { useMemo } from 'react'
import { Link } from 'react-router'
import { Bell, CalendarX2, Clock, UsersRound, Wallet, type LucideIcon } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { attentionLabel, attentionLink, useAttention } from '../../hooks/useAttention'
import type { AttentionItem, AttentionKind } from '../../lib/metrics'
import { cn } from '../../lib/cn'
import { Popover } from '../ui/Popover'

const kindIcon: Record<AttentionKind, LucideIcon> = {
  attendance_missing: CalendarX2,
  overdue: Wallet,
  absences: Clock,
  capacity: UsersRound,
}

/** Notifications are generated from the same "needs attention" rules as the dashboard. */
function pickNotifications(items: AttentionItem[]): AttentionItem[] {
  const take = (kind: AttentionKind, n: number) => items.filter((i) => i.kind === kind).slice(0, n)
  return [...take('attendance_missing', 3), ...take('absences', 2), ...take('capacity', 2), ...take('overdue', 3)]
}

export function NotificationsMenu() {
  const { data, actions } = useSchool()
  const items = useAttention()
  const notifications = useMemo(() => pickNotifications(items), [items])
  const read = new Set(data.readNotificationIds)
  const unread = notifications.filter((n) => !read.has(n.id))

  return (
    <Popover
      label="Notifications"
      className="w-[min(24rem,calc(100vw-2rem))]"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={unread.length ? `Notifications, ${unread.length} unread` : 'Notifications'}
          className="relative inline-flex size-10 items-center justify-center rounded-control text-ink-muted hover:bg-subtle hover:text-ink"
        >
          <Bell className="size-[18px]" />
          {unread.length > 0 && (
            <span aria-hidden className="num absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {unread.length}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <button
              type="button"
              disabled={unread.length === 0}
              onClick={() => actions.markNotificationsRead(notifications.map((n) => n.id))}
              className="text-xs font-medium text-accent hover:underline disabled:text-ink-faint disabled:no-underline"
            >
              Mark all as read
            </button>
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">Nothing needs your attention right now.</p>
          ) : (
            <ul className="max-h-[min(28rem,70vh)] divide-y divide-line overflow-y-auto">
              {notifications.map((item) => {
                const Icon = kindIcon[item.kind]
                const isUnread = !read.has(item.id)
                return (
                  <li key={item.id}>
                    <Link
                      to={attentionLink(item)}
                      onClick={() => {
                        actions.markNotificationsRead([item.id])
                        close()
                      }}
                      className="flex gap-3 px-4 py-3 hover:bg-subtle"
                    >
                      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-faint" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-ink-muted">{attentionLabel[item.kind]}</span>
                        <span className={cn('block truncate text-sm', isUnread ? 'font-semibold text-ink' : 'text-ink')}>{item.title}</span>
                        <span className="block text-xs text-ink-muted">{item.reason}</span>
                      </span>
                      {isUnread && <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="border-t border-line px-4 py-2.5 text-xs text-ink-muted">Generated from the demo data in this browser.</p>
        </>
      )}
    </Popover>
  )
}
