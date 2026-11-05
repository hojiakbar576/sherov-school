import { useMemo } from 'react'
import { useSchool } from '../data/school-context'
import { attentionItems, type AttentionItem, type AttentionKind } from '../lib/metrics'
import { tr } from '../i18n'

export const attentionLabel: Record<AttentionKind, string> = {
  overdue: tr("Tuition overdue"),
  absences: tr("Repeated absences"),
  capacity: tr("Group almost full"),
  attendance_missing: tr("Attendance missing"),
  teacher_away: tr("Group without a teacher"),
  trial_today: tr("Trial lesson today"),
  trial_result: tr("Trial result missing"),
  lead_new: tr("New enquiry"),
}

/** Where to go to resolve an item. */
export function attentionLink(item: AttentionItem): string {
  switch (item.kind) {
    case 'overdue':
    case 'absences':
      return `/students/${item.studentId}`
    case 'capacity':
    case 'teacher_away':
      return `/groups?q=${encodeURIComponent(item.title)}`
    case 'trial_today':
    case 'trial_result':
    case 'lead_new':
      return `/leads/${item.leadId}`
    case 'attendance_missing':
      return `/attendance?group=${item.groupId}&date=${item.date}`
  }
}

/** Everything that currently needs the administrator's attention. */
export function useAttention(): AttentionItem[] {
  const { data, now, balances } = useSchool()
  return useMemo(() => attentionItems(data, now, balances), [data, now, balances])
}
