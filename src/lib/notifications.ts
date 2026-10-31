// A teacher's notification list: stored messages from the administration
// plus reminders worked out from their own homework and attendance.

import { CalendarClock, Megaphone, MessageSquare, NotebookPen, type LucideIcon } from 'lucide-react'
import type { NotificationKind, SchoolData } from '../types'
import { addDays, atTime, toISODate } from './dates'
import { formatDayShort } from './format'
import { sessionsOn } from './metrics'

export interface PortalNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  createdAt: string
  link?: string
}

export const notificationKindLabel: Record<NotificationKind, string> = {
  schedule: 'Schedule change',
  announcement: 'Announcement',
  homework: 'Homework deadline',
  admin: 'From the administration',
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
      title: `“${hw.title}” is due ${hw.dueDate === today ? 'today' : 'tomorrow'}`,
      body: `${groupName.get(hw.groupId) ?? 'Your group'}. Remind students in class.`,
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
        title: 'Attendance not recorded',
        body: `${session.group.name}, ${formatDayShort(atTime(date, session.start))} at ${session.start}. Please record it.`,
        createdAt: notBefore(atTime(date, session.end)),
        link: `/teacher/attendance?group=${session.group.id}&date=${date}`,
      })
    }
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
