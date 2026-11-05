// A teacher's notification list: stored messages from the administration
// plus reminders worked out from their own homework and attendance.

import { CalendarClock, Megaphone, MessageSquare, NotebookPen, type LucideIcon } from 'lucide-react'
import type { NotificationKind, SchoolData } from '../types'
import { addDays, atTime, toISODate } from './dates'
import { formatDayShort } from './format'
import { sessionsOn } from './metrics'
import { tr } from '../i18n'

export interface PortalNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  createdAt: string
  link?: string
}

export const notificationKindLabel: Record<NotificationKind, string> = {
  schedule: tr("Schedule change"),
  announcement: tr("Announcement"),
  homework: tr("Homework deadline"),
  admin: tr("From the administration"),
}

export const notificationIcon: Record<NotificationKind, LucideIcon> = {
  schedule: CalendarClock,
  announcement: Megaphone,
  homework: NotebookPen,
  admin: MessageSquare,
}

/** `data` must already be scoped to the teacher (see lib/scope.ts). */
export function teacherNotifications(data: SchoolData, now: Date): PortalNotification[] {
  const today = toISODate(now)
  const tomorrow = toISODate(addDays(now, 1))
  const groupName = new Map(data.groups.map((g) => [g.id, g.name]))
  const notBefore = (moment: Date) => (moment > now ? now : moment).toISOString()
  const items: PortalNotification[] = data.notifications.map((n) => ({ ...n }))

  for (const hw of data.homework) {
    if (hw.dueDate !== today && hw.dueDate !== tomorrow) continue
    items.push({
      id: `hw-due:${hw.id}:${hw.dueDate}`,
      kind: 'homework',
      title: tr("“{0}” is due {1}", hw.title, hw.dueDate === today ? 'today' : 'tomorrow'),
      body: tr("{0}. Remind students in class.", groupName.get(hw.groupId) ?? 'Your group'),
      createdAt: notBefore(atTime(today, '07:00')),
      link: `/teacher/homework?group=${hw.groupId}`,
    })
  }

  // Classes from the last week that ended without attendance.
  for (let i = 0; i < 7; i++) {
    const date = toISODate(addDays(now, -i))
    for (const session of sessionsOn(data, date, now)) {
      if (session.status !== 'not_recorded') continue
      items.push({
        id: `att-missing:${session.group.id}:${date}`,
        kind: 'admin',
        title: tr("Attendance not recorded"),
        body: tr("{0}, {1} at {2}. Please record it.", session.group.name, formatDayShort(atTime(date, session.start)), session.start),
        createdAt: notBefore(atTime(date, session.end)),
        link: `/teacher/attendance?group=${session.group.id}&date=${date}`,
      })
    }
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
