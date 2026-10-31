import { useMemo } from 'react'
import { Link } from 'react-router'
import { BellOff } from 'lucide-react'
import type { NotificationKind } from '../../types'
import { useSchool, useUser } from '../../data/school-context'
import { useListParams } from '../../hooks/useListParams'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { RangeToggle } from '../../components/ui/RangeToggle'
import { EmptyState } from '../../components/ui/misc'
import { formatRelative } from '../../lib/format'
import { notificationIcon, notificationKindLabel, teacherNotifications } from '../../lib/notifications'
import { cn } from '../../lib/cn'

const FILTERS = ['kind', 'show'] as const
const KINDS: NotificationKind[] = ['schedule', 'announcement', 'homework', 'admin']

export function NotificationsPage() {
  const { data, now, actions } = useSchool()
  const user = useUser()
  const { values, set } = useListParams(FILTERS)
  const all = useMemo(() => teacherNotifications(data, now), [data, now])
  const read = new Set(data.notificationReads[user.id])
  const unreadIds = all.filter((n) => !read.has(n.id)).map((n) => n.id)
  const shown = all.filter((n) => (!values.kind || n.kind === values.kind) && (values.show !== 'unread' || !read.has(n.id)))

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Schedule changes, announcements, homework deadlines and messages from your administrator."
        actions={
          <Button onClick={() => actions.markNotificationsRead(unreadIds)} disabled={unreadIds.length === 0}>
            Mark all as read
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <RangeToggle
          label="Show"
          value={values.show === 'unread' ? 'unread' : 'all'}
          onChange={(v) => set('show', v === 'all' ? '' : v)}
          options={[
            { value: 'all', label: `All (${all.length})` },
            { value: 'unread', label: `Unread (${unreadIds.length})` },
          ]}
        />
        <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-1.5">
          {KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={values.kind === kind}
              onClick={() => set('kind', values.kind === kind ? '' : kind)}
              className={cn(
                'h-7 rounded-full border px-3 text-xs font-medium',
                values.kind === kind ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line-strong bg-surface text-ink-muted hover:text-ink',
              )}
            >
              {notificationKindLabel[kind]}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-panel border border-line bg-surface">
        {shown.length === 0 ? (
          <EmptyState icon={BellOff} title="Nothing here">
            {values.show === 'unread' ? 'You’ve read everything.' : 'No notifications of this type.'}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((n) => {
              const Icon = notificationIcon[n.kind]
              const isUnread = !read.has(n.id)
              return (
                <li key={n.id} className={cn('flex gap-4 px-5 py-4', isUnread && 'bg-brand-soft/30')}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-ink-muted">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink-muted">
                      {notificationKindLabel[n.kind]} · {formatRelative(n.createdAt, now)}
                    </p>
                    <h2 className={cn('text-sm text-ink', isUnread ? 'font-semibold' : 'font-medium')}>
                      {isUnread && <span className="sr-only">Unread: </span>}
                      {n.title}
                    </h2>
                    <p className="mt-0.5 max-w-[70ch] text-sm text-ink-muted">{n.body}</p>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm">
                      {n.link && (
                        <Link to={n.link} onClick={() => actions.markNotificationsRead([n.id])} className="font-medium text-brand hover:underline">
                          Open
                        </Link>
                      )}
                      {isUnread && (
                        <button type="button" onClick={() => actions.markNotificationsRead([n.id])} className="font-medium text-ink-muted hover:text-ink">
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
