import { useMemo } from 'react'
import { Link } from 'react-router'
import { Bell, CalendarX2, Clock, UsersRound, Wallet, type LucideIcon } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { attentionLabel, attentionLink, useAttention } from '../../hooks/useAttention'
import type { AttentionItem, AttentionKind } from '../../lib/metrics'
import { notificationIcon, notificationKindLabel, teacherNotifications } from '../../lib/notifications'
import { cn } from '../../lib/cn'
import { Popover } from '../ui/Popover'

const attentionIcon: Record<AttentionKind, LucideIcon> = {
  attendance_missing: CalendarX2,
  overdue: Wallet,
  absences: Clock,
  capacity: UsersRound,
}

/** One row in the menu, whatever produced it. */
interface MenuItem {
  id: string
  icon: LucideIcon
  label: string
  title: string
  detail: string
  to: string
}

/** Administrators: generated from the same "needs attention" rules as the dashboard. */
function pickAttention(items: AttentionItem[]): MenuItem[] {
  const take = (kind: AttentionKind, n: number) => items.filter((i) => i.kind === kind).slice(0, n)
  return [...take('attendance_missing', 3), ...take('absences', 2), ...take('capacity', 2), ...take('overdue', 3)].map((item) => ({
    id: item.id,
    icon: attentionIcon[item.kind],
    label: attentionLabel[item.kind],
    title: item.title,
    detail: item.reason,
    to: attentionLink(item),
  }))
}

export function NotificationsMenu() {
  const { user } = useSchool()
  return user?.role === 'teacher' ? <TeacherNotificationsMenu /> : <AdminNotificationsMenu />
}

function AdminNotificationsMenu() {
  const attention = useAttention()
  const items = useMemo(() => pickAttention(attention), [attention])
  return <Menu items={items} empty="Nothing needs your attention right now." />
}

function TeacherNotificationsMenu() {
  const { data, now } = useSchool()
  const items = useMemo<MenuItem[]>(
    () =>
      teacherNotifications(data, now)
        .slice(0, 8)
        .map((n) => ({
          id: n.id,
          icon: notificationIcon[n.kind],
          label: notificationKindLabel[n.kind],
          title: n.title,
          detail: n.body,
          to: n.link ?? '/teacher/notifications',
        })),
    [data, now],
  )
  return <Menu items={items} empty="No notifications yet." footerLink="/teacher/notifications" />
}

function Menu({ items, empty, footerLink }: { items: MenuItem[]; empty: string; footerLink?: string }) {
  const { data, user, actions } = useSchool()
  const read = new Set(user ? data.notificationReads[user.id] : [])
  const unread = items.filter((n) => !read.has(n.id))

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
              onClick={() => actions.markNotificationsRead(items.map((n) => n.id))}
              className="text-xs font-medium text-brand hover:underline disabled:text-ink-faint disabled:no-underline"
            >
              Mark all as read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">{empty}</p>
          ) : (
            <ul className="max-h-[min(28rem,70vh)] divide-y divide-line overflow-y-auto">
              {items.map((item) => {
                const Icon = item.icon
                const isUnread = !read.has(item.id)
                return (
                  <li key={item.id}>
                    <Link
                      to={item.to}
                      onClick={() => {
                        actions.markNotificationsRead([item.id])
                        close()
                      }}
                      className="flex gap-3 px-4 py-3 hover:bg-subtle"
                    >
                      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-faint" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-ink-muted">{item.label}</span>
                        <span className={cn('block truncate text-sm', isUnread ? 'font-semibold text-ink' : 'text-ink')}>{item.title}</span>
                        <span className="line-clamp-2 block text-xs text-ink-muted">{item.detail}</span>
                      </span>
                      {isUnread && <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          {footerLink ? (
            <Link to={footerLink} onClick={close} className="block border-t border-line px-4 py-2.5 text-xs font-medium text-brand hover:bg-subtle">
              See all notifications
            </Link>
          ) : (
            <p className="border-t border-line px-4 py-2.5 text-xs text-ink-muted">Generated from the demo data in this browser.</p>
          )}
        </>
      )}
    </Popover>
  )
}
